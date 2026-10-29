// Fictional fixtures only. No FatSecret data, credentials, OAuth or network calls.
import {validateSearchQuery,rankFoods} from '../search.js';
import {nutrients} from '../nutrients.js';
const fixtures=[
 {id:'snack',name:'Demo Orchard oat snack',brand:'Demo Orchard',cal:160,pro:4,carb:25,fat:5,serving:{description:'1 fictional bar (40 g)',grams:40,ml:null}},
 {id:'bowl',name:'Demo Diner grilled chicken rice bowl',brand:'Demo Diner',cal:520,pro:35,carb:60,fat:15,serving:{description:'1 fictional bowl (350 g)',grams:350,ml:null}},
 {id:'drink',name:'Demo Orchard oat drink',brand:'Demo Orchard',cal:120,pro:3,carb:16,fat:5,serving:{description:'1 fictional cup (240 ml)',grams:null,ml:240}},
];
export function mockFoods(){return fixtures.map(f=>({...Object.fromEntries(nutrients.map(k=>[k,null])),...structuredClone(f),id:'mock-'+f.id,base:1,unit:'serving',basis:f.serving.description,quantity:1,source:'Fictional provider demo',barcode:'',provenance:{provider:'fatsecret-demo',dataset:'synthetic',recordId:f.id,license:'Synthetic test fixture; not provider data'},usage:{persistence:'forbidden'}}))}
const abort=()=>new DOMException('Cancelled','AbortError');
// Simulates an HTTP contract, NOT token acquisition/refresh or server authorization.
export function createMockTransport({scenario='success',delayMs=15,maxRequests=8}={}){
 let requests=0;
 return async(query,{signal}={})=>{
  if(signal?.aborted)throw abort();requests++;
  if(scenario==='timeout')return new Promise((_,reject)=>signal?.addEventListener('abort',()=>reject(abort()),{once:true}));
  await new Promise((resolve,reject)=>{const done=()=>{signal?.removeEventListener('abort',cancel);resolve()},timer=setTimeout(done,delayMs),cancel=()=>{clearTimeout(timer);reject(abort())};signal?.addEventListener('abort',cancel,{once:true})});
  const status=requests>maxRequests||scenario==='rate-limit'?429:scenario==='unauthorized'||scenario==='expired-token'?401:scenario==='outage'?503:200;
  if(status!==200)return Response.json({error:scenario==='expired-token'?'expired-token':'simulated-failure'},{status});
  if(scenario==='malformed')return Response.json({foods:[{name:'Invalid fixture',cal:-2}]});
  return Response.json({foods:rankFoods(query,mockFoods())});
 };
}
export function createMockNutrition({transport=createMockTransport()}={}){return {label:'Fictional demo',async search(query,{signal}={}){
 query=validateSearchQuery(query);const response=await transport(query,{signal});
 if(!response.ok){if(response.status===401)throw Error('Fictional demo: simulated unauthorized/expired-token response (401); no real authentication was attempted.');if(response.status===429)throw Error('Fictional demo: simulated rate limit (429).');throw Error('Fictional demo unavailable (simulated HTTP '+response.status+').')}
 const data=await response.json();if(!data||!Array.isArray(data.foods)||data.foods.length>50||data.foods.some(f=>f.provenance?.provider!=='fatsecret-demo'||f.usage?.persistence!=='forbidden'||!f.id||typeof f.name!=='string'||f.unit!=='serving'||f.base!==1||nutrients.some(k=>f[k]!==null&&(typeof f[k]!=='number'||!Number.isFinite(f[k])||f[k]<0))))throw Error('Fictional demo returned invalid data.');return data.foods;
 }}}
