const CACHE='calorieiq-shell-v2.0.1-reliability';
const ASSETS=['./','./index.html','./styles.css','./app.js','./core.js','./writer.js','./scanner.js','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./vendor/zxing-browser.min.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const name of await caches.keys())if((name.startsWith('calorieiq-shell-')||name==='calorieiq-v1')&&name!==CACHE)await caches.delete(name);await self.clients.claim()})()));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==self.location.origin)return;if(e.request.mode==='navigate'){e.respondWith(caches.open(CACHE).then(async c=>(await c.match('./index.html'))||fetch(e.request)));return}if(ASSETS.some(p=>new URL(p,self.registration.scope).href===url.href))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(e.request))||fetch(e.request)))});
