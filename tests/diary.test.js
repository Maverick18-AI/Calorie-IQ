import test from 'node:test';
import assert from 'node:assert/strict';
import {shiftDate,foodHistory,quickFood} from '../diary.js';
import {fresh,validate,totals} from '../core.js';
test('diary date controls handle month, leap-year and year boundaries',()=>{
  assert.equal(shiftDate('2024-03-01',-1),'2024-02-29');
  assert.equal(shiftDate('2026-12-31',1),'2027-01-01');
});
test('frequent foods count snapshots without merging changed nutrition',()=>{
  const a={name:'A',base:1,unit:'serving',cal:10}, b={...a,cal:20};
  const result=foodHistory({'2026-10-27':[a,a],'2026-10-28':[b]});
  assert.equal(result.recent[0].cal,20);assert.equal(result.frequent[0].cal,10);
  assert.equal(result.recent.length,2);
});
test('quick add preserves unknown macros, explicit zero and backup validity',()=>{
  const f=quickFood({id:'quick',name:'',cal:120,pro:0,meal:'Lunch'}),d=fresh();
  d.profiles[0].logs['2026-10-28']=[f];validate(d);
  const t=totals([f]);assert.equal(t.cal,120);assert.equal(t.unknown.pro,0);assert.equal(t.unknown.carb,1);
  assert.throws(()=>quickFood({id:'x',name:'bad',cal:-1,meal:'Lunch'}));
});
