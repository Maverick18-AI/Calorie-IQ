import {nutrients as KEYS,primary,nutrientInfo} from './nutrients.js';
const NAMES=Object.fromEntries(KEYS.map(k=>[k,nutrientInfo[k].off]));
const positive=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&v!==null&&v!==''&&v!==undefined&&Number.isFinite(Number(v))&&Number(v)>0;
const reading=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&v!==null&&v!==''&&v!==undefined&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;

export function servingInfo(p){
 const description=String(p.serving_size||'').trim().slice(0,300),warnings=[];
 const found={g:[],ml:[]};
 const units={g:['g',1],kg:['g',1000],mg:['g',.001],ml:['ml',1],cl:['ml',10],l:['ml',1000]};
 for(const m of description.matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|mg|g|ml|cl|l)\b/gi)){
  if(/[-–/]\s*$/.test(description.slice(0,m.index))){warnings.push('Serving size contains a range or fraction that needs label review.');continue}
  const [unit,factor]=units[m[2].toLowerCase()],amount=Number(m[1].replace(',','.'))*factor;
  if(positive(amount))found[unit].push(amount);
 }
 const unique=unit=>[...new Set(found[unit])];
 let grams=unique('g').length===1?unique('g')[0]:null,ml=unique('ml').length===1?unique('ml')[0]:null;
 if(unique('g').length>1||unique('ml').length>1){warnings.push('Serving description contains conflicting quantities. Conversion is unavailable.');grams=ml=null}
 const q=positive(p.serving_quantity)?Number(p.serving_quantity):null,u=String(p.serving_quantity_unit||'').toLowerCase();
 if(q&&units[u]){const [unit,factor]=units[u],amount=q*factor,stated=unit==='g'?grams:ml;
  if(stated!==null&&Math.abs(stated-amount)>.01){warnings.push('Serving description and numeric serving quantity disagree. Conversion is unavailable.');grams=ml=null}
  else if(!warnings.length){if(unit==='g')grams=amount;else ml=amount}
 }else if(q&&((grams!==null&&ml===null)||(ml!==null&&grams===null))){const stated=grams??ml;if(Math.abs(q-stated)>.01){warnings.push('Numeric serving quantity conflicts with the label description. Conversion is unavailable.');grams=ml=null}}
 if(warnings.length){grams=ml=null}
 return {serving:{description:description||'Listed serving (size not supplied)',grams,ml},warnings};
}

export function productFood(p){
 const n=p.nutriments||{},declared=String(p.nutrition_data_per||'').toLowerCase().replace(/\s/g,'');
 const read=suffix=>{const values={};for(const k of KEYS){const value=reading(n[NAMES[k]+suffix]);values[k]=value===null?null:value*nutrientInfo[k].factor;}if(values.cal===null){const kj=reading(n['energy'+suffix]);if(kj!==null)values.cal=kj/4.184}return values};
 const perServing=read('_serving'),per100=read('_100g'),has=x=>KEYS.some(k=>x[k]!==null);
 const info=servingInfo(p),s=info.serving,warnings=[...info.warnings];
 const standardUnit=declared==='100ml'?'ml':declared==='100g'?'g':declared==='serving'?(s.grams?'g':s.ml?'ml':null):null;
 const amount=standardUnit==='g'?s.grams:standardUnit==='ml'?s.ml:null;
 let values,unit,base,basis,selected,multiplier=1;
 if(primary.some(k=>perServing[k]!==null)||(!primary.some(k=>per100[k]!==null)&&has(perServing))){
  values={...perServing};unit='serving';base=1;basis=s.description;selected='_serving';
  if(amount&&has(per100))for(const k of KEYS)if(perServing[k]!==null&&per100[k]!==null){const expected=per100[k]*amount/100,tolerance=k==='cal'?Math.max(5,expected*.05):Math.max(.5,expected*.1);if(Math.abs(perServing[k]-expected)>tolerance)warnings.push('Per-serving and per-100 values disagree for '+NAMES[k]+'. Verify and correct the label values.')}
 }else if(has(per100)&&amount){
  multiplier=amount/100;values=Object.fromEntries(KEYS.map(k=>[k,per100[k]===null?null:per100[k]*multiplier]));unit='serving';base=1;basis=s.description;selected='_100g';
 }else{
  values={...per100};unit=standardUnit||'g';base=100;basis=standardUnit?'100 '+standardUnit:'100 g or 100 ml — confirm label';selected='_100g';
  warnings.push('A reliable serving conversion is unavailable. Use the stated nutrition basis and verify the label.');
 }
 if(!has(per100)&&!has(perServing))warnings.push('Nutrition is unavailable. Enter the manufacturer label values; blanks remain unknown.');
 if(s.description==='Listed serving (size not supplied)')warnings.push('Manufacturer serving description is missing. Verify what one serving means.');
 if((s.grams&&s.grams<=1)||(s.ml&&s.ml<=1))warnings.push('Database serving is only '+(s.grams?'1 g or less':'1 ml or less')+'. Confirm the actual manufacturer portion.');
 const primaryAmount=unit==='serving'?s.grams:unit==='g'?base:null;
 if(primaryAmount&&['pro','carb','fat'].every(k=>values[k]!==null)&&values.pro+values.carb+values.fat>primaryAmount*1.1)warnings.push('Reported macro mass exceeds the serving mass. Correct the database values from the package label.');
 if(values.cal!==null&&['pro','carb','fat'].every(k=>values[k]!==null)){const approximate=4*values.pro+4*values.carb+9*values.fat;if(approximate>0&&Math.abs(approximate-values.cal)>Math.max(30,approximate*.35))warnings.push('Calories and macros are substantially inconsistent. Verify the package label.');}
 if(standardUnit==='g'&&s.ml&&!s.grams)warnings.push('Standard nutrition is declared per 100 g but serving volume is in ml. No mass/volume equivalence was assumed.');
 const packageInfo=packageFromProduct(p,s);if(packageInfo.warning)warnings.push(packageInfo.warning);
 const requiresReview=warnings.some(w=>/disagree|conflict|exceeds|inconsistent|only 1/.test(w));
 return {id:crypto.randomUUID(),name:String(p.product_name||p.product_name_en||'Unnamed product').slice(0,300),basis,base,unit,...values,source:'Open Food Facts',package:packageInfo.value,barcode:/^\d{8,14}$/.test(p.code||'')?p.code:'',serving:s,requiresUnitConfirmation:base===100&&!standardUnit,requiresReview,warnings:[...new Set(warnings)],nutritionSource:{declared,selected,multiplier,standardUnit,perServing,per100,servingDescription:String(p.serving_size||'').slice(0,300)}};
}

