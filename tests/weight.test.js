import test from 'node:test';
import assert from 'node:assert/strict';
import {weightSummary,rollingWeight,periodDates} from '../wellness.js';
import {fresh,validate,newProfile} from '../core.js';
test('weight progress handles loss, gain, moving away, and no goal without predictions',()=>{
 const loss=[{date:'2026-10-01',kg:80},{date:'2026-10-28',kg:75}];
 assert.deepEqual(weightSummary(loss,70),{start:80,current:75,change:-5,remaining:5,progress:50});
 assert.equal(weightSummary(loss,90).progress,0);assert.equal(weightSummary(loss,null).progress,null);
 assert.equal(weightSummary([...loss,{date:'2026-10-29',kg:65}],70).progress,100);
 assert.equal(weightSummary([],70).current,undefined);
});
test('trailing weight average uses calendar days and real samples only',()=>{
 const ws=[{date:'2026-10-01',kg:100},{date:'2026-10-22',kg:80},{date:'2026-10-28',kg:70},{date:'2026-10-29',kg:1}];
 assert.deepEqual(rollingWeight(ws,'2026-10-28'),{count:2,kg:75});
 assert.deepEqual(rollingWeight(ws,'2026-09-01'),{count:0,kg:null});assert.equal(periodDates('2026-10-28',7)[0],'2026-10-22');
});
test('weight preferences validate independently for each profile and never change calories',()=>{
 const d=fresh(),p=d.profiles[0];d.profiles.push(newProfile('Family'));p.plan={goalKg:65,direction:'lose',weeklyRate:.25,activity:'light'};
 const restored=validate(JSON.parse(JSON.stringify(d)));assert.equal(restored.profiles[1].plan,undefined);assert.equal(restored.profiles[0].goals.cal,2200);
 p.plan.goalKg=-1;assert.throws(()=>validate(d));
});
