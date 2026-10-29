import {foodOK,nutrients,totals} from './core.js';

export function recipeDraftNutrition(ingredients,yieldCount){
 const total=totals(ingredients),validYield=Number.isFinite(yieldCount)&&yieldCount>=.001&&yieldCount<=1e7;
 const whole={},perServing={};
 for(const key of nutrients){whole[key]=!ingredients.length||total.unknown[key]?null:total[key];perServing[key]=validYield&&whole[key]!==null?whole[key]/yieldCount:null}
 return {whole,perServing,validYield,knownSubtotal:total,count:ingredients.length};
}

// A replacement targets the original slot and ID; a changed draft fails closed.
// Same-product ingredients are allowed when added deliberately in separate reviews.
export function applyRecipeIngredient(ingredients,food,{replaceIndex=null,replaceId=null}={}){
 if(!foodOK(food)||!Number.isFinite(food.quantity)||food.quantity<.001||food.quantity>1e7)throw Error('Review a valid ingredient and positive quantity first.');
 const next=structuredClone(ingredients),copy=structuredClone(food);
 if(replaceIndex===null)next.push(copy);
 else{
  if(!Number.isInteger(replaceIndex)||replaceIndex<0||!next[replaceIndex]||next[replaceIndex].id!==replaceId)throw Error('The ingredient being replaced changed. Return to the recipe and choose it again.');
  copy.id=next[replaceIndex].id;next[replaceIndex]=copy;
 }
 return next;
}
