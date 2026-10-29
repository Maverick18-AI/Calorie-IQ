import {shiftDate} from './diary.js';
// Percentages describe energy from known P/C/F, not percentages of scale weight.
export function macroShares(t) {
  if (['pro','carb','fat'].some(k=>t.unknown[k])) return null;
  const energy={pro:t.pro*4,carb:t.carb*4,fat:t.fat*9};
  const sum=energy.pro+energy.carb+energy.fat;
  return sum>0?Object.fromEntries(Object.entries(energy).map(([k,v])=>[k,v/sum*100])):null;
}
export function periodDates(end, count) {
  return Array.from({length:count},(_,i)=>shiftDate(end,i-count+1));
}
export const activityFactors = {sedentary:1.2,light:1.375,moderate:1.55,active:1.725};
export function calorieEstimate({age,heightCm,kg,sex,activity}) {
  if (!Number.isFinite(age)||age<18||age>100||!Number.isFinite(heightCm)||heightCm<100||heightCm>250||
      !Number.isFinite(kg)||kg<30||kg>400||!['male','female'].includes(sex)||!activityFactors[activity]) throw Error('For this adult estimate, enter age 18–100, height 100–250 cm, weight 30–400 kg, equation option and activity.');
  const resting=10*kg+6.25*heightCm-5*age+(sex==='male'?5:-161);
  return {resting:Math.round(resting),maintenance:Math.round(resting*activityFactors[activity])};
}
export function weightSummary(weights, goalKg) {
  const ordered=[...weights].sort((a,b)=>a.date.localeCompare(b.date)),start=ordered[0]?.kg,current=ordered.at(-1)?.kg;
  const span=start===undefined||goalKg==null?0:goalKg-start;
  return {start,current,change:start===undefined?null:current-start,
    remaining:current===undefined||goalKg==null?null:Math.abs(current-goalKg),
    progress:span?Math.max(0,Math.min(100,(current-start)/span*100)):current===goalKg?100:null};
}
export function rollingWeight(weights,date) {
  const from=shiftDate(date,-6),samples=weights.filter(w=>w.date>=from&&w.date<=date);
  return {count:samples.length,kg:samples.length?samples.reduce((s,w)=>s+w.kg,0)/samples.length:null};
}
