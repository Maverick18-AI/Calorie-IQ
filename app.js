import {KEY,RECOVERY,nutrients,uid,today,dateOK,fresh,validate,migrate,totals,recipe,productFood,commit,convertWeight,changeFoodUnit,servingEquivalent} from './core.js';
import {unifiedSearch,localBarcode} from './search.js';
import {createCatalogue} from './providers/catalogue.js';
import {createOFF} from './providers/off.js';
import {primary,extra,additional,nutrientInfo} from './nutrients.js';
import {periodDates,calorieEstimate,weightSummary,rollingWeight} from './wellness.js';
import {packageQuantity} from './nutrition.js';
import {MEALS,shiftDate,foodHistory,quickFood} from './diary.js';
import {cameraScanner} from './scanner.js';
import {acquireWriter} from './writer.js';
import {BUILD,BUILD_KEY,currentBuild,prepareBuild} from './development.js';
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const labels=Object.fromEntries(nutrients.map(k=>[k,nutrientInfo[k].name+' ('+nutrientInfo[k].unit+')'])),fmt=n=>Number(n.toFixed(1)).toLocaleString();
function notice(t){$('notice').textContent=t}
function button(text,fn,cls='secondary'){const b=el('button',text,cls);b.type='button';b.onclick=()=>{try{const p=fn();p?.catch?.(e=>notice(e.message))}catch(e){notice(e.message)}};return b}
let targetMeal=null;
let db,blocked=false,editing=null,loaded=null,draft=[],recipeEdit=null,undo=null,registration,request=null,requestId=0,previousToday=today();
let writer=await acquireWriter(navigator.locks),expectedRaw=null,expectedStamp=null,buildState={ready:false,reset:false};
try{buildState=prepareBuild(localStorage,sessionStorage,writer.held,fresh);const raw=localStorage.getItem(KEY),old=localStorage.getItem('calorieiq-v1');expectedRaw=raw;db=raw?validate(JSON.parse(raw)):old?migrate(JSON.parse(old)):fresh();if(!raw&&writer.held)localStorage.setItem(KEY,JSON.stringify(db));expectedRaw=localStorage.getItem(KEY);expectedStamp=draftStamp(expectedRaw);if(!raw&&old)notice('Your original food log was migrated in memory. The original data is retained; export a new backup.')}catch(e){db=fresh();blocked=true;notice('Stored data could not be loaded: '+e.message+' Saving is blocked. Download recovery, then restore a valid backup.')}
expectedStamp=draftStamp(expectedRaw);
const catalogue=createCatalogue({fetchJSON:(...args)=>fetch(...args)}),off=createOFF({version:BUILD.id,fetchJSON:(...args)=>fetch(...args)});
const profile=()=>db.profiles.find(p=>p.id===db.active),day=()=>$('day').value,rows=()=>profile().logs[day()]||[];
function mutate(fn,message='',undoable=false){if(!writer.held){notice('This tab is read-only. Close the editing tab, then use Enable editing in Settings. Your drafts are retained.');return false}if(!currentBuild(localStorage)){notice('A newer development build is active. Reload before saving.');return false}if(blocked){notice('Saving is blocked because stored data changed or is invalid. Download your drafts and reload, or restore a valid backup.');return false}if(reviewRecovered&&!confirm('Saved data changed since these drafts were made. Have you reviewed the latest Food Log and want to apply this change?'))return false;try{const next=structuredClone(db);fn(next);const prior=structuredClone(db);db=commit(localStorage,next,db.revision,expectedRaw);expectedRaw=localStorage.getItem(KEY);expectedStamp=draftStamp(expectedRaw);reviewRecovered=false;if(undoable)undo={db:prior,revision:db.revision};else undo=null;render();if(message)notice(message);return true}catch(e){notice('Could not save: '+e.message);return false}}
function withProfile(next){return next.profiles.find(p=>p.id===db.active)}
function cancelRequest(){requestId++;request?.abort();request=null}
function resetFood(){$('foodReview').hidden=true;cancelRequest();editing=null;loaded=null;$('foodForm').reset();$('foodTitle').textContent='Review nutrition & quantity';$('foodSource').textContent='Custom food. Nutrition is for the base quantity shown.';$('submitFood').textContent='Add to Food Log';$('cancelEdit').hidden=true;showFoodMetadata(null);previousFoodUnit=$('unit').value;preview();cleanForm('foodForm')}
function view(name){
 if(name!=='add'){targetMeal=null;cancelRequest();scanner.stop()}
 if(name==='nutrition'){$('nutritionDate').value=nutritionSelectedDate=day();renderNutrition()}
 document.querySelectorAll('main > section').forEach(s=>s.hidden=s.id!==name);
 document.querySelectorAll('nav button').forEach(b=>{if(b.dataset.view===name||(name==='add'&&b.dataset.view==='diary'))b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
 if(name==='settings')renderGoals();
 if(name==='add')$('addContext').textContent=day()+' · '+((dirtyForm('foodForm')||editing)?$('meal').value:(targetMeal||$('selectedMeal').value));
 storeDrafts();window.scrollTo({top:0,behavior:'instant'});
}
function showEntryPanel(mode){
 if(mode!=='barcode')scanner.stop();cancelRequest();
 $('searchPanel').hidden=mode!=='search';$('barcodePanel').hidden=mode!=='barcode';
 $('findFood').setAttribute('aria-expanded',String(mode==='search'));$('scan').setAttribute('aria-expanded',String(mode==='barcode'));
}
function showFoodReview(){$('foodReview').hidden=false}

// Drafts are per-tab session data, never mixed into diary backups or other profiles.
const DRAFT_KEY='calorieiq-drafts-v1';
const trackedForms=['foodForm','recipeForm','goalForm','weightForm','quickForm','planForm','estimateForm'];
const baselines=new Map(),forcedDrafts=new Set();
let draftsReady=false,reviewRecovered=false,selectedDay=today(),previousFoodUnit='serving',previousWeightUnit='kg';
function controls(id){return [...$(id).querySelectorAll('input[id],select[id]')].filter(n=>n.type!=='file')}
function formState(id){return controls(id).map(n=>[n.id,n.type==='checkbox'?n.checked:n.value])}
function cleanForm(id){baselines.set(id,JSON.stringify(formState(id)));forcedDrafts.delete(id)}
function dirtyForm(id){return forcedDrafts.has(id)||(baselines.has(id)&&baselines.get(id)!==JSON.stringify(formState(id)))}
function hasDrafts(){return trackedForms.some(dirtyForm)||draft.length>0||!!recipeEdit||!!editing}
// A compact stamp is only a recovered-draft warning, not a save-integrity check.
// Saves still compare the complete original string. Do not copy other profiles into drafts.
function draftStamp(raw){if(raw===null)return null;let a=2166136261,b=5381;for(let i=0;i<raw.length;i++){a=Math.imul(a^raw.charCodeAt(i),16777619);b=Math.imul(b,33)^raw.charCodeAt(i)}return `${raw.length}:${a>>>0}:${b>>>0}`}
function draftSnapshot(){return {version:1,profile:db.active,date:day(),baseStamp:expectedStamp,forms:Object.fromEntries(trackedForms.map(id=>[id,formState(id)])),dirty:trackedForms.filter(dirtyForm),draft,recipeEdit,editing,loaded,meal:$('selectedMeal').value}}
function storeDrafts(){if(!draftsReady||!buildState.ready||!currentBuild(localStorage))return;try{if(hasDrafts())sessionStorage.setItem(DRAFT_KEY,JSON.stringify(draftSnapshot()));else sessionStorage.removeItem(DRAFT_KEY)}catch{notice('Draft recovery storage is unavailable. Keep this tab open or download unsaved drafts before leaving.')}}
function discardFood(){if((dirtyForm('foodForm')||editing)&&!confirm('Replace this unsaved food or edit draft?'))return false;resetFood();return true}
function allowContextChange(){return !hasDrafts()||confirm('Restoring data will discard unsaved forms and recipe drafts. Continue?')}
function restoreDrafts(){try{const raw=sessionStorage.getItem(DRAFT_KEY);if(!raw)return;const s=JSON.parse(raw);if(s.version!==1||s.profile!==db.active||!dateOK(s.date)||!Array.isArray(s.draft)||!s.forms||!Array.isArray(s.dirty))throw Error();const probe=fresh();probe.profiles[0].logs[s.date]=s.draft;validate(probe);$('day').value=selectedDay=s.date;if(MEALS.includes(s.meal))$('selectedMeal').value=s.meal;draft=s.draft;recipeEdit=s.recipeEdit;editing=s.editing;loaded=s.loaded;render();showFoodMetadata(loaded);for(const id of trackedForms)for(const [field,value]of s.forms[id]||[]){const n=controls(id).find(n=>n.id===field);if(n){if(n.type==='checkbox')n.checked=!!value;else n.value=String(value)}}for(const id of s.dirty)if(trackedForms.includes(id))forcedDrafts.add(id);previousFoodUnit=$('unit').value;previousWeightUnit=$('weightUnit').value;previousGoalUnit=$('goalWeightUnit').value;if(editing){$('submitFood').textContent='Save changes';$('cancelEdit').hidden=false;$('foodTitle').textContent='Recovered edit draft'}if(dirtyForm('foodForm')||editing)showFoodReview();preview();reviewRecovered=s.baseStamp!==undefined?s.baseStamp!==expectedStamp:s.raw!==expectedRaw;notice('Unsaved drafts recovered for '+profile().name+'.'+(reviewRecovered?' Saved data has changed; review it before applying drafts.':''));storeDrafts()}catch{notice('An older draft could not be recovered automatically. Its session copy is retained; use Download unsaved drafts in Settings.')}}
document.addEventListener('input',e=>{if(trackedForms.some(id=>$(id).contains(e.target)))storeDrafts()});
document.addEventListener('change',e=>{if(trackedForms.some(id=>$(id).contains(e.target)))storeDrafts()});
window.addEventListener('beforeunload',e=>{storeDrafts();if(hasDrafts()){e.preventDefault();e.returnValue=''}});
window.addEventListener('pagehide',()=>{storeDrafts();writer.release()});
window.addEventListener('pageshow',async e=>{if(e.persisted){writer=await acquireWriter(navigator.locks);if(localStorage.getItem(KEY)!==expectedRaw)blocked=true;notice(writer.held&&!blocked?'Editing resumed.':'This tab is read-only. Download drafts and reload to use the latest saved data.')}});
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>view(b.dataset.view));
for(const k of nutrients){for(const [container,prefix]of [[extra.includes(k)?'extraNutritionFields':'nutritionFields',''],[extra.includes(k)?'extraGoalFields':'goalFields','goal-']]){const wrap=el('div'),label=el('label',labels[k]),input=el('input');input.id=prefix+k;label.htmlFor=input.id;input.type='number';input.min=prefix&&k==='cal'?'1':'0';input.max=prefix?'100000':'10000000';input.step='any';input.required=!!prefix&&!extra.includes(k);wrap.append(label,input);$(container).append(wrap)}}
$('day').value=today();$('nutritionDate').value=today();$('selectedMeal').value=rows().at(-1)?.meal||'Breakfast';$('copyFrom').value=shiftDate(today(),-1);$('weightDate').value=today();
function amount(f){return primary.map(k=>`${k==='cal'?'kcal':k==='carb'?'C':k==='pro'?'P':'F'} ${f[k]===null?'unknown':fmt(f[k])}`).join(' · ')}
function entryAmount(r){const t=totals([r]);return primary.map(k=>`${k==='cal'?'kcal':k==='carb'?'C':k==='pro'?'P':'F'} ${t.unknown[k]?'unknown':fmt(t[k])}`).join(' · ')}
function empty(node,msg){node.replaceChildren(el('p',msg,'empty'))}
async function chooseResult(food){
 if(!food.catalogueRecord)return choose(food);
 cancelRequest();const id=requestId,controller=new AbortController();request=controller;$('lookupStatus').textContent='Loading USDA reference nutrition…';
 try{const full=await catalogue.resolve(food,{signal:controller.signal});if(id===requestId&&!controller.signal.aborted&&!$('add').hidden){choose(full);$('lookupStatus').textContent='USDA reference loaded. Review the documented portion or switch to grams.'}}
 catch(e){if(id===requestId&&e.name!=='AbortError')$('lookupStatus').textContent=e.message}
}
function sourceCaption(f){const p=f.provenance;return f.source+(f.brand?' · '+f.brand:'')+(p?.recordId?' · '+(p.provider==='usda'?'FDC ':'')+p.recordId:'')+(p?.release?' · '+p.release:'')}
function choose(food){if(!discardFood())return false;cancelRequest();editing=null;loaded=structuredClone(food);$('foodTitle').textContent=food.name;$('foodSource').textContent=`${sourceCaption(food)} · Nutrition per ${food.basis}. ${food.provenance?.provider==='usda'?'Reference food; match the preparation and portion.':'Verify the package label.'}`;$('name').value=food.name;$('base').value=food.base;$('unit').value=food.requiresUnitConfirmation?'':food.unit;$('quantity').value=food.quantity||food.base;$('meal').value=targetMeal||food.meal||$('selectedMeal').value||'Snacks';for(const k of nutrients)$(k).value=food[k]??'';$('saveFood').checked=false;showFoodMetadata(food);$('submitFood').textContent='Add to Food Log';$('cancelEdit').hidden=true;previousFoodUnit=$('unit').value;forcedDrafts.add('foodForm');preview();showEntryPanel(null);view('add');showFoodReview();$('foodTitle').scrollIntoView({block:'start'});return true}
function showFoodMetadata(food){
 const serving=food?.serving,p=food?.provenance;
 $('sourceDetails').hidden=!p;
 const basis=food?.nutritionSource?.originalBasis;
 $('sourceDetailsText').textContent=p?'Record '+p.recordId+' · '+(p.release?'Release '+p.release+' · ':'')+'Retrieved '+(p.retrieved||'unknown')+' · '+p.license+(basis?' · Original basis: '+(basis.quantity?basis.quantity+' '+basis.unit:basis.declared||'not declared'):''):'';
 const link=$('sourceRecordLink');link.hidden=true;link.removeAttribute('href');
 if(p?.provider==='usda'&&/^\d+$/.test(p.recordId)){link.href='https://fdc.nal.usda.gov/food-details/'+p.recordId+'/nutrients';link.hidden=false}
 if(p?.provider==='off'&&/^\d{8,14}$/.test(p.recordId)){link.href='https://world.openfoodfacts.org/product/'+p.recordId;link.hidden=false}

 $('servingDetails').open=!food||food.requiresUnitConfirmation||!!food.requiresReview;
 $('servingDescription').value=serving?.description||'';$('servingGrams').value=serving?.grams??'';$('servingMl').value=serving?.ml??'';
 $('servingLabel').textContent=serving?(food?.provenance?.provider==='usda'?'USDA reference portion: ':'Manufacturer serving: ')+serving.description:'Manual food: enter a serving description if known.';
 $('nutritionWarning').textContent=(food?.warnings||[]).join('\n');
 $('reviewNutritionText').textContent=food?.provenance?.provider==='usda'?'I reviewed the USDA source record, warnings and reference portion.':'I checked and corrected these values against the package label.';
 $('reviewNutrition').checked=false;$('reviewNutrition').required=!!food?.requiresReview;$('reviewBox').hidden=!food?.requiresReview;
}
function formFood(){const f={id:uid(),name:$('name').value.trim(),base:Number($('base').value),unit:$('unit').value,basis:`${$('base').value} ${$('unit').value}`,source:loaded?.source||'Custom',provenance:loaded?.provenance||null,brand:loaded?.brand||'',ingredientText:loaded?.ingredientText||'',barcode:loaded?.barcode||'',requiresUnitConfirmation:false,quantity:Number($('quantity').value),favorite:!!loaded?.favorite,package:loaded?.package||null,meal:$('meal').value,serving:{description:$('servingDescription').value.trim()||'Custom serving',grams:$('servingGrams').value===''?null:Number($('servingGrams').value),ml:$('servingMl').value===''?null:Number($('servingMl').value)},nutritionSource:loaded?.nutritionSource||null,warnings:loaded?.warnings||[],requiresReview:false,labelReviewed:$('reviewNutrition').checked};for(const k of nutrients)f[k]=$(k).value===''?null:Number($(k).value);if(loaded&&JSON.stringify(f.serving)!==JSON.stringify(loaded.serving))f.package=null;if(loaded?.nutritionSource){const edited=nutrients.some(k=>f[k]!==loaded[k])||JSON.stringify(f.serving)!==JSON.stringify(loaded.serving);if(JSON.stringify(f.serving)!==JSON.stringify(loaded.serving))f.package=null;f.nutritionSource={...loaded.nutritionSource,userEdited:edited};if(edited)f.source='Package label (user corrected)'}return f}
function preview(){const f=formFood();$('preview').textContent=f.base>0&&f.quantity>0?`${fmt(f.quantity)} ${f.unit} · ${entryAmount(f)}`:'Enter a positive base and quantity.';const pack=packageQuantity({...f,requiresReview:!!loaded?.requiresReview&&!$('reviewNutrition').checked});$('wholePackage').hidden=pack===null;$('packageHint').textContent=pack===null?'':'Entire package: '+fmt(pack)+' '+f.unit+'. Verify package and serving quantities.';const equivalent=servingEquivalent(f);if(equivalent)$('preview').textContent+=' · '+equivalent;}
$('foodForm').oninput=()=>{cancelRequest();preview()};
function renderGoals(){if(dirtyForm('goalForm'))return;const p=profile(),g=$('dateGoal').checked?(p.dayGoals[day()]||p.goals):p.goals;for(const k of nutrients)$('goal-'+k).value=g[k]??'';cleanForm('goalForm')}
function render(){
 const p=profile(),rs=rows(),t=totals(rs),g=p.dayGoals[day()]||p.goals;
 $('diaryTitle').textContent=day()===today()?"Food Log":new Date(day()+'T12:00:00').toLocaleDateString(undefined,{dateStyle:'long'});$('dayHint').textContent=day()!==today()?'Food Log for '+day():'';
 $('remaining').textContent=fmt(g.cal-t.cal)+(t.unknown.cal?'*':'');$('calSummary').textContent=`${fmt(t.cal)} consumed / ${fmt(g.cal)} kcal goal${t.unknown.cal?' · Some calories unknown':''}`;$('calPercent').textContent=`${fmt(t.cal/g.cal*100)}% of daily goal${t.cal>g.cal?' · '+fmt(t.cal-g.cal)+' kcal over goal':''}`;$('calProgress').value=Math.min(100,t.cal/g.cal*100);$('macros').replaceChildren();
 for(const [k,name]of [['pro','Protein'],['carb','Carbs'],['fat','Fat']]){const n=el('div');n.append(el('strong',`${fmt(t[k])}${t.unknown[k]?'*':''} g`),el('small',`${name} / ${g[k]} g · ${g[k]?fmt(t[k]/g[k]*100)+'%':'No target'}`));const bar=el('progress');bar.max=100;bar.value=g[k]?Math.min(100,t[k]/g[k]*100):0;bar.setAttribute('aria-label',name+' goal progress');n.append(bar);$('macros').append(n)}
 renderEntries();
 $('undo').hidden=!undo||undo.revision!==db.revision;
 renderLibrary();renderShortcuts();renderFoodList('recipes',p.recipes,'recipes');
 $('meals').replaceChildren();if(!p.meals.length)empty($('meals'),'No saved meals yet.');for(const m of p.meals){const n=el('div',undefined,'entry');n.append(el('strong',m.name),el('small',`${m.entries.length} foods`),button('Log meal',()=>{if(confirm(`Add ${m.name} to ${day()} for ${p.name}?`))mutate(d=>{const q=withProfile(d);(q.logs[day()]??=[]).push(...m.entries.map(e=>({...structuredClone(e),id:uid()})))},'Meal added.',true)}),button('Delete',()=>{if(confirm('Delete this saved meal?'))mutate(d=>{withProfile(d).meals=withProfile(d).meals.filter(x=>x.id!==m.id)})},'danger'));$('meals').append(n)}
 $('backupStatus').textContent=db.lastBackup?`Last backup export: ${db.lastBackup}. Export again after important changes.`:'No backup exported yet. Export one to protect your food log.';renderGoals();renderPlan();renderIngredients();renderProgress();renderNutrition();storeDrafts();
}
function renderEntries(){const p=profile(),rs=rows();
 $('entries').replaceChildren();
 for(const meal of [$('selectedMeal').value]){const list=rs.filter(r=>r.meal===meal),section=el('section',undefined,'meal-group'),heading=el('div',undefined,'row spread'),mt=totals(list);section.setAttribute('aria-label',meal);heading.append(el('span',fmt(mt.cal)+(mt.unknown.cal?'*':'')+' kcal','meal-calories'));section.append(heading);
 for(const r of list){const n=el('div',undefined,'entry'),actions=el('div',undefined,'actions');n.append(el('strong',r.name),el('small',fmt(r.quantity)+' '+r.unit+' · '+entryAmount(r)+(r.serving?' · '+servingEquivalent(r):'')));
 actions.append(button('Edit',()=>{targetMeal=null;if(!choose(r))return;editing={id:r.id,date:day(),profile:p.id};$('foodTitle').textContent='Edit Food Log entry';$('submitFood').textContent='Save changes';$('cancelEdit').hidden=false;storeDrafts()}),button('Duplicate',()=>mutate(d=>withProfile(d).logs[day()].push({...structuredClone(r),id:uid()}),'Entry duplicated.',true)),button('Delete',()=>mutate(d=>{const q=withProfile(d);q.logs[day()]=q.logs[day()].filter(x=>x.id!==r.id)},'Entry removed. Undo is available.',true),'danger'));
 const move=el('select');move.setAttribute('aria-label','Move '+r.name+' to meal');for(const m of MEALS){const o=el('option',m);o.value=m;move.append(o)}move.value=r.meal;move.onchange=()=>mutate(d=>{withProfile(d).logs[day()].find(x=>x.id===r.id).meal=move.value},'Entry moved to '+move.value+'.',true);actions.append(move);n.append(actions);section.append(n)}$('entries').append(section)}
}
$('selectedMeal').onchange=()=>{renderEntries();storeDrafts()};
function renderFoodList(id,foods,collection){const root=$(id);root.replaceChildren();if(!foods.length)empty(root,'Nothing here yet.');for(const f of foods){const n=el('div',undefined,'entry');n.append(el('strong',f.name),el('small',`${sourceCaption(f)} · ${f.basis} · ${amount(f)}`));const a=el('div',undefined,'actions');a.append(button('Use',()=>chooseResult(f)));if(collection==='foods')a.append(button(f.favorite?'★ Favorited':'☆ Favorite',()=>mutate(d=>{const item=withProfile(d).foods.find(x=>x.id===f.id);item.favorite=!item.favorite},'Favorite updated.')),button('Edit food',()=>{if(!choose(f))return;editing={library:f.id};$('foodTitle').textContent='Edit saved food';$('submitFood').textContent='Save food changes';$('cancelEdit').hidden=false;storeDrafts()}));if(collection==='recipes')a.append(button('Edit recipe',()=>{if((draft.length||recipeEdit||dirtyForm('recipeForm'))&&!confirm('Replace the unsaved recipe draft?'))return;recipeEdit=f.id;draft=structuredClone(f.ingredients);$('recipeName').value=f.name;$('recipeYield').value=f.yield;forcedDrafts.add('recipeForm');renderIngredients();view('library')}));if(collection)a.append(button('Delete',()=>{if(confirm(`Delete ${f.name} from your library?`))mutate(d=>{const q=withProfile(d);q[collection]=q[collection].filter(x=>x.id!==f.id)})},'danger'));n.append(a);root.append(n)}}
function renderIngredients(){$('ingredients').replaceChildren();if(!draft.length)empty($('ingredients'),'No ingredients added yet.');draft.forEach((f,i)=>{const n=el('div',undefined,'entry');n.append(el('strong',f.name),el('small',`${f.quantity} ${f.unit} · ${entryAmount(f)}`),button('Remove',()=>{draft.splice(i,1);renderIngredients();storeDrafts()},'danger'));$('ingredients').append(n)})}
function chart(id,points,label){const root=$(id);root.replaceChildren();if(!points.length){empty(root,'Log a record to see your trend.');return}const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 500 200');svg.setAttribute('class','chart');svg.setAttribute('role','img');svg.setAttribute('aria-label',label);const min=Math.min(...points.map(p=>p.y)),max=Math.max(...points.map(p=>p.y)),span=max-min||1,xmin=Math.min(...points.map(p=>p.x)),xspan=Math.max(...points.map(p=>p.x))-xmin||1;const coords=points.map(p=>({x:20+(p.x-xmin)/xspan*460,y:175-(p.y-min)/span*145,p}));const line=document.createElementNS(ns,'polyline');line.setAttribute('points',coords.map(p=>`${p.x},${p.y}`).join(' '));svg.append(line);for(const c of coords){const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',c.x);dot.setAttribute('cy',c.y);dot.setAttribute('r',4);const title=document.createElementNS(ns,'title');title.textContent=c.p.label;dot.append(title);svg.append(dot)}root.append(svg,el('small',`${points[0].label} → ${points.at(-1).label}`))}
function renderProgress(){const p=profile(),factor=$('weightUnit').value==='lb'?2.2046226218:1,unit=$('weightUnit').value,ws=[...p.weights].sort((a,b)=>a.date.localeCompare(b.date));const dates=periodDates(today(),Number($('weightRange').value)),visible=ws.filter(w=>w.date>=dates[0]&&w.date<=today());chart('weightChart',visible.map(w=>({x:Date.parse(w.date),y:w.kg*factor,label:w.date+': '+fmt(w.kg*factor)+' '+unit})),'Weight trend, '+$('weightRange').value+' days. Exact records listed below.');renderWeightStats(ws,visible,factor,unit);$('weightSummary').textContent=ws.filter(w=>w.date<=today()).length?`Latest ${fmt(ws.filter(w=>w.date<=today()).at(-1).kg*factor)} ${unit} · Change ${fmt((ws.filter(w=>w.date<=today()).at(-1).kg-ws[0].kg)*factor)} ${unit}`:'Your first weigh-in starts your trend.';$('weights').replaceChildren();for(const w of ws.slice().reverse()){const n=el('div',undefined,'entry');n.append(el('span',`${w.date} · ${fmt(w.kg*factor)} ${unit} `),button('Edit',()=>{$('weightDate').value=w.date;$('weight').value=Number((w.kg*factor).toFixed(6));forcedDrafts.add('weightForm');storeDrafts()}),button('Delete',()=>mutate(d=>{withProfile(d).weights=withProfile(d).weights.filter(x=>x.date!==w.date)},'Weight removed.',true),'danger'));$('weights').append(n)}
 const trendDates=Array.from({length:14},(_,i)=>{const d=new Date(today()+'T12:00:00');d.setDate(d.getDate()-13+i);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`});const points=[];$('trends').replaceChildren();for(const d of trendDates){const rs=p.logs[d]||[],t=totals(rs),tr=el('tr');tr.append(el('td',d));for(const k of primary)tr.append(el('td',rs.length?fmt(t[k])+(t.unknown[k]?'*':''):'—'));$('trends').append(tr);if(rs.length)points.push({x:Date.parse(d),y:t.cal,label:`${d}: ${fmt(t.cal)} kcal${t.unknown.cal?' (incomplete)':''}`})}chart('calChart',points,'Calories on logged days. Missing days are omitted. Values in the table below.')}
$('day').onchange=()=>{if((dirtyForm('foodForm')||dirtyForm('goalForm')||dirtyForm('quickForm')||editing)&&!confirm('Changing the Food Log date will discard unsaved food and goal values. Continue?')){$('day').value=selectedDay;return}if(!dateOK(day())){$('day').value=today();notice('Choose a valid tracking date.')}selectedDay=day();resetFood();$('quickForm').reset();cleanForm('quickForm');cleanForm('goalForm');render();storeDrafts()};
function openMeal(meal){
 targetMeal=meal;
 if(!dirtyForm('foodForm')&&!editing){resetFood();$('foodReview').hidden=true;$('meal').value=meal;showEntryPanel(null)}
 if(!dirtyForm('quickForm'))$('quickMeal').value=meal;
 view('add');$('addTitle').focus();storeDrafts();
}
$('addFood').onclick=()=>openMeal($('selectedMeal').value);
$('backToLog').onclick=()=>view('diary');
$('enterBarcode').onclick=()=>{showEntryPanel('barcode');scanner.stop();$('barcodeEntry').open=true;$('barcode').focus()};
$('findFood').onclick=()=>{showEntryPanel('search');$('query').focus()};
$('recipeAddFood').onclick=()=>{openMeal($('selectedMeal').value);showEntryPanel('search');$('query').focus()};$('manual').onclick=()=>{if(discardFood()){showFoodReview();$('meal').value=targetMeal||$('selectedMeal').value;$('name').focus();$('foodTitle').scrollIntoView({block:'start'});storeDrafts()}};$('cancelEdit').onclick=()=>{if(discardFood()){$('foodReview').hidden=true;storeDrafts()}};
$('foodForm').onsubmit=e=>{e.preventDefault();const f=formFood(),edit=editing;if(mutate(d=>{const p=withProfile(d);if(edit?.library){const i=p.foods.findIndex(x=>x.id===edit.library);if(i<0)throw Error('Saved food no longer exists.');p.foods[i]={...f,id:edit.library}}else if(edit){if(edit.profile!==p.id||edit.date!==day())throw Error('The editing date or profile changed.');const index=p.logs[edit.date].findIndex(r=>r.id===edit.id);if(index<0)throw Error('Entry no longer exists.');p.logs[edit.date][index]={...f,id:edit.id}}else(p.logs[day()]??=[]).push(f);if($('saveFood').checked)p.foods.push({...f,id:uid()})},edit?'Entry updated.':'Food added.',true)){if(!edit?.library){$('selectedMeal').value=f.meal;renderEntries()}resetFood();$('foodReview').hidden=true;view('diary');storeDrafts()}};
$('undo').onclick=()=>{if(!undo||undo.revision!==db.revision)return;const old=undo.db;mutate(d=>{Object.assign(d,old);d.revision=db.revision},'Last change undone.')};
$('copyDay').onclick=()=>{const date=new Date(day()+'T12:00:00');date.setDate(date.getDate()-1);const previous=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,source=profile().logs[previous]||[];if(!source.length)return notice('No foods logged on the previous day.');if(confirm(`Copy ${source.length} foods from ${previous} to ${day()}?`))mutate(d=>(withProfile(d).logs[day()]??=[]).push(...source.map(r=>({...structuredClone(r),id:uid()}))),'Previous day copied.',true)};
$('saveMeal').onclick=()=>{if(!rows().length)return notice('Log foods first.');const name=prompt('Name this saved meal');if(name?.trim())mutate(d=>withProfile(d).meals.push({id:uid(),name:name.trim(),entries:structuredClone(rows())}),'Meal saved in Add Food.')};
$('addIngredient').onclick=()=>{if(!$('foodForm').reportValidity())return;const f=formFood();const probe=structuredClone(db);withProfile(probe).logs['2000-01-01']=[f];try{validate(probe);draft.push(f);resetFood();renderIngredients();view('library');notice('Ingredient added to recipe draft. Save the recipe to keep it.')}catch(e){notice(e.message)}};
$('recipeForm').onsubmit=e=>{e.preventDefault();try{const r=recipe($('recipeName').value.trim(),draft,Number($('recipeYield').value));if(mutate(d=>{const p=withProfile(d);if(recipeEdit){r.id=recipeEdit;p.recipes=p.recipes.filter(x=>x.id!==recipeEdit)}p.recipes.push(r)},'Recipe saved.')){$('recipeForm').reset();draft=[];recipeEdit=null;cleanForm('recipeForm');renderIngredients();storeDrafts()}}catch(e){notice(e.message)}};
$('clearRecipe').onclick=()=>{if((draft.length||recipeEdit||dirtyForm('recipeForm'))&&!confirm('Discard this recipe draft?'))return;draft=[];recipeEdit=null;$('recipeForm').reset();cleanForm('recipeForm');renderIngredients();storeDrafts()};
$('weightForm').onsubmit=e=>{e.preventDefault();const date=$('weightDate').value,kg=Number($('weight').value)/($('weightUnit').value==='lb'?2.2046226218:1);if(mutate(d=>{const p=withProfile(d);p.weights=p.weights.filter(w=>w.date!==date);p.weights.push({date,kg})},'Weight saved.',true)){$('weight').value='';cleanForm('weightForm');storeDrafts()}};$('weightUnit').onchange=()=>{const to=$('weightUnit').value,value=$('weight').value;if(value!==''&&Number.isFinite(Number(value))){$('weight').value=Number(convertWeight(Number(value),previousWeightUnit,to).toFixed(8));notice('Entered weight converted from '+previousWeightUnit+' to '+to+'.')}previousWeightUnit=to;renderProgress();storeDrafts()};
$('dateGoal').onchange=()=>{const selected=$('dateGoal').checked;$('dateGoal').checked=!selected;const wasDirty=dirtyForm('goalForm');$('dateGoal').checked=selected;if(wasDirty&&!confirm('Replace unsaved goal values with this goal set?')){$('dateGoal').checked=!$('dateGoal').checked;return}cleanForm('goalForm');renderGoals();storeDrafts()};$('goalForm').onsubmit=e=>{e.preventDefault();const g=Object.fromEntries(nutrients.map(k=>[k,$('goal-'+k).value===''?null:Number($('goal-'+k).value)]));if(mutate(d=>{const p=withProfile(d);if($('dateGoal').checked)p.dayGoals[day()]=g;else p.goals=g},'Goals saved.')){cleanForm('goalForm');storeDrafts()}};$('resetDateGoal').onclick=()=>{if(dirtyForm('goalForm')&&!confirm('Discard unsaved goals?'))return;if(mutate(d=>delete withProfile(d).dayGoals[day()],'Default goals restored for this date.')){cleanForm('goalForm');renderGoals();storeDrafts()}};
function clearContext(){$('selectedMeal').value=rows().at(-1)?.meal||'Breakfast';targetMeal=null;cancelRequest();scanner.stop();draft=[];recipeEdit=null;resetFood();$('recipeForm').reset();$('weightForm').reset();$('quickForm').reset();$('planForm').reset();$('estimateForm').reset();$('estimateResult').textContent='';$('useEstimate').hidden=true;estimatedCalories=null;previousGoalUnit='kg';$('weightDate').value=today();$('goalForm').reset();previousWeightUnit='kg';for(const id of trackedForms)cleanForm(id);reviewRecovered=false;renderIngredients();renderGoals();renderPlan();storeDrafts()}
function download(raw,name){const u=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=el('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000)}
$('export').onclick=()=>{if(blocked)return notice('Use Download recovery snapshot to export the original unreadable data.');download(JSON.stringify({...db,lastBackup:today()},null,2),`calorieiq-${today()}.json`);mutate(d=>d.lastBackup=today(),'Backup download started. Keep it somewhere safe.')};
$('recovery').onclick=()=>{try{const raw=blocked?(localStorage.getItem(KEY)||localStorage.getItem('calorieiq-v1')):localStorage.getItem(RECOVERY);if(!raw)return notice('No recovery snapshot is available.');download(raw,`calorieiq-recovery-${today()}.json`)}catch(e){notice(e.message)}};
$('importButton').onclick=()=>$('import').click();$('import').onchange=async e=>{const file=e.target.files[0];try{if(!file)return;if(file.size>10e6)throw Error('Backup exceeds the 10 MB limit.');const next=migrate(JSON.parse(await file.text()));if(!buildState.ready||!currentBuild(localStorage))throw Error('Reload the current app build before restoring.');if(!writer.held)throw Error('This tab is read-only. Close the editing tab and enable editing first.');if(!allowContextChange())return;if(!confirm(`Replace all local data with this backup (${next.profiles.length} profiles)? A recovery snapshot of current data will be kept.`))return;const current=localStorage.getItem(KEY);if(current!==expectedRaw)throw Error('Another tab changed your data. Reload before restoring.');if(current)localStorage.setItem(RECOVERY,current);next.revision=(blocked?0:db.revision)+1;localStorage.setItem(KEY,JSON.stringify(validate(next)));db=next;expectedRaw=localStorage.getItem(KEY);expectedStamp=draftStamp(expectedRaw);blocked=false;undo=null;clearContext();render();notice('Backup restored. A recovery snapshot is available in Settings.')}catch(err){notice('Restore failed: '+err.message)}finally{e.target.value=''}};
$('persist').onclick=async()=>{try{notice(await navigator.storage?.persist?.()?'Persistent storage granted. Continue exporting backups.':'Persistent storage was not granted. Continue exporting backups.')}catch(e){notice(e.message)}};
window.addEventListener('storage',e=>{if(e.key===KEY||e.key===BUILD_KEY){cancelRequest();scanner.stop();notice('Data changed in another tab. Reload before making more changes.');blocked=true}});
function rollover(){const now=today();if(now!==previousToday){if(day()===previousToday&&!editing&&!dirtyForm('foodForm')&&!dirtyForm('quickForm')){$('day').value=selectedDay=now;render();notice('A new day has started. Your Food Log date advanced.')}previousToday=now}}document.addEventListener('visibilitychange',()=>{if(!document.hidden)rollover()});setInterval(rollover,60000);
const scanner=cameraScanner({video:$('video'),container:$('scanner'),torch:$('torch'),zoom:$('zoom'),zoomLabel:$('zoomLabel'),status:t=>$('lookupStatus').textContent=t,onCode:code=>{$('barcode').value=code;lookup(code)}});$('scan').onclick=()=>{showEntryPanel('barcode');scanner.start()};$('stopScan').onclick=()=>scanner.stop();$('photo').onchange=e=>{cancelRequest();scanner.photo(e.target.files[0]);e.target.value=''};
async function lookup(code){if(!/^\d{8,14}$/.test(code))return notice('Enter an 8–14 digit barcode.');scanner.stop();cancelRequest();if(!discardFood())return;$('results').replaceChildren();const cached=localBarcode(profile().foods,code)||localBarcode(db.cache,code);if(cached){let preset=changeFoodUnit({...cached,quantity:cached.base},'serving')||structuredClone(cached);if(preset.unit==='serving'){for(const k of nutrients)if(preset[k]!=null)preset[k]/=preset.base;preset.base=1}preset.quantity=preset.base;if(!choose(preset))return;$('lookupStatus').textContent='Loaded saved barcode nutrition. Verify the label.';return}try{const controller=new AbortController();request=controller;const id=requestId;$('lookupStatus').textContent='Searching Open Food Facts…';const f=await off.lookup(code,{signal:controller.signal});if(id!==requestId||controller.signal.aborted)return;if(!choose(f))return;mutate(d=>{d.cache=[f,...d.cache.filter(x=>x.barcode!==code)].slice(0,200)});$('lookupStatus').textContent='Product loaded. Review units and missing nutrition before adding.'}catch(e){if(e.name!=='AbortError')$('lookupStatus').textContent=e.message}}
$('barcodeForm').onsubmit=e=>{e.preventDefault();lookup($('barcode').value.trim())};
$('searchForm').onsubmit=async e=>{
 e.preventDefault();if(!discardFood())return;cancelRequest();const id=requestId,controller=new AbortController();request=controller;
 const q=$('query').value.trim();$('results').replaceChildren();$('lookupStatus').textContent='Searching saved foods, USDA and Open Food Facts…';
 await unifiedSearch(q,{saved:[...profile().foods,...profile().recipes],catalogue,off,signal:controller.signal,onUpdate:result=>{
  if(id!==requestId||controller.signal.aborted||$('add').hidden)return;
  if(result.foods.length)renderFoodList('results',result.foods);else $('results').replaceChildren();
  $('lookupStatus').textContent=(result.foods.length?result.foods.length+' matching foods. Choose a result to review.':result.complete?'No matching foods. Try another name or enter manually.':'Searching…')+(result.issues.length?' '+result.issues.join(' '):'');
 }});
};
async function setupWorker(){if(!('serviceWorker'in navigator))return;let hadController=!!navigator.serviceWorker.controller;try{registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});const ready=()=>{$('update').hidden=!registration.waiting};ready();registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',ready));navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!hadController){hadController=true;return}if(!blocked&&writer.held)notice('Update installed. Reload when your current drafts are saved.');$('update').textContent='Reload updated app';$('update').hidden=false;$('update').onclick=()=>{if(confirm('Reload now? Unsaved drafts will be recovered if session storage is available. Download important drafts first.'))location.reload()}})}catch{if(!blocked)notice('Offline caching is unavailable. Your Food Log can still be used while online.')}}
$('checkUpdate').onclick=async()=>{try{await registration?.update();notice(registration?.waiting?'An app update is available.':'Update check finished.');$('update').hidden=!registration?.waiting}catch{notice('Could not check for updates. Check your connection.')}};$('update').onclick=()=>registration?.waiting?.postMessage('SKIP_WAITING');

function shortcutFoods(kind){const p=profile(),history=foodHistory(p.logs);return kind==='recent'||kind==='frequent'?history[kind]:kind==='favorites'?p.foods.filter(f=>f.favorite):kind==='custom'?p.foods.filter(f=>f.source==='Custom'||f.source==='Package label (user corrected)'):kind==='recipes'?p.recipes:p.foods}
function renderShortcuts(){renderFoodList('recent',shortcutFoods($('quickList').value).slice(0,12))}
function renderLibrary(){const filter=$('libraryFilter').value;renderFoodList('savedFoods',shortcutFoods(filter),['recent','frequent'].includes(filter)?undefined:'foods')}
$('quickList').onchange=renderShortcuts;$('libraryFilter').onchange=renderLibrary;
$('openMeals').onclick=()=>view('library');

$('quickForm').onsubmit=e=>{e.preventDefault();try{const optional=id=>$(id).value===''?null:Number($(id).value);const f=quickFood({id:uid(),name:$('quickName').value,cal:Number($('quickCal').value),pro:optional('quickPro'),carb:optional('quickCarb'),fat:optional('quickFat'),meal:$('quickMeal').value});if(mutate(d=>(withProfile(d).logs[day()]??=[]).push(f),'Quick entry added.',true)){$('selectedMeal').value=f.meal;renderEntries();$('quickForm').reset();cleanForm('quickForm');storeDrafts();view('diary')}}catch(e){notice(e.message)}};
for(const [id,offset]of [['previousDay',-1],['nextDay',1],['todayDay',0]])$(id).onclick=()=>{$('day').value=offset?shiftDate(day(),offset):today();$('day').dispatchEvent(new Event('change'))};
$('copyAnyDay').onclick=()=>{const from=$('copyFrom').value;if(!dateOK(from))return notice('Choose a valid source date.');if(from===day())return notice('Choose a different source date.');const source=profile().logs[from]||[];if(!source.length)return notice('No foods logged on '+from+'.');if(confirm('Copy '+source.length+' foods from '+from+' to '+day()+'?'))mutate(d=>(withProfile(d).logs[day()]??=[]).push(...source.map(r=>({...structuredClone(r),id:uid()}))),'Selected day copied.',true)};



function renderWeightStats(all,visible,factor,unit){const goal=profile().plan?.goalKg??null,s=weightSummary(all.filter(w=>w.date<=today()),goal),root=$('weightStats');root.replaceChildren();for(const [name,value]of [['Starting',s.start],['Current',s.current],['Goal',goal],['Total change',s.change],['Remaining to goal',s.remaining]]){const n=el('div');n.append(el('small',name),el('strong',value==null?'Not set':fmt(value*factor)+' '+unit));root.append(n)}const progress=$('weightGoalProgress');progress.replaceChildren();if(s.progress!==null){progress.append(el('p',fmt(s.progress)+'% of start-to-goal change'));const bar=el('progress');bar.max=100;bar.value=s.progress;bar.setAttribute('aria-label','Weight goal progress');progress.append(bar)}else progress.append(el('p','Set a goal in Settings to see goal progress.','muted'));$('weightWindow').textContent=visible.length+' weigh-in(s) in this window. Starting and current values use all saved weigh-ins. '+(all.some(w=>w.date>today())?'Future-dated records are excluded from the trend and current weight.':'');
 const show=$('weightAverage').checked;$('weightAverageChart').hidden=!show;if(show){const points=visible.map(w=>{const avg=rollingWeight(all,w.date);return {x:Date.parse(w.date),y:avg.kg*factor,label:w.date+': '+fmt(avg.kg*factor)+' '+unit+' average ('+avg.count+' weigh-in(s), trailing 7 calendar days)'}});chart('weightAverageChart',points,'Trailing seven-day average on each recorded date; missing weigh-ins are omitted.');$('weightAverageChart').prepend(el('h3','7-day average'))}
}
$('weightRange').onchange=renderProgress;$('weightAverage').onchange=renderProgress;

function renderNutrition(){
 const date=$('nutritionDate').value||day(),p=profile(),entries=p.logs[date]||[],t=totals(entries),g=p.dayGoals[date]||p.goals,root=$('nutritionTotals');
 root.replaceChildren();$('micronutrientTotals').replaceChildren();$('additionalNutrition').hidden=true;
 $('nutritionContext').textContent=Object.values(t.unknown).some(Boolean)?'— unavailable · * known subtotal with missing values':'';
 for(const k of nutrients.filter(k=>!additional.includes(k)||entries.some(e=>e[k]!=null)||g[k]!=null)){
  const info=nutrientInfo[k],known=entries.length>t.unknown[k],partial=known&&t.unknown[k]>0,target=g[k],n=el('div',undefined,'nutrition-stat'),heading=el('div',undefined,'row spread');
  heading.append(el('span',info.name),el('strong',known?fmt(t[k])+' '+info.unit+(partial?'*':''):'—'));
  n.append(heading);
  if(target!=null){const percent=known&&target>0?t[k]/target*100:null;
   n.append(el('small','Goal '+fmt(target)+' '+info.unit+(percent===null?'':' · '+fmt(percent)+'%')));
   if(known){const bar=el('progress');bar.max=100;bar.value=percent===null?0:Math.min(100,percent);bar.setAttribute('aria-label',info.name+' goal progress');n.append(bar)}
  }
  if(additional.includes(k)){$('micronutrientTotals').append(n);$('additionalNutrition').hidden=false}else root.append(n);
 }
}
let nutritionSelectedDate=today();
$('nutritionDate').onchange=()=>{const value=$('nutritionDate').value;if(!dateOK(value)){$('nutritionDate').value=nutritionSelectedDate;return}nutritionSelectedDate=value;renderNutrition()};
for(const [id,offset]of [['nutritionPrevious',-1],['nutritionNext',1]])$(id).onclick=()=>{nutritionSelectedDate=shiftDate($('nutritionDate').value||day(),offset);$('nutritionDate').value=nutritionSelectedDate;renderNutrition()};
let previousGoalUnit='kg',estimatedCalories=null;
function renderPlan(){if(dirtyForm('planForm'))return;const p=profile().plan||{},unit=$('goalWeightUnit').value;$('goalWeight').value=p.goalKg==null?'':Number(convertWeight(p.goalKg,'kg',unit).toFixed(8));$('direction').value=p.direction||'maintain';$('weeklyRate').value=p.weeklyRate??'';$('activity').value=p.activity||'';cleanForm('planForm')}
$('goalWeightUnit').onchange=()=>{const to=$('goalWeightUnit').value;if($('goalWeight').value!=='')$('goalWeight').value=Number(convertWeight(Number($('goalWeight').value),previousGoalUnit,to).toFixed(8));previousGoalUnit=to;storeDrafts()};
$('planForm').onsubmit=e=>{e.preventDefault();const plan={goalKg:$('goalWeight').value===''?null:convertWeight(Number($('goalWeight').value),$('goalWeightUnit').value,'kg'),direction:$('direction').value,weeklyRate:$('weeklyRate').value===''?null:Number($('weeklyRate').value),activity:$('activity').value};if(mutate(d=>withProfile(d).plan=plan,'Preferences saved. Daily calorie goal was unchanged.')){cleanForm('planForm');storeDrafts()}};
$('estimateForm').onsubmit=e=>{e.preventDefault();try{const result=calorieEstimate({age:Number($('estimateAge').value),heightCm:Number($('estimateHeight').value),kg:Number($('estimateKg').value),sex:$('estimateSex').value,activity:$('estimateActivity').value});estimatedCalories=result.maintenance;$('estimateResult').textContent='Estimated resting energy: '+fmt(result.resting)+' kcal/day. Estimated maintenance: '+fmt(result.maintenance)+' kcal/day. This is an estimate, not a guaranteed result.';$('useEstimate').hidden=false;cleanForm('estimateForm');storeDrafts()}catch(e){notice(e.message)}};
$('estimateForm').oninput=()=>{estimatedCalories=null;$('useEstimate').hidden=true;$('estimateResult').textContent='Inputs changed. Calculate again.'};
$('useEstimate').onclick=()=>{if(estimatedCalories===null)return;if(dirtyForm('goalForm')&&!confirm('Replace the unsaved calorie target with this estimate? Other goal fields stay as entered.'))return;$('goal-cal').value=estimatedCalories;forcedDrafts.add('goalForm');storeDrafts();$('goal-cal').focus();notice('Estimate copied to goal form. Review all targets and choose Save goals to apply.')};
$('wholePackage').onclick=()=>{const f=formFood(),q=packageQuantity({...f,requiresReview:!!loaded?.requiresReview&&!$('reviewNutrition').checked});if(q===null)return notice('Reliable package conversion is unavailable.');$('quantity').value=q;preview();storeDrafts()};

resetFood();render();for(const id of trackedForms)cleanForm(id);draftsReady=true;restoreDrafts();setupWorker();
if(!writer.held)notice('This tab is read-only: another tab is editing, or this browser lacks safe cross-tab locking. Drafts and exports remain available.');
let claimingWriter=false;
$('claimWriter').onclick=async()=>{
 if(claimingWriter)return;
 claimingWriter=true;$('claimWriter').disabled=true;
 try{
  if(!writer.held)writer=await acquireWriter(navigator.locks);
  if(writer.held&&!buildState.ready){location.reload();return}
  if(localStorage.getItem(KEY)!==expectedRaw)blocked=true;
  if(writer.held&&!blocked&&expectedRaw===null){
   localStorage.setItem(KEY,JSON.stringify(validate(db)));
   expectedRaw=localStorage.getItem(KEY);expectedStamp=draftStamp(expectedRaw);
  }
  notice(writer.held&&!blocked?'Editing enabled.':writer.held?'Saved data changed. Reload latest data; drafts will be recovered.':'Another tab is still editing, or safe locking is unsupported. Close it and retry.');
 }catch(e){notice('Could not enable editing: '+e.message)}
 finally{claimingWriter=false;$('claimWriter').disabled=false}
};
$('reloadData').onclick=()=>{storeDrafts();location.reload()};
$('downloadDrafts').onclick=()=>{let raw;try{raw=sessionStorage.getItem(DRAFT_KEY)}catch{}download(raw||JSON.stringify(draftSnapshot(),null,2),'calorieiq-unsaved-drafts.json')};
$('unit').required=true;
$('unit').onchange=()=>{
 const target=$('unit').value;
 if(!previousFoodUnit&&loaded?.requiresUnitConfirmation&&target==='serving'){$('unit').value='';notice('Confirm grams or milliliters on the label, or enter a manual serving.');return}
 const f=formFood();f.unit=previousFoodUnit;
 const converted=previousFoodUnit&&changeFoodUnit(f,target);
 if(converted){$('base').value=Number(converted.base.toFixed(8));$('quantity').value=Number(converted.quantity.toFixed(8));notice('Converted using the stated serving size. Nutrition is unchanged for the same amount eaten.');}
 else if(previousFoodUnit&&target!==previousFoodUnit&&nutrients.some(k=>$(k).value!=='')){
  if(!confirm('No reliable conversion exists. Clear nutrition values and enter the package label for the new unit?')){$('unit').value=previousFoodUnit;return}
  for(const k of nutrients)$(k).value='';notice('Enter label values for the new base quantity; grams and milliliters were not assumed equivalent.');
 }
 previousFoodUnit=target;preview();storeDrafts();
};

$('devStorageNote').hidden=!BUILD.development;$('devBanner').hidden=!BUILD.development;$('devBanner').textContent='DEVELOPMENT · '+BUILD.id;$('devBanner').title='Test data resets once per new development build; ordinary reopens preserve entries.';
if(buildState.reset)$('devBanner').textContent='DEVELOPMENT · '+BUILD.id+' · Test data reset';

if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',event=>{if(BUILD.development&&event.data?.type==='CALORIEIQ_DEV_UPDATE'&&event.data.build!==BUILD.id){location.reload()}});
