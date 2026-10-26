import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTournament,applyAction,gameResult,standings,pair,scoringDivisor,activePlayers,rosterChangePreview,swapImpact} from '../src/domain.mjs';
import {validateBackup} from '../src/worker.mjs';
import {ratingRows,ratingTSV} from '../src/sheet-export.mjs';
import {database,Client} from './db-helper.mjs';
const make=(n=8,d=100)=>applyAction(createTournament({id:'feedback',name:'Тест изменений',date:'2026-10-26',scoreDivisor:d}),{type:'register',names:Array.from({length:n},(_,i)=>'Тест Игрок '+(i+1))});
const draw=t=>applyAction(t,{type:'draw'},17);
const score=(t,g,values)=>applyAction(t,{type:'results',round:t.rounds.length,game:g.id,scores:values??g.players.map((_,i)=>1000-i*300)});
const complete=t=>{for(const g of t.rounds.at(-1).games)if(!g.scores)t=score(t,g);return t;};
const amend=(t,action)=>applyAction(t,{type:'amendRoster',scope:'current',confirm:true,...action},17);
test('custom divisors normalize only the raw-score term, including ties, zeros and decimal negatives',()=>{
 const g={players:['a','b','c','d'],scores:[100000,70000,70000,-1025]};
 assert.deepEqual(gameResult(g,200).map(r=>r.place),[1,2.5,2.5,4]);assert.deepEqual(gameResult(g,200).map(r=>r.points),[80000,50000,50000,-512.5]);
 const thirds=gameResult({players:['a','b','c'],scores:[33300,0,-33300]},333);assert.deepEqual(thirds.map(r=>r.points),[40000,20000,0]);
 for(const bad of [0,-1,1.5,'abc','200.5',10001,null,true])assert.throws(()=>scoringDivisor(bad));assert.equal(scoringDivisor({}),100);assert.equal(scoringDivisor('200'),200);
});
test('equivalent 100/200 games produce exactly the same standings and subsequent groups',()=>{
 let a=complete(draw(make(12,100))),b=draw(make(12,200));for(const [i,g]of b.rounds[0].games.entries())b=score(b,g,a.rounds[0].games[i].scores.map(raw=>raw/100*2));
 assert.deepEqual(standings(a).map(p=>[p.id,p.total,p.rank]),standings(b).map(p=>[p.id,p.total,p.rank]));assert.deepEqual(pair(a).games.map(g=>g.players),pair(b).games.map(g=>g.players));
});
test('arbitrary divisors use integer tie/pairing keys even when displayed fractions repeat',()=>{
 for(const d of [1,200,300,333,9999,10000]){const t=make(3,d);t.rounds=[[100,0,-1000],[100,200,-1000],[50,50,-1000]].map((scores,i)=>({number:i+1,games:[{id:`r${i+1}g1`,players:['p1','p2','p3'],scores}]}));const rows=standings(t);assert.equal(rows.find(p=>p.id==='p1').total,rows.find(p=>p.id==='p2').total);assert.equal(rows.find(p=>p.id==='p1').rank,'1–2');assert.ok(rows.every(p=>Number.isSafeInteger(p.pairKey)&&Number.isSafeInteger(p.sortKey)));}
});
test('changing divisor preserves raw first-round scores and explicitly resets dependent rounds',()=>{
 let t=complete(draw(make())),first=structuredClone(t.rounds[0]);t=applyAction(t,{type:'settings',name:t.name,scoreDivisor:200});assert.deepEqual(t.rounds[0],first);assert.equal(standings(t)[0].total,80000);
 t=draw(t);const before=structuredClone(t);assert.throws(()=>applyAction(t,{type:'settings',name:t.name,scoreDivisor:333}),/Подтвердите/);assert.deepEqual(t,before);
 t=applyAction(t,{type:'settings',name:t.name,scoreDivisor:333,confirm:true});assert.equal(t.rounds.length,1);assert.equal(t.scoreDivisor,333);assert.deepEqual(t.rounds[0],first);assert.equal(t.history.at(-1).details.discardedRounds.length,1);
});
test('late withdrawal rebuilds only unplayed games and retains completed scores and historical names',()=>{
 let t=draw(make());t=score(t,t.rounds[0].games[0]);const saved=structuredClone(t.rounds[0].games[0]),removed=t.rounds[0].games[1].players[0],action={removeIds:[removed],scope:'current'};
 const preview=rosterChangePreview(t,action);assert.equal(preview.preservedGames,1);assert.deepEqual(preview.newSizes,[3]);t=amend(t,action);assert.deepEqual(t.rounds[0].games.find(g=>g.id===saved.id),saved);assert.equal(activePlayers(t).length,7);assert.equal(t.players.length,8);assert.equal(t.players.find(p=>p.id===removed).active,false);assert.equal(t.rounds[0].roster.length,7);assert.deepEqual(ratingRows(t).slice(0,6),ratingRows({...t,rounds:[{games:[saved]}]}));
 const restored=validateBackup({format:'svoyak-v1',tournament:t});assert.deepEqual(restored.rounds,t.rounds);assert.deepEqual(restored.players,t.players);
});
test('withdrawal of an already played participant retains points and excludes only future pairing',()=>{
 let t=complete(draw(make()));const removed=t.rounds[0].games[0].players[0],total=standings(t).find(p=>p.id===removed).total;t=amend(t,{scope:'next',removeIds:[removed]});assert.equal(standings(t).find(p=>p.id===removed).total,total);assert.equal(t.rounds[0].roster.length,8);const next=pair(t);assert.equal(next.roster.length,7);assert.ok(!next.games.flatMap(g=>g.players).includes(removed));
 t=amend(t,{scope:'next',restoreIds:[removed]});assert.equal(activePlayers(t).length,8);assert.equal(t.players.find(p=>p.id===removed).id,removed);
});
test('invalid remaining groups are rejected atomically, with a next-round alternative for late arrivals',()=>{
 let t=draw(make());t=score(t,t.rounds[0].games[0]);const before=structuredClone(t);assert.throws(()=>amend(t,{removeIds:t.rounds[0].games[1].players.slice(0,3)}),/останется 1/);assert.deepEqual(t,before);
 t=amend(t,{names:['Поздний игрок'],scope:'next'});assert.equal(activePlayers(t).length,9);assert.deepEqual(t.rounds[0],before.rounds[0]);assert.equal(standings(t).find(p=>p.id==='p9').total,0);assert.deepEqual(standings(t).find(p=>p.id==='p9').rounds,[null]);t=complete(t);assert.equal(pair(t).roster.length,9);
});
test('late additions can join unplayed games, and returning a player reuses the original identity',()=>{
 let t=draw(make(6));t=score(t,t.rounds[0].games[0]);const saved=structuredClone(t.rounds[0].games[0]);t=amend(t,{names:['Поздний игрок']});assert.deepEqual(t.rounds[0].games[0],saved);assert.equal(t.rounds[0].games[1].players.length,4);assert.equal(new Set(t.rounds[0].games.flatMap(g=>g.players)).size,7);
 const id=t.rounds[0].games[1].players[0],name=t.players.find(p=>p.id===id).name;t=amend(t,{removeIds:[id],scope:'next'});const count=t.players.length;t=amend(t,{names:[name],scope:'next'});assert.equal(t.players.length,count);assert.equal(t.players.find(p=>p.id===id).active,true);
});
test('group correction resets only affected games and dependent rounds after explicit confirmation',()=>{
 let t=complete(draw(make(12))),first=structuredClone(t.rounds[0]);t=draw(t);const a=first.games[0].players[0],b=first.games[1].players[0],impact=swapImpact(t,{round:1,a,b});assert.equal(impact.savedGames,2);assert.deepEqual(impact.followingRounds,[2]);assert.throws(()=>applyAction(t,{type:'swap',round:1,a,b}),/Подтвердите/);
 t=applyAction(t,{type:'swap',round:1,a,b,confirm:true});assert.equal(t.rounds.length,1);assert.equal(t.rounds[0].games[0].scores,null);assert.equal(t.rounds[0].games[1].scores,null);assert.deepEqual(t.rounds[0].games[2],first.games[2]);assert.equal(new Set(t.rounds[0].games.flatMap(g=>g.players)).size,12);assert.equal(t.history.at(-1).details.discardedGames.length,2);assert.equal(t.history.at(-1).details.discardedRounds.length,1);
});
test('historical score correction is atomic and does not leave later standings or finals stale',()=>{
 let t=make();for(let i=0;i<3;i++)t=complete(draw(t));t=applyAction(t,{type:'finals',groups:[t.players.slice(0,4).map(p=>p.id)]});const old=structuredClone(t.rounds[0]),id=old.games[0].id;
 assert.throws(()=>applyAction(t,{type:'results',round:1,game:id,scores:[2000,700,400,0],confirm:true}),/следующие/);
 t=applyAction(t,{type:'results',round:1,game:id,scores:[2000,700,400,0],confirm:true,resetFollowing:true});assert.equal(t.rounds.length,1);assert.equal(t.finals.length,0);assert.deepEqual(t.rounds[0].games[1],old.games[1]);assert.equal(standings(t).find(p=>p.id===old.games[0].players[0]).total,230000);assert.equal(t.history.at(-1).details.discardedRounds.length,2);assert.equal(t.history.at(-1).details.discardedFinals.length,1);
});
test('backup validation rejects tampered per-round rosters and preserves arbitrary divisors',()=>{
 let t=complete(draw(make(8,333)));t=amend(t,{removeIds:['p1'],scope:'next'});t=draw(t);const copy=validateBackup({format:'svoyak-v1',tournament:t});assert.equal(copy.scoreDivisor,333);assert.deepEqual(copy.rounds,t.rounds);assert.deepEqual(copy.players,t.players);
 const bad=structuredClone(t);bad.rounds[0].roster.pop();assert.throws(()=>validateBackup({format:'svoyak-v1',tournament:bad}));const bad2=structuredClone(t);bad2.players[0].active='false';assert.throws(()=>validateBackup({format:'svoyak-v1',tournament:bad2}));
});
test('export example is exactly one six-row A:D block; custom divisors never rewrite raw export scores',()=>{
 const text=readFileSync(new URL('../public/export-example.tsv',import.meta.url),'utf8').replace(/\n$/,'');const rows=text.split('\n').map(line=>line.split('\t'));assert.equal(rows.length,6);assert.ok(rows.every(row=>row.length===4));assert.equal(rows[1][3],'1000');assert.equal(rows[4][3],'0');assert.ok(rows[1][2].startsWith('Пример'));
 let t=complete(draw(make(4,200)));const raw=ratingTSV(t);t=applyAction(t,{type:'settings',name:t.name,date:t.date,scoreDivisor:333});assert.equal(ratingTSV(t),raw);
});
test('new owner operations are persisted and projected safely, and viewers cannot perform them',async()=>{
 const {db,env}=database();try{const owner=new Client(env),viewer=new Client(env),created=await owner.create('Feedback API fixture');let t=created.tournament;const send=async action=>{const r=await owner.request('/api/tournaments/'+t.id,{revision:t.revision,action});assert.equal(r.status,200);t=await r.json();};await send({type:'settings',name:t.name,scoreDivisor:333});await send({type:'register',names:['Тест А','Тест Б','Тест В','Тест Г','Тест Д','Тест Е','Тест Ж','Тест З']});await send({type:'draw'});await send({type:'amendRoster',removeIds:[t.rounds[0].games[1].players[0]],scope:'current',confirm:true});assert.equal(activePlayers(t).length,7);const result=await(await viewer.request('/api/tournaments/'+t.id)).json();assert.equal(result.scoreDivisor,333);assert.ok(result.players.some(p=>p.active===false));assert.ok(!Object.hasOwn(result.standings[0],'scoreNumerator'));assert.equal((await viewer.request('/api/tournaments/'+t.id,{revision:t.revision,action:{type:'amendRoster',names:['Forbidden'],scope:'next',confirm:true}})).status,401);
 const backup=await(await owner.request('/api/tournaments/'+t.id+'/backup')).json(),restore=await owner.request('/api/restore',backup);assert.equal(restore.status,201);const restored=await restore.json();assert.equal(restored.tournament.scoreDivisor,333);assert.deepEqual(restored.tournament.rounds,t.rounds);
 }finally{db.close();}
});
