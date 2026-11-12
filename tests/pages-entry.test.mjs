import test from 'node:test';
import assert from 'node:assert/strict';
import pages from '../src/pages-entry.mjs';

test('Pages aliases only serve transition and reject APIs without reading bindings',async()=>{
 const env=new Proxy({},{get(){throw Error('Alias must not access a binding');}});
 for(const host of ['preview.svoyak-tournament.pages.dev','deployment.svoyak-tournament.pages.dev','unrelated.invalid']){
  assert.equal((await pages.fetch(new Request(`https://${host}/t/synthetic`),env)).status,200);
  assert.equal((await pages.fetch(new Request(`https://${host}/api/tournaments`,{method:'POST'}),env)).status,410);
 }
});
test('canonical Pages hostname uses the existing readiness gate and application authorization',async()=>{
 const request=path=>new Request('https://svoyak-tournament.pages.dev'+path);
 const DB=new Proxy({},{get(){throw Error('Must not access D1');}});
 assert.equal((await pages.fetch(request('/'),{DB,SVOYAK_MIGRATION_STATUS:'pending'})).status,503);
 assert.equal((await pages.fetch(request('/'),{DB,SVOYAK_MIGRATION_STATUS:'ready'})).status,200);
 assert.equal((await pages.fetch(request('/README.md'),{DB,SVOYAK_MIGRATION_STATUS:'ready'})).status,401);
});
