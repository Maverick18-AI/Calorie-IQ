import './build-config.js';
export const BUILD=globalThis.CALORIEIQ_BUILD;
export const BUILD_KEY='calorieiq-development-build';
const SESSION_BUILD='calorieiq-draft-build';
export function currentBuild(storage,build=BUILD){
 const raw=storage.getItem(BUILD_KEY);
 if(!raw)return false;
 const marker=JSON.parse(raw);return marker.generation===build.generation&&marker.id===build.id;
}
export function prepareBuild(storage,session,canWrite,makeFresh,build=BUILD){
 const raw=storage.getItem(BUILD_KEY),marker=raw?JSON.parse(raw):null;
 if(marker&&(!Number.isSafeInteger(marker.generation)||typeof marker.id!=='string'))throw Error('Invalid development build marker.');
 if(marker&&(marker.generation>build.generation||(marker.generation===build.generation&&marker.id!==build.id)))throw Error('Older cached app blocked. Reload to load the newest application.');
 const upgrade=!marker||marker.generation<build.generation;
 if(upgrade&&!canWrite)throw Error('Close the other CalorieIQ editing tab, then reload to initialize this development version.');
 let reset=false;
 if(upgrade){
  if(build.development&&build.resetData!==false){
   // Reset the complete diary in one primary-key write; remove only app-prefixed keys.
   storage.setItem('calorieiq-v2',JSON.stringify(makeFresh()));
   for(const k of Array.from({length:storage.length},(_,i)=>storage.key(i)))if(k?.startsWith('calorieiq-')&&k!=='calorieiq-v2'&&k!==BUILD_KEY)storage.removeItem(k);
   reset=true;
  }
  storage.setItem(BUILD_KEY,JSON.stringify(build));
 }
 if(session.getItem(SESSION_BUILD)!==build.id){
  if(build.development&&build.resetData!==false)for(const k of Array.from({length:session.length},(_,i)=>session.key(i)))if(k?.startsWith('calorieiq-'))session.removeItem(k);
  session.setItem(SESSION_BUILD,build.id);
 }
 return {reset,ready:true};
}
