import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {database,Client} from './db-helper.mjs';
import worker from '../src/worker.mjs';
import {demoTournament} from '../src/domain.mjs';
import {validCapability,managementDigest} from '../src/access.mjs';
const actions=['amendRoster','register','rename','remove','draw','results','swap','rollback','finals','finalResults','finish','reopen','archive','settings'];
test('creation issues secure browser ownership and stores only hashed capabilities',async()=>{
 const {db,env}=database();try{const a=new Client(env);const response=await a.request('/api/tournaments',{name:'A'});assert.equal(response.status,201);const created=await response.json();assert.ok(validCapability(created.managementKey),'management capability must have 256 bits');const cookie=response.headers.get('Set-Cookie')??'';for(const flag of ['__Host-svoyak-owner=','Path=/','HttpOnly','SameSite=Strict','Secure','Max-Age='])assert.ok(cookie.includes(flag),'required cookie flag missing');assert.ok(!cookie.includes('Domain='));assert.equal(created.tournament.canEdit,true);
 const row=db.prepare('SELECT management_key_hash,payload FROM tournaments WHERE id=?').get(created.tournament.id);assert.ok(row.management_key_hash!==created.managementKey);assert.ok(row.management_key_hash===await managementDigest(created.tournament.id,created.managementKey));assert.ok(!row.payload.includes(created.managementKey));assert.ok(!JSON.stringify(db.prepare('SELECT * FROM tournament_owner_sessions').all()).includes(a.cookie.split('=')[1]));
 }finally{db.close();}
});
test('owner B and anonymous spectators cannot mutate, back up, restore or replace management of A',async()=>{
 const {db,env}=database();try{const a=new Client(env),b=new Client(env),anonymous=new Client(env);const created=await a.create('A'),other=await b.create('B'),id=created.tournament.id;const before=db.prepare('SELECT payload FROM tournaments WHERE id=?').get(id).payload;
 for(const [client,status]of[[b,403],[anonymous,401]]){for(const type of actions)assert.equal((await client.request('/api/tournaments/'+id,{revision:0,action:{type,keep:0,confirm:true}})).status,status,type);assert.equal((await client.request('/api/tournaments/'+id+'/backup')).status,status);assert.equal((await client.request('/api/tournaments/'+id+'/management-link',{})).status,status);assert.equal((await client.request('/api/restore',{format:'svoyak-v1',tournament:created.tournament})).status,status);}
 assert.equal(db.prepare('SELECT payload FROM tournaments WHERE id=?').get(id).payload,before);assert.deepEqual((await(await b.request('/api/tournaments')).json()).map(t=>t.id),[other.tournament.id]);assert.deepEqual(await(await anonymous.request('/api/tournaments')).json(),[]);
 assert.equal((await b.request('/api/tournaments',{name:'Forged',owner_id:id})).status,400);assert.equal((await a.request('/api/tournaments/'+id,{revision:0,action:{type:'settings',name:'Forged',ownerId:'other'}})).status,400);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tournaments').get().n,2);
 }finally{db.close();}
});
test('public shared records contain only results and no directory, notes, audit or secrets',async()=>{
 const {db,env}=database();try{const a=new Client(env),anonymous=new Client(env),created=await a.create('Public results');const t=demoTournament();t.id=created.tournament.id;t.name='Public results';t.location='PRIVATE VENUE';t.privateNotes='PRIVATE NOTE';db.prepare('UPDATE tournaments SET payload=?,revision=? WHERE id=?').run(JSON.stringify(t),t.revision,t.id);
 const read=await(await anonymous.request('/api/tournaments/'+t.id)).json();const keys=Object.keys(read);assert.deepEqual(keys.sort(),['canEdit','date','scoreDivisor','finals','finished','id','name','players','rounds','standings'].sort());assert.ok(!JSON.stringify(read).includes('PRIVATE'));assert.ok(!JSON.stringify(read).includes(created.managementKey));assert.ok(!Object.hasOwn(read.players[0],'seed'));assert.ok(!Object.hasOwn(read.rounds[0],'randomSeed'));assert.equal(read.canEdit,false);assert.equal(read.standings.length,16);
 const owned=await(await a.request('/api/tournaments/'+t.id)).json();assert.equal(owned.canEdit,true);assert.ok(owned.history.length);const backup=await(await a.request('/api/tournaments/'+t.id+'/backup')).json();assert.ok(!JSON.stringify(backup).includes(created.managementKey));assert.ok(!JSON.stringify(backup).includes('session_hash'));assert.ok(!JSON.stringify(backup).includes('management_key_hash'));
 assert.deepEqual(await(await anonymous.request('/api/tournaments')).json(),[]);assert.equal((await anonymous.request('/docs/VERIFICATION.md')).status,401);assert.equal((await a.request('/docs/VERIFICATION.md')).status,200);
 }finally{db.close();}
});
test('cookie loss and a private recovery link restore only its bound tournament',async()=>{
 const {db,env}=database();try{const a=new Client(env),b=new Client(env),fresh=new Client(env);const one=await a.create('One'),two=await b.create('Two');const id=one.tournament.id;assert.equal((await fresh.request('/api/tournaments/'+id,{revision:0,action:{type:'register',names:['A']}})).status,401);
 const preview=await fresh.request('/t/'+id);assert.equal(preview.status,200);assert.ok(!preview.headers.has('Set-Cookie'));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tournament_owner_sessions WHERE tournament_id=?').get(id).n,1);
 assert.equal((await fresh.request('/api/tournaments/'+two.tournament.id+'/recover',{key:one.managementKey})).status,403);
 const recovery=await fresh.request('/api/tournaments/'+id+'/recover',{key:one.managementKey});assert.equal(recovery.status,200);assert.equal((await recovery.json()).canEdit,true);assert.equal((await fresh.request('/api/tournaments/'+id,{revision:0,action:{type:'register',names:['Recovered']}})).status,200);assert.equal((await fresh.request('/api/tournaments/'+two.tournament.id,{revision:0,action:{type:'draw'}})).status,403);
 assert.equal((await fresh.request('/api/tournaments/'+id+'/recover',{key:'X'.repeat(43)})).status,403);
 }finally{db.close();}
});
test('replacing a private link revokes the old capability and other browser sessions',async()=>{
 const {db,env}=database();try{const a=new Client(env),c=new Client(env),d=new Client(env),created=await a.create('Rotate app capability'),id=created.tournament.id;await c.request('/api/tournaments/'+id+'/recover',{key:created.managementKey});const response=await a.request('/api/tournaments/'+id+'/management-link',{});assert.equal(response.status,200);const next=await response.json();assert.ok(validCapability(next.managementKey));assert.ok(next.managementKey!==created.managementKey);assert.equal((await c.request('/api/tournaments/'+id,{revision:0,action:{type:'draw'}})).status,401);assert.equal((await d.request('/api/tournaments/'+id+'/recover',{key:created.managementKey})).status,403);assert.equal((await d.request('/api/tournaments/'+id+'/recover',{key:next.managementKey})).status,200);assert.equal((await(await a.request('/api/tournaments/'+id)).json()).canEdit,true);
 }finally{db.close();}
});
test('same-origin JSON, session fixation and client-supplied identity fields are enforced',async()=>{
 const {db,env}=database();try{const a=new Client(env);const created=await a.create('CSRF'),id=created.tournament.id;assert.equal((await a.request('/api/tournaments/'+id,{revision:0,action:{type:'settings',name:'Wrong origin'}},{origin:'http://evil'})).status,403);assert.equal((await a.request('/api/tournaments/'+id+'/recover',{key:created.managementKey},{origin:'http://evil'})).status,403);
 const fake=new Client(env);fake.cookie='__Host-svoyak-owner='+'F'.repeat(43);assert.equal((await fake.request('/api/tournaments/'+id,{revision:0,action:{type:'settings',name:'Forged cookie'}})).status,401);const response=await fake.request('/api/tournaments',{name:'Separate'});assert.equal(response.status,201);assert.ok(!fake.cookie.endsWith('F'.repeat(43)));
 const forged=await new Client(env).request('/api/tournaments/'+id,{revision:0,action:{type:'settings',name:'Forged identity'}},{headers:{'oai-authenticated-user-id':'pretend-owner','oai-authenticated-user-email':'irrelevant@test.invalid'}});assert.equal(forged.status,401);
 assert.equal((await a.request('/api/tournaments/'+id,{revision:0,action:{type:'settings',name:'Clean',key:'DO NOT PERSIST'}})).status,200);assert.ok(!db.prepare('SELECT payload FROM tournaments WHERE id=?').get(id).payload.includes('DO NOT PERSIST'));
 }finally{db.close();}
});
test('restore requires existing source ownership and creates an independent management capability',async()=>{
 const {db,env}=database();try{const a=new Client(env),b=new Client(env),created=await a.create('Restore source'),id=created.tournament.id;await b.create('B');const backup=await(await a.request('/api/tournaments/'+id+'/backup')).json();assert.equal((await b.request('/api/restore',backup)).status,403);const response=await a.request('/api/restore',backup);assert.equal(response.status,201);const copy=await response.json();assert.ok(copy.tournament.id!==id);assert.ok(copy.managementKey!==created.managementKey);assert.equal((await b.request('/api/tournaments/'+copy.tournament.id+'/recover',{key:created.managementKey})).status,403);assert.equal((await a.request('/api/restore',{...backup,tournament:{...backup.tournament,ownerId:'forged'}})).status,400);
 }finally{db.close();}
});
test('legacy migration preserves records and never permits first-visitor claiming',async()=>{
 const db=new DatabaseSync(':memory:');try{db.exec(readFileSync(new URL('../drizzle/0000_tournaments.sql',import.meta.url),'utf8'));const t=demoTournament(),payload=JSON.stringify(t);db.prepare('INSERT INTO tournaments VALUES (?,?,?,?)').run(t.id,payload,t.revision,'2026-10-26');db.exec(readFileSync(new URL('../drizzle/0001_tournament_ownership.sql',import.meta.url),'utf8'));assert.equal(db.prepare('SELECT payload FROM tournaments').get().payload,payload);assert.equal(db.prepare('SELECT management_key_hash FROM tournaments').get().management_key_hash,null);
 }finally{db.close();}
 const store=database();try{const t=demoTournament();store.db.prepare('INSERT INTO tournaments (id,payload,revision,updated_at) VALUES (?,?,?,?)').run(t.id,JSON.stringify(t),t.revision,'2026-10-26');const first=new Client(store.env);await first.create('New owned record');assert.equal((await first.request('/api/tournaments/'+t.id)).status,404);assert.equal((await first.request('/api/tournaments/'+t.id+'/recover',{key:'X'.repeat(43)})).status,404);assert.equal((await first.request('/api/tournaments/'+t.id,{revision:t.revision,action:{type:'settings',name:'Claim'}})).status,404);assert.equal(store.db.prepare('SELECT management_key_hash FROM tournaments WHERE id=?').get(t.id).management_key_hash,null);
 }finally{store.db.close();}
});
test('emitted Worker is self-contained and identity-less spectator mutations are denied',async()=>{
 const {default:built}=await import('../dist/server/index.js');const {db,env}=database();try{const a=new Client(env),created=await a.create('Built artifact');const request=new Request('http://local/api/tournaments/'+created.tournament.id,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://local'},body:JSON.stringify({revision:0,action:{type:'draw'}})});assert.equal((await built.fetch(request,env)).status,401);assert.equal((await built.fetch(new Request('http://local/t/'+created.tournament.id),env)).status,200);}finally{db.close();}
});
