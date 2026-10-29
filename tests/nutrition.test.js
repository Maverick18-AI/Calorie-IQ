import test from 'node:test';
import assert from 'node:assert/strict';
import {productFood,totals,recipe,fresh,validate} from '../core.js';
import {packageQuantity,packageFromProduct,changeFoodUnit} from '../nutrition.js';
import {macroShares,calorieEstimate} from '../wellness.js';
const product=()=>({nutrition_data_per:'serving',serving_size:'1 pack (26 g)',quantity:'130 g',nutriments:{'energy-kcal_serving':130,proteins_serving:2,carbohydrates_serving:15,fat_serving:7,'saturated-fat_serving':1.5,fiber_serving:1,sugars_serving:0,sodium_serving:.12,cholesterol_serving:.01,potassium_serving:.2}});
test('OFF standard gram nutrients convert to mg exactly once, including explicit zero',()=>{
 const f=productFood(product());assert.equal(f.sodium,120);assert.equal(f.cholesterol,10);assert.equal(f.potassium,200);assert.equal(f.sugar,0);
 const t=totals([{...f,quantity:.5}]);assert.equal(t.sodium,60);assert.equal(t.sat,.75);assert.equal(t.sugar,0);assert.equal(t.unknown.sugar,0);
});
test('all extra nutrients scale through recipes, meals and backup roundtrips',()=>{
 const f={...productFood(product()),quantity:2,meal:'Lunch'},r=recipe('Pack recipe',[f],4),d=fresh();
 d.profiles[0].recipes=[r];d.profiles[0].meals=[{id:'meal',name:'Meal',entries:[f]}];d.profiles[0].logs['2026-10-28']=[{...r,quantity:3,meal:'Lunch'}];
 const restored=validate(JSON.parse(JSON.stringify(d)));assert.equal(totals(restored.profiles[0].logs['2026-10-28']).sodium,180);
 r.sodium=999;assert.throws(()=>validate(d),/Inconsistent recipe/);
});
test('old four-nutrient recipes and backups remain valid; absent extras are unknown',()=>{
 const f={...productFood(product()),quantity:1,meal:'Lunch'};delete f.sodium;const r=recipe('Old',[f],1);delete r.sodium;
 const d=fresh();d.profiles[0].recipes=[r];assert.doesNotThrow(()=>validate(d));assert.equal(totals([{...r,quantity:1}]).unknown.sodium,1);
});
test('extra-only serving data cannot displace valid per-100 macro basis',()=>{
 const f=productFood({nutrition_data_per:'100g',nutriments:{'energy-kcal_100g':300,sodium_serving:.2}});assert.equal(f.unit,'g');assert.equal(f.cal,300);assert.equal(f.sodium,null);
});
test('whole packages use explicit compatible quantities in servings and grams',()=>{
 const f=productFood(product());assert.equal(packageQuantity(f),5);assert.equal(packageQuantity(changeFoodUnit({...f,quantity:1},'g')),130);
 const liquid=productFood({nutrition_data_per:'100ml',serving_size:'250 ml',quantity:'1 l',nutriments:{'energy-kcal_100g':40}});assert.equal(packageQuantity(liquid),4);
 const incompatible=productFood({...product(),quantity:'500 ml'});assert.equal(packageQuantity(incompatible),null);
});
test('whole packages reject conflicting counts, ranges, multipack guesses and missing units',()=>{
 const f=productFood({...product(),servings_per_container:6});assert.equal(f.package,null);
 for(const p of [{quantity:'5 x 26 g'},{quantity:'120-130 g'},{product_quantity:130},{servings_per_container:'about 5'}])assert.equal(packageFromProduct(p,{grams:26,ml:null}).value,null);
 assert.equal(packageQuantity({...productFood(product()),requiresReview:true}),null);
});
test('macro energy percentages handle zero and incomplete macros honestly',()=>{
 const t=totals([{...productFood(product()),quantity:1}]);const shares=macroShares(t);assert.ok(Math.abs(shares.pro+shares.carb+shares.fat-100)<1e-10);t.unknown.pro=1;assert.equal(macroShares(t),null);
});
test('maintenance estimate follows documented equation and rejects invalid adult inputs',()=>{
 assert.deepEqual(calorieEstimate({age:30,heightCm:180,kg:80,sex:'male',activity:'sedentary'}),{resting:1780,maintenance:2136});
 assert.equal(calorieEstimate({age:30,heightCm:180,kg:80,sex:'female',activity:'light'}).resting,1614);
 assert.throws(()=>calorieEstimate({age:17,heightCm:180,kg:80,sex:'male',activity:'sedentary'}));
});
