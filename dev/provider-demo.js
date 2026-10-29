import {unifiedSearch,validateSearchQuery,debounceSearch} from '../search.js';
import {createCatalogue} from '../providers/catalogue.js';
import {createMockNutrition,createMockTransport} from '../providers/mock-nutrition.js';
import {changeFoodUnit} from '../nutrition.js';
import {totals} from '../core.js';
import {nutrients,nutrientInfo} from '../nutrients.js';
const $=id=>document.getElementById(id),node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n};
const catalogue=createCatalogue({storage:null});let controller,food;
function preview(){if(!food)return;const quantity=Number($('demoQuantity').value);if(!Number.isFinite(quantity)||quantity<.001||quantity>1e7){$('demoNutrition').textContent='Enter a positive quantity.';return}food.quantity=quantity;const t=totals([food]);$('demoNutrition').textContent=nutrients.map(k=>nutrientInfo[k].name+': '+(t.unknown[k]?'unknown':Number(t[k].toFixed(2))+' '+nutrientInfo[k].unit)).join(' · ')}
function review(f){food=structuredClone(f);$('demoReview').hidden=false;$('demoName').textContent=f.name;$('demoBasis').textContent=f.source+' · '+f.basis+' · '+(f.provenance?.license||'');$('demoQuantity').value=f.base;$('demoUnit').value=f.unit;preview()}
function render(foods){$('demoResults').replaceChildren();for(const f of foods){const row=node('div','');row.className='entry';row.append(node('strong',f.name),node('small',f.source+' · '+f.basis+' · '+(f.cal??'unknown')+' kcal'));const b=node('button','Preview only');b.type='button';b.onclick=async()=>{try{review(f.catalogueRecord?await catalogue.resolve(f,{signal:controller.signal}):f)}catch(e){if(e.name!=='AbortError')$('demoStatus').textContent=e.message}};row.append(b);$('demoResults').append(row)}}
$('demoQuery').oninput=()=>{controller?.abort();$('demoResults').replaceChildren();$('demoStatus').textContent='Select Search demo.'};
$('scenario').onchange=()=>{controller?.abort();$('demoResults').replaceChildren();$('demoStatus').textContent='Select Search demo to simulate this response.'};
$('demoSearch').onsubmit=async e=>{e.preventDefault();controller?.abort();const current=controller=new AbortController();$('demoReview').hidden=true;try{const query=validateSearchQuery($('demoQuery').value);$('demoStatus').textContent='Searching…';await debounceSearch(current.signal);await unifiedSearch(query,{catalogue,off:{search:async()=>[]},additionalProviders:[createMockNutrition({transport:createMockTransport({scenario:$('scenario').value})})],signal:current.signal,providerTimeoutMs:800,onUpdate:r=>{if(current!==controller||current.signal.aborted)return;render(r.foods);$('demoStatus').textContent=(r.complete?r.foods.length+' read-only results.':'Searching…')+' '+r.issues.join(' ')}})}catch(err){if(err.name!=='AbortError')$('demoStatus').textContent=err.message}};
$('demoQuantity').oninput=preview;
$('demoUnit').onchange=()=>{if(!food)return;const changed=changeFoodUnit(food,$('demoUnit').value);if(!changed){$('demoUnit').value=food.unit;$('demoNutrition').textContent='No compatible conversion. Grams and milliliters are not interchangeable.';return}food=changed;$('demoQuantity').value=food.quantity;preview()};
window.addEventListener('pagehide',()=>controller?.abort());
