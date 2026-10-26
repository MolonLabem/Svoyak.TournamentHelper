import test from 'node:test';
import assert from 'node:assert/strict';
import {database,Client} from './db-helper.mjs';
const endpoint=id=>'/api/tournaments/'+id+'/delete';
async function change(client,t,action){const r=await client.request('/api/tournaments/'+t.id,{revision:t.revision,action});assert.equal(r.status,200);return r.json();}
async function secondOwner(env,created){const client=new Client(env);assert.equal((await client.request('/api/tournaments/'+created.tournament.id+'/recover',{key:created.managementKey})).status,200);return client;}
test('deletion requires the matching owner, same origin, explicit confirmation and a current revision',async()=>{
 const {db,env}=database();try{const owner=new Client(env),other=new Client(env),anonymous=new Client(env),created=await owner.create('Delete access fixture');await other.create('Unrelated owner');let t=created.tournament;
 for(const [client,status]of [[anonymous,401],[other,403]])assert.equal((await client.request(endpoint(t.id),{revision:t.revision,confirm:true})).status,status);
 assert.equal((await owner.request(endpoint(t.id),{revision:t.revision,confirm:true},{origin:'https://example.invalid'})).status,403);
 assert.equal((await owner.request(endpoint(t.id),null,{method:'GET'})).status,405);
 assert.equal((await owner.request(endpoint(t.id),{revision:t.revision,confirm:true},{method:'DELETE'})).status,405);
 for(const confirm of [undefined,false,'true'])assert.equal((await owner.request(endpoint(t.id),{revision:t.revision,confirm})).status,400);
 assert.equal((await owner.request(endpoint(t.id),{revision:t.revision,confirm:true,ownerId:'forged'})).status,400);
 assert.equal((await owner.request('/api/tournaments/'+t.id,{revision:t.revision,action:{type:'delete',confirm:true}})).status,400);
 t=await change(owner,t,{type:'settings',name:'Changed after opening confirmation'});
 assert.equal((await owner.request(endpoint(t.id),{revision:t.revision-1,confirm:true})).status,409);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tournaments WHERE id=?').get(t.id).n,1);assert.equal((await(await owner.request('/api/tournaments/'+t.id)).json()).canEdit,true);
 // Pre-ownership rows are never claimable or deletable through this endpoint.
 db.prepare('UPDATE tournaments SET management_key_hash=NULL WHERE id=?').run(t.id);assert.equal((await owner.request(endpoint(t.id),{revision:t.revision,confirm:true})).status,404);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tournaments WHERE id=?').get(t.id).n,1);
 }finally{db.close();}
});
test('owner can permanently delete a completed archived tournament, revoking all devices without touching other tournaments',async()=>{
 const {db,env}=database();try{const owner=new Client(env),other=new Client(env),anonymous=new Client(env),created=await owner.create('Deletion fixture');let t=created.tournament;const ownOther=await owner.create('Keep same owner'),otherRecord=await other.create('Keep different owner');
 t=await change(owner,t,{type:'register',names:['Тест Альфа','Тест Бета','Тест Гамма']});
 for(let round=1;round<=3;round++){t=await change(owner,t,{type:'draw'});t=await change(owner,t,{type:'results',round,game:t.rounds.at(-1).games[0].id,scores:[1000,700,0]});}
 t=await change(owner,t,{type:'finals',groups:[t.players.map(p=>p.id)]});t=await change(owner,t,{type:'finalResults',game:'f0',scores:[800,800,0],places:[1,2,3]});t=await change(owner,t,{type:'finish'});t=await change(owner,t,{type:'archive'});
 const device=await secondOwner(env,created),backup=await(await owner.request('/api/tournaments/'+t.id+'/backup')).json();assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tournament_owner_sessions WHERE tournament_id=?').get(t.id).n,2);
 const response=await owner.request(endpoint(t.id),{revision:t.revision,confirm:true});assert.equal(response.status,200);assert.deepEqual(await response.json(),{deleted:true,id:t.id});
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tournaments WHERE id=?').get(t.id).n,0);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tournament_owner_sessions WHERE tournament_id=?').get(t.id).n,0);
 for(const client of [owner,device,anonymous]){assert.equal((await client.request('/api/tournaments/'+t.id)).status,404);assert.equal((await client.request('/api/tournaments/'+t.id+'/backup')).status,404);assert.equal((await client.request('/api/tournaments/'+t.id+'/recover',{key:created.managementKey})).status,404);}
 assert.equal((await owner.request('/api/restore',backup)).status,403);assert.equal((await owner.request(endpoint(t.id),{revision:t.revision,confirm:true})).status,404);assert.deepEqual(await(await device.request('/api/tournaments')).json(),[]);
 assert.equal((await(await owner.request('/api/tournaments/'+ownOther.tournament.id)).json()).canEdit,true);assert.equal((await(await other.request('/api/tournaments/'+otherRecord.tournament.id)).json()).canEdit,true);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tournaments').get().n,2);
 }finally{db.close();}
});
test('a concurrent edit during deletion preserves the tournament and every owner binding',async()=>{
 const {db,env}=database();try{const owner=new Client(env),created=await owner.create('Concurrent deletion fixture'),device=await secondOwner(env,created),t=created.tournament,runBatch=env.DB.batch;
 env.DB.batch=async statements=>{env.DB.batch=runBatch;await change(device,t,{type:'settings',name:'Concurrent edit wins'});return runBatch(statements);};
 assert.equal((await owner.request(endpoint(t.id),{revision:t.revision,confirm:true})).status,409);const current=await(await owner.request('/api/tournaments/'+t.id)).json();assert.equal(current.name,'Concurrent edit wins');assert.equal(current.revision,1);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tournament_owner_sessions WHERE tournament_id=?').get(t.id).n,2);assert.equal((await(await device.request('/api/tournaments/'+t.id)).json()).canEdit,true);
 }finally{db.close();}
});
test('failed deletion rolls back access cleanup and retains saved tournament data',async()=>{
 const {db,env}=database();try{const owner=new Client(env),created=await owner.create('Atomic deletion fixture'),device=await secondOwner(env,created),t=created.tournament,runBatch=env.DB.batch;
 env.DB.batch=async statements=>runBatch([statements[0],{executeSync(){throw new Error('Synthetic transaction failure');}}]);
 assert.equal((await owner.request(endpoint(t.id),{revision:t.revision,confirm:true})).status,500);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tournaments WHERE id=?').get(t.id).n,1);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tournament_owner_sessions WHERE tournament_id=?').get(t.id).n,2);assert.equal((await(await device.request('/api/tournaments/'+t.id)).json()).canEdit,true);
 env.DB.batch=runBatch;assert.equal((await owner.request(endpoint(t.id),{revision:t.revision,confirm:true})).status,200);
 }finally{db.close();}
});
