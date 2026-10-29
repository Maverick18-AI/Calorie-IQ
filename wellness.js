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
export function weightSummary(weights, goalKg, startingKg=null) {
  const ordered=[...weights].sort((a,b)=>a.date.localeCompare(b.date)),start=startingKg??ordered[0]?.kg,current=ordered.at(-1)?.kg;
  const span=start===undefined||goalKg==null?0:goalKg-start;
  return {start,current,change:start===undefined||current===undefined?null:current-start,
    remaining:current===undefined||goalKg==null?null:Math.abs(current-goalKg),
    progress:current===undefined?null:span?Math.max(0,Math.min(100,(current-start)/span*100)):current===goalKg?100:null};
}

export function heightToCm(feet,inches) {
  if(!Number.isInteger(feet)||feet<3||feet>8||!Number.isFinite(inches)||inches<0||inches>=12)throw Error('Enter height in feet and inches (inches must be below 12).');
  const cm=(feet*12+inches)*2.54;
  if(cm<100||cm>250)throw Error('This adult calculator supports heights from 100 to 250 cm.');
  return cm;
}
export function heightFromCm(cm) {
  if(cm==null)return {feet:'',inches:''};
  const total=Math.round(cm/2.54*100)/100,feet=Math.floor(total/12);
  return {feet,inches:Number((total-feet*12).toFixed(2))};
}
export function safeCalorieGoal(cal,sex='manual') {
  const minimum=sex==='male'?1500:1200;
  if(!Number.isFinite(cal)||cal<minimum||cal>10000)throw Error('Choose a daily target between '+minimum.toLocaleString()+' and 10,000 kcal. Lower targets need individual clinical guidance.');
  return cal;
}
// A bounded planning estimate, not a prediction of weight change or a prescription.
export function calorieTarget(input) {
  const estimate=calorieEstimate(input),direction=input.direction||'maintain',rate=input.weeklyRate??0;
  if(!['lose','maintain','gain'].includes(direction))throw Error('Choose lose, maintain or gain.');
  if(direction!=='maintain'&&(!Number.isFinite(rate)||rate<=0||rate>(direction==='gain'?.45359237:.90718474)+1e-8))throw Error('Choose a weekly rate above zero, up to 2 lb for loss or 1 lb for gain.');
  if(input.goalKg!=null&&((direction==='lose'&&input.goalKg>=input.kg)||(direction==='gain'&&input.goalKg<=input.kg)))throw Error('Goal weight must match the chosen direction from your current weight.');
  if(direction==='lose'&&(input.kg/(input.heightCm/100)**2<18.5||(input.goalKg!=null&&input.goalKg/(input.heightCm/100)**2<18.5)))throw Error('A weight-loss estimate is unavailable at an underweight current or goal weight. Choose maintenance or seek individual guidance.');
  const minimum=input.sex==='male'?1500:1200,warnings=[];
  safeCalorieGoal(estimate.maintenance,input.sex);
  const requested=direction==='maintain'?0:rate*7700/7;
  const adjustment=direction==='lose'?-Math.min(requested,estimate.maintenance*.25,estimate.maintenance-minimum):direction==='gain'?Math.min(requested,500):0;
  const target=Math.round(estimate.maintenance+adjustment);
  if(direction!=='maintain'&&Math.abs(adjustment)+.01<requested)warnings.push('The requested rate was limited by calorie safeguards. The target does not promise that rate of weight change.');
  return {...estimate,target,adjustment:target-estimate.maintenance,warnings};
}
export function saveWeighIn(weights,{date,kg,originalDate=null}) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(kg)||kg<.1||kg>1000)throw Error('Enter a valid date and weight.');
  const parsed=new Date(date+'T12:00:00Z');
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)throw Error('Enter a valid weigh-in date.');
  if(originalDate&&!weights.some(w=>w.date===originalDate))throw Error('The weight being edited no longer exists. Reload before saving.');
  return [...weights.filter(w=>w.date!==date&&w.date!==originalDate),{date,kg}];
}
export function rollingWeight(weights,date) {
  const from=shiftDate(date,-6),samples=weights.filter(w=>w.date>=from&&w.date<=date);
  return {count:samples.length,kg:samples.length?samples.reduce((s,w)=>s+w.kg,0)/samples.length:null};
}
