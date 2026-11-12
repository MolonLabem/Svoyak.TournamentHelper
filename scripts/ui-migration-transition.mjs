// Synthetic browser test: intercept every URL; no production requests or records.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {database,Client} from '../tests/db-helper.mjs';
import app from '../src/worker.mjs';
import source from '../src/sites-entry.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const store=database();const owner=new Client(store.env);const fixture=await owner.create('Synthetic link transition');
const target='https://svoyak.sardarka-300.workers.dev';const old='https://source.invalid';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
const context=await browser.newContext();let targetRequests=0,recoverPosts=0;const errors=[];
try{
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(![old,target].includes(url.origin)){await route.abort();return;}
  if(url.origin===target){targetRequests++;if(url.pathname.endsWith('/recover')&&req.method()==='POST')recoverPosts++;}
  const headers=await req.allHeaders();const body=req.postDataBuffer();
  const request=new Request(req.url(),{method:req.method(),headers,...(body?{body}:{} )});
  const res=await(url.origin===old?source:app).fetch(request,store.env);
  await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.name));
 const privateURL=old+'/t/'+fixture.tournament.id+'#manage='+fixture.managementKey;
 await page.goto(privateURL);await page.waitForSelector('#continue-management',{state:'visible'});
 assert.ok(!page.url().includes(fixture.managementKey),'old URL cleaned');assert.equal(targetRequests,0);assert.equal(recoverPosts,0);
 await page.click('#continue-management');await page.waitForSelector('#modal[open]');
 assert.ok(page.url().startsWith(target));assert.ok(!page.url().includes(fixture.managementKey),'new URL cleaned');assert.equal(recoverPosts,0);
 await page.locator('#modal .actions [data-action="close"]').click();assert.equal(recoverPosts,0);
 assert.equal(await page.locator('[data-view="settings"]').count(),0);
 await page.goto(privateURL);await page.waitForSelector('#continue-management',{state:'visible'});await page.click('#continue-management');
 await page.waitForSelector('#modal[open]');await page.locator('#modal button[type=submit]').click();
 await page.waitForSelector('[data-view="settings"]',{state:'attached'});assert.equal(recoverPosts,1);
 const cookies=await context.cookies(target);assert.ok(cookies.some(c=>c.name==='__Host-svoyak-owner'&&c.secure&&c.httpOnly&&c.sameSite==='Strict'));
 assert.equal(errors.length,0);
 console.log(JSON.stringify({passed:true,old_fragment_cleaned:true,new_fragment_cleaned:true,no_automatic_recovery:true,explicit_cross_hostname_recovery:true,secure_host_cookie:true,browser_errors:errors.length}));
}catch(e){console.error('Transition browser test failed: '+String(e.message).split('\n')[0].replace(/[A-Za-z0-9_-]{43,}/g,'[redacted]'));process.exitCode=1;}
finally{await context.close();await browser.close();store.db.close();}
