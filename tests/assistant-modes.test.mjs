import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,userDefaults,validateUserWorkspace,workspaceForStorage,applyUserWorkspace,putLine,ordersForMode,estimateOrders,collectionActions,removeCompleted} from '../src/workspace.js';
import {createStore} from '../src/storage.js';
import {createPriceSnapshot} from '../src/engine/price-protocol.js';
import {collectionRows} from '../src/engine/collection-model.js';
import {gatheringSkills} from '../src/engine/gathering-model.js';
import * as game from '../src/engine/upstream.js';
const line={kind:'collection',itemId:40,jobId:41,target:100};
function setup(){const w=defaults();Object.assign(w.character,{initialized:true,worldTick:1000000,bank:{},pack:{}});for(const key in w.character.config.levels)w.character.config.levels[key]=100;return w;}
const plan=(w,mode)=>estimateOrders({...w,orders:ordersForMode(w,mode)},createPriceSnapshot(w.prices));
test('legacy version 2 gains only an empty independent collection order without rewriting any old intent',async()=>{
 const raw=userDefaults();delete raw.collectionOrder;raw.orders[0].fees.fixed=42;raw.orders[0].enabled=false;putLine(raw.orders[0],line);const before=structuredClone(raw);let writes=0;
 const store=createStore({get:async()=>structuredClone(raw),set:async()=>writes++},'test',validateUserWorkspace);
 const value=await store.load();assert.deepEqual(value.orders,raw.orders);assert.equal(value.currentOrderId,raw.currentOrderId);assert.deepEqual(value.collectionOrder.lines,[]);assert.equal(writes,0);assert.deepEqual(raw,before);
 const w=applyUserWorkspace(defaults(),value);putLine(w.collectionOrder,line);assert.deepEqual(workspaceForStorage(w).orders,raw.orders);assert.equal(w.collectionOrder.lines.length,1);
});
test('present malformed fixed orders are rejected and block writes instead of seeding an empty order',async()=>{
 const w=setup(),gather=collectionRows(w.character).find(r=>r.status==='ok'&&gatheringSkills.includes(game.recipes.find(j=>j.id===r.jobId).skill));assert.ok(gather);
 const invalid=[undefined,null,{}, {...w.collectionOrder,enabled:false},{...w.collectionOrder,fees:{fixed:1,percent:0,minute:0}}, {...w.collectionOrder,id:'other'}, {...w.collectionOrder,name:'other'}, {...w.collectionOrder,lines:[{kind:'craft',jobId:41,tier:0,count:1}]}, {...w.collectionOrder,lines:[{kind:'collection',itemId:gather.id,jobId:gather.jobId,target:gather.target}]}];
 for(const value of invalid){const raw=userDefaults();raw.collectionOrder=value;const before=structuredClone(raw);let writes=0;const store=createStore({get:async()=>structuredClone(raw),set:async()=>writes++},'test',validateUserWorkspace);await assert.rejects(store.load());await assert.rejects(store.save(userDefaults()),/storageBlocked/);assert.equal(writes,0);assert.deepEqual(raw,before);}
});
test('fixed and manufacturing order IDs cannot collide',()=>{const raw=userDefaults();raw.orders[0].id=raw.collectionOrder.id;raw.currentOrderId=raw.collectionOrder.id;assert.throws(()=>validateUserWorkspace(raw),/invalidOrders/);});
test('active scopes isolate material demand, output offsets, points and fees without changing enabled flags',()=>{
 const w=setup();putLine(w.orders[0],{kind:'craft',jobId:41,tier:0,count:10000});w.orders[0].fees.fixed=99;putLine(w.collectionOrder,line);
 const a=plan(w,'collection'),b=plan(w,'craft');assert.equal(a.rows.find(r=>r.id===1).required,100);assert.equal(b.rows.find(r=>r.id===1).required,10000);assert.equal(a.points,5);assert.equal(b.points,0);assert.equal(a.orders[0].fees.total,0);assert.equal(b.orders[0].fees.fixed,99);
 assert.deepEqual(plan(w,'collectionGather').entries,[]);assert.equal(w.orders[0].enabled,true);assert.throws(()=>ordersForMode(w,'bad'),/invalidMode/);
});
test('editable collection actions retain completed and blocked targets with original identities',()=>{
 const w=setup();putLine(w.collectionOrder,line);w.character.counts[40]=100;let rows=collectionActions(plan(w,'collection'));assert.equal(rows.length,1);assert.equal(rows[0].key,'collection:40');assert.equal(rows[0].count,0);assert.equal(rows[0].status,'complete');
 w.character.initialized=false;rows=collectionActions(plan(w,'collection'));assert.equal(rows.length,1);assert.equal(rows[0].count,null);assert.ok(rows[0].issues.length);assert.equal(rows[0].target,100);
});
test('automatic completion updates both stored scopes only after initialized progress',()=>{const w=setup();putLine(w.collectionOrder,line);putLine(w.orders[0],line);w.autoRemove=true;w.character.counts[40]=100;w.character.initialized=false;assert.equal(removeCompleted(w),false);w.character.initialized=true;assert.equal(removeCompleted(w),true);assert.deepEqual(w.collectionOrder.lines,[]);assert.deepEqual(w.orders[0].lines,[]);});
test('fractional collection attempts are rounded consistently for editable action and procurement',()=>{const w=setup();const candidate=collectionRows(w.character).find(r=>r.status==='ok'&&!gatheringSkills.includes(game.recipes.find(j=>j.id===r.jobId).skill)&&r.attempts!==Math.ceil(r.attempts));assert.ok(candidate);putLine(w.collectionOrder,{kind:'collection',itemId:candidate.id,jobId:candidate.jobId,target:candidate.target});const p=plan(w,'collection'),row=collectionActions(p)[0];assert.equal(row.count,Math.ceil(candidate.attempts));for(const input of game.recipeInputs(game.recipes.find(j=>j.id===candidate.jobId),game.itemTier(candidate.id)))assert.equal(p.rows.find(r=>r.id===input.itemId).required,Math.ceil(input.qty*row.count));});
