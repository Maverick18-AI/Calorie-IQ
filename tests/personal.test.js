import test from 'node:test';
import assert from 'node:assert/strict';
import {heightToCm,heightFromCm,calorieTarget,safeCalorieGoal,saveWeighIn,weightSummary} from '../wellness.js';
import {fresh,validate,convertWeight} from '../core.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const adult={age:30,heightCm:180,kg:80,sex:'male',activity:'sedentary',direction:'maintain'};

test('imperial height converts without treating inches as decimal feet',()=>{
 near(heightToCm(5,10),177.8);assert.deepEqual(heightFromCm(177.8),{feet:5,inches:10});
 for(const [ft,inch]of [[5,12],[5,-1],[5.5,4],[3,0],[9,0]])assert.throws(()=>heightToCm(ft,inch));
 assert.deepEqual(heightFromCm(null),{feet:'',inches:''});
});
test('adult target separates resting, maintenance and explicit lose/maintain/gain adjustments',()=>{
 const m=calorieTarget(adult);assert.equal(m.resting,1780);assert.equal(m.maintenance,2136);assert.equal(m.target,2136);assert.equal(m.adjustment,0);
 const lose=calorieTarget({...adult,direction:'lose',weeklyRate:.25,goalKg:70});assert.equal(lose.target,1861);assert.equal(lose.adjustment,-275);
 const gain=calorieTarget({...adult,direction:'gain',weeklyRate:.25,goalKg:85});assert.equal(gain.target,2411);assert.equal(gain.adjustment,275);
 assert.deepEqual(adult,{age:30,heightCm:180,kg:80,sex:'male',activity:'sedentary',direction:'maintain'});
});
test('calorie safeguards cap aggressive deficits and reject unsupported rates or underweight loss',()=>{
 const guarded=calorieTarget({...adult,direction:'lose',weeklyRate:convertWeight(2,'lb','kg')});assert.equal(guarded.target,1602);assert.ok(guarded.warnings.length);
 for(const bad of [{age:17},{sex:'manual'},{direction:'lose',weeklyRate:1},{direction:'gain',weeklyRate:.6},{direction:'lose',weeklyRate:0},{direction:'lose',weeklyRate:.2,goalKg:90},{kg:50,direction:'lose',weeklyRate:.2},{direction:'lose',weeklyRate:.2,goalKg:45}])assert.throws(()=>calorieTarget({...adult,...bad}));
 assert.throws(()=>safeCalorieGoal(1199));assert.throws(()=>safeCalorieGoal(1499,'male'));assert.equal(safeCalorieGoal(1500,'male'),1500);assert.equal(safeCalorieGoal(1200,'female'),1200);assert.throws(()=>safeCalorieGoal(Infinity));
});
test('weigh-in date edits move the original instead of duplicating it, without mutating input',()=>{
 const original=[{date:'2026-10-01',kg:80},{date:'2026-10-02',kg:79}];
 const moved=saveWeighIn(original,{date:'2026-10-03',kg:78,originalDate:'2026-10-01'});assert.deepEqual(moved,[original[1],{date:'2026-10-03',kg:78}]);assert.equal(original.length,2);assert.equal(original[0].kg,80);
 assert.equal(saveWeighIn(original,{date:'2026-10-02',kg:78,originalDate:'2026-10-01'}).length,1);
 assert.throws(()=>saveWeighIn(original,{date:'2026-02-30',kg:80}));assert.throws(()=>saveWeighIn(original,{date:'2026-10-03',kg:78,originalDate:'2020-01-01'}));
});
test('explicit starting weight supports goal progress independently of the first history record',()=>{
 const s=weightSummary([{date:'2026-10-29',kg:75}],70,100);assert.equal(s.start,100);assert.equal(s.current,75);assert.equal(s.change,-25);near(s.progress,100*25/30);
 const empty=weightSummary([],70,100);assert.equal(empty.current,undefined);assert.equal(empty.change,null);assert.equal(empty.progress,null);
});
test('personal profile and starting point survive backups with unchanged diary nutrition and old backups',()=>{
 const d=fresh(),p=d.profiles[0];p.personal={age:35,heightCm:177.8,sex:'manual',activity:'light',weightUnit:'lb'};p.plan={startKg:90,startDate:'2026-01-01',goalKg:75,direction:'lose',weeklyRate:.25,activity:'light'};p.weights=[{date:'2026-10-29',kg:80}];const goals=structuredClone(p.goals);
 const roundtrip=validate(JSON.parse(JSON.stringify(d)));assert.deepEqual(roundtrip.profiles[0],p);assert.deepEqual(roundtrip.profiles[0].goals,goals);delete d.profiles[0].personal;assert.doesNotThrow(()=>validate(d));
});
test('malformed profile fields and starting dates are rejected before restore',()=>{
 const p={age:35,heightCm:177.8,sex:'female',activity:'light',weightUnit:'lb'};
 for(const bad of [{age:17},{age:35.5},{heightCm:0},{sex:'unknown'},{weightUnit:'stone'},{activity:'extreme'}]){const d=fresh();d.profiles[0].personal={...p,...bad};assert.throws(()=>validate(d))}
 const d=fresh();d.profiles[0].plan={startKg:90,startDate:'2026-02-30',goalKg:75,direction:'lose',weeklyRate:.25,activity:'light'};assert.throws(()=>validate(d));
});
