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
