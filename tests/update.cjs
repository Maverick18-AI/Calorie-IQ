const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
module.exports=async browser=>{
 let generation=101,development=true;
 const build=()=>({id:'update-test-'+generation,generation,development});
 const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;let file=path.resolve(process.cwd(),'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(process.cwd()+path.sep)||pathname.includes('/.')){res.writeHead(403);res.end();return}const body=pathname==='/build-config.js'?'globalThis.CALORIEIQ_BUILD='+JSON.stringify(build()):await fs.readFile(file);const types={'.js':'application/javascript','.css':'text/css','.html':'text/html','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body)}catch{res.writeHead(404);res.end()}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const context=await browser.newContext();
 try{
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')console.log('UPDATE console:',m.text())});p.on('dialog',d=>d.accept());const url='http://127.0.0.1:'+server.address().port;
 await p.goto(url);await p.waitForFunction(()=>document.querySelector('#remaining').textContent.length>0);await p.evaluate(()=>Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Worker install timeout')),10000))]));await p.reload();
 async function add(name){await p.locator('nav button[data-view=add]').click();await p.locator('#name').fill(name);await p.locator('#unit').selectOption('serving');await p.locator('#cal').fill('100');await p.locator('#submitFood').click();}
 await add('Build 101 test');await p.evaluate(()=>{localStorage.setItem('unrelated-app','keep');sessionStorage.setItem('unrelated-session','keep');localStorage.setItem('calorieiq-recovery-v2','discard test recovery')});
 await p.reload();await p.waitForFunction(()=>document.querySelector('#calSummary').textContent.includes('100 consumed'));
 await p.locator('nav button[data-view=add]').click();await p.locator('#name').fill('Old build draft');
 generation=102;await p.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>r.update()));
 await p.waitForFunction(()=>document.querySelector('#devBanner')?.textContent.includes('update-test-102'),{},{timeout:20000});
 assert.match(await p.locator('#calSummary').textContent(),/0 consumed/);assert.equal(await p.locator('#name').inputValue(),'');
 assert.equal(await p.evaluate(()=>localStorage.getItem('unrelated-app')),'keep');assert.equal(await p.evaluate(()=>sessionStorage.getItem('unrelated-session')),'keep');assert.equal(await p.evaluate(()=>localStorage.getItem('calorieiq-recovery-v2')),null);
 const raw=await p.evaluate(()=>localStorage.getItem('calorieiq-v2'));
 const stale=await p.evaluate(async()=>{const {prepareBuild}=await import('./development.js');try{prepareBuild(localStorage,sessionStorage,true,()=>({}),{id:'update-test-101',generation:101,development:true});return false}catch{return true}});
 assert.equal(stale,true);assert.equal(await p.evaluate(()=>localStorage.getItem('calorieiq-v2')),raw);
 await add('Build 102 retained');await context.setOffline(true);await p.reload();await p.waitForFunction(()=>document.querySelector('#calSummary').textContent.includes('100 consumed'));assert.equal(await p.evaluate(()=>typeof ZXingBrowser.BrowserMultiFormatOneDReader),'function');await context.setOffline(false);
 await p.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return !r.installing&&!r.waiting&&r.active?.state==='activated'});generation=103;development=false;await p.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>r.update()));
 await p.evaluate(async()=>{
  const stopAt=Date.now()+15000;
  while(Date.now()<stopAt){
   const r=await navigator.serviceWorker.getRegistration();
   const w=r.waiting||r.installing;
   if(w)w.postMessage('SKIP_WAITING');
   if(!(await caches.keys()).includes('calorieiq-shell-update-test-102'))return;
   await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw Error('Production worker did not activate');
 });
 await p.reload();await p.waitForFunction(()=>document.querySelector('#calSummary').textContent.includes('100 consumed'));assert.equal(await p.locator('#devBanner').isVisible(),false);assert.deepEqual(errors,[]);
 console.log('PASS service-worker update: development 101 → 102 resets once, same-build/offline persistence, unrelated storage retained, stale build blocked, production 103 preserves data.');
 }finally{await context.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
};
