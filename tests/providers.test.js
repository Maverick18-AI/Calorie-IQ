import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {usdaFood,convertNutrient} from '../providers/usda.js';
import {offFood,createOFF} from '../providers/off.js';
import {createCatalogue} from '../providers/catalogue.js';
import {rankFoods,barcodeMatch,localBarcode,combineResults,unifiedSearch} from '../search.js';
import {totals,changeFoodUnit,recipe,fresh,validate} from '../core.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/usda-references.json',import.meta.url))),offFixtures=JSON.parse(fs.readFileSync(new URL('./fixtures/off-products.json',import.meta.url)));
const food=id=>usdaFood(fixture.foods.find(f=>f.id===id),fixture);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);
test('real FDC examples retain source IDs, release, units and reference energy',()=>{
 for(const [id,kcal]of [[2707152,143],[331960,166],[2346401,81],[168878,130],[173944,89],[2514743,190],[330137,61]]){
  const f=food(id),g=changeFoodUnit({...f,quantity:f.base},'g')||f;
  near(totals([{...g,quantity:100}]).cal,kcal);assert.equal(f.provenance.recordId,String(id));assert.equal(f.provenance.license,'CC0-1.0');assert.equal(f.nutritionSource.originalBasis.unit,'g');
 }
 assert.equal(food(2346401).nutritionSource.energyId,2048); // Specific Atwater, not an averaged energy estimate.
});
test('real egg portions: 1/.5/2 eggs, 100g and 40g scale without density assumptions',()=>{
 const f=food(2707152);assert.equal(f.serving.grams,50);assert.equal(f.serving.ml,null);
 for(const [q,kcal]of [[1,71.5],[.5,35.75],[2,143]])near(totals([{...f,quantity:q}]).cal,kcal);
 const g=changeFoodUnit({...f,quantity:1},'g');near(totals([{...g,quantity:40}]).cal,57.2);assert.equal(changeFoodUnit({...f,quantity:1},'ml'),null);
});
test('real cooked rice reference gives 130 kcal/100g and 52 kcal/40g',()=>{
 const f=food(168878),g=changeFoodUnit({...f,quantity:1},'g');assert.equal(f.serving.grams,158);near(totals([{...g,quantity:40}]).cal,52);near(totals([{...f,quantity:.5}]).cal,102.7);
});
test('explicit g/mg/µg and kcal/kJ conversions preserve zero and unknown',()=>{
 assert.equal(convertNutrient(.12,'g','mg'),120);near(convertNutrient(.0025,'mg','µg'),2.5);assert.equal(convertNutrient(1,'μg','mg'),.001);near(convertNutrient(418.4,'kJ','kcal'),100);
 assert.equal(convertNutrient(0,'g','mg'),0);assert.equal(convertNutrient(null,'g','mg'),null);assert.equal(convertNutrient(-1,'g','mg'),null);assert.equal(convertNutrient(1,'ml','g'),null);
 assert.equal(food(2707152).sodium,64.5);assert.equal(food(2707152).vitD,1.25);assert.equal(food(330137).vitD,0);assert.equal(food(2346401).b12,null);
});
test('mixed-source recipes and saved snapshots preserve micronutrients and provenance',()=>{
 const egg={...food(2707152),quantity:1,meal:'Breakfast'},rice={...food(168878),quantity:.5,meal:'Breakfast'},r=recipe('Egg and rice',[egg,rice],2),d=fresh();d.profiles[0].recipes=[r];d.profiles[0].logs['2026-10-29']=[{...r,quantity:2,meal:'Breakfast'}];
 near(r.cal,87.1);const restored=validate(JSON.parse(JSON.stringify(d)));assert.equal(restored.profiles[0].recipes[0].ingredients[0].provenance.dataset,'fndds');egg.cal=999;near(restored.profiles[0].recipes[0].cal,87.1);
 const branded=offFood(offFixtures[2].product,{retrieved:offFixtures[2].retrieved}),grams=changeFoodUnit({...branded,quantity:branded.base},'g')||branded;
 const mixed=recipe('USDA egg and OFF Nutella',[{...food(2707152),quantity:1,meal:'Lunch'},{...grams,quantity:40,meal:'Lunch'}],2);near(mixed.cal,143.55);assert.equal(mixed.ingredients[0].provenance.provider,'usda');assert.equal(mixed.ingredients[1].provenance.provider,'off');d.profiles[0].recipes=[mixed];assert.doesNotThrow(()=>validate(d));
});
test('real inaccurate Ritz fixtures are flagged and retained, never silently repaired',()=>{
 const box=offFood(offFixtures[0].product,{retrieved:offFixtures[0].retrieved}),pack=offFood(offFixtures[1].product,{retrieved:offFixtures[1].retrieved});
 assert.equal(box.cal,1.3);assert.equal(box.requiresReview,true);assert.equal(pack.requiresReview,true);assert.equal(box.provenance.provider,'off');assert.match(box.provenance.license,/ODbL/);
 const correction={...box,name:'Ritz crackers (package label)',cal:130,pro:2,carb:15,fat:7,source:'Package label (user corrected)',id:'correction'};
 assert.equal(localBarcode([correction],offFixtures[0].requestedBarcode).cal,130);near(totals([{...correction,quantity:2}]).cal,260);
});
test('OFF keeps original field identifiers/standard units and rejects booleans, blanks and negative values',()=>{
 const f=offFood(offFixtures[2].product,{retrieved:'2026-10-29'});assert.ok(f.nutritionSource.originalValues.some(v=>v.id==='sodium_100g'&&v.unit==='g'));
 const bad=offFood({nutrition_data_per:'serving',nutriments:{'energy-kcal_serving':true,proteins_serving:' ',fat_serving:-1}});assert.equal(bad.cal,null);assert.equal(bad.pro,null);assert.equal(bad.fat,null);assert.equal(bad.requiresReview,true);
});
test('barcode padding preserves exact corrected identity, while unrelated short codes stay distinct',()=>{
 assert.equal(barcodeMatch('044000077174','0044000077174'),true);assert.equal(barcodeMatch('044000077174','044000077365'),false);assert.equal(barcodeMatch('12345678','00000012345678'),false);
 const a={id:'old',barcode:'044000077174'},b={id:'latest',barcode:'0044000077174'};assert.equal(localBarcode([a,b],'044000077174').id,'latest');
});
test('ranking recognizes potato/plural and retains raw/cooked/skin distinctions',()=>{
 const foods=[{name:'Chicken breast cooked, skin on'},{name:'Chicken breast raw'},{name:'Chicken breast cooked, skinless'}];
 assert.deepEqual(rankFoods('raw chicken breast',foods).map(f=>f.name),['Chicken breast raw']);assert.equal(rankFoods('raw potato',[{name:'Potatoes, russet, raw'}]).length,1);
 assert.equal(rankFoods('plain greek yogurt',[{name:'Yogurt, Greek, plain, nonfat'}]).length,1);
});
test('unified results prioritize saved corrections without averaging provider nutrition',()=>{
 const saved={name:'Crackers',source:'Package label',barcode:'044000077174',id:'local',cal:130},remote={...saved,id:'remote',cal:1.3,source:'Open Food Facts',provenance:{provider:'off',recordId:'0044000077174'}};
 const result=combineResults('crackers',{saved:[saved],off:[remote]});assert.deepEqual(result,[saved]);
 const different={...remote,barcode:'044000077365',provenance:{provider:'off',recordId:'044000077365'}};assert.equal(combineResults('crackers',{saved:[saved],off:[different]}).length,2);
});
test('provider failures preserve saved and USDA results; aborted searches never publish late updates',async()=>{
 const local={name:'Egg',id:'local'},usda={name:'Egg, raw',id:'usda'};const updates=[];
 const result=await unifiedSearch('egg',{saved:[local],catalogue:{search:async()=>[usda]},off:{search:async()=>{throw Error('503 unavailable')}},onUpdate:r=>updates.push(r)});assert.equal(result.foods.length,2);assert.match(result.issues[0],/503/);
 const controller=new AbortController();let resolve;const pending=unifiedSearch('egg',{catalogue:{search:()=>new Promise(r=>resolve=r)},off:{search:async()=>[]},signal:controller.signal,onUpdate:r=>updates.push(r)});controller.abort();const count=updates.length;resolve([usda]);assert.equal(await pending,null);assert.equal(updates.length,count);
});
test('OFF handles 429, 503, malformed responses, cancellation and conservative rate limits',async()=>{
 for(const [status,message]of [[429,/rate limit/],[503,/503/]]){const client=createOFF({fetchJSON:async()=>new Response('',{status}),storage:null,rateStorage:null,locks:null});await assert.rejects(client.search('rice'),message)}
 const bad=createOFF({fetchJSON:async()=>new Response('not JSON',{headers:{'Content-Type':'text/html'}}),storage:null,rateStorage:null,locks:null});await assert.rejects(bad.search('rice'),/malformed/);
 const client=createOFF({fetchJSON:async()=>new Response('{"products":[]}',{headers:{'Content-Type':'application/json'}}),storage:null,rateStorage:null,locks:null});for(let i=0;i<8;i++)await client.search('rice');await assert.rejects(client.search('rice'),/wait a minute/);
 const c=new AbortController();c.abort();await assert.rejects(client.search('rice',{signal:c.signal}),e=>e.name==='AbortError');
});
class MemoryCache{
 map=new Map();async match(k){return this.map.get(typeof k==='string'?k:k.url)?.clone()}async put(k,v){this.map.set(typeof k==='string'?k:k.url,v.clone())}async keys(){return [...this.map.keys()].map(url=>({url}))}async delete(k){return this.map.delete(typeof k==='string'?k:k.url)}
}
test('OFF timeout and unknown product errors are explicit; cached records retain the original retrieval date',async()=>{
 const slow=createOFF({timeoutMs:5,storage:null,rateStorage:null,locks:null,fetchJSON:(_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Timeout','AbortError')),{once:true}))});await assert.rejects(slow.search('rice'),/timed out/);
 const missing=createOFF({storage:null,rateStorage:null,locks:null,fetchJSON:async()=>new Response('',{status:404})});await assert.rejects(missing.lookup('044000077174'),/Product not found/);
 const cache=new MemoryCache(),storage={open:async()=>cache};let time=Date.parse('2026-10-29T23:00:00Z'),calls=0;
 const cached=createOFF({storage,rateStorage:null,locks:null,now:()=>time,fetchJSON:async()=>{calls++;return new Response(JSON.stringify({product:offFixtures[2].product}),{headers:{'Content-Type':'application/json'}})}});
 assert.equal((await cached.lookup('3017620422003')).provenance.retrieved,'2026-10-29');time+=2*3600000;assert.equal((await cached.lookup('3017620422003')).provenance.retrieved,'2026-10-29');assert.equal(calls,1);
});
test('catalogue loads only index then selected detail, verifies hashes and works from downloaded cache',async()=>{
 const cache=new MemoryCache(),storage={open:async()=>cache};let requests=0,online=true;
 const catalogue=createCatalogue({storage,fetchJSON:async url=>{requests++;if(!online)throw Error('Offline');return new Response(fs.readFileSync(fileURLToPath(url),'utf8'))}});
 const results=await catalogue.search('raw egg');assert.equal(requests,2);const egg=results.find(f=>f.catalogueRecord===2707152);assert.ok(egg);await catalogue.resolve(egg);assert.equal(requests,3);
 online=false;const reopened=createCatalogue({storage,fetchJSON:async()=>{throw Error('Offline')}});const again=(await reopened.search('raw egg')).find(f=>f.catalogueRecord===2707152);assert.equal((await reopened.resolve(again)).cal,71.5);
 const key=(await cache.keys()).find(k=>k.url.endsWith('index.json'));await cache.put(key,new Response('[]'));await assert.rejects(createCatalogue({storage,fetchJSON:async()=>{throw Error('Offline')}}).search('egg'),/integrity/);assert.equal(await cache.match(key),undefined);
});
test('all shipped detail files and public catalogue counts pass integrity and cache-budget checks',async()=>{
 const m=JSON.parse(fs.readFileSync(new URL('../data/usda/usda-2026-10-v1/manifest.json',import.meta.url))),index=JSON.parse(fs.readFileSync(new URL('../data/usda/usda-2026-10-v1/index.json',import.meta.url))),cache=new MemoryCache(),catalogue=createCatalogue({storage:{open:async()=>cache},fetchJSON:async url=>new Response(fs.readFileSync(fileURLToPath(url),'utf8'))});
 assert.deepEqual(m.counts,{foundation:364,legacy:7793,fndds:5431});assert.equal(index.length,13588);assert.ok(m.shards.every(s=>s.bytes<=128000));
 for(let n=0;n<m.shards.length;n++){const row=index.find(r=>r[7]===n);const f=await catalogue.resolve({catalogueRecord:row[0],name:row[2],catalogueShard:n});assert.ok(f.provenance.recordId)}
 let bytes=0;for(const key of await cache.keys())bytes+=Number((await cache.match(key)).headers.get('X-CalorieIQ-Bytes'))||0;assert.ok(bytes<=8000000,`USDA cache is ${bytes} bytes`);
});
