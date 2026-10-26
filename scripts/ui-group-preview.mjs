// Local-only regression: setup preview is the real pairing partition, and remains visible before confirmation.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {suggestedGroupSizes} from '../src/domain.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.APP_URL||'http://127.0.0.1:4173';assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const c=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',reducedMotion:'reduce'}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
const confirm=async()=>{await p.locator('#modal button[type=submit]').click();await p.waitForFunction(()=>!document.querySelector('#modal').open);};
let id,t;const read=async()=>t=await(await c.request.get(base+'/api/tournaments/'+id)).json();const action=async value=>{const r=await c.request.post(base+'/api/tournaments/'+id,{data:{revision:t.revision,action:value}});assert.equal(r.status(),200);t=await r.json();};
try{
 await p.goto(base);await p.locator('.home-heading [data-action=new]').click();await p.locator('input[name=name]').fill('QA · Размеры боёв');const created=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/tournaments'&&r.request().method()==='POST');await confirm();id=(await(await created).json()).tournament.id;await read();
 for(const n of [0,1,2,3,4,5,6,7,9,14,37,40]){
  if(n>t.players.length)await action({type:'register',names:Array.from({length:n-t.players.length},(_,i)=>'Синтетический '+(t.players.length+i+1))});await p.goto(base+'/t/'+id+'#/participants');await p.reload();await p.waitForFunction(expected=>Number(document.querySelector('.heading-count')?.textContent)===expected,n);await p.waitForSelector('#draw-preview');const text=await p.locator('#draw-preview').innerText(),button=p.locator('[data-action=draw]');
  if([0,1].includes(n)){assert.equal(await button.isDisabled(),true);assert.ok(text.length>0);continue;}
  const expected=suggestedGroupSizes(n),actualCounts=[...text.matchAll(/(\d+) (?:бой|боя|боёв) по ([234]) игрока/g)].flatMap(match=>Array(Number(match[1])).fill(Number(match[2])));assert.deepEqual(actualCounts,expected,`preview partition for ${n}: ${JSON.stringify(text)}`);assert.equal(await button.isEnabled(),true);
  if(n===14){for(const theme of ['light','dark']){await p.selectOption('[data-appearance]',theme);await p.locator('#toast').evaluate(el=>el.className='');await p.screenshot({path:`outputs/group-preview-${theme}-desktop.png`,fullPage:true});await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:`outputs/group-preview-${theme}-mobile.png`,fullPage:true});await p.setViewportSize({width:1440,height:1000});}}
  await button.click();assert.ok(!await p.locator('#modal p').first().innerText().then(s=>s.includes('3–4')),'confirmation only protects locking');await confirm();await read();assert.deepEqual(t.rounds[0].games.map(game=>game.players.length),expected);await action({type:'rollback',keep:0,confirm:true});
 }
 // Removing an actual roster entry refreshes preview through the same UI mutation.
 await p.goto(base+'/t/'+id+'#/participants');await p.reload();await p.waitForSelector('#participant-rows');await p.locator('.row-menu summary').last().click();await p.locator('[data-remove-player]').last().click();await confirm();await read();assert.equal(t.players.length,39);assert.equal(await p.locator('#draw-preview').innerText(),'9 боёв по 4 игрока · 1 бой по 3 игрока');
 await p.locator('#player-entry').fill('Ещё один тест');await p.locator('#player-entry').press('Enter');assert.equal(await p.locator('[data-action=draw]').isDisabled(),true);await p.locator('.name-chip').click();assert.equal(await p.locator('[data-action=draw]').isEnabled(),true);
 assert.equal(await p.locator('link[rel=icon]').getAttribute('href'),'/logo.svg');assert.equal(await p.locator('.app-logo').evaluate(el=>el.complete&&el.naturalWidth>0),true);for(const theme of ['light','dark']){await p.selectOption('[data-appearance]',theme);await p.setViewportSize({width:320,height:740});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 assert.equal(errors.length,0);console.log(JSON.stringify({passed:true,counts:[0,1,2,3,4,5,6,7,9,14,37,40],generatedGroupsMatch:true,removalAndPendingSelection:true,logoHeaderAndFavicon:true,uncaughtBrowserErrors:errors.length}));
}catch(e){console.error('Group preview regression failed: '+e.message);console.error(e.stack?.split('\n').filter(s=>s.includes('ui-group-preview.mjs')).join('\n'));process.exitCode=1;}finally{await c.close();await browser.close();}
