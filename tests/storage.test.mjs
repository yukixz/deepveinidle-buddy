import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../src/storage.js';

function fixture(value=null){
 let raw=value;
 return {
  get:async()=>structuredClone(raw),
  set:async(_key,next)=>{raw=structuredClone(next);},
  get raw(){return raw;},
  set raw(value){raw=value;},
 };
}
const validate=value=>{
 if(value.bad||!Number.isSafeInteger(value.revision))throw Error('invalid');
 return value;
};
const nextTurn=()=>new Promise(resolve=>setTimeout(resolve,0));

test('bad storage remains intact until explicit reset',async()=>{
 const platform=fixture({bad:true}),store=createStore(platform,'x',validate);
 await assert.rejects(store.load());
 await assert.rejects(store.save({revision:0}),/storageBlocked/);
 assert.deepEqual(platform.raw,{bad:true});
 await store.reset();
 await store.save({revision:0,value:2});
 assert.equal(platform.raw.value,2);
});

test('external revision blocks overwrites and explicit reload recovers',async()=>{
 const platform=fixture({revision:1}),store=createStore(platform,'x',validate);
 await store.load();
 platform.raw={revision:2,value:9};
 await assert.rejects(store.save({revision:1,value:1}),/storageConflict/);
 assert.equal(platform.raw.value,9);
 await store.load();
 await store.save({revision:2,value:3});
 assert.equal(platform.raw.revision,3);
});

test('slow writes keep newest pending data in order',async()=>{
 let raw=null,release;
 const writes=[];
 const store=createStore({
  get:async()=>raw,
  set:async(_key,value)=>{
   writes.push(value);
   if(writes.length===1)await new Promise(resolve=>release=resolve);
   raw=value;
  },
 },'x',validate);
 await store.load();
 const first=store.save({revision:0,value:1});
 await nextTurn();
 await store.save({revision:0,value:2});
 await store.save({revision:0,value:3});
 release();
 await first;
 assert.deepEqual(writes.map(value=>value.value),[1,3]);
 assert.equal(raw.revision,2);
});

test('unexpected storage deletion cannot be overwritten before reload',async()=>{
 const platform=fixture({revision:1}),store=createStore(platform,'x',validate);
 await store.load();
 platform.raw=null;
 await assert.rejects(store.save({revision:1,value:4}),/storageConflict/);
 assert.equal(platform.raw,null);
});

test('flush waits for all coalesced writes before disposal',async()=>{
 let raw=null,release;
 const writes=[];
 const store=createStore({
  get:async()=>raw,
  set:async(_key,value)=>{
   writes.push(value);
   if(writes.length===1)await new Promise(resolve=>release=resolve);
   raw=value;
  },
 },'flush',validate);
 await store.load();
 const first=store.save({revision:0,value:1});
 await nextTurn();
 await store.save({revision:0,value:2});
 let finished=false;
 const flushed=store.flush().then(()=>finished=true);
 await nextTurn();
 assert.equal(finished,false);
 release();
 await first;
 await flushed;
 store.dispose();
 assert.equal(raw.value,2);
 assert.deepEqual(writes.map(value=>value.value),[1,2]);
});

test('unread and failed reads cannot overwrite an existing revision zero value',async()=>{
 const platform=fixture({revision:0,value:'keep'});let fail=true;
 const store=createStore({...platform,get:async()=>{if(fail)throw Error('readFailed');return platform.get();}},'x',validate);
 await assert.rejects(store.save({revision:0}),/storageBlocked/);
 await assert.rejects(store.load(),/readFailed/);fail=false;
 await assert.rejects(store.save({revision:0}),/storageBlocked/);
 assert.equal(platform.raw.value,'keep');await store.load();await store.save({revision:0,value:'edited'});assert.equal(platform.raw.value,'edited');
});
test('same revision corrupt data and invalid candidates remain protected',async()=>{
 const platform=fixture({revision:1}),store=createStore(platform,'x',validate);await store.load();
 platform.raw={revision:1,bad:true};await assert.rejects(store.save({revision:1}),/invalid/);assert.equal(platform.raw.bad,true);
 platform.raw={revision:1};await store.load();await assert.rejects(store.save({revision:1,bad:true}),/invalid/);assert.deepEqual(platform.raw,{revision:1});
});
test('explicit reload of deleted storage clears revision and protection',async()=>{
 const platform=fixture({revision:1}),store=createStore(platform,'x',validate);await store.load();platform.raw=null;
 await assert.rejects(store.save({revision:1}),/storageConflict/);assert.equal(await store.load(),null);await store.save({revision:0,value:2});assert.equal(platform.raw.revision,1);
});
test('revision overflow cannot write an invalid revision',async()=>{
 const platform=fixture({revision:Number.MAX_SAFE_INTEGER}),store=createStore(platform,'x',validate);await store.load();
 await assert.rejects(store.save({revision:0}),/storageRevisionOverflow/);assert.equal(platform.raw.revision,Number.MAX_SAFE_INTEGER);
});
test('load and reset cannot interleave with pending writes',async()=>{
 let release;const platform=fixture(),store=createStore({...platform,set:async(k,v)=>{await new Promise(resolve=>release=resolve);await platform.set(k,v);}},'x',validate);
 await store.load();const saved=store.save({revision:0,value:1});await nextTurn();await assert.rejects(store.load(),/storageBusy/);await assert.rejects(store.reset(),/storageBusy/);release();await saved;
 assert.equal(platform.raw.value,1);
});
test('failed set protects original value and reload retains the confirmed revision',async()=>{
 const platform=fixture({revision:4,value:'keep'});let fail=true;
 const store=createStore({...platform,set:async(k,v)=>{if(fail)throw Error('writeFailed');await platform.set(k,v);}},'x',validate);
 await store.load();await assert.rejects(store.save({revision:0,value:'new'}),/writeFailed/);assert.deepEqual(platform.raw,{revision:4,value:'keep'});
 fail=false;await assert.rejects(store.save({revision:0,value:'new'}),/storageBlocked/);await store.load();await store.save({revision:0,value:'new'});assert.equal(platform.raw.revision,5);
});
