import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rankFoods,combineResults,unifiedSearch,validateSearchQuery,debounceSearch} from '../search.js';
import {foodOK,fresh,validate,recipe,totals,commit,KEY} from '../core.js';
import {changeFoodUnit} from '../nutrition.js';
import {persistenceAllowed} from '../providers/policy.js';
import {mockFoods,createMockNutrition,createMockTransport} from '../providers/mock-nutrition.js';
import {createOFF} from '../providers/off.js';
const empty={search:async()=>[]};
const base={id:'a',name:'Chicken breast',base:1,unit:'serving',basis:'1 serving',cal:100,pro:20,carb:0,fat:2,source:'Custom',barcode:''};
test('brand, apostrophe, diacritic, plural and conservative spelling matches',()=>{
 const foods=[{...base,name:'Demo Diner chicken bowl',brand:'Demo Diner'},{...base,id:'b',name:'Crème yogurt'},{...base,id:'c',name:"Demo's oat snack",brand:"Demo's"}];
 assert.equal(rankFoods('demo diner chicken',foods)[0].name,foods[0].name);
 assert.equal(rankFoods('creme yoghurt',foods)[0].name,'Crème yogurt');assert.equal(rankFoods('demos oat snacks',foods)[0].id,'c');
 const miss=rankFoods('chikcen',foods);assert.equal(miss.length,1);assert.equal(miss[0].searchMatch.kind,'approximate');assert.equal(foods[0].searchMatch,undefined);
 assert.equal(rankFoods('zzzzz',foods).length,0);assert.equal(rankFoods('chickeeeeen',foods).length,0);
 assert.equal(rankFoods('chikcen',[{...base,name:'Chikcen exact'},...foods]).length,1,'exact hits displace spelling guesses');
});
test('preparation words never fuzzy-match or prefix incompatible states',()=>{
 const foods=['raw','cooked','skinless','skin on','unsalted','salted','nonfat','low-fat'].map((state,i)=>({...base,id:String(i),name:'Chicken '+state}));
 for(const word of ['raw','cooked','skinless','skin on','unsalted','salted','nonfat','low fat'])assert.equal(rankFoods('chicken '+word,foods).length,1,word);
 assert.equal(rankFoods('raw',[{...base,name:'Chicken cooked'}]).length,0);assert.equal(rankFoods('skin',[{...base,name:'Chicken skinless'}]).length,0);
});
test('duplicate identities keep conflicting nutrition and unrelated variants separate',()=>{
 const a={...base,provenance:{provider:'off',recordId:'123'},barcode:'044000077174'},b={...a,id:'b'};
 assert.equal(combineResults('chicken',{off:[a,b]}).length,1);
 assert.equal(combineResults('chicken',{off:[a,{...b,cal:101}]}).length,2);
 assert.equal(combineResults('chicken',{off:[a,{...b,barcode:'044000077365',provenance:{provider:'off',recordId:'456'}}]}).length,2);
 const saved={...a,id:'local',cal:130};assert.deepEqual(combineResults('chicken',{saved:[saved],off:[a]}),[saved]);
 const newest={...saved,id:'newest',name:'Chicken label corrected',cal:150},older={...saved,id:'older',name:'Chicken',cal:50};assert.equal(combineResults('chicken',{saved:[newest,older],off:[a]})[0].id,'newest');
 const usda={...base,id:'usda',name:'Chicken long irrelevant description raw',source:'USDA',provenance:{provider:'usda',recordId:'9'}};
 assert.equal(combineResults('chicken',{usda:[usda],off:[{...base,name:'Chicken',source:'OFF'}]})[0].source,'OFF');
});
test('search validation rejects control/long/short inputs before any provider request',async()=>{
 let calls=0;const provider={search:async()=>{calls++;return []}};
 for(const query of ['a','x'.repeat(101),'egg\nraw',Array(18).fill('egg').join(' '),null])await assert.rejects(unifiedSearch(query,{catalogue:provider,off:provider}));
 assert.equal(calls,0);assert.equal(validateSearchQuery('  raw   egg  '),'raw egg');
 const off=createOFF({fetchJSON:async()=>{calls++;return Response.json({products:[]})},storage:null,rateStorage:null,locks:null});await assert.rejects(off.search('x'.repeat(101)));await assert.rejects(off.lookup('../test'));assert.equal(calls,0);
});
test('debouncing cancels superseded submissions and limits providers to two',async()=>{
 const first=new AbortController();const cancelled=debounceSearch(first.signal,50);first.abort();await assert.rejects(cancelled,{name:'AbortError'});await debounceSearch(null,1);
 let active=0,max=0;const search=async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;return [base]};
 const r=await unifiedSearch('chicken',{catalogue:{search},off:{search},additionalProviders:[{label:'Mock',search}]});assert.equal(max,2);assert.equal(r.providerStates.additional,'ready');
});
test('timeouts and malformed providers preserve other sources and cancel late updates',async()=>{
 let cancelled=false;const updates=[];
 const result=await unifiedSearch('chicken',{saved:[base],catalogue:empty,off:{search:(_,{signal})=>new Promise(()=>{signal.addEventListener('abort',()=>cancelled=true)})},providerTimeoutMs:10,onUpdate:r=>updates.push(r)});
 assert.equal(cancelled,true);assert.equal(result.foods[0].id,'a');assert.match(result.issues[0],/Open Food Facts.*timed out/);assert.equal(result.providerStates.off,'unavailable');
 for(const invalid of [null,{},[null],Array(201).fill(base)]){const r=await unifiedSearch('chicken',{catalogue:empty,off:{search:async()=>invalid}});assert.match(r.issues[0],/Open Food Facts.*Invalid search response/)}
 const signal=new AbortController();signal.abort();let calls=0;assert.equal(await unifiedSearch('chicken',{catalogue:{search:()=>calls++},off:empty,signal:signal.signal}),null);assert.equal(calls,0);
});
test('synthetic branded and restaurant mock results are clearly marked and never persisted',async()=>{
 const client=createMockNutrition();const branded=(await client.search('Demo Orchard oat snack'))[0],restaurant=(await client.search('Demo Diner chicken'))[0];
 assert.equal(branded.provenance.provider,'fatsecret-demo');assert.equal(restaurant.cal,520);assert.equal(persistenceAllowed(branded),false);assert.equal(foodOK(branded),false);
 for(const collection of ['foods','recipes','cache','logs','meals']){const d=fresh(),p=d.profiles[0],f={...branded,quantity:1,meal:'Lunch'};
  if(collection==='cache')d.cache=[f];else if(collection==='logs')p.logs['2026-10-29']=[f];else if(collection==='meals')p.meals=[{id:'m',name:'meal',entries:[f]}];else p[collection]=[f];assert.throws(()=>validate(d),/Invalid backup/);
 }
 assert.throws(()=>recipe('Restricted',[{...branded,quantity:1,meal:'Lunch'}],1));
 const normal={...base,ingredients:[branded]};assert.equal(foodOK(normal),false);assert.equal(foodOK({...base,provenance:{provider:'fatsecret'}}),false);assert.equal(foodOK({...base,source:'FatSecret (user corrected)'}),false);
 const db=fresh(),raw=JSON.stringify(db);let stored=raw;const storage={getItem:()=>stored,setItem:(_k,v)=>stored=v};db.profiles[0].foods=[branded];assert.throws(()=>commit(storage,db,0,raw));assert.equal(stored,raw);assert.equal(KEY,'calorieiq-v2');
});
test('mock response simulations cover 401/expiry/429/outage/invalid data without claiming real OAuth',async()=>{
 for(const [scenario,message]of [['unauthorized',/401/],['expired-token',/expired-token/],['rate-limit',/429/],['outage',/503/],['malformed',/invalid data/]])await assert.rejects(createMockNutrition({transport:createMockTransport({scenario,delayMs:0})}).search('chicken'),message);
 const client=createMockNutrition({transport:createMockTransport({maxRequests:1,delayMs:0})});await client.search('chicken');await assert.rejects(client.search('chicken'),/429/);
 const r=await unifiedSearch('chicken',{saved:[base],catalogue:empty,off:empty,additionalProviders:[createMockNutrition({transport:createMockTransport({scenario:'timeout'})})],providerTimeoutMs:10});assert.equal(r.foods[0].id,'a');assert.match(r.issues[0],/Fictional demo.*timed out/);
});
test('mock previews reuse engine: fractional servings and dimensionally valid g/ml conversions',()=>{
 const [snack,bowl,drink]=mockFoods();assert.equal(totals([{...snack,quantity:.5}]).cal,80);assert.equal(totals([{...bowl,quantity:2}]).pro,70);
 const grams=changeFoodUnit({...snack,quantity:.5},'g');assert.equal(grams.quantity,20);assert.equal(totals([grams]).cal,80);assert.equal(totals([grams]).unknown.sodium,1);
 assert.equal(changeFoodUnit(drink,'g'),null);const ml=changeFoodUnit({...drink,quantity:.5},'ml');assert.equal(ml.quantity,120);assert.equal(totals([ml]).cal,60);
});
test('production frontend has no live FatSecret route or credential configuration',()=>{
 for(const file of ['app.js','index.html','sw.js','providers/off.js'])assert.doesNotMatch(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),/oauth\.fatsecret|platform\.fatsecret|connect\/token|client_secret|Bearer\s+[A-Za-z0-9]/i);
 const page=fs.readFileSync(new URL('../dev/provider-demo.html',import.meta.url),'utf8');assert.match(page,/connect-src 'self'/);assert.doesNotMatch(page,/build-config\.js|app\.js|development\.js/);
 // No backend exists: CORS/authentication and deployment security remain unimplemented, not "passed".
});
