import {usdaFood} from './usda.js';
import {rankFoods} from '../search.js';
export const CATALOGUE_VERSION='usda-2026-10-v1';
const ROOT=new URL('../data/usda/'+CATALOGUE_VERSION+'/',import.meta.url);
const CACHE='calorieiq-usda-'+CATALOGUE_VERSION;
const abort=signal=>{if(signal?.aborted)throw new DOMException('Search cancelled','AbortError')};
const hex=b=>[...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
export function createCatalogue({fetchJSON=globalThis.fetch?.bind(globalThis),storage=globalThis.caches}={}){
 let manifest,index;const details=new Map();
 async function read(file,{signal,expected}={}){
  abort(signal);if(!/^(manifest|index|foods-\d{3})\.json$/.test(file))throw Error('Invalid catalogue path.');
  const url=new URL(file,ROOT).href;let cache,response;
  try{cache=await storage?.open(CACHE);response=await cache?.match(url)}catch{}
  if(!response){try{response=await fetchJSON(url,{signal,cache:'no-cache'})}catch(e){if(signal?.aborted)throw new DOMException('Search cancelled','AbortError');throw Error('This USDA file has not been downloaded for offline use. Reconnect and search again.')}if(!response.ok)throw Error('USDA catalogue unavailable. Try saved foods or reconnect.');}
  const text=await response.text();abort(signal);
  if(text.length>2000000)throw Error('USDA catalogue file exceeds its size limit.');
  if(expected&&hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))!==expected){try{await cache?.delete(url)}catch{}throw Error('USDA catalogue integrity check failed. Search again while online to refresh the data.');}
  const json=JSON.parse(text);
  try{if(cache){await cache.put(url,new Response(text,{headers:{'Content-Type':'application/json','X-CalorieIQ-Bytes':String(new TextEncoder().encode(text).length)}}));const keys=await cache.keys(),anchors=new Set([new URL('manifest.json',ROOT).href,new URL('index.json',ROOT).href]);let bytes=0;for(const key of keys)if(anchors.has(key.url))bytes+=Number((await cache.match(key)).headers.get('X-CalorieIQ-Bytes'))||0;for(const key of keys.slice().reverse())if(!anchors.has(key.url)){const size=Number((await cache.match(key)).headers.get('X-CalorieIQ-Bytes'))||0;if(bytes+size>8000000)await cache.delete(key);else bytes+=size} }}catch{}
  return json;
 }
 async function load(signal){
  if(!manifest){const m=await read('manifest.json',{signal});if(m.schema!==1||m.version!==CATALOGUE_VERSION||!Array.isArray(m.sources)||!Array.isArray(m.shards)||m.index?.count>20000)throw Error('Invalid USDA catalogue manifest.');manifest=m;}
  if(!index){const data=await read(manifest.index.file,{signal,expected:manifest.index.sha256});if(!Array.isArray(data)||data.length!==manifest.index.count)throw Error('Invalid USDA search index.');index=data.map(r=>{
   if(!Array.isArray(r)||r.length!==8||!Number.isSafeInteger(r[0])||typeof r[2]!=='string'||!manifest.sources[r[1]]||!manifest.shards[r[7]])throw Error('Invalid USDA index row.');
   return {id:'usda-'+r[0],name:r[2],base:100,unit:'g',basis:'100 g',quantity:100,cal:r[3],pro:r[4],carb:r[5],fat:r[6],source:manifest.sources[r[1]].label,barcode:'',catalogueRecord:r[0],catalogueShard:r[7],provenance:{provider:'usda',dataset:manifest.sources[r[1]].id,recordId:String(r[0]),release:manifest.sources[r[1]].release,retrieved:manifest.retrieved,license:'CC0-1.0'}};
  })}
  abort(signal);return index;
 }
 return {
  async search(query,{signal,limit=24}={}){const foods=await load(signal);return rankFoods(query,foods).slice(0,limit)},
  async resolve(summary,{signal}={}){
   await load(signal);const n=summary.catalogueShard,spec=manifest.shards[n];if(!spec)throw Error('Unknown USDA detail shard.');
   if(!details.has(n)){const rows=await read(spec.file,{signal,expected:spec.sha256});if(!Array.isArray(rows))throw Error('Invalid USDA food details.');details.set(n,rows);while(details.size>4)details.delete(details.keys().next().value)}
   abort(signal);const record=details.get(n).find(r=>r.id===summary.catalogueRecord);if(!record||record.name!==summary.name)throw Error('USDA food detail does not match its search result.');
   return usdaFood(record,manifest);
  },
  get loaded(){return !!index},
  get count(){return index?.length||0}
 };
}
