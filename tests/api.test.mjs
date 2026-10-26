import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import worker,{validateBackup} from '../src/worker.mjs';
import {demoTournament} from '../src/domain.mjs';
import {database,Client} from './db-helper.mjs';
test('durable SQLite recovery, API workflow and optimistic concurrency',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'svoyak-'));let store=database(join(dir,'test.db'));const client=new Client(store.env);
 try{
  let {tournament:t}=await client.create('Кубок');
  const post=async action=>{const response=await client.request('/api/tournaments/'+t.id,{revision:t.revision,action});assert.equal(response.status,200);t=await response.json();};
  await post({type:'register',names:['Анна','Борис','Вера','Глеб','Дина','Егор','Жанна','Зоя','Игорь']});await post({type:'draw'});assert.equal(t.rounds[0].games.length,3);assert.ok(t.rounds[0].games.every(g=>g.players.length===3));
  const stale=t.revision;await post({type:'results',round:1,game:'r1g1',scores:['0','-10.25','100']});assert.equal((await client.request('/api/tournaments/'+t.id,{revision:stale,action:{type:'settings',name:'Lost update'}})).status,409);
  store.db.close();store=database(join(dir,'test.db'),{initialize:false});client.env=store.env;
  const restored=await(await client.request('/api/tournaments')).json();assert.equal(restored[0].name,'Кубок');assert.equal(restored[0].rounds[0].games[0].scores[1],-1025);assert.equal(restored[0].revision,t.revision);assert.equal(restored[0].canEdit,true);
  assert.equal((await client.request('/api/tournaments/'+t.id,{revision:t.revision,action:{type:'draw'}})).status,400);
  const backup=await(await client.request('/api/tournaments/'+t.id+'/backup')).json();const restore=await client.request('/api/restore',backup);assert.equal(restore.status,201);const {tournament:copy}=await restore.json();assert.ok(copy.id!==t.id);assert.deepEqual(copy.rounds,t.rounds);assert.equal((await(await client.request('/api/tournaments')).json()).length,2);
  assert.equal((await client.request('/api/restore',{format:'svoyak-v1',tournament:{...t,players:[...t.players,t.players[0]]}})).status,400);
  assert.equal((await client.request('/api/tournaments',{name:'Blocked'},{origin:'http://evil'})).status,403);
 }finally{store.db.close();rmSync(dir,{recursive:true,force:true});}
});
test('backup validation rejects missing/duplicate players and invalid downstream states',()=>{
 const good={format:'svoyak-v1',tournament:demoTournament()};const copy=validateBackup(good);assert.equal(copy.demo,false);assert.equal(copy.players.length,16);
 const edit=fn=>{const x=structuredClone(good);fn(x.tournament);return ()=>validateBackup(x);};
 assert.throws(edit(t=>t.rounds[0].games[0].players[0]='unknown'));assert.throws(edit(t=>t.rounds[0].games[0].scores=null));assert.throws(edit(t=>t.finished=true));assert.throws(edit(t=>t.players[1].name=t.players[0].name));assert.throws(edit(t=>t.history[0].details.names='unsafe'));
});
test('worker serves Russian UI and legal notices; administrative docs require owner session',async()=>{
 const response=await worker.fetch(new Request('http://local/'),{});assert.equal(response.status,200);assert.ok((await response.text()).includes('lang="ru"'));assert.ok(response.headers.get('Content-Security-Policy').includes("script-src 'self'"));assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');
 assert.equal((await worker.fetch(new Request('http://local/app.mjs'),{})).status,200);assert.equal((await worker.fetch(new Request('http://local/t/example-id'),{})).status,200);assert.equal((await worker.fetch(new Request('http://local/docs/VERIFICATION.md'),{})).status,401);assert.ok((await(await worker.fetch(new Request('http://local/NOTICE'),{})).text()).includes('Required Notice:'));assert.equal((await worker.fetch(new Request('http://local/api/tournaments'),{})).status,503);
});
