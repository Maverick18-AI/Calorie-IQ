import {productFood} from '../nutrition.js';
import {nutrientInfo} from '../nutrients.js';
export const OFF_FIELDS='code,product_name,product_name_en,brands,nutriments,serving_size,serving_quantity,serving_quantity_unit,nutrition_data_per,quantity,product_quantity,product_quantity_unit,servings_per_container,ingredients_text,ingredients_text_en,last_modified_t';
export function offFood(product,{retrieved=new Date().toISOString().slice(0,10)}={}){
 const f=productFood(product);f.brand=(Array.isArray(product.brands)?product.brands.join(', '):String(product.brands||'')).slice(0,300);
 const original=[];let invalid=false;for(const info of [...Object.values(nutrientInfo),{off:'energy'}])for(const suffix of ['_100g','_serving']){const key=info.off+suffix,value=product.nutriments?.[key];if(value===undefined||value===null||typeof value==='string'&&value.trim()==='')continue;const valid=(typeof value==='number'||typeof value==='string')&&Number.isFinite(Number(value))&&Number(value)>=0;if(!valid)invalid=true;original.push({id:key,amount:value,unit:info.off==='energy'?'kJ':info.off==='energy-kcal'?'kcal':'g',enteredUnit:product.nutriments?.[info.off+'_unit']??null})}
 f.nutritionSource.originalValues=original;
 f.nutritionSource.originalBasis={declared:String(product.nutrition_data_per||''),selected:f.nutritionSource.selected,standardUnit:f.nutritionSource.standardUnit};
 if(invalid){f.warnings.push('Invalid or negative nutrient values were ignored. Verify and correct the package label.');f.requiresReview=true}
 f.ingredientText=String(product.ingredients_text_en||product.ingredients_text||'').slice(0,10000);
 f.provenance={provider:'off',dataset:'products',recordId:String(product.code||''),release:null,retrieved,published:Number.isFinite(Number(product.last_modified_t))&&Number(product.last_modified_t)>0&&Number(product.last_modified_t)<1e11?new Date(Number(product.last_modified_t)*1000).toISOString().slice(0,10):null,license:'ODbL-1.0 / DbCL-1.0',url:'https://world.openfoodfacts.org/product/'+String(product.code||'')};
 if(f.provenance.published&&Date.parse(retrieved)-Date.parse(f.provenance.published)>3*365*86400000)f.warnings.push('Manufacturer record is more than three years old. Verify the current label.');
 return f;
}
export function createOFF({fetchJSON=(...args)=>globalThis.fetch(...args),storage=globalThis.caches,rateStorage=globalThis.localStorage,locks=globalThis.navigator?.locks,now=()=>Date.now(),version='development',timeoutMs=12000}={}){
 const memory={search:[],product:[]};let cooldown=0;
 async function take(kind){const run=()=>{const time=now();let rates=memory;
  try{const saved=JSON.parse(rateStorage?.getItem('calorieiq-off-rate-v1')||'null');if(saved&&Array.isArray(saved.search)&&Array.isArray(saved.product))rates=saved}catch{}
  rates[kind]=rates[kind].filter(t=>typeof t==='number'&&t>time-60000&&t<=time);
  if(time<cooldown||rates[kind].length>=(kind==='search'?8:12))throw Error('Please wait a minute before more online lookups. USDA and saved foods remain available.');rates[kind].push(time);Object.assign(memory,rates);
  try{rateStorage?.setItem('calorieiq-off-rate-v1',JSON.stringify(rates))}catch{}
 };if(locks?.request)await locks.request('calorieiq-off-rate',run);else run()}
 async function request(url,kind,{signal}={}){
  const controller=new AbortController(),cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
  let cache;try{cache=await storage?.open('calorieiq-off-http-v1');const hit=await cache?.match(url);if(hit){const stored=Number(hit.headers.get('X-CalorieIQ-Time'));if(now()-stored<(kind==='search'?30*60000:86400000)){signal?.removeEventListener('abort',cancel);if(signal?.aborted)throw new DOMException('Cancelled','AbortError');return {data:await hit.json(),retrieved:new Date(stored).toISOString().slice(0,10)}}}}catch{}
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');await take(kind);const response=await fetchJSON(url,{signal:controller.signal,headers:{Accept:'application/json','User-Agent':'CalorieIQ/'+version+' (https://github.com/Maverick18-AI/Calorie-IQ)'}});
   if(!response.ok){if(response.status===429){cooldown=now()+60000;throw Error('Open Food Facts rate limit (429). Please wait a minute. USDA and saved foods remain available.')}if(kind==='product'&&response.status===404)throw Error('Product not found. Enter it manually.');throw Error('Open Food Facts unavailable (HTTP '+response.status+'). Try USDA, saved or manual food.')}
   const type=response.headers?.get('content-type');if(type&&!type.includes('json'))throw Error('Open Food Facts returned malformed/non-JSON data. USDA and saved foods remain available.');
   const result=await response.json();if(!result||typeof result!=='object'||JSON.stringify(result).length>2000000)throw Error('Open Food Facts returned an invalid or oversized response.');if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
   try{if(cache){await cache.put(url,new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json','X-CalorieIQ-Time':String(now()),'X-CalorieIQ-Bytes':String(new TextEncoder().encode(JSON.stringify(result)).length)}}));const keys=await cache.keys();let bytes=0;for(const key of keys.slice().reverse()){const size=Number((await cache.match(key)).headers.get('X-CalorieIQ-Bytes'))||0;if(bytes+size>4000000||keys.indexOf(key)<keys.length-24)await cache.delete(key);else bytes+=size}}}catch{}
   return {data:result,retrieved:new Date(now()).toISOString().slice(0,10)};
  }catch(e){if(signal?.aborted)throw new DOMException('Cancelled','AbortError');if(e.name==='AbortError')throw Error('Open Food Facts lookup timed out. USDA and saved foods remain available.');if(e instanceof TypeError)throw Error('Open Food Facts could not be reached. USDA and saved foods remain available.');if(e instanceof SyntaxError)throw Error('Open Food Facts returned malformed JSON. USDA and saved foods remain available.');throw e}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel)}
 }
 const identity='&app_name=CalorieIQ&app_version='+encodeURIComponent(version);
 return {
  async search(query,{signal}={}){if(globalThis.navigator?.onLine===false)throw Error('Offline: online packaged-food search is unavailable. Previously downloaded USDA data and saved foods may still work.');
   const url='https://world.openfoodfacts.org/cgi/search.pl?search_terms='+encodeURIComponent(query)+'&search_simple=1&action=process&json=1&page_size=12&fields='+OFF_FIELDS+identity;
   const {data:j,retrieved}=await request(url,'search',{signal});if(!Array.isArray(j.products))throw Error('Open Food Facts returned an unexpected search response.');return j.products.map(p=>offFood(p,{retrieved}));
  },
  async lookup(code,{signal}={}){const {data:j,retrieved}=await request('https://world.openfoodfacts.org/api/v3/product/'+encodeURIComponent(code)+'.json?fields='+OFF_FIELDS+identity,'product',{signal});if(!j.product)throw Error('Product not found. Enter it manually.');return offFood({...j.product,code:j.product.code||code},{retrieved})},
 };
}
