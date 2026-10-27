// Local-only two-tab score-confirmation regressions. Never print capabilities or cookies.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.APP_URL||'http://127.0.0.1:4173';
assert.ok(['127.0.0.1','localhost'].includes(new URL(origin).hostname),'Synthetic checks are loopback-only.');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true});
const context=await browser.newContext({viewport:{width:1100,height:900},colorScheme:'dark',reducedMotion:'reduce'});
const records=[],errors=[],checks=[];
let success=false;
const safe=error=>String(error?.message??error).split('\n')[0].replace(/[A-Za-z0-9_-]{43,}/g,'[redacted]');
const read=async id=>{const response=await context.request.get(origin+'/api/tournaments/'+id);assert.equal(response.status(),200);return response.json();};
async function send(id,action){const t=await read(id),response=await context.request.post(origin+'/api/tournaments/'+id,{data:{revision:t.revision,action}});assert.equal(response.status(),200);return response.json();}
async function fixture(mode){
 const response=await context.request.post(origin+'/api/tournaments',{data:{name:'QA score confirmation '+mode}});
 assert.equal(response.status(),201);const {tournament}=await response.json(),id=tournament.id;records.push(id);
 await send(id,{type:'register',names:Array.from({length:8},(_,i)=>'Fixture Player '+(i+1))});
 let t=await send(id,{type:'draw'});
 if(mode==='inline'||mode==='retry')return send(id,{type:'results',round:1,game:'r1g1',scores:[1000,700,400,0]});
 for(let round=1;round<=(mode==='historical'?1:3);round++){
  if(round>1)t=await send(id,{type:'draw'});
  for(const g of t.rounds.at(-1).games)t=await send(id,{type:'results',round,game:g.id,scores:[1000,700,400,0]});
 }
 if(mode==='historical')return send(id,{type:'draw'});
 t=await send(id,{type:'finals',groups:[t.players.slice(0,4).map(p=>p.id),t.players.slice(4).map(p=>p.id)]});
 return send(id,{type:'finalResults',game:'f0',scores:[1000,700,400,0]});
}
async function openCorrection(page,mode){
 if(mode==='historical'){
  await page.locator('[data-edit-game="r1g1"]').click();
  await page.locator('#score-correction input').first().fill('1100');
 }else{
  const form=page.locator(`form[data-game="${mode==='final'?'f0':'r1g1'}"]`);
  await form.locator('input').first().fill('1100');await form.locator('input').first().press('Control+Enter');
 }
 await page.waitForSelector('#modal[open] form');
}
try{
 await mkdir('outputs',{recursive:true});
 for(const mode of ['inline','historical','final']){
  const t=await fixture(mode),id=t.id,gameId=mode==='final'?'f0':'r1g1';
  const page=await context.newPage(),other=await context.newPage();
  page.on('pageerror',error=>errors.push(safe(error)));
  const url=origin+'/t/'+id+'#/'+(mode==='final'?'finals':'rounds?round=1');
  await page.goto(url);await other.goto(url);
  await openCorrection(page,mode);
  if(mode==='final'){
   const groups=t.finals.map(g=>[...g.players]);[groups[0][0],groups[1][0]]=[groups[1][0],groups[0][0]];
   await send(id,{type:'rollback',keep:3,confirm:true});await send(id,{type:'finals',groups});
  }else{
   await other.locator('[data-action=swap]').click();
   await other.locator('#swap-players [name=a]').selectOption(t.rounds[0].games[0].players[0]);
   await other.locator('#swap-players [name=b]').selectOption(t.rounds[0].games[1].players[0]);
   await other.locator('#modal button[type=submit]').click();await other.waitForFunction(()=>!document.querySelector('#modal').open);
  }
  const changed=await read(id),before=JSON.stringify(changed),posts=[];
  page.on('request',request=>{if(request.method()==='POST'&&request.url()===origin+'/api/tournaments/'+id)posts.push(true);});
  await page.locator('#modal button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#modal form')?.dataset.stale==='true');
  assert.equal(await page.locator('#modal button[type=submit]').isDisabled(),true);
  assert.equal(await page.locator('#modal .modal-error').evaluate(el=>el===document.activeElement),true);
  assert.ok((await page.locator('#modal .modal-error').innerText()).length>30);
  // A disabled button alone is insufficient: Enter and programmatic repeated submits must also be harmless.
  await page.keyboard.press('Enter');
  await page.locator('#modal form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
  assert.equal(JSON.stringify(await read(id)),before);assert.equal(posts.length,1);
  if(mode==='inline')for(const width of [1100,390])for(const theme of ['dark','light']){
   await page.setViewportSize({width,height:844});await page.evaluate(value=>window.SvoyakAppearance.set(value),theme);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:`outputs/score-conflict-${theme}-${width}.png`,fullPage:true});
  }
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#modal').open&&document.activeElement?.id==='main-content');
  assert.equal(await page.locator('#main-content').evaluate(el=>el===document.activeElement),true);
  await page.reload();await page.waitForSelector(`form[data-game="${gameId}"]`);
  const fresh=mode==='final'?changed.finals[0]:changed.rounds[0].games[0],form=page.locator(`form[data-game="${gameId}"]`);
  assert.equal(await form.locator('input').first().inputValue(),'');
  for(const [index,score]of [900,600,300,0].entries())await form.locator('input').nth(index).fill(String(score));
  await form.locator('input').first().press('Control+Enter');
  await page.waitForFunction(()=>document.body.dataset.saving!=='true');
  const saved=await read(id),game=mode==='final'?saved.finals[0]:saved.rounds[0].games[0];
  assert.deepEqual(game.players,fresh.players);assert.deepEqual(game.scores,[90000,60000,30000,0]);
  assert.equal(posts.length,2);
  checks.push(mode+' correction rejects the stale review, repeated submissions cannot write, fresh lineup saves');
  console.log('PASS: '+checks.at(-1));await page.close();await other.close();
 }
 const t=await fixture('retry'),page=await context.newPage();
 await page.goto(origin+'/t/'+t.id+'#/rounds?round=1');await openCorrection(page,'inline');
 let fail=true;await page.route('**/api/tournaments/'+t.id,async route=>{
  if(fail&&route.request().method()==='POST'){fail=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary fixture failure'})});}
  else await route.continue();
 });
 await page.locator('#modal button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#modal .modal-error')?.textContent.includes('Temporary fixture failure'));
 assert.equal(await page.locator('#modal button[type=submit]').isEnabled(),true);
 assert.equal(await page.locator('#modal form').getAttribute('data-stale'),null);
 await page.locator('#modal button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);
 assert.equal((await read(t.id)).rounds[0].games[0].scores[0],110000);
 checks.push('transient failure keeps the same reviewed input retryable');console.log('PASS: '+checks.at(-1));
 await page.close();assert.deepEqual(errors,[]);success=true;
}catch(error){console.error('Score confirmation QA failed: '+safe(error));console.error(error.stack?.split('\n').filter(line=>line.includes('ui-score-conflicts.mjs')).join('\n'));}
finally{
 let cleaned=0;
 for(const id of records)try{const t=await read(id);const response=await context.request.post(origin+'/api/tournaments/'+id+'/delete',{data:{revision:t.revision,confirm:true}});assert.equal(response.status(),200);cleaned++;}catch{success=false;console.error('Synthetic fixture cleanup failed.');}
 await context.close();await browser.close();
 console.log(JSON.stringify({passed:success,checks:checks.length,syntheticRecordsCleaned:cleaned,browserErrors:errors.length}));
}
if(!success)process.exitCode=1;
