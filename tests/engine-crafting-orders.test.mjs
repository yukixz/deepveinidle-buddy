import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrder,emptyWorkspace,normalizeWorkspace,combinedPlans,setOrderCount,batchOrderCount,orderEstimate} from '../src/engine/crafting-orders.js';
import {materialBudget,craftingDefaults} from '../src/engine/crafting-model.js';
import {priceDefaults,setItemPrice} from '../src/engine/item-prices.js';
const prices=()=>{let p=priceDefaults();for(const id of [1,2,1001,1002])p=setItemPrice(p,id,10);return p.prices;};
const finished=plan=>({result:{complete:true,elapsedTicks:plan.count*600}});

test('orders contain multiple recipes; batch replaces all existing counts and zero preserves execution selection',()=>{
 const a=createOrder('a','A'),b=createOrder('b','B');
 assert.equal(a.enabled,true);setOrderCount(a,'41:0',2);setOrderCount(a,'61:2',7);setOrderCount(b,'41:0',9);
 batchOrderCount(a,3);assert.deepEqual(a.plans,{'41:0':3,'61:2':3});assert.deepEqual(b.plans,{'41:0':9});
 a.enabled=true;assert.throws(()=>batchOrderCount(a,1.5),/invalidQuantity/);assert.deepEqual(a.plans,{'41:0':3,'61:2':3});
 batchOrderCount(a,0);assert.deepEqual(a.plans,{});assert.equal(a.enabled,true);
 a.enabled=false;setOrderCount(a,'41:0',2);batchOrderCount(a,0);assert.equal(a.enabled,false);
});
test('shared materials merge before a single stock deduction and rarity remains independent',()=>{
 const a=createOrder('a','A'),b=createOrder('b','B');a.plans={'41:0':3,'41:1':2};b.plans={'41:0':4};
 const plans=combinedPlans([a,b]);assert.deepEqual(plans,{'41:0':7,'41:1':2});
 const budget=materialBudget({...craftingDefaults(),plans,owned:{1:5,2:100}},prices());
 assert.deepEqual(budget.rows.map(r=>[r.id,r.required,r.purchase]),[[1,7,2],[2,7,0],[1001,2,2],[1002,2,2]]);
 a.plans={'41:0':Number.MAX_SAFE_INTEGER};assert.throws(()=>combinedPlans([a,b]),/quantityOverflow/);
});
test('all three fees add, fixed charges once, stock does not reduce percentage basis, exact minutes used',()=>{
 const order=createOrder('a','A');order.plans={'41:0':3,'41:1':2};order.fees={fixed:100,percent:10,minute:7};
 const e=orderEstimate(order,prices(),finished,1000);
 assert.equal(e.material.value,100);assert.equal(e.minutes,50);assert.deepEqual(e.fees,{fixed:100,percent:10,minute:350,total:460});
 const partial=orderEstimate(order,prices(),()=>({result:{complete:true,elapsedTicks:1}}),1000);assert.equal(partial.minutes,1/30);assert.equal(partial.fees.minute,7/30);
});
test('incomplete time is unknown only for nonzero time fees; empty and instant orders cost correctly',()=>{
 const order=createOrder('a','A');order.plans={'41:0':1};order.fees={fixed:5,percent:null,minute:null};
 let e=orderEstimate(order,prices(),()=>null,1000);assert.equal(e.minutes,null);assert.equal(e.fees.total,5);
 order.fees.minute=2;e=orderEstimate(order,prices(),()=>({result:{complete:false,elapsedTicks:4}}),1000);assert.equal(e.fees.minute,null);assert.equal(e.fees.total,null);assert.equal(e.fees.fixed,5);
 order.plans={'upgrade-271:0':2};e=orderEstimate(order,prices(),()=>({result:{complete:true,elapsedTicks:0}}),1000);assert.equal(e.minutes,0);assert.equal(e.fees.total,5);
 order.plans={};e=orderEstimate(order,prices(),()=>null,1000);assert.deepEqual(e.fees,{fixed:0,percent:0,minute:0,total:0});
});
test('fee overflow fails explicitly instead of clamping or hiding failed estimates',()=>{
 const o=createOrder('a','A');o.plans={'41:0':1};o.fees={fixed:Number.MAX_SAFE_INTEGER,percent:100,minute:0};
 assert.throws(()=>orderEstimate(o,prices(),finished,1000),/priceOverflow/);
});
test('new workspace roundtrip preserves edits, execution and fees; malformed orders rejected atomically',()=>{
 const raw=emptyWorkspace(),order=createOrder('one','<Order>');order.plans={'41:0':3};order.enabled=true;order.fees={fixed:null,percent:1.25,minute:0};raw.orders=[order];raw.currentOrderId=order.id;raw.build.owned={};
 assert.deepEqual(normalizeWorkspace(JSON.parse(JSON.stringify(raw))),raw);
 for(const edit of [r=>r.version=2,r=>r.orders.push(structuredClone(order)),r=>r.orders[0].plans.bad=1,r=>r.orders[0].plans['41:0']=-1,r=>r.orders[0].fees.minute=-1,r=>r.currentOrderId='missing']){
  const broken=structuredClone(raw);edit(broken);assert.throws(()=>normalizeWorkspace(broken),/invalidOrders/);
 }
 assert.equal(raw.orders[0].plans['41:0'],3);
});

test('enabled empty orders survive saving and explicit deselection is preserved',()=>{
 const raw=emptyWorkspace(),order=createOrder('empty','Empty');raw.orders=[order];raw.currentOrderId=order.id;
 assert.equal(normalizeWorkspace(raw).orders[0].enabled,true);
 order.enabled=false;assert.equal(normalizeWorkspace(raw).orders[0].enabled,false);
});
