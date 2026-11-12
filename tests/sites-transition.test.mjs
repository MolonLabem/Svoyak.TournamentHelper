import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import source from '../src/sites-entry.mjs';
import {redirectBrowser} from '../src/sites-redirect.mjs';
import {database} from './db-helper.mjs';

test('old source serves transition without D1 or cookies; every API/write/export is closed',async()=>{
 const env=new Proxy({},{get(){throw Error('Source must never access bindings');}});
 for(const [path,method,status] of [['/','GET',200],['/t/synthetic','GET',200],['/t/synthetic','HEAD',200],['/api/tournaments','GET',410],['/api/tournaments/synthetic/recover','POST',410],['/__migration/read','POST',410],['/__migration/manifest','GET',410],['/','POST',410]]){
  const response=await source.fetch(new Request('https://old.invalid'+path,{method}),env);
  assert.equal(response.status,status);assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer');
  if(method==='HEAD')assert.equal(await response.text(),'');
 }
 const html=await(await source.fetch(new Request('https://old.invalid/t/synthetic'))).text();
 assert.match(html,/href="https:\/\/svoyak-tournament\.pages\.dev\/t\/synthetic"/);
 const script=await(await source.fetch(new Request('https://old.invalid/migration-redirect.mjs'))).text();assert.match(script,/history.replaceState/);
});

function visit(hash,path='/t/synthetic'){
 const elements=new Map();const navigations=[],history=[];
 const context={
  location:{pathname:path,hash,replace:url=>navigations.push(url)},
  history:{replaceState:(_state,_title,url)=>history.push(url)},
  document:{querySelector(selector){
   if(!elements.has(selector))elements.set(selector,{hidden:true,listeners:{},addEventListener(type,listener){this.listeners[type]=listener;}});
   return elements.get(selector);
  }}
 };
 runInNewContext(`(${redirectBrowser.toString()})();`,context);
 return {elements,navigations,history};
}
test('old private fragment is cleared and only an explicit click forwards it to the fixed hostname',()=>{
 const key='a'.repeat(43),page=visit('#manage='+key);
 assert.deepEqual(page.history,['/t/synthetic']);assert.equal(page.navigations.length,0);
 const link=page.elements.get('#public-destination');assert.ok(!link.href.includes(key));
 const button=page.elements.get('#continue-management');assert.equal(button.hidden,false);button.listeners.click();
 assert.ok(page.navigations[0]==='https://svoyak-tournament.pages.dev/t/synthetic#manage='+key);
});
test('invalid fragments and foreign-looking paths cannot forward a capability or choose a host',()=>{
 for(const [hash,path] of [['#manage=invalid','/t/synthetic'],['#manage='+'a'.repeat(43),'//evil.invalid'],['#/standings','/t/synthetic']]){
  const page=visit(hash,path);assert.equal(page.navigations.length,0);assert.equal(page.elements.has('#continue-management'),false);
  const link=page.elements.get('#public-destination');assert.ok(link.href.startsWith('https://svoyak-tournament.pages.dev/'));assert.ok(!link.href.includes('manage'));
 }
});
test('source archive rejects writes from old deployments without modifying any existing fields',()=>{
 const {db}=database();
 try{
  db.prepare('INSERT INTO tournaments VALUES (?,?,?,?,?)').run('legacy',' {"id":"legacy"} ',7,'unchanged',null);
  db.prepare('INSERT INTO tournament_owner_sessions VALUES (?,?,?)').run('legacy','synthetic',123);
  const before=JSON.stringify([db.prepare('SELECT * FROM tournaments').all(),db.prepare('SELECT * FROM tournament_owner_sessions').all()]);
  db.exec(readFileSync(new URL('../drizzle/0004_freeze_sites_source.sql',import.meta.url),'utf8'));
  for(const sql of ["INSERT INTO tournaments VALUES ('blocked','{}',0,'now',NULL)","UPDATE tournaments SET revision=revision+1","DELETE FROM tournaments","INSERT INTO tournament_owner_sessions VALUES ('legacy','blocked',1)","UPDATE tournament_owner_sessions SET expires_at=1","DELETE FROM tournament_owner_sessions"])assert.throws(()=>db.exec(sql),/Source frozen/);
  assert.equal(JSON.stringify([db.prepare('SELECT * FROM tournaments').all(),db.prepare('SELECT * FROM tournament_owner_sessions').all()]),before);
 }finally{db.close();}
});
