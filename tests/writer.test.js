import test from 'node:test';
import assert from 'node:assert/strict';
import {acquireWriter} from '../writer.js';

test('only one session may own the writer lease; release allows takeover',async()=>{
 let owner=false;
 const locks={async request(name,options,callback){assert.equal(name,'calorieiq-v2-writer');assert.equal(options.ifAvailable,true);if(owner)return callback(null);owner=true;try{return await callback({name})}finally{owner=false}}};
 const [a,b]=await Promise.all([acquireWriter(locks),acquireWriter(locks)]);
 assert.equal(a.held,true);assert.equal(b.held,false);
 a.release();await new Promise(r=>setTimeout(r,0));
 const c=await acquireWriter(locks);assert.equal(c.held,true);c.release();
});
test('unsupported or denied Web Locks fails closed',async()=>{
 assert.equal((await acquireWriter(undefined)).held,false);
 assert.equal((await acquireWriter({request:async()=>{throw Error('denied')}})).held,false);
});
