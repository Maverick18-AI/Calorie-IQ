import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {USDA_KEYS,ENERGY_IDS,usdaFood} from '../providers/usda.js';
import {foodOK} from '../core.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const spec=JSON.parse(fs.readFileSync(path.join(root,'data/usda/sources.json'),'utf8'));
const output=path.resolve(root,process.argv[2]||'data/usda/'+spec.version);
if(!output.startsWith(root+path.sep))throw Error('Catalogue output must stay inside the project.');
fs.mkdirSync(output,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const ids=new Set([...Object.values(USDA_KEYS),...ENERGY_IDS]);
const manifest={schema:1,version:spec.version,retrieved:spec.retrieved,license:spec.license,licenseUrl:spec.licenseUrl,citation:spec.citation,sources:spec.sources,nutrientDefinitions:{},shards:[],counts:{},index:null};
const records=[],report={input:{},included:{},excluded:{},duplicates:0,qualityWarnings:0};
const seen=new Set();
for(const src of spec.sources){
 const archive=fs.readFileSync(path.join(root,'.source-data',src.id+'.zip'));
 if(sha(archive)!==src.sha256)throw Error('Archive checksum mismatch: '+src.id);
 const raw=fs.readFileSync(path.join(root,'.source-data',src.id+'.json'),'utf8');
 if(sha(raw)!==src.jsonSha256)throw Error('Extracted JSON checksum mismatch: '+src.id);
 const data=JSON.parse(raw),foods=data[Object.keys(data)[0]];
 report.input[src.id]=foods.length;report.excluded[src.id]={};
 for(const f of foods){
  const reject=reason=>report.excluded[src.id][reason]=(report.excluded[src.id][reason]||0)+1;
  const values=[];let invalid=false;
  for(const n of f.foodNutrients||[]){const id=n.nutrient?.id;if(!ids.has(id))continue;
   if(n.amount===undefined||n.amount===null)continue;
   if(typeof n.amount!=='number'||!Number.isFinite(n.amount)||n.amount<0){invalid=true;break}
   const definition={number:n.nutrient.number,name:n.nutrient.name,unit:n.nutrient.unitName};
   if(manifest.nutrientDefinitions[id]&&JSON.stringify(manifest.nutrientDefinitions[id])!==JSON.stringify(definition))throw Error('Conflicting nutrient definition '+id);
   manifest.nutrientDefinitions[id]=definition;values.push([id,n.amount]);
  }
  if(invalid){reject('invalid-nutrient');continue}
  if(!values.length){reject('no-nutrition');continue}
  if(new Set(values.map(v=>v[0])).size!==values.length){reject('duplicate-nutrient-id');continue}
  const portions=(f.foodPortions||[]).filter(p=>typeof p.gramWeight==='number'&&p.gramWeight>=.001&&p.gramWeight<=1e7).sort((a,b)=>(a.sequenceNumber??999)-(b.sequenceNumber??999)).map(p=>{
   const unit=p.measureUnit?.name,quantity=p.amount??p.value;
   const description=p.portionDescription||(quantity!==undefined?[quantity,unit==='undetermined'?'':unit,p.modifier].filter(x=>x!==undefined&&x!=='').join(' '):'');
   return {description,grams:p.gramWeight,original:{id:p.id,amount:quantity??null,measureUnitId:p.measureUnit?.id??null,unit:unit??null,modifier:p.modifier??null}};
  }).filter(p=>p.description&&!/quantity not specified|RACC/i.test(p.description));
  const r={id:f.fdcId,source:src.id,name:f.description,values:values.sort((a,b)=>a[0]-b[0]),portions,published:f.publicationDate||null,category:f.foodCategory?.description||f.wweiaFoodCategory?.wweiaFoodCategoryDescription||'',referenceCode:f.foodCode||f.ndbNumber||null};
  const normalized=usdaFood(r,manifest);
  if(!foodOK(normalized)||!Number.isSafeInteger(r.id)||r.name.length>300){reject('invalid-food');continue}
  if(normalized.cal===null){reject('missing-energy');continue}
  const fingerprint=JSON.stringify([src.id,r.name.trim().toLowerCase(),r.values,r.portions]);
  if(seen.has(fingerprint)){report.duplicates++;continue}seen.add(fingerprint);
  if(normalized.warnings.length)report.qualityWarnings++;
  records.push(r);
 }
 report.included[src.id]=records.filter(r=>r.source===src.id).length;
}
records.sort((a,b)=>a.source.localeCompare(b.source)||a.id-b.id);
const index=[];let chunk=[];
function flush(){if(!chunk.length)return;const name='foods-'+String(manifest.shards.length).padStart(3,'0')+'.json',body=JSON.stringify(chunk);manifest.shards.push({file:name,bytes:Buffer.byteLength(body),sha256:sha(body)});fs.writeFileSync(path.join(output,name),body);chunk=[]}
for(const r of records){
 if(chunk.length&&Buffer.byteLength(JSON.stringify(chunk))+Buffer.byteLength(JSON.stringify(r))>128000)flush();
 const shard=manifest.shards.length,f=usdaFood(r,manifest),per100=r.portions[0]?100/r.portions[0].grams:1;
 index.push([r.id,spec.sources.findIndex(s=>s.id===r.source),r.name,...['cal','pro','carb','fat'].map(k=>f[k]===null?null:f[k]*per100),shard]);chunk.push(r);
}flush();
const body=JSON.stringify(index);manifest.index={file:'index.json',bytes:Buffer.byteLength(body),sha256:sha(body),count:index.length};manifest.counts=report.included;
fs.writeFileSync(path.join(output,'index.json'),body);
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest));
fs.writeFileSync(path.join(root,'data/usda/import-report.json'),JSON.stringify({...report,version:spec.version,indexBytes:manifest.index.bytes,detailBytes:manifest.shards.reduce((s,x)=>s+x.bytes,0),shards:manifest.shards.length},null,2)+'\n');
console.log(JSON.stringify({records:index.length,counts:report.included,indexBytes:manifest.index.bytes,shards:manifest.shards.length,totalDetailBytes:manifest.shards.reduce((s,x)=>s+x.bytes,0),excluded:report.excluded,duplicates:report.duplicates,qualityWarnings:report.qualityWarnings},null,2));
