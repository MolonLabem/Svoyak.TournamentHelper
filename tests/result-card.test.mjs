import test from 'node:test';
import assert from 'node:assert/strict';
import {createTournament,applyAction,standings} from '../src/domain.mjs';
import {spectatorTournament} from '../src/access.mjs';
import {resultCard,resultStages,swissRows,finalRows} from '../src/result-card.mjs';

function setup(n=8){return applyAction(createTournament({id:'card-test',name:'Кубок <друзей>',date:'2026-10-26',location:'PRIVATE VENUE',scoreDivisor:200}),{type:'register',names:Array.from({length:n},(_,i)=>'Игрок '+(i+1))});}
function round(t){t=applyAction(t,{type:'draw'},7);for(const g of t.rounds.at(-1).games)t=applyAction(t,{type:'results',round:t.rounds.length,game:g.id,scores:g.players.map((_,i)=>[1000,700,700,-100][i%4])});return t;}
function finals(n=8){let t=setup(n);for(let i=0;i<3;i++)t=round(t);const cut=Math.ceil(n/2);t=applyAction(t,{type:'finals',groups:[t.players.slice(0,cut).map(p=>p.id),t.players.slice(cut).map(p=>p.id)]});for(const g of t.finals)t=applyAction(t,{type:'finalResults',game:g.id,scores:g.players.map((_,i)=>i===0?0:1000)});return t;}
test('round cards are saved historical snapshots, with custom divisor and ties; later scores/finals cannot change them',()=>{
 const first=round(setup()),card=resultCard(first,'1');let later=round(round(first));later=applyAction(later,{type:'finals',groups:[['p1','p2','p3'],['p4','p5']]});later=applyAction(later,{type:'finalResults',game:'f0',scores:[0,1000,1000]});assert.deepEqual(resultCard(later,'1'),card);assert.equal(card.divisor,200);assert.ok(card.sections[0].rows.some(r=>r.includes('2,5')));assert.ok(card.sections[0].rows.some(r=>r.includes('-100')));assert.deepEqual(card.sections.at(-1).rows.map(r=>r.slice(4,5)),Array(8).fill(['—']));assert.ok(card.sections[0].rows.some(r=>r.includes('8,00')));
});
test('incomplete round/final exports are rejected and stage readiness follows all required saved games',()=>{
 let t=setup();assert.throws(()=>resultCard(t,'1'));t=applyAction(t,{type:'draw'},1);assert.equal(resultStages(t)[0].ready,false);const g=t.rounds[0].games[0];t=applyAction(t,{type:'results',round:1,game:g.id,scores:[0,0,0,0]});assert.throws(()=>resultCard(t,'1'));t=finals();t.finals[1].places=null;t.finals[1].scores=null;assert.equal(resultStages(t).at(-1).ready,false);assert.throws(()=>resultCard(t,'finals'));assert.equal(resultStages(t)[0].ready,true);
});
test('final card includes both independent standings with automatic fractional positions and the correct small-final offset',()=>{
 const t=finals(),card=resultCard(t,'finals');assert.deepEqual(card.sections.map(s=>s.title),['Итоговые места','Швейцарка · после круга 3']);assert.ok(card.sections[0].rows.some(r=>r[0]==='2'));assert.ok(card.sections[0].rows.some(r=>r[0]==='6'));assert.deepEqual(card.sections[1].rows.map(r=>r[1]),swissRows(t).map(p=>p.name));assert.deepEqual(card.sections[0].rows.map(r=>r[1]),standings(t).map(p=>p.name));assert.notDeepEqual(card.sections[0].rows.map(r=>r[1]),card.sections[1].rows.map(r=>r[1]));assert.equal(card.sections[0].rows.find(r=>r[1]==='Игрок 1')[3],'0');
});
test('owner and public cards match exactly, without venue, audit, IDs, credentials or mutations to server standings',()=>{
 const t=finals(),publicT=spectatorTournament(t),before=structuredClone(publicT);t.managementKey='PRIVATE KEY';t.history.push({secret:'PRIVATE AUDIT'});for(const stage of ['1','2','3','finals'])assert.deepEqual(resultCard(t,stage),resultCard(publicT,stage));finalRows(publicT).reverse();assert.deepEqual(publicT,before);const text=JSON.stringify(resultCard(t,'finals'));for(const secret of ['PRIVATE','revision','management','history','card-test'])assert.ok(!text.includes(secret));
});
test('five-player 3+2 games, forced skips and chairs preserve real scores and never invent points',()=>{
 let t=setup(5);t=applyAction(t,{type:'draw'},1);t=applyAction(t,{type:'chairs',game:t.rounds[0].games[1].id,count:1});for(const g of t.rounds[0].games)t=applyAction(t,{type:'results',round:1,game:g.id,scores:g.players.map(()=>0)});const card=resultCard(t,'1');assert.deepEqual(card.sections.slice(0,2).map(s=>s.rows.length),[3,2]);assert.ok(card.sections[1].note.includes('Пустых мест: 1'));assert.equal(card.sections.at(-1).rows.length,5);
 t=applyAction(setup(8),{type:'draw'},1);t=applyAction(t,{type:'amendRoster',scope:'current',confirm:true,missedIds:['p1','p2'],sizes:[3,3]});for(const g of t.rounds[0].games)t=applyAction(t,{type:'results',round:1,game:g.id,scores:[100,0,-100]});const missed=resultCard(t,'1');assert.equal(missed.sections.at(-2).rows.length,2);assert.equal(missed.sections.at(-1).rows.find(r=>r[1]==='Игрок 1')[2],'Пропуск');
});
test('historical standings omit future newcomers and later withdrawals do not erase a played result',()=>{
 let t=round(setup(8));const first=resultCard(t,'1');t=applyAction(t,{type:'amendRoster',scope:'next',confirm:true,names:['Новый игрок'],removeIds:['p1']});assert.deepEqual(resultCard(t,'1'),first);assert.equal(swissRows(t,1).length,8);
});
test('flexible finals include every real player for 5 and 40 players; no fixed four-seat truncation',()=>{
 for(const n of [5,40]){const t=finals(n),card=resultCard(t,'finals');assert.equal(card.sections[0].rows.length,n);assert.equal(card.sections[1].rows.length,n);assert.equal(new Set(card.sections[0].rows.map(r=>r[1])).size,n);assert.deepEqual(resultCard(spectatorTournament(t),'finals'),card);}
});
