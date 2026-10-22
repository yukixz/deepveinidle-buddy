import test from 'node:test';
import assert from 'node:assert/strict';
import {readCharacterInventory,readInventoryParts} from '../src/engine/character-inventory.js';
import {orderMaterialBudget,createOrder,normalizeWorkspace,emptyWorkspace} from '../src/engine/crafting-orders.js';
import {craftingDefaults} from '../src/engine/crafting-model.js';
import {priceDefaults,setItemPrice} from '../src/engine/item-prices.js';
const snapshot=()=>({version:2,capturedAt:Date.now(),player:{bank:{1:2,1001:7},pack:[{itemId:1,qty:3},{itemId:1,qty:4},{itemId:2,qty:6}],overflow:{1:100},equipment:{weapon:1}}});
test('game stock merges warehouse and repeated backpack stacks by full id, excluding overflow and equipment',()=>{
 const raw=snapshot(),before=structuredClone(raw),stock=readCharacterInventory(raw);assert.deepEqual(stock,{capturedAt:raw.capturedAt,items:{1:9,2:6,1001:7}});assert.deepEqual(raw,before);
 assert.deepEqual(readInventoryParts({bank:{},pack:[]}),{bank:{},pack:{},items:{}});
});
test('inventory rejects missing, malformed, unknown, fractional, future and overflowing data atomically',()=>{
 for(const edit of [s=>delete s.player.bank,s=>delete s.player.pack,s=>s.player.pack={},s=>s.player.bank={1:-1},s=>s.player.bank={1:1.5},s=>s.player.bank={bad:1},s=>s.player.bank={999999999:1},s=>s.player.pack=[{itemId:1,qty:0}],s=>s.player.pack=[{itemId:1,qty:Number.MAX_SAFE_INTEGER},{itemId:1,qty:1}],s=>s.player.bank={1:Number.MAX_SAFE_INTEGER},s=>s.capturedAt=Date.now()+120000,s=>s.version=1]){
  const raw=snapshot();edit(raw);assert.throws(()=>readCharacterInventory(raw),/invalidSnapshot|incompleteSnapshot/);
 }
});
test('unknown stock leaves purchase and budget unknown; known empty stock means full purchase; shared stock deducted once',()=>{
 const a=createOrder('a','A'),b=createOrder('b','B');a.plans={'41:0':3};b.plans={'41:0':4};let prices=priceDefaults();prices=setItemPrice(prices,1,10);prices=setItemPrice(prices,2,20);
 let budget=orderMaterialBudget(craftingDefaults(),[a,b],null,prices.prices);assert.equal(budget.total,null);assert.ok(budget.rows.every(r=>r.owned===null&&r.purchase===null&&r.cost===null));assert.equal(budget.rows[0].required,7);
 budget=orderMaterialBudget(craftingDefaults(),[a,b],{items:{1:5,2:100}},prices.prices);assert.deepEqual(budget.rows.map(r=>[r.id,r.purchase,r.cost]),[[1,2,20],[2,0,0]]);assert.equal(budget.total,20);
 budget=orderMaterialBudget(craftingDefaults(),[a,b],{items:{}},prices.prices);assert.equal(budget.total,210);
 assert.equal(orderMaterialBudget(craftingDefaults(),[],null,prices.prices).total,0);
});
test('workspace stores validated game inventory, ignores legacy hand stock and preserves orders',()=>{
 const raw=emptyWorkspace();raw.build.owned={1:100};raw.orders=[createOrder('a','A')];raw.currentOrderId='a';raw.inventory=readCharacterInventory(snapshot());
 const restored=normalizeWorkspace(raw);assert.deepEqual(restored.build.owned,{});assert.deepEqual(restored.inventory,raw.inventory);assert.deepEqual(restored.orders,raw.orders);
 delete raw.inventory;assert.equal(normalizeWorkspace(raw).inventory,null);raw.inventory={capturedAt:Date.now(),items:{1:-1}};assert.throws(()=>normalizeWorkspace(raw),/invalidSnapshot/);
});
