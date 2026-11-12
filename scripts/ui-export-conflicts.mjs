// Loopback-only export regressions. Never print management capabilities or cookies.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import {gamesCSV,ratingTSV} from '../src/sheet-export.mjs';
import {resultCard,telegramTextBlocks} from '../src/result-card.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.APP_URL||'http://127.0.0.1:4173';
assert.ok(['127.0.0.1','localhost'].includes(new URL(origin).hostname),'Synthetic checks are loopback-only.');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true});
const options={viewport:{width:1100,height:900},colorScheme:'light',reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']};
const owner=await browser.newContext(options),viewer=await browser.newContext(options);
const records=[],errors=[],checks=[];let success=false;
const safe=error=>String(error?.message??error).split('\n')[0].replace(/[A-Za-z0-9_-]{43,}/g,'[redacted]');
const pass=message=>{checks.push(message);console.log('PASS: '+message);};
const read=async id=>{const response=await owner.request.get(origin+'/api/tournaments/'+id);assert.equal(response.status(),200);return response.json();};
async function send(id,action){const t=await read(id),response=await owner.request.post(origin+'/api/tournaments/'+id,{data:{revision:t.revision,action}});assert.equal(response.status(),200);return response.json();}
async function complete(id){
 let t=await read(id);
 for(let round=t.rounds.length+1;round<=3;round++){
  t=await send(id,{type:'draw'});
  for(const g of t.rounds.at(-1).games)t=await send(id,{type:'results',round,game:g.id,scores:g.players.map((_,i)=>[100,0,-10.25,0][i])});
 }
 t=await send(id,{type:'finals',groups:[t.players.map(p=>p.id)]});
 return send(id,{type:'finalResults',game:'f0',scores:t.players.map((_,i)=>i%3===0?100:i%3===1?0:-10.25)});
}
async function fixture(count){
 const response=await owner.request.post(origin+'/api/tournaments',{data:{name:'QA export '+count,date:'2026-11-12',location:'PRIVATE VENUE',scoreDivisor:333}});
 assert.equal(response.status(),201);const {tournament}=await response.json(),id=tournament.id;records.push(id);
 await send(id,{type:'register',names:Array.from({length:count},(_,i)=>i?'Тест Игрок '+(i+1):'=SUM(1;2)')});
 return complete(id);
}
async function pageFor(context,id,view='finals'){
 const page=await context.newPage();page.on('pageerror',error=>errors.push(safe(error)));
 await page.goto(origin+'/t/'+id+'#/'+view);await page.waitForSelector('#view-content');return page;
}
const draft=page=>page.evaluate(()=>sessionStorage.getItem('svoyak-draft:'+location.pathname.split('/').at(-1)));
async function openExport(page){await page.locator('[data-action=export]').click();await page.waitForSelector('#export-status');}
async function download(page,action){
 const pending=page.waitForEvent('download');await page.locator('[data-action='+action+']').click();
 const file=await pending;return readFile(await file.path(),'utf8');
}
async function copyRating(page,expected){
 await page.locator('[data-action=copy-rating]').click();
 await page.waitForFunction(async text=>await navigator.clipboard.readText()===text,ratingTSV(expected));
 assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),ratingTSV(expected));
}
try{
 await mkdir('outputs',{recursive:true});
 const initial=await fixture(5),id=initial.id;
 const page=await pageFor(owner,id),other=await pageFor(owner,id,'rounds?round=1');
 await page.locator('form[data-game=f0] input').first().fill('98765');
 const savedDraft=await draft(page);assert.ok(savedDraft);
 await other.locator('[data-edit-game=r1g1]').click();
 assert.ok((await other.locator('#score-correction .confirm-detail').innerText()).includes('Финалы будут отменены'));
 await other.locator('#score-correction input').first().fill('456.75');
 await other.locator('#modal button[type=submit]').click();await other.waitForFunction(()=>!document.querySelector('#modal').open);
 let latest=await read(id);assert.equal(latest.rounds.length,1);assert.equal(latest.finals.length,0);
 await openExport(page);
 assert.ok(!(await page.locator('#modal').innerText()).includes('Не включены в Data'));
 assert.ok((await page.locator('#modal').innerText()).includes('2 сыгранных боёв'));
 assert.equal(await download(page,'games-csv'),gamesCSV(latest));
 const standings=await download(page,'csv');assert.ok(!standings.includes('PRIVATE'));assert.ok(!standings.includes('98765'));
 assert.equal(standings.split('\r\n').length,6);assert.ok(standings.split('\r\n').slice(1).every(line=>line.endsWith(';""')));
 await copyRating(page,latest);
 assert.equal(await draft(page),savedDraft);assert.equal((await read(id)).revision,latest.revision);
 pass('a stale owner tab exports the corrected saved round without cancelled finals or draft values');

 latest=await complete(id);
 await page.evaluate(()=>navigator.clipboard.writeText('UNCHANGED'));
 await page.locator('[data-action=copy-rating]').click();
 await page.waitForFunction(()=>document.querySelector('#export-status')?.textContent.includes('Результаты изменились'));
 assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'UNCHANGED');
 assert.ok((await page.locator('#modal').innerText()).includes('ГФ (5 игроков)'));
 assert.equal(await page.locator('#export-status').evaluate(el=>el===document.activeElement),true);
 await copyRating(page,latest);
 const full=await download(page,'games-csv');assert.equal(full,gamesCSV(latest));
 assert.equal(full.split('\r\n').filter(line=>line.includes('"ГФ"')).length,5);
 assert.ok(full.includes("'=SUM(1;2)"));assert.equal(await draft(page),savedDraft);
 pass('changes while the export dialog is open require reviewing updated exclusions before copying');

 const route=origin+'/api/tournaments/'+id;
 const fail=handler=>handler.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Тестовая ошибка загрузки'})});
 await page.locator('#modal [data-action=close]').click();await page.route(route,fail);
 await page.locator('[data-action=export]').click();await page.waitForSelector('[data-action=export-retry]');
 assert.equal(await page.locator('[data-export-action]').count(),0);
 await page.unroute(route,fail);await page.locator('[data-action=export-retry]').click();await page.waitForSelector('#export-status');
 let downloads=0;page.on('download',()=>downloads++);
 await page.route(route,fail);await page.locator('[data-action=games-csv]').click();
 await page.waitForFunction(()=>document.querySelector('#export-status').textContent.includes('Экспорт не выполнен'));
 assert.equal(downloads,0);assert.equal(await page.locator('[data-action=games-csv]').isEnabled(),true);
 await page.unroute(route,fail);assert.equal(await download(page,'games-csv'),gamesCSV(latest));
 await page.locator('#modal [data-action=close]').click();
 let release,entered;const blocked=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
 const delay=async handler=>{entered();await gate;await handler.continue();};
 await page.route(route,delay);await page.locator('[data-action=export]').click();await blocked;
 await page.locator('#modal [data-action=close]').click();
 const response=page.waitForResponse(route);release();await response;await page.unroute(route,delay);
 assert.equal(await page.locator('#modal').evaluate(el=>el.open),false);assert.equal(await draft(page),savedDraft);
 pass('load failures never export cached data; retry and closing during a pending load preserve the draft');

 const publicPage=await pageFor(viewer,id,'standings');await openExport(publicPage);
 assert.equal(await publicPage.locator('[data-action=private-link],[data-view=settings]').count(),0);
 assert.equal(await download(publicPage,'games-csv'),gamesCSV(latest));await copyRating(publicPage,latest);
 assert.equal((await viewer.request.get(route+'/backup')).status(),401);
 assert.equal((await viewer.request.post(route,{data:{revision:latest.revision,action:{type:'finish'}}})).status(),401);
 for(const theme of ['light','dark']){
  await publicPage.locator('#modal [data-action=close]').click();await publicPage.selectOption('[data-appearance]',theme);
  await publicPage.setViewportSize({width:390,height:844});await openExport(publicPage);
  assert.equal(await publicPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await publicPage.screenshot({path:'outputs/export-correction-'+theme+'-390.png',fullPage:true});
 }
 pass('spectators export identical formula-safe public results while private routes remain denied');

 const big=await fixture(40),textPage=await pageFor(owner,big.id);
 await textPage.locator('form[data-game=f0] input').first().fill('9999');const textDraft=await draft(textPage);
 await textPage.locator('#view-content [data-result-image]').click();await textPage.waitForSelector('#result-image-preview img');
 await textPage.locator('#result-image-text>summary').click();
 const blocks=telegramTextBlocks(resultCard(big,'finals'));assert.ok(blocks.length>1);
 for(let i=0;i<blocks.length;i++){
  assert.equal(await textPage.locator('#result-text-block').inputValue(),blocks[i]);
  await textPage.locator('[data-action=text-copy]').click();
  await textPage.waitForFunction(async text=>await navigator.clipboard.readText()===text,blocks[i]);
  assert.equal(await textPage.evaluate(()=>navigator.clipboard.readText()),blocks[i]);
  if(i<blocks.length-1)await textPage.locator('[data-action=text-next]').click();
 }
 await textPage.locator('[data-action=text-prev]').click();
 assert.equal(await textPage.locator('#result-text-block').inputValue(),blocks.at(-2));
 assert.equal(await draft(textPage),textDraft);assert.equal((await read(big.id)).revision,big.revision);
 await textPage.keyboard.press('Escape');assert.equal(await textPage.locator('form[data-game=f0] input').first().inputValue(),'9999');
 await other.goto(origin+'/t/'+id+'#/history');assert.ok((await other.locator('#view-content').innerText()).includes('Подробности отменённых игр входят в резервную копию JSON'));
 assert.equal(errors.length,0);
 pass('all 40-player text blocks copy and paginate with an unsaved score; history explains recovery limits');
 success=true;
}catch(error){
 console.error('Export QA failed: '+safe(error));
 console.error(error.stack?.split('\n').filter(line=>line.includes('ui-export-conflicts.mjs')).join('\n'));
}finally{
 let cleaned=0;
 for(const id of records)try{const t=await read(id),response=await owner.request.post(origin+'/api/tournaments/'+id+'/delete',{data:{revision:t.revision,confirm:true}});assert.equal(response.status(),200);cleaned++;}catch{success=false;console.error('Synthetic fixture cleanup failed.');}
 await owner.close();await viewer.close();await browser.close();
 console.log(JSON.stringify({passed:success,checks:checks.length,syntheticRecordsCleaned:cleaned,browserErrors:errors.length}));
}
if(!success)process.exitCode=1;
