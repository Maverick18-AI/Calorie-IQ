const ui=require('./ui.cjs');
require('../build-config.js');
// Run with PLAYWRIGHT_PATH set to an installed Playwright package; local server must be running.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('dialog',d=>d.accept(d.type()==='prompt'?'Meal template':undefined));
 await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>document.querySelector('#remaining').textContent.length>0);
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await ui.manual(page);await page.locator('#name').fill('<img src=x onerror=alert(1)> Yogurt');await page.locator('#base').fill('100');await page.locator('#unit').selectOption('g');await page.locator('#quantity').fill('30');await page.locator('#cal').fill('400');await page.locator('#pro').fill('10');await page.locator('#carb').fill('50');await page.locator('#fat').fill('15');await page.locator('#saveFood').check();await page.locator('#submitFood').click();
 assert.match(await page.locator('#calSummary').textContent(),/120 consumed/);assert.equal(await page.locator('#entries img').count(),0);
 await page.locator('#entries').getByRole('button',{name:'Edit',exact:true}).click();await page.locator('#quantity').fill('60');await page.locator('#submitFood').click();assert.match(await page.locator('#calSummary').textContent(),/240 consumed/);
 await page.locator('#entries').getByRole('button',{name:'Delete',exact:true}).click();await page.locator('#undo').click();assert.match(await page.locator('#calSummary').textContent(),/240 consumed/);
 await ui.reuse(page);await page.locator('#saveMeal').click();await ui.manageFoods(page);await page.locator('#savedFoods').getByRole('button',{name:'Use',exact:true}).click();await page.locator('#quantity').fill('100');await page.locator('#addIngredient').click();await page.locator('#recipeName').fill('Yogurt recipe');await page.locator('#recipeYield').fill('4');await page.locator('#recipeForm button[type=submit], #recipeForm button:not([type])').click();assert.match(await page.locator('#recipes').textContent(),/Yogurt recipe/);
 await page.getByRole('button',{name:'Weight',exact:true}).click();await page.locator('#weightUnit').selectOption('kg');await page.locator('#weight').fill('70');await page.locator('#weightForm button').click();assert.match(await page.locator('#weightSummary').textContent(),/70 kg/);
 await page.getByRole('button',{name:'Goals',exact:true}).click();await page.locator('#goal-cal').fill('1900');await page.locator('#goalForm button:not([type])').click();const compatibility=await page.evaluate(async()=>{const d=JSON.parse(localStorage.getItem('calorieiq-v2'));const {newProfile}=await import('./core.js');d.profiles.push(newProfile('Earlier version archive'));return d});await page.locator('#import').setInputFiles({name:'compatible.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(compatibility))});await page.getByRole('button',{name:'Food Log',exact:true}).click();assert.match(await page.locator('#calSummary').textContent(),/240 consumed \/ 1,?900/);assert.equal(await page.locator('#profile').count(),0);
 await page.getByRole('button',{name:'Goals',exact:true}).click();const before=await page.evaluate(()=>localStorage.getItem('calorieiq-v2'));await page.locator('#import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"logs":null,"goals":null}')});assert.equal(await page.evaluate(()=>localStorage.getItem('calorieiq-v2')),before);
 await ui.backups(page);const download=page.waitForEvent('download');await page.locator('#export').click();assert.match((await download).suggestedFilename(),/calorieiq/);
 const backup=await page.evaluate(()=>localStorage.getItem('calorieiq-v2'));await page.locator('#import').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(backup)});assert.match(await page.locator('#notice').textContent(),/Backup restored/);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('calorieiq-recovery-v2')).profiles.length),2);

 await context.route('https://world.openfoodfacts.org/**',async route=>route.fulfill({json:{product:{product_name:'Mock milk',nutrition_data_per:'100ml',nutriments:{'energy-kcal_100g':50,proteins_100g:3}}}}));await ui.barcode(page);await page.locator('#barcode').fill('1234567890123');await page.locator('#barcodeForm button').click();await page.waitForFunction(()=>document.querySelector('#name').value==='Mock milk');assert.equal(await page.locator('#unit').inputValue(),'ml');assert.equal(await page.locator('#fat').inputValue(),'');
 await page.getByRole('button',{name:'Food Log',exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'tests/diary-mobile.png',fullPage:true});
 await context.setOffline(true);await page.reload();await page.waitForFunction(()=>document.querySelector('#remaining').textContent.length>0);assert.match(await page.locator('#calSummary').textContent(),/240 consumed/);assert.equal(await page.evaluate(()=>typeof ZXingBrowser.BrowserMultiFormatOneDReader),'function');await context.setOffline(false);
 // Exercise the real bundled decoder on empty frames, then cancel pending camera startup.
 await ui.openAdd(page);
 await page.evaluate(()=>{window.BarcodeDetector=undefined;const c=document.createElement('canvas');c.width=640;c.height=480;c.getContext('2d').fillRect(0,0,640,480);window.testStream=c.captureStream(8);Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,writable:true,value:async()=>window.testStream})});
 await page.locator('#scan').click();await page.waitForTimeout(1000);assert.equal(await page.locator('#scanner').isVisible(),true);assert.match(await page.locator('#lookupStatus').textContent(),/Aim at the barcode/);await page.locator('#stopScan').click();assert.equal(await page.evaluate(()=>testStream.getTracks()[0].readyState),'ended');
 await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=100;window.pendingStream=c.captureStream(8);navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>window.finishCamera=resolve)});
 await page.locator('#scan').click();await page.locator('#stopScan').click();await page.evaluate(()=>finishCamera(pendingStream));await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>pendingStream.getTracks()[0].readyState),'ended');assert.equal(await page.locator('#scanner').isVisible(),false);
 await page.getByRole('button',{name:'Food Log',exact:true}).click();
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'tests/diary-desktop.png',fullPage:true});
 // Independent legacy migration context.
 const legacy=await browser.newContext({serviceWorkers:'block'});await legacy.route('**/build-config.js',route=>route.fulfill({contentType:'application/javascript',body:'globalThis.CALORIEIQ_BUILD='+JSON.stringify({...globalThis.CALORIEIQ_BUILD,development:false})}));await legacy.addInitScript(()=>{if(!localStorage.getItem('calorieiq-v2'))localStorage.setItem('calorieiq-v1',JSON.stringify({logs:{'2026-10-28':[{name:'Old food',servings:2,cal:200,pro:20,carb:4,fat:8}]},goals:{'2026-10-28':1800}}))});const lp=await legacy.newPage();await lp.goto('http://127.0.0.1:4173');await lp.waitForFunction(()=>localStorage.getItem('calorieiq-v2'));assert.equal(await lp.evaluate(()=>JSON.parse(localStorage.getItem('calorieiq-v2')).profiles[0].logs['2026-10-28'][0].cal),100);await legacy.close();
 assert.deepEqual(errors,[]);console.log('Browser checks passed: Food Log, edit/delete/undo, XSS rendering, goals, recipes, meals, older-profile backup retention, weight, invalid restore, export, mocked lookup, legacy migration, offline shell/scanner, mobile overflow.');
 await require('./reliability.cjs')(browser);
 await require('./servings.cjs')(browser);
 await require('./v22.cjs')(browser);
 await require('./v23.cjs')(browser);
 await require('./multisource.cjs')(browser);
 await require('./v25.cjs')(browser);
 await require('./update.cjs')(browser);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
