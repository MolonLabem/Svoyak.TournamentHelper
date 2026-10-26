// Optional browser QA: PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core node scripts/ui-smoke.mjs
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=process.env.APP_URL||'http://127.0.0.1:4173';
const selectView=async view=>{if(view==='tournaments')await page.locator('.app-brand').click();else if(view==='settings'){await page.locator('.more-menu summary').click();await page.locator('.menu-items [data-view="settings"]').click();}else if(view==='finals')await page.locator('.round-tabs [data-view="finals"]').click();else await page.locator(`.main-nav [data-view="${view}"]`).click();};
const confirm=async()=>{await page.locator('#modal button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);};
try{
 await page.goto(url);await page.waitForSelector('h1');
 await page.locator('.home-heading [data-action="new"]').click();
 const name='UI проверка '+Date.now();
 await page.locator('#modal input[name="name"]').fill(name);await page.locator('#modal input[name="date"]').fill('2026-11-01');await page.locator('#modal input[name="location"]').fill('Тестовая площадка');await confirm();
 await page.locator('.more-menu summary').click();await page.locator('button[data-action="register"]').click();await page.locator('#modal textarea').fill('Анна\n АННА ');await page.locator('#modal button[type="submit"]').click();
 await page.waitForFunction(()=>document.querySelector('.modal-error')?.textContent.includes('уникальными'));
 await page.locator('#modal textarea').fill(['Анна','Борис','Вера','Глеб','Дина','Егор','Жанна','Зоя','Игорь'].join('\n'));await confirm();
 assert.equal(await page.locator('#participant-rows tr').count(),9);
 await selectView('rounds');await page.locator('button[data-action="draw"]').click();await confirm();
 for(let round=1;round<=3;round++){
  assert.equal(await page.locator('form[data-form="result"]').count(),3);
  for(let game=1;game<=3;game++){
   const form=page.locator(`form[data-game="r${round}g${game}"]`);
   for(let i=0;i<3;i++)await form.locator('input').nth(i).fill(String(1000-i*300+game*10));
   await form.locator('button[type="submit"]').click();
   await page.waitForFunction(id=>document.querySelector(`form[data-game="${id}"] .pill`)?.textContent.includes('Готово'),`r${round}g${game}`);
  }
  if(round<3){await page.locator('button[data-action="draw"]').click();await confirm();}
 }
 await selectView('finals');await page.locator('button[data-action="finals"]').click();
 for(let i=0;i<4;i++)await page.locator('#modal .final-assignment-row select').nth(i).selectOption('grand');
 for(let i=4;i<8;i++)await page.locator('#modal .final-assignment-row select').nth(i).selectOption('small');await confirm();
 for(let game=0;game<2;game++){
  const form=page.locator(`form[data-game="f${game}"]`);
  for(let i=0;i<4;i++){await form.locator(`input[name="score${i}"]`).fill(String(1000-i*100));await form.locator(`select[name="place${i}"]`).selectOption(String(i+1));}
  await form.locator('button').click();await page.waitForFunction(id=>document.querySelector(`form[data-game="${id}"] .pill`)?.textContent.includes('Готово'),`f${game}`);
 }
 await page.locator('button[data-action="finish"]').click();await confirm();await selectView('standings');
 assert.equal(await page.locator('tbody tr').count(),9);
 await page.locator('.round-head [data-action="export"]').click();const csvPromise=page.waitForEvent('download');await page.locator('button[data-action="csv"]').click();const csv=await csvPromise;const csvText=await readFile(await csv.path(),'utf8');assert.match(csvText,/Игрок/);assert.match(csvText,/Анна/);
 await page.locator('#modal [data-action="close"]').click();await selectView('settings');const backupPromise=page.waitForEvent('download');await page.locator('button[data-action="json"]').click();const backup=await backupPromise;const backupText=await readFile(await backup.path(),'utf8');const data=JSON.parse(backupText);assert.equal(data.tournament.finished,true);assert.equal(data.tournament.rounds.length,3);
 const title=await page.locator('h1').textContent();await page.reload();await page.waitForSelector('h1');assert.equal(await page.locator('h1').textContent(),title,'reload resumes persisted tournament');
 // A separate browser session must see server records, without localStorage.
 const second=await browser.newPage();await second.goto(url+new URL(page.url()).pathname+'#/standings');await second.waitForSelector('h1');assert.equal(await second.locator('h1').textContent(),title);await second.close();
 await selectView('settings');
 // The picker is opened by UI; attach a backup through its DOM input, then confirm as a separate tournament.
 // filePicker uses a detached input, so the OS file chooser is exercised directly below in a new click.
 const chooserPromise=page.waitForEvent('filechooser');await page.locator('button[data-action="restore"]').click();const chooser=await chooserPromise;await chooser.setFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(backupText)});await page.waitForSelector('#modal[open]');await confirm();assert.equal(await page.locator('h1').textContent(),title);
 await selectView('tournaments');assert.ok(await page.locator('.tournament-item').count()>=2);
 await page.locator('.tournament-item button[data-open]').first().click();await page.locator('#toast').evaluate(el=>el.className='');await page.screenshot({path:'outputs/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'outputs/mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile layout must not overflow');
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('UI PASS: creation, duplicate validation, 3 rounds, manual finals, finish, CSV, JSON restore, reload/new-session persistence, mobile layout; no browser errors.');
}catch(error){console.error('UI smoke failed: '+error.name);console.error(error.stack?.split('\n').filter(line=>line.includes('ui-smoke.mjs')).join('\n'));process.exitCode=1;}finally{await context.close();await browser.close();}
