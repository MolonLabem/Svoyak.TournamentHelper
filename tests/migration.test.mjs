import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac,randomBytes} from 'node:crypto';
import {database,Client} from './db-helper.mjs';
import {migrationBridge} from '../src/migration-bridge.mjs';
import target from '../src/cloudflare-entry.mjs';
import source from '../src/sites-entry.mjs';

function migrationEnv(env){return {...env,SVOYAK_MIGRATION_SECRET:randomBytes(32).toString('hex'),SVOYAK_MIGRATION_EXPIRES:String(Date.now()+3600_000),SVOYAK_MIGRATION_STATUS:'pending'};}
function signed(env,path,body={},time=Date.now()){
  const text=JSON.stringify(body),stamp=String(time);
  const signature=createHmac('sha256',env.SVOYAK_MIGRATION_SECRET).update(`POST\n${path}\n${stamp}\n${text}`).digest('hex');
  return new Request('https://fixture.invalid'+path,{method:'POST',body:text,headers:{'Content-Type':'application/json','X-Migration-Time':stamp,'X-Migration-Signature':signature}});
}
const freeze=db=>db.exec(readFileSync(new URL('../drizzle/0004_freeze_sites_source.sql',import.meta.url),'utf8'));

test('migration bridge fails closed without valid unexpired authentication before touching D1',async()=>{
 const env=migrationEnv({DB:new Proxy({},{get(){throw Error('must not access D1');}})});
 for(const req of [new Request('https://fixture.invalid/__migration/manifest',{method:'POST',body:'{}'}),signed(env,'/__migration/manifest',{},Date.now()-120_000)])assert.equal((await migrationBridge(req,env,'source')).status,404);
 const req=signed(env,'/__migration/manifest');req.headers.set('X-Migration-Signature','0'.repeat(64));assert.equal((await migrationBridge(req,env,'target')).status,404);
 assert.equal((await migrationBridge(signed(env,'/__migration/manifest'),{...env,SVOYAK_MIGRATION_EXPIRES:'1'},'source')).status,404);
 assert.equal((await target.fetch(new Request('https://fixture.invalid/api/tournaments'),env)).status,503);
 assert.equal((await source.fetch(new Request('https://fixture.invalid/api/tournaments',{method:'POST'}),env)).status,503);
});

test('frozen source preserves long payloads, null hashes and all session fields during exact retry-safe import',async()=>{
 const a=database(),b=database();const from=migrationEnv(a.env),to=migrationEnv(b.env);
 try{
  const owner=new Client(a.env),created=await owner.create('Synthetic migration');
  const payload=' {"id":"legacy", "revision":7,"notes":'+JSON.stringify('Приватное 🦊\n'.repeat(12000))+'} ';
  a.db.prepare('INSERT INTO tournaments VALUES (?,?,?,?,?)').run('legacy',payload,7,'2026-11-01T00:00:00.123Z',null);
  assert.equal((await migrationBridge(signed(from,'/__migration/manifest'),from,'source')).status,409);
  freeze(a.db);
  for(const sql of ["INSERT INTO tournaments VALUES ('blocked','{}',0,'now',NULL)","UPDATE tournaments SET revision=revision+1","DELETE FROM tournaments","INSERT INTO tournament_owner_sessions VALUES ('legacy','blocked',1)","UPDATE tournament_owner_sessions SET expires_at=1","DELETE FROM tournament_owner_sessions"])assert.throws(()=>a.db.exec(sql),/Source frozen/);
  const manifest=await(await migrationBridge(signed(from,'/__migration/manifest'),from,'source')).json();
  assert.deepEqual(manifest.counts,{tournaments:2,tournament_owner_sessions:1});
  for(const [table,count] of Object.entries(manifest.counts))for(let offset=0;offset<count;offset++){
   const input={table,offset},row=await(await migrationBridge(signed(from,'/__migration/read',input),from,'source')).json();
   for(let retry=0;retry<2;retry++){
    const imported=await migrationBridge(signed(to,'/__migration/import',{table,values:row.values}),to,'target');assert.equal(imported.status,200);assert.deepEqual((await imported.json()).hashes,row.hashes);
   }
   const copied=await(await migrationBridge(signed(to,'/__migration/read',input),to,'target')).json();assert.deepEqual(copied,row);
  }
  assert.equal(b.db.prepare('SELECT payload FROM tournaments WHERE id=?').get('legacy').payload,payload);
  const conflict=await migrationBridge(signed(to,'/__migration/import',{table:'tournaments',values:['legacy','{}',7,'other',null]}),to,'target');assert.equal(conflict.status,409);
  assert.equal(b.db.prepare('SELECT payload FROM tournaments WHERE id=?').get('legacy').payload,payload);
  assert.equal((await migrationBridge(signed(to,'/__migration/manifest'),{...to,SVOYAK_MIGRATION_STATUS:'ready'},'target')).status,409);
  // A new hostname has no cookie: only the original key can recover this ID.
  const recovered=new Client(b.env);assert.equal((await recovered.request('/api/tournaments/'+created.tournament.id+'/recover',{key:created.managementKey})).status,200);
  assert.equal((await recovered.request('/api/tournaments/legacy')).status,404);
 }finally{a.db.close();b.db.close();}
});

test('only signed pending-target requests can run synthetic acceptance tests before cutover',async()=>{
 const store=database(),env=migrationEnv(store.env);
 try{
  assert.equal((await target.fetch(signed(env,'/api/tournaments',{name:'Synthetic QA'}),env)).status,201);
  assert.equal((await target.fetch(new Request('https://fixture.invalid/api/tournaments',{method:'POST',body:'{}'}),env)).status,503);
 }finally{store.db.close();}
});
