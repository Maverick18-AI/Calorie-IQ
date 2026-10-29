export function normalizeBarcode(value){const s=String(value||'').replace(/[\s-]/g,'');return /^\d{12,14}$/.test(s)?s.padStart(14,'0'):/^\d{8,11}$/.test(s)?'short:'+s:null}
export function barcodeMatch(a,b){const x=normalizeBarcode(a);return x!==null&&x===normalizeBarcode(b)}
export function localBarcode(foods,code){return [...foods].reverse().find(f=>barcodeMatch(f.barcode,code))}
export function searchWords(value){return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/yoghurt/g,'yogurt').replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean).map(w=>w==='potatoes'?'potato':w.length>3&&w.endsWith('s')&&!w.endsWith('ss')?w.slice(0,-1):w)}
export function relevance(query,food){const terms=searchWords(query),words=searchWords(food.name+' '+(food.brand||''));if(!terms.length)return -Infinity;if(!terms.every(t=>words.some(w=>w===t||w.startsWith(t)&&t.length>=3)))return -Infinity;const phrase=words.join(' '),needle=terms.join(' ');let score=100+terms.length*12-Math.max(0,words.length-terms.length)*2;if(phrase===needle)score+=80;else if(phrase.startsWith(needle))score+=30;else if(phrase.includes(needle))score+=15;score+=food.provenance?.dataset==='foundation'?12:food.provenance?.dataset==='fndds'?3:0;return score}
export function rankFoods(query,foods){return foods.map((food,i)=>({food,i,score:relevance(query,food)})).filter(r=>Number.isFinite(r.score)).sort((a,b)=>b.score-a.score||a.i-b.i).map(r=>r.food)}
export function combineResults(query,{saved=[],usda=[],off=[]}){
 const result=[],seen=new Set(),savedCodes=new Set(saved.map(f=>normalizeBarcode(f.barcode)).filter(Boolean));
 for(const [kind,list]of [['saved',saved],['usda',usda],['off',off]])for(const f of rankFoods(query,list)){
  if(kind!=='saved'&&normalizeBarcode(f.barcode)&&savedCodes.has(normalizeBarcode(f.barcode)))continue;
  const key=kind==='saved'?(normalizeBarcode(f.barcode)||f.id):[f.provenance?.provider||f.source,f.provenance?.dataset||'',f.provenance?.recordId||normalizeBarcode(f.barcode)||f.id].join(':');
  if(seen.has(key))continue;seen.add(key);result.push(f);
 }
 return result.slice(0,48);
}
// Provider results are independent: an outage never erases working local results.
export async function unifiedSearch(query,{saved=[],catalogue,off,signal,onUpdate=()=>{}}){
 const groups={saved:[...saved].reverse(),usda:[],off:[]},issues=[];
 const emit=()=>{if(!signal?.aborted)onUpdate({foods:combineResults(query,groups),issues:[...issues],complete:false})};emit();
 await Promise.all([['usda',()=>catalogue.search(query,{signal})],['off',()=>off.search(query,{signal})]].map(async([name,run])=>{try{groups[name]=await run()}catch(e){if(e.name!=='AbortError')issues.push(e.message)}emit()}));
 if(signal?.aborted)return null;
 const result={foods:combineResults(query,groups),issues,complete:true};onUpdate(result);return result;
}
