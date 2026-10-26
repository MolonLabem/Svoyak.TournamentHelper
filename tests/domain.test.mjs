import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTournament,applyAction,groupSizes,gameResult,pair,standings,scoreValue,roundComplete,demoTournament} from '../src/domain.mjs';
const make=(n=12)=>applyAction(createTournament({id:'test',name:'Тест'}),{type:'register',names:Array.from({length:n},(_,i)=>`Игрок ${i+1}`)});
const complete=t=>{for(const g of t.rounds.at(-1).games)t=applyAction(t,{type:'results',round:t.rounds.length,game:g.id,scores:g.players.map((_,i)=>1000-300*i)});return t;};
test('creation and participant validation are atomic and keep unique IDs',()=>{
 let t=createTournament({id:'a',name:'  Кубок  осени  '});assert.equal(t.name,'Кубок осени');assert.equal(t.rounds.length,0);
 t=applyAction(t,{type:'register',names:['Анна','Борис','Вера']});
 assert.throws(()=>applyAction(t,{type:'register',names:['  АННА  ','Глеб']}),/уникальными/);assert.equal(t.players.length,3);
 assert.throws(()=>applyAction(t,{type:'register',names:['']}));
 t=applyAction(t,{type:'rename',id:'p1',name:'Анна С.'});assert.equal(t.players[0].name,'Анна С.');
 t=applyAction(t,{type:'remove',id:'p2'});assert.equal(t.players.length,2);
 assert.throws(()=>applyAction(make(40),{type:'register',names:['Дополнительный']}),/40/);
});
test('every supported count partitions into exactly 3/4, without automatic byes',()=>{
 for(let n=3;n<=40;n++){if(n===5){assert.throws(()=>groupSizes(n));continue;}const sizes=groupSizes(n);assert.equal(sizes.reduce((a,b)=>a+b),n);assert.ok(sizes.every(n=>n===3||n===4));const r=pair(make(n),98);assert.equal(new Set(r.games.flatMap(g=>g.players)).size,n);}
 for(const n of [0,1,2,5,41])assert.throws(()=>groupSizes(n));
 assert.deepEqual(groupSizes(7),[4,3]);assert.deepEqual(groupSizes(9),[3,3,3]);assert.deepEqual(groupSizes(14),[4,4,3,3]);
});
test('source RANK.AVG and point formula, ties, negative/decimal/zero scores',()=>{
 const r=gameResult({players:['a','b','c','d'],scores:[120000,80000,80000,-10000]});
 assert.deepEqual(r.map(x=>x.place),[1,2.5,2.5,4]);assert.deepEqual(r.map(x=>x.points),[150000,95000,95000,-10000]);
 const three=gameResult({players:['a','b','c'],scores:[100000,100000,0]});assert.deepEqual(three.map(x=>x.points),[125000,125000,10000]);
 assert.deepEqual(gameResult({players:[1,2,3,4],scores:[0,0,0,0]}).map(x=>x.points),[15000,15000,15000,15000]);
 assert.equal(scoreValue('-12,34'),-1234);assert.equal(scoreValue('0'),0);assert.equal(scoreValue('10.01'),1001);
 for(const x of ['',null,'abc','1.234','1e3','1000000'])assert.throws(()=>scoreValue(x));
 assert.equal(gameResult({players:[1,2,3],scores:[100,null,0]}),null);
});
test('first draw is a reproducible permutation with a stored random seed',()=>{
 const t=make(16);assert.deepEqual(pair(t,45),pair(t,45));assert.notDeepEqual(pair(t,45),pair(t,46));assert.equal(pair(t,45).randomSeed,45);assert.deepEqual(t.rounds,[]);
});
const fixtures=JSON.parse(readFileSync(new URL('./workbook-fixtures.json',import.meta.url)));
for(const f of fixtures.scenarios)test(`exact workbook formula fixture: ${f.participants} players, rounds 2 and 3`,()=>{
 let t=make(f.participants);
 t.rounds=[{number:1,randomSeed:9,games:f.round1.map((g,i)=>({id:`r1g${i+1}`,players:g.map(p=>'p'+p),scores:f.round1Scores[i].map(s=>s*100)}))}];
 assert.deepEqual(pair(t).games.map(g=>g.players),f.expectedRound2.map(g=>g.map(p=>'p'+p)));
 t=applyAction(t,{type:'draw'});
 for(let i=0;i<f.round2Scores.length;i++)t=applyAction(t,{type:'results',round:2,game:`r2g${i+1}`,scores:f.round2Scores[i]});
 assert.deepEqual(t.players.map(p=>standings(t).find(r=>r.id===p.id).total),f.totalPointUnitsAfter2);
 assert.deepEqual(pair(t).games.map(g=>g.players),f.expectedRound3.map(g=>g.map(p=>'p'+p)));
});
test('soft repeat penalties allow unavoidable repeats, not a generic no-repeat rule',()=>{
 let t=complete(applyAction(make(3),{type:'draw'},1));t=applyAction(t,{type:'draw'});assert.equal(t.rounds[1].games.length,1);assert.deepEqual([...t.rounds[1].games[0].players].sort(),['p1','p2','p3']);
});
test('incomplete games cannot advance; ties share rank and seeded order',()=>{
 let t=applyAction(make(4),{type:'draw'},2);assert.throws(()=>applyAction(t,{type:'draw'}),/результаты/);
 assert.throws(()=>applyAction(t,{type:'results',round:1,game:'r1g1',scores:['100','','0','0']}));assert.equal(t.rounds[0].games[0].scores,null);
 t=applyAction(t,{type:'results',round:1,game:'r1g1',scores:[0,0,0,0]});assert.equal(roundComplete(t.rounds[0]),true);
 const rows=standings(t);assert.ok(rows.every(p=>p.rank==='1–4'));assert.deepEqual(rows.map(p=>p.id),['p1','p2','p3','p4']);
});
test('roster locks, explicit corrections and rollback preserve audit history',()=>{
 let t=complete(applyAction(make(),{type:'draw'},3));assert.throws(()=>applyAction(t,{type:'remove',id:'p1'}),/зафиксирован/);
 assert.throws(()=>applyAction(t,{type:'results',round:1,game:'r1g1',scores:[1,2,3,4]}),/Подтвердите/);
 t=applyAction(t,{type:'results',round:1,game:'r1g1',scores:[1,2,3,4],confirm:true});t=applyAction(t,{type:'draw'});
 assert.throws(()=>applyAction(t,{type:'results',round:1,game:'r1g1',scores:[4,3,2,1],confirm:true}),/следующие/);
 assert.throws(()=>applyAction(t,{type:'rollback',keep:1}),/Подтвердите/);
 const events=t.history.length;t=applyAction(t,{type:'rollback',keep:1,confirm:true});assert.equal(t.rounds.length,1);assert.equal(t.history.length,events+1);
 t=applyAction(t,{type:'results',round:1,game:'r1g1',scores:[4,3,2,1],confirm:true});assert.equal(t.rounds[0].games[0].scores[0],400);
});
test('manual swap preserves every player once and locks after scoring',()=>{
 let t=applyAction(make(8),{type:'draw'},2);const [a,b]=t.rounds[0].games.map(g=>g.players[0]);t=applyAction(t,{type:'swap',a,b});assert.equal(t.rounds[0].games[0].players[0],b);
 assert.equal(new Set(t.rounds[0].games.flatMap(g=>g.players)).size,8);t=complete(t);assert.throws(()=>applyAction(t,{type:'swap',a,b}));
});
test('three rounds, score-derived finals and final numeric ordering',()=>{
 let t=make(8);for(let i=0;i<3;i++)t=complete(applyAction(t,{type:'draw'},1));assert.throws(()=>applyAction(t,{type:'draw'}),/Три/);
 t=applyAction(t,{type:'finals',groups:[['p1','p2','p3','p4'],['p5','p6','p7','p8']]});
 assert.throws(()=>applyAction(t,{type:'finish'}));
 t=applyAction(t,{type:'finalResults',game:'f0',scores:[10,20,30,40],places:[4,3,2,1]});
 t=applyAction(t,{type:'finalResults',game:'f1',scores:[50,60,70,80],places:[1,2,3,4]});
 const rows=standings(t);assert.equal(rows[0].id,'p4');assert.equal(rows.find(p=>p.id==='p8').final,5);
 t=applyAction(t,{type:'finish'});assert.ok(t.finished);assert.throws(()=>applyAction(t,{type:'results',round:3,game:'r3g1',scores:[1,2,3,4],confirm:true}));
 t=applyAction(t,{type:'archive'});assert.ok(t.archived);assert.throws(()=>applyAction(t,{type:'reopen'}));t=applyAction(t,{type:'archive'});t=applyAction(t,{type:'reopen'});assert.ok(!t.finished);
});
test('demo is separate, clearly marked, and has two complete / two pending round-2 games',()=>{const t=demoTournament();assert.equal(t.demo,true);assert.equal(t.rounds.length,2);assert.equal(t.rounds[1].games.filter(g=>gameResult(g)).length,2);});
test('rollback clears downstream contributions and finals, retaining discarded data in audit',()=>{
 let t=make(8);for(let i=0;i<3;i++)t=complete(applyAction(t,{type:'draw'},55));
 t=applyAction(t,{type:'finals',groups:[['p1','p2','p3','p4']]});t=applyAction(t,{type:'finalResults',game:'f0',scores:[1,2,3,4],places:[4,3,2,1]});
 const before=standings(t).find(p=>p.id==='p1').total;
 t=applyAction(t,{type:'rollback',keep:1,confirm:true});assert.equal(t.finals.length,0);assert.equal(t.rounds.length,1);
 assert.ok(standings(t).every(p=>p.final===null&&p.total===p.rounds[0]));assert.ok(standings(t).find(p=>p.id==='p1').total<before);
 const audit=t.history.at(-1).details;assert.equal(audit.discardedRounds.length,2);assert.equal(audit.discardedFinals[0].places[0],4);assert.equal(t.history.find(h=>h.type==='draw').details.generatedRound.games.length,2);
});
