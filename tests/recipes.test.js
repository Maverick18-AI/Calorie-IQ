import test from 'node:test';
import assert from 'node:assert/strict';
import {recipeDraftNutrition,applyRecipeIngredient} from '../recipes.js';
import {changeFoodUnit,packageQuantity} from '../nutrition.js';
import {offFood} from '../providers/off.js';
import {recipe,totals} from '../core.js';

// Synthetic label fixture based on the user's 110-kcal / 28-g example.
const cheese=()=>({...offFood({code:'123456789012',product_name:'Recipe cheese label fixture',brands:'Example test brand',nutrition_data_per:'serving',serving_size:'1 slice (28 g)',serving_quantity:28,serving_quantity_unit:'g',quantity:'224 g',servings_per_container:8,nutriments:{'energy-kcal_serving':110,proteins_serving:7,carbohydrates_serving:1,fat_serving:9,fiber_serving:0,sugars_serving:0,sodium_serving:.18}},{retrieved:'2026-10-29'}),quantity:1,meal:'Snacks'});

test('recipe cheese example: 56 g contributes 220 kcal with source and original serving intact',()=>{
 const f=cheese(),g={...changeFoodUnit(f,'g'),quantity:56},d=recipeDraftNutrition([g],2);
 assert.equal(g.base,28);assert.equal(d.whole.cal,220);assert.equal(d.perServing.cal,110);assert.equal(d.whole.sodium,360);assert.equal(d.whole.fiber,0);assert.equal(d.whole.b12,null);assert.equal(d.perServing.b12,null);assert.equal(g.nutritionSource.originalBasis.selected,'_serving');assert.equal(g.provenance.provider,'off');assert.equal(g.provenance.recordId,'123456789012');
});
test('fractional servings and reliable whole packages scale every supplied nutrient once',()=>{
 const f=cheese();assert.equal(packageQuantity(f),8);const half=recipeDraftNutrition([{...f,quantity:.5}],2),all=recipeDraftNutrition([{...f,quantity:8}],8);
 assert.equal(half.whole.cal,55);assert.equal(half.perServing.cal,27.5);assert.equal(half.whole.sodium,90);assert.equal(all.whole.cal,880);assert.equal(all.perServing.cal,110);assert.equal(all.whole.sodium,1440);
});
test('missing nutrition stays unknown when other ingredients have values, including known zeros',()=>{
 const a=cheese(),b={...cheese(),id:'second',cal:null,sodium:null};const n=recipeDraftNutrition([a,b],2);assert.equal(n.whole.cal,null);assert.equal(n.perServing.cal,null);assert.equal(n.knownSubtotal.cal,110);assert.equal(n.whole.fiber,0);assert.equal(n.perServing.fiber,0);
});
test('invalid yields never produce infinity or misleading per-serving values',()=>{
 for(const value of [0,-1,NaN,Infinity,1e8]){const n=recipeDraftNutrition([cheese()],value);assert.equal(n.validYield,false);assert.equal(n.perServing.cal,null);assert.equal(n.whole.cal,110)}assert.equal(recipeDraftNutrition([],4).whole.cal,null);
});
test('replacing a recipe ingredient preserves its slot, other ingredients and historical snapshots',()=>{
 const a=cheese(),b={...cheese(),id:'other',quantity:2},old=recipe('Original',[a,b],2),history=structuredClone(old),replacement={...cheese(),id:'replacement',quantity:.5},next=applyRecipeIngredient([a,b],replacement,{replaceIndex:0,replaceId:a.id});
 assert.equal(next.length,2);assert.equal(next[0].id,a.id);assert.deepEqual(next[1],b);assert.equal(recipe('Changed',next,2).cal,137.5);assert.equal(history.cal,165);assert.equal(a.quantity,1);replacement.quantity=999;assert.equal(next[0].quantity,.5);assert.equal(totals(next).cal,275);
});
test('stale replacement targets and invalid amounts fail without altering the original draft',()=>{
 const a=cheese(),draft=[a];for(const context of [{replaceIndex:1,replaceId:a.id},{replaceIndex:0,replaceId:'stale'},{replaceIndex:.5,replaceId:a.id}])assert.throws(()=>applyRecipeIngredient(draft,cheese(),context));assert.throws(()=>applyRecipeIngredient(draft,{...a,quantity:0}));assert.equal(draft.length,1);assert.equal(draft[0].quantity,1);
});
