const ui=require('./ui.cjs');
require('../build-config.js');
const activeBuild=globalThis.CALORIEIQ_BUILD;
const assert = require('node:assert/strict');

// Runs in isolated browser contexts. No production API or personal profile is used.
module.exports = async function reliability(browser) {
  const base = 'http://127.0.0.1:4173';
  const key = 'calorieiq-v2';
  const failures = [];
  let passed = 0;
  async function run(name, action, {unsupported = false} = {}) {
    const context = await browser.newContext({viewport: {width: 390, height: 844}});
    try {
      await context.route('https://world.openfoodfacts.org/**', route => route.abort());
      await context.addInitScript(({unsupported,activeBuild}) => {
        if (unsupported) Object.defineProperty(navigator, 'locks', {value: undefined});
        // Fixed profile IDs make recovery assertions independent of UUID randomness.
        if (!unsupported && !localStorage.getItem('calorieiq-v2')) {
          localStorage.setItem('calorieiq-development-build',JSON.stringify(activeBuild));
          const profile = (id, name) => ({id, name, goals: {cal: 2200, pro: 120, carb: 250, fat: 70}, dayGoals: {}, logs: {}, foods: [], recipes: [], meals: [], weights: []});
          localStorage.setItem('calorieiq-v2', JSON.stringify({version: 2, revision: 0, active: 'me', profiles: [profile('me','Me'), profile('family','Family')], cache: [], lastBackup: null}));
        }
      }, {unsupported,activeBuild});
      const errors = [], decisions = [], dialogs = [];
      function instrument(page) {
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', async dialog => {
          dialogs.push(dialog.message());
          if (decisions.shift() === 'dismiss') await dialog.dismiss();
          else await dialog.accept();
        });
      }
      const page = await context.newPage(); instrument(page);
      await page.goto(base);
      await page.waitForFunction(() => document.querySelector('#remaining').textContent.length > 0);
      const nav = (name, target = page) => ui.nav(target,name);
      const saved = (target = page) => target.evaluate(() => JSON.parse(localStorage.getItem('calorieiq-v2')));
      async function food(name, target = page) {
        await ui.manual(target);
        await target.locator('#name').fill(name);
        await target.locator('#unit').selectOption('serving');
        await target.locator('#cal').fill('100');
      }
      await action({context, page, decisions, dialogs, instrument, nav, saved, food});
      assert.deepEqual(errors, []);
      console.log('PASS reliability: ' + name); passed++;
    } catch (error) {
      failures.push({name, error}); console.error('FAIL reliability: ' + name + '\n' + error.stack);
    } finally { await context.close(); }
  }

  await run('ambiguous food requires label units; mass and volume are not relabeled', async ({context,page,nav,saved}) => {
    await context.unroute('https://world.openfoodfacts.org/**');
    await context.route('https://world.openfoodfacts.org/**', route => route.fulfill({json: {product: {product_name:'Ambiguous liquid',serving_size:'250 ml',nutriments:{'energy-kcal_100g':50,proteins_100g:3}}}}));
    await ui.barcode(page); await page.locator('#barcode').fill('1234567890123'); await page.locator('#barcodeForm button').click();
    await page.waitForFunction(() => document.querySelector('#name').value === 'Ambiguous liquid');
    assert.equal(await page.locator('#unit').inputValue(), '');
    await page.locator('#submitFood').click();
    assert.deepEqual((await saved()).profiles[0].logs, {});
    await page.locator('#unit').selectOption('serving');
    assert.equal(await page.locator('#unit').inputValue(), '');
    await page.locator('#unit').selectOption('ml'); await page.locator('#quantity').fill('250');
    await page.locator('#submitFood').click();
    const entries = Object.values((await saved()).profiles[0].logs).flat();
    assert.equal(entries[0].unit, 'ml'); assert.equal(entries[0].base, 100); assert.equal(entries[0].cal * entries[0].quantity / entries[0].base,125);
    await page.locator('#entries').getByRole('button',{name:'Edit',exact:true}).click();
    await page.locator('#unit').selectOption('g');
    assert.equal(await page.locator('#cal').inputValue(),'');
    assert.equal(await page.locator('#pro').inputValue(),'');
  });

  await run('kg/lb changes convert an entered or edited weight', async ({page,nav,saved}) => {
    await nav('progress'); await page.locator('#weightUnit').selectOption('kg');await page.locator('#weight').fill('70');
    await page.locator('#weightUnit').selectOption('lb');
    assert.ok(Math.abs(Number(await page.locator('#weight').inputValue())-154.323583526)<1e-6);
    await page.locator('#weightUnit').selectOption('kg');
    assert.ok(Math.abs(Number(await page.locator('#weight').inputValue())-70)<1e-7);
    await page.locator('#weightForm button').click();
    assert.ok(Math.abs((await saved()).profiles[0].weights[0].kg-70)<1e-7);
    await page.locator('#weights').getByRole('button',{name:'Edit',exact:true}).click();
    await page.locator('#weightUnit').selectOption('lb'); await page.locator('#weightForm button').click();
    assert.ok(Math.abs((await saved()).profiles[0].weights[0].kg-70)<1e-6);
    await page.locator('#weightUnit').selectOption('kg'); assert.equal(await page.locator('#weight').inputValue(),'');
  });

  await run('late search AND barcode responses cannot reopen Add Food', async ({page,nav}) => {
    for (const type of ['search','barcode']) {
      await nav('add');
      await page.evaluate(() => {window.fetch = (url,options) => {window.lookupSignal=options.signal;return new Promise(resolve => window.finishLookup = resolve)}});
      if(type==='search'){await page.locator('#query').fill('milk');await page.locator('#searchForm button').click()}
      else {await ui.barcode(page);await page.locator('#barcode').fill('1234567890123');await page.locator('#barcodeForm button').click()}
      await page.waitForFunction(() => typeof window.finishLookup === 'function');
      await nav('diary');
      assert.equal(await page.evaluate(()=>lookupSignal.aborted),true);
      await page.evaluate(type => window.finishLookup({ok:true,json:async()=>type==='search'?{products:[{product_name:'Old result',nutriments:{'energy-kcal_100g':100}}]}:{product:{product_name:'Old result',nutriments:{'energy-kcal_100g':100}}}}),type);
      await page.waitForTimeout(80);
      assert.equal(await page.locator('#diary').isVisible(),true);
      assert.equal(await page.locator('#results').textContent(),'');
      assert.notEqual(await page.locator('#name').inputValue(),'Old result');
      await page.evaluate(() => delete window.finishLookup);
    }
  });

  await run('food drafts survive navigation/reload and can cancel replacement/restore', async ({page,nav,food,decisions,saved}) => {
    await food('Keep my food'); await nav('library'); await nav('add');
    assert.equal(await page.locator('#name').inputValue(),'Keep my food');
    assert.equal(await page.evaluate(()=>Object.hasOwn(JSON.parse(sessionStorage.getItem('calorieiq-drafts-v1')),'raw')),false);
    decisions.push('dismiss'); await page.locator('#manual').click();
    assert.equal(await page.locator('#name').inputValue(),'Keep my food');
    const before=await saved();await nav('settings');decisions.push('dismiss');await page.locator('#import').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(before))});await page.waitForFunction(()=>document.querySelector('#import').value==='');assert.deepEqual(await saved(),before);assert.equal(await page.locator('#name').inputValue(),'Keep my food');
    await page.reload(); await page.waitForFunction(() => document.querySelector('#name').value==='Keep my food');
    await nav('add');assert.equal(await page.locator('#cal').inputValue(),'100');
    assert.equal(await page.locator('#profile').count(),0);
    assert.equal(await page.locator('#name').inputValue(),'Keep my food');
  });

  await run('recipe ingredients/name/yield survive navigation and reload', async ({page,nav,food,decisions}) => {
    await food('Ingredient'); await page.locator('#addIngredient').click();
    await page.locator('#recipeName').fill('Keep recipe');await page.locator('#recipeYield').fill('3');
    await nav('progress');await nav('library');
    assert.match(await page.locator('#ingredients').textContent(),/Ingredient/);
    decisions.push('dismiss');await page.locator('#clearRecipe').click();
    assert.equal(await page.locator('#recipeName').inputValue(),'Keep recipe');
    await page.reload();await nav('library');
    assert.equal(await page.locator('#recipeName').inputValue(),'Keep recipe');
    assert.equal(await page.locator('#recipeYield').inputValue(),'3');
    assert.match(await page.locator('#ingredients').textContent(),/Ingredient/);
    await page.locator('#recipeForm button:not([type])').click();
    assert.match(await page.locator('#recipes').textContent(),/Keep recipe/);
    await page.locator('#recipes').getByRole('button',{name:'Edit recipe',exact:true}).click();
    await page.locator('#recipeYield').fill('6');await page.reload();await nav('library');
    assert.equal(await page.locator('#recipeYield').inputValue(),'6');
    await page.locator('#recipeForm button:not([type])').click();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('calorieiq-v2')).profiles[0].recipes.length),1);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('calorieiq-v2')).profiles[0].recipes[0].yield),6);
  });

  await run('diary and saved-food edits recover their identity, not duplicate records', async ({page,food,nav,saved}) => {
    await food('Original');await page.locator('#saveFood').check();await page.locator('#submitFood').click();
    await page.locator('#entries').getByRole('button',{name:'Edit',exact:true}).click();await page.locator('#quantity').fill('2');
    await nav('library');await nav('add');await page.reload();await nav('add');
    await page.locator('#submitFood').click();
    let entries=Object.values((await saved()).profiles[0].logs).flat();assert.equal(entries.length,1);assert.equal(entries[0].quantity,2);
    await ui.manageFoods(page);await page.locator('#savedFoods').getByRole('button',{name:'Edit food',exact:true}).click();await page.locator('#cal').fill('300');
    await page.reload();await nav('add');await page.locator('#submitFood').click();
    const db=await saved();assert.equal(db.profiles[0].foods.length,1);assert.equal(db.profiles[0].foods[0].cal,300);
    entries=Object.values(db.profiles[0].logs).flat();assert.equal(entries[0].cal,100);
  });

  await run('unsaved goals and weights survive navigation with no profile controls', async ({page,nav,decisions}) => {
    await nav('settings');await page.locator('#goal-cal').fill('1850');
    await nav('diary');await nav('settings');assert.equal(await page.locator('#goal-cal').inputValue(),'1850');
    assert.equal(await page.locator('#profileForm').count(),0);assert.equal(await page.locator('#goal-cal').inputValue(),'1850');
    await nav('progress');await page.locator('#weight').fill('65');await nav('diary');await nav('progress');assert.equal(await page.locator('#weight').inputValue(),'65');
  });

  await run('recipe import rejects inconsistent library data and preserves historic snapshots', async ({page,nav,saved}) => {
    const valid=await page.evaluate(async()=>{const {recipe,uid}=await import('./core.js');const d=JSON.parse(localStorage.getItem('calorieiq-v2'));const f={id:uid(),name:'Ingredient',base:100,unit:'g',basis:'100 g',source:'Custom',barcode:'',cal:400,pro:null,carb:50,fat:15,quantity:30,meal:'Lunch'};const r=recipe('Recipe',[f],4);d.profiles[0].recipes=[r];d.profiles[0].logs['2026-10-28']=[{...r,id:uid(),cal:999,quantity:2,meal:'Lunch'}];return d});
    await nav('settings');const before=JSON.stringify(await saved());const bad=structuredClone(valid);bad.profiles[0].recipes[0].cal=1234;
    await page.locator('#import').setInputFiles({name:'bad-recipe.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});
    await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Inconsistent recipe'));
    assert.equal(JSON.stringify(await saved()),before);
    await page.locator('#import').setInputFiles({name:'valid-v2.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(valid))});
    await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Backup restored'));
    assert.equal((await saved()).profiles[0].logs['2026-10-28'][0].cal,999);
  });

  await run('simultaneous tabs cannot overwrite each other; takeover recovers the losing draft', async ({context,page,food,saved,instrument,nav,decisions}) => {
    await food('Writer A');
    const second=await context.newPage();instrument(second);await second.goto(base);await second.waitForFunction(()=>document.querySelector('#remaining').textContent.length>0);
    assert.match(await second.locator('#notice').textContent(),/read-only/);await food('Writer B',second);
    await Promise.all([page.locator('#submitFood').click(),second.locator('#submitFood').click()]);
    let names=Object.values((await saved()).profiles[0].logs).flat().map(e=>e.name);assert.deepEqual(names,['Writer A']);
    assert.equal(await second.locator('#name').inputValue(),'Writer B');
    await ui.recovery(second);const dl=second.waitForEvent('download');await second.locator('#downloadDrafts').click();assert.match((await dl).suggestedFilename(),/unsaved-drafts/);
    await page.close();await second.locator('#claimWriter').click();await second.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Reload'));
    await second.reload();await nav('add',second);assert.equal(await second.locator('#name').inputValue(),'Writer B');
    decisions.push('dismiss');await second.locator('#submitFood').click();names=Object.values((await saved(second)).profiles[0].logs).flat().map(e=>e.name);assert.deepEqual(names,['Writer A']);
    await second.locator('#submitFood').click();names=Object.values((await saved(second)).profiles[0].logs).flat().map(e=>e.name);assert.deepEqual(names,['Writer A','Writer B']);
  });

  await run('without Web Locks, saving fails closed without initializing a database', async ({page,food}) => {
    assert.match(await page.locator('#notice').textContent(),/read-only/);await food('Do not overwrite');await page.locator('#submitFood').click();
    assert.equal(await page.evaluate(()=>localStorage.getItem('calorieiq-v2')),null);
    assert.equal(await page.locator('#name').inputValue(),'Do not overwrite');
  }, {unsupported:true});

  await run('corrupt startup data can still be restored with the original captured for recovery', async ({page,nav,saved}) => {
    const good=await saved();
    await page.evaluate(()=>localStorage.setItem('calorieiq-v2','{"logs":null}'));
    await page.reload();await page.waitForFunction(()=>document.querySelector('#remaining').textContent.length>0);
    assert.match(await page.locator('#notice').textContent(),/Saving is blocked/);
    await nav('settings');
    await page.locator('#import').setInputFiles({name:'recovery.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(good))});
    await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Backup restored'));
    assert.equal((await saved()).profiles[0].id,'me');
    assert.equal(await page.evaluate(()=>localStorage.getItem('calorieiq-recovery-v2')),'{"logs":null}');
  });

  console.log(`Reliability browser checks: ${passed} passed, ${failures.length} failed.`);
  if(failures.length)throw Error(failures.map(f=>f.name).join('; '));
};
