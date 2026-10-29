// A persistence gate, not authorization to use a provider or a DRM mechanism.
// Existing local/USDA/OFF snapshots remain supported. No FatSecret API is active.
export function persistenceAllowed(food,depth=0){
 if(!food||typeof food!=='object'||depth>20)return false;
 const provider=String(food.provenance?.provider||'').toLowerCase();
 if(provider==='fatsecret'||provider==='fatsecret-demo'||food.usage?.persistence==='forbidden'||/^fatsecret(?:\b|[-_])/i.test(food.source||''))return false;
 return food.ingredients===undefined||(Array.isArray(food.ingredients)&&food.ingredients.every(f=>persistenceAllowed(f,depth+1)));
}
