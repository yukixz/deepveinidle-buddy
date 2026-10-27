import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,userDefaults,validateUserWorkspace,workspaceForStorage,applyUserWorkspace,removeCompleted} from '../src/workspace.js';

test('user persistence roundtrips without character, clock, inventory or market validation',()=>{
 const runtime=defaults();runtime.character.buyMode='bid';runtime.character.config=null;runtime.character.bank='invalid';runtime.prices=null;
 const stored=workspaceForStorage(runtime);assert.equal(stored.materialPriceMode,'bid');assert.equal(stored.version,2);
 assert.deepEqual(Object.keys(stored).sort(),['version','revision','orders','currentOrderId','materialPriceMode','productPriceMode','excludeInsufficientAsks','autoRemove','filters'].sort());
 assert.deepEqual(validateUserWorkspace(stored),stored);
});
test('persisted user data excludes runtime state and requires explicit settings',()=>{
 const user=userDefaults();assert.throws(()=>validateUserWorkspace({...user,character:defaults().character}),/invalidWorkspace/);
 assert.throws(()=>validateUserWorkspace({...user,prices:{version:1,quotes:{}}}),/invalidWorkspace/);
 const missing=structuredClone(user);delete missing.materialPriceMode;assert.throws(()=>validateUserWorkspace(missing),/invalidWorkspace/);
});
test('applying user settings preserves current runtime character and market',()=>{
 const runtime=defaults();runtime.character.bank={1:42};runtime.character.initialized=true;runtime.character.worldTick=1000;runtime.prices.quotes={};
 const user=userDefaults();user.materialPriceMode='bid';user.filters.collection.query='new';
 const next=applyUserWorkspace(runtime,user);assert.equal(next.character.bank,runtime.character.bank);assert.equal(next.prices,runtime.prices);assert.equal(next.character.buyMode,'bid');assert.equal(next.orders[0].id,user.currentOrderId);assert.equal(next.filters.collection.query,'new');
});
test('automatic removal reports only actual user order mutations and requires initialized character',()=>{
 const runtime=defaults();runtime.autoRemove=true;runtime.orders[0].lines=[{kind:'collection',itemId:40,jobId:41,target:10}];runtime.character.counts={40:10};
 assert.equal(removeCompleted(runtime),false);assert.equal(runtime.orders[0].lines.length,1);
 runtime.character.initialized=true;assert.equal(removeCompleted(runtime),true);assert.equal(removeCompleted(runtime),false);
});

test('every persisted user field is required and corrupt user storage stays untouched',async()=>{
 const {createStore}=await import('../src/storage.js');
 for(const key of Object.keys(userDefaults())){
  const raw=userDefaults();delete raw[key];const before=structuredClone(raw);let writes=0;
  const store=createStore({get:async()=>structuredClone(raw),set:async()=>writes++},'user',validateUserWorkspace);
  await assert.rejects(store.load());await assert.rejects(store.save(userDefaults()),/storageBlocked/);assert.equal(writes,0);assert.deepEqual(raw,before);
 }
});