export function changeFoodUnit(food,to){
 const factors={serving:1,g:food.serving?.grams,ml:food.serving?.ml};
 if(!positive(factors[food.unit])||!positive(factors[to]))return null;
 const result=structuredClone(food),ratio=factors[to]/factors[food.unit];
 result.unit=to;result.base=food.base*ratio;result.quantity=(food.quantity??food.base)*ratio;
 result.basis=`${Number(result.base.toFixed(6))} ${to}`;
 return result;
}

export function servingEquivalent(f){
 const perUnit=f.unit==='serving'?1:f.unit==='g'?f.serving?.grams:f.serving?.ml;
 if(!positive(perUnit))return '';
 const servings=f.unit==='serving'?f.quantity:f.quantity/perUnit;
 const format=n=>Number(n.toFixed(3));
 return `${format(servings)} serving(s)`+(f.serving?.grams?` · ${format(servings*f.serving.grams)} g`:'')+(f.serving?.ml?` · ${format(servings*f.serving.ml)} ml`:'');
}

export function packageFromProduct(p,serving){
 const units={g:['grams',1],kg:['grams',1000],ml:['ml',1],l:['ml',1000],cl:['ml',10]};
 const value={grams:null,ml:null,servings:null};
 const text=String(p.quantity||'').trim();
 // Accept only a single explicit mass/volume. Multipacks and ambiguous text need manual label review.
 const match=text.match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)$/i);
 if(match){const [key,factor]=units[match[2].toLowerCase()];value[key]=Number(match[1].replace(',','.'))*factor}
 const typed=units[String(p.product_quantity_unit||'').toLowerCase()];
 if(positive(p.product_quantity)&&typed){const [key,factor]=typed,amount=Number(p.product_quantity)*factor;
  if((value.grams!==null&&key!=='grams')||(value.ml!==null&&key!=='ml')||(value[key]!==null&&Math.abs(value[key]-amount)>.01))return {value:null,warning:'Package quantities disagree. Entire-package logging is unavailable.'};
  value[key]=amount;
 }
 if(positive(p.servings_per_container)&&/^\d+(?:\.\d+)?$/.test(String(p.servings_per_container)))value.servings=Number(p.servings_per_container);
 if(Object.values(value).some(v=>v!==null&&(!positive(v)||v<.001||v>1e7)))return {value:null,warning:'Package quantity is outside supported limits. Entire-package logging is unavailable.'};
 if(value.servings)for(const key of ['grams','ml'])if(serving[key]&&value[key]&&Math.abs(serving[key]*value.servings-value[key])>Math.max(.1,value[key]*.02))return {value:null,warning:'Package serving count and quantity disagree. Entire-package logging is unavailable.'};
 return {value:Object.values(value).some(positive)?value:null,warning:null};
}
export function packageQuantity(f){
 const p=f.package;if(!p||f.requiresUnitConfirmation||f.requiresReview)return null;
 // Also guard imported metadata, which may not have passed through product parsing.
 if(positive(p.servings))for(const key of ['grams','ml'])if(positive(p[key])&&positive(f.serving?.[key])&&Math.abs(p.servings*f.serving[key]-p[key])>Math.max(.1,p[key]*.02))return null;
 if(f.unit==='g'&&positive(p.grams))return p.grams;
 if(f.unit==='ml'&&positive(p.ml))return p.ml;
 const count=positive(p.servings)?p.servings:positive(p.grams)&&positive(f.serving?.grams)?p.grams/f.serving.grams:positive(p.ml)&&positive(f.serving?.ml)?p.ml/f.serving.ml:null;
 if(!positive(count))return null;
 return f.unit==='serving'?count:f.unit==='g'&&positive(f.serving?.grams)?count*f.serving.grams:f.unit==='ml'&&positive(f.serving?.ml)?count*f.serving.ml:null;
}
