// A session-wide exclusive Web Lock avoids localStorage read/check/write races.
// Read-only tabs can prepare drafts, export, and claim the lock after the writer closes.
export async function acquireWriter(locks){
 const lease={held:false,release(){}};
 if(!locks?.request)return lease;
 return new Promise(resolve=>{
  let finish;
  const lifetime=new Promise(done=>finish=done);
  locks.request('calorieiq-v2-writer',{mode:'exclusive',ifAvailable:true},async lock=>{
   if(!lock){resolve(lease);return}
   lease.held=true;
   lease.release=()=>{lease.held=false;finish()};
   resolve(lease);
   await lifetime;
  }).catch(()=>resolve(lease));
 });
}
