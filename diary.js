// Diary helpers operate on snapshots; library changes never rewrite history.
export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
export function shiftDate(date, offset) {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function foodKey(f) {
  return [f.barcode || '', f.name, f.base, f.unit, f.cal, f.pro, f.carb, f.fat,f.sat,f.fiber,f.sugar,f.sodium,f.cholesterol,f.potassium].join('|');
}
export function foodHistory(logs) {
  const recent = [], counts = new Map();
  for (const date of Object.keys(logs).sort().reverse()) {
    for (const f of [...logs[date]].reverse()) {
      const key = foodKey(f), prior = counts.get(key);
      if (prior) prior.count++;
      else { const item = {food:f, count:1}; counts.set(key,item); recent.push(item); }
    }
  }
  return {recent:recent.map(x=>x.food), frequent:[...recent].sort((a,b)=>b.count-a.count).map(x=>x.food)};
}
export function quickFood({id, name, cal, pro=null, carb=null, fat=null, meal}) {
  if (!MEALS.includes(meal) || !Number.isFinite(cal) || cal < 0 || cal > 1e7 ||
      [pro,carb,fat].some(n=>n!==null&&(!Number.isFinite(n)||n<0||n>1e7))) throw Error('Enter valid, nonnegative nutrition.');
  return {id, name:name.trim()||'Quick add', base:1, quantity:1, unit:'serving', basis:'1 quick entry', source:'Quick add', barcode:'', cal, pro, carb, fat, meal};
}
