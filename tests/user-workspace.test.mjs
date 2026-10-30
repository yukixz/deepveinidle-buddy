import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,userDefaults,validateUserWorkspace,workspaceForStorage,applyUserWorkspace,removeCompleted} from '../src/workspace.js';

test('user persistence roundtrips without character, clock, inventory or market validation',()=>{
 const runtime=defaults();runtime.character.buyMode='bid';runtime.character.config=null;runtime.character.bank='invalid';runtime.prices=null;
 const stored=workspaceForStorage(runtime);assert.equal(stored.materialPriceMode,'bid');assert.equal(stored.version,2);
 assert.deepEqual(Object.keys(stored).sort(),['version','revision','selectedMode','orders','currentOrderId','collectionOrder','materialPriceMode','productPriceMode','excludeInsufficientAsks','autoRemove','filters'].sort());
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

test('required persisted user fields cannot be omitted and corrupt storage stays untouched',async()=>{
 const {createStore}=await import('../src/storage.js');
 for(const key of Object.keys(userDefaults()).filter(key=>!['collectionOrder','selectedMode'].includes(key))){
  const raw=userDefaults();delete raw[key];const before=structuredClone(raw);let writes=0;
  const store=createStore({get:async()=>structuredClone(raw),set:async()=>writes++},'user',validateUserWorkspace);
  await assert.rejects(store.load());await assert.rejects(store.save(userDefaults()),/storageBlocked/);assert.equal(writes,0);assert.deepEqual(raw,before);
 }
});

test('three recipe modes roundtrip independent preferences',()=>{
 const user=userDefaults();
 for(const [key,skill,query] of [['craft','cooking','craft'],['collection','smithing','bars'],['collectionGather','mining','ores']]){
  Object.assign(user.filters[key],{skill,query,tier:'1',page:2,maxCost:'100'});
 }
 const stored=workspaceForStorage(applyUserWorkspace(defaults(),user));
 assert.deepEqual(stored,user);
 stored.filters.collectionGather.query='changed';
 assert.equal(stored.filters.collection.query,'bars');
});
test('legacy shared collection filters seed gathering without mutating or writing the source',async()=>{
 const raw=userDefaults();delete raw.filters.collectionGather;
 Object.assign(raw.filters.collection,{skill:'mining',route:'gather',query:'ore',page:3,maxSecondsPerPoint:'54'});
 const before=structuredClone(raw);let writes=0;
 const {createStore}=await import('../src/storage.js');
 const store=createStore({get:async()=>raw,set:async()=>writes++},'user',validateUserWorkspace);
 const loaded=await store.load();
 assert.deepEqual(loaded.filters.collectionGather,raw.filters.collection);
 assert.notEqual(loaded.filters.collectionGather,loaded.filters.collection);
 assert.deepEqual(raw,before);assert.equal(writes,0);
 assert.deepEqual(validateUserWorkspace(loaded),loaded);
});
test('present but malformed gathering filters are rejected and protected',async()=>{
 const {createStore}=await import('../src/storage.js');
 for(const invalid of [null,{},undefined,{...userDefaults().filters.collectionGather,maxCost:'oops'}]){
  const raw=userDefaults();raw.filters.collectionGather=invalid;let writes=0;
  const store=createStore({get:async()=>raw,set:async()=>writes++},'user',validateUserWorkspace);
  await assert.rejects(store.load(),/invalidFilters/);
  await assert.rejects(store.save(userDefaults()),/storageBlocked/);assert.equal(writes,0);
 }
});

test('selected mode defaults to manufacturing and roundtrips independently from per-mode filters',()=>{
 assert.equal(userDefaults().selectedMode,'craft');
 for(const selectedMode of ['craft','collection','collectionGather']){const raw=userDefaults();raw.selectedMode=selectedMode;raw.filters.collection.query='bars';raw.filters.collectionGather.query='ores';const saved=workspaceForStorage(applyUserWorkspace(defaults(),raw));assert.deepEqual(saved,raw);assert.equal(validateUserWorkspace(saved).selectedMode,selectedMode);}
});
test('a missing legacy mode defaults without mutating storage; a present invalid mode protects the original',async()=>{
 const {createStore}=await import('../src/storage.js');
 const raw=userDefaults();delete raw.selectedMode;const before=structuredClone(raw);let writes=0;
 const store=createStore({get:async()=>structuredClone(raw),set:async()=>writes++},'test',validateUserWorkspace);
 assert.equal((await store.load()).selectedMode,'craft');assert.deepEqual(raw,before);assert.equal(writes,0);
 for(const value of [undefined,null,'',false,'gather',{},4]){const invalid={...userDefaults(),selectedMode:value},original=structuredClone(invalid);const bad=createStore({get:async()=>structuredClone(invalid),set:async()=>writes++},'test',validateUserWorkspace);await assert.rejects(bad.load(),/invalidWorkspace/);await assert.rejects(bad.save(userDefaults()),/storageBlocked/);assert.deepEqual(invalid,original);assert.equal(writes,0);}
});
