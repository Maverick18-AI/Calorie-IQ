export const KEY='calorieiq-v2', RECOVERY='calorieiq-recovery-v2';
export const nutrients=['cal','pro','carb','fat'];
export const uid=()=>globalThis.crypto.randomUUID();
export const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const fail=()=>{throw Error('Invalid backup data. No data was replaced.')};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const num=(x,min=0,max=1e7)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
const text=(x,max=300)=>typeof x==='string'&&x.length>0&&x.length<=max;
export function dateOK(x){if(!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;const d=new Date(x+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===x}
export function newProfile(name='Me'){return {id:uid(),name,goals:{cal:2200,pro:120,carb:250,fat:70},dayGoals:{},logs:{},foods:[],recipes:[],meals:[],weights:[]}}
export function fresh(){const p=newProfile();return {version:2,revision:0,active:p.id,profiles:[p],cache:[],lastBackup:null}}
export function foodOK(f){return obj(f)&&text(f.id)&&text(f.name)&&text(f.basis)&&['serving','g','ml'].includes(f.unit)&&num(f.base,.001)&&nutrients.every(k=>f[k]===null||num(f[k]))&&typeof f.source==='string'&&f.source.length<=300&&typeof f.barcode==='string'&&/^\d{0,14}$/.test(f.barcode)}
function entryOK(e){return foodOK(e)&&num(e.quantity,.001)&&['Breakfast','Lunch','Dinner','Snacks'].includes(e.meal)}
function goalsOK(g){return obj(g)&&num(g.cal,1,100000)&&['pro','carb','fat'].every(k=>num(g[k],0,100000))}
export function validate(db){
 if(!obj(db)||db.version!==2||!Number.isSafeInteger(db.revision)||db.revision<0||!Array.isArray(db.profiles)||!db.profiles.length||db.profiles.length>50||!Array.isArray(db.cache)||db.cache.length>200||!(db.lastBackup===null||dateOK(db.lastBackup)))fail();
 const ids=new Set();for(const p of db.profiles){
 if(!obj(p)||!text(p.id)||ids.has(p.id)||!text(p.name,60)||!goalsOK(p.goals)||!obj(p.logs)||!obj(p.dayGoals))fail();ids.add(p.id);
 for(const [d,rs] of Object.entries(p.logs))if(!dateOK(d)||!Array.isArray(rs)||rs.length>2000||!rs.every(entryOK)||new Set(rs.map(r=>r.id)).size!==rs.length)fail();
 for(const [d,g] of Object.entries(p.dayGoals))if(!dateOK(d)||!goalsOK(g))fail();
 for(const key of ['foods','recipes','meals','weights'])if(!Array.isArray(p[key])||p[key].length>10000)fail();
 if(!p.foods.every(foodOK)||!p.recipes.every(r=>foodOK(r)&&Array.isArray(r.ingredients)&&r.ingredients.every(entryOK)&&num(r.yield,.001))||!p.meals.every(m=>obj(m)&&text(m.id)&&text(m.name)&&Array.isArray(m.entries)&&m.entries.length>0&&m.entries.every(entryOK))||!p.weights.every(w=>obj(w)&&dateOK(w.date)&&num(w.kg,.1,1000)))fail();
 for(const r of p.recipes){
  if(r.unit!=='serving'||!r.ingredients.length)throw Error('Invalid recipe: servings and ingredients are required. No data was replaced.');
  const calculated=totals(r.ingredients);
  for(const k of nutrients){
   const expected=calculated.unknown[k]?null:calculated[k]/r.yield*r.base;
   if(expected===null?r[k]!==null:r[k]===null||Math.abs(r[k]-expected)>1e-8*Math.max(1,Math.abs(expected)))throw Error('Inconsistent recipe nutrition: '+r.name+'. Correct its library values in the backup before importing. Diary history was not changed.');
  }
 }
 for(const collection of [p.foods,p.recipes,p.meals])if(new Set(collection.map(x=>x.id)).size!==collection.length)fail();
 if(new Set(p.weights.map(w=>w.date)).size!==p.weights.length)fail();
 }if(!ids.has(db.active)||!db.cache.every(foodOK))fail();return structuredClone(db);
}
export function migrate(v){if(v?.version===2)return validate(v);if(!obj(v)||!obj(v.logs)||!obj(v.goals))fail();const db=fresh(),p=db.profiles[0];
 for(const [d,rs]of Object.entries(v.logs)){if(!dateOK(d)||!Array.isArray(rs))fail();p.logs[d]=rs.map(r=>{if(!obj(r)||!text(r.name)||!num(r.servings,.001)||!nutrients.every(k=>num(r[k])))fail();const f={id:uid(),name:r.name,basis:'Legacy serving',base:1,unit:'serving',source:'Legacy log',barcode:'',quantity:r.servings,meal:'Snacks'};for(const k of nutrients)f[k]=r[k]/r.servings;return f})}
 for(const [d,g]of Object.entries(v.goals)){if(!dateOK(d)||!num(g,1,100000))fail();p.dayGoals[d]={...p.goals,cal:g}}return validate(db);
}
export function totals(entries){const r={cal:0,pro:0,carb:0,fat:0,unknown:{cal:0,pro:0,carb:0,fat:0}};for(const e of entries)for(const k of nutrients){if(e[k]===null)r.unknown[k]++;else r[k]+=e[k]*e.quantity/e.base}return r}
export function recipe(name,ingredients,yieldCount){if(!ingredients.length||!num(yieldCount,.001))throw Error('Add ingredients and a positive recipe yield.');const t=totals(ingredients),r={id:uid(),name,basis:'1 recipe serving',base:1,unit:'serving',source:'Recipe',barcode:'',ingredients:structuredClone(ingredients),yield:yieldCount};for(const k of nutrients)r[k]=t.unknown[k]?null:t[k]/yieldCount;return r}
export function productFood(p){const n=p.nutriments||{},has=k=>n[k]!==undefined&&n[k]!==null&&n[k]!==''&&Number.isFinite(Number(n[k]))&&Number(n[k])>=0;
 const declared=String(p.nutrition_data_per||'').toLowerCase().replace(/\s/g,'');
 const hasBasis=suffix=>['energy-kcal','energy','proteins','carbohydrates','fat'].some(k=>has(k+suffix));
 // _100g is also used by OFF for per-100ml values. Package/serving volume
 // does not establish the basis of these nutrients; never infer density.
 const standardized=hasBasis('_100g')&&!(declared==='serving'&&hasBasis('_serving'));
 const suffix=standardized?'_100g':'_serving';
 const ambiguous=standardized&&!['100g','100ml'].includes(declared);
 const liquid=declared==='100ml';
 const f={id:uid(),name:(p.product_name||p.product_name_en||'Unnamed product').slice(0,300),basis:standardized?(ambiguous?'100 g or 100 ml — confirm label':liquid?'100 ml':'100 g'):(p.serving_size||'Listed serving — verify size').slice(0,300),base:standardized?100:1,unit:standardized?(liquid?'ml':'g'):'serving',source:'Open Food Facts',barcode:/^\d{8,14}$/.test(p.code||'')?p.code:'',requiresUnitConfirmation:ambiguous};
 for(const [k,nk]of Object.entries({cal:'energy-kcal',pro:'proteins',carb:'carbohydrates',fat:'fat'}))f[k]=has(nk+suffix)?Number(n[nk+suffix]):null;if(f.cal===null&&has('energy'+suffix))f.cal=Number(n['energy'+suffix])/4.184;return f;
}
export function commit(storage,next,expected,expectedRaw){const candidate=validate(next),current=storage.getItem(KEY);if((expectedRaw!==undefined&&current!==expectedRaw)||!current||JSON.parse(current).revision!==expected)throw Error('Stored data changed. Download your drafts, then reload before saving.');candidate.revision=expected+1;storage.setItem(KEY,JSON.stringify(candidate));return candidate}

export function convertWeight(value,from,to){if(!['kg','lb'].includes(from)||!['kg','lb'].includes(to)||!Number.isFinite(value))throw Error('Invalid weight or unit.');return from===to?value:from==='kg'?value*2.2046226218:value/2.2046226218}
