import {nutrients} from '../nutrients.js';

// FDC nutrient IDs, not display-name matching. All source quantities are per 100 g.
export const USDA_KEYS={pro:1003,fat:1004,carb:1005,sugar:2000,fiber:1079,sat:1258,sodium:1093,cholesterol:1253,potassium:1092,calcium:1087,iron:1089,magnesium:1090,vitC:1162,vitD:1114,b12:1178,folate:1177};
export const ENERGY_IDS=[2048,1008,2047,1062];
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
export function convertNutrient(amount,from,to){
 if(!finite(amount))return null;
 const unit=s=>String(s).toLowerCase().replaceAll('μ','µ');from=unit(from);to=unit(to);
 if(from===to)return amount;
 const mass={g:1,mg:.001,'µg':.000001,ug:.000001};
 if(mass[from]&&mass[to])return amount*mass[from]/mass[to];
 if(from==='kj'&&to==='kcal')return amount/4.184;
 if(from==='kcal'&&to==='kj')return amount*4.184;
 return null;
}
const appUnit=k=>['calcium','iron','magnesium','sodium','potassium','cholesterol','vitC'].includes(k)?'mg':['vitD','b12','folate'].includes(k)?'µg':'g';
export function usdaValues(record,definitions){
 const original=new Map(record.values.map(([id,value])=>[id,value])),values=Object.fromEntries(nutrients.map(k=>[k,null]));
 const energyId=ENERGY_IDS.find(id=>finite(original.get(id))&&convertNutrient(original.get(id),definitions[id]?.unit,'kcal')!==null);
 if(energyId)values.cal=convertNutrient(original.get(energyId),definitions[energyId].unit,'kcal');
 for(const [key,id]of Object.entries(USDA_KEYS))if(key in values&&original.has(id))values[key]=convertNutrient(original.get(id),definitions[id]?.unit,appUnit(key));
 return {values,energyId};
}
export function qualityWarnings(values,{basisGrams=100,published,dataset}={}){
 const warnings=[];
 if(values.cal===null)warnings.push('Calories are unavailable. Verify this record before logging.');
 if(values.cal!==null&&values.cal>1000)warnings.push('Calories exceed the plausible per-100 g range. Verify the source.');
 if(['pro','carb','fat'].every(k=>values[k]!==null)){
  const mass=values.pro+values.carb+values.fat,energy=4*values.pro+4*values.carb+9*values.fat;
  if(mass>basisGrams*1.1)warnings.push('Reported macro mass exceeds the stated food mass.');
  if(values.cal!==null&&Math.abs(values.cal-energy)>Math.max(30,energy*.35))warnings.push('Calories and macros are substantially inconsistent. Fiber, alcohol or source error may contribute.');
 }
 if(values.sat!==null&&values.fat!==null&&values.sat>values.fat+.5)warnings.push('Saturated fat exceeds total fat. Verify the source.');
 if(dataset==='branded'&&published&&Date.parse(published)<Date.parse('2023-10-29'))warnings.push('Manufacturer record is more than three years old at catalogue retrieval. Verify the current package label.');
 return warnings;
}
export function usdaFood(record,manifest){
 const src=manifest.sources.find(s=>s.id===record.source);if(!src)throw Error('Unknown USDA source.');
 const {values,energyId}=usdaValues(record,manifest.nutrientDefinitions);
 const portion=record.portions[0]||null,scale=portion?portion.grams/100:1,warnings=qualityWarnings(values,{dataset:record.source,published:record.published});
 const f={id:'usda-'+record.id,name:record.name,brand:record.brand||'',base:portion?1:100,unit:portion?'serving':'g',quantity:portion?1:100,basis:portion?portion.description:'100 g',source:src.label,barcode:record.barcode||'',serving:{description:portion?portion.description:'Reference nutrition per 100 g; no portion supplied',grams:portion?.grams??null,ml:null},warnings,requiresReview:warnings.some(w=>/exceed|inconsistent/.test(w)),requiresUnitConfirmation:false,
  provenance:{provider:'usda',dataset:src.id,recordId:String(record.id),release:src.release,retrieved:manifest.retrieved,published:record.published,license:'CC0-1.0',url:'https://fdc.nal.usda.gov/food-details/'+record.id+'/nutrients',archiveSha256:src.sha256},
  nutritionSource:{originalBasis:{quantity:100,unit:'g'},energyId,originalValues:record.values.map(([id,amount])=>({id,number:manifest.nutrientDefinitions[id].number,unit:manifest.nutrientDefinitions[id].unit,amount})),referencePortions:record.portions}};
 for(const k of nutrients)f[k]=values[k]===null?null:values[k]*scale;
 return f;
}
