import test from 'node:test';import assert from 'node:assert/strict';
import {amount,addAmount,multiplyAmount,divideAmount,estimateAmount} from '../src/amounts.js';
import {estimateCollectionCost,estimateCraftRecipe,createIntermediatePricing,valueItems} from '../src/crafting-estimates.js';
import {defaults,putLine,estimateOrders,validateWorkspace,add} from '../src/workspace.js';
import {craftingJobs,craftingMaterials} from '../src/engine/crafting-model.js';
import {collectionRows,collectionPlayers} from '../src/engine/collection-model.js';
import {createPriceSnapshot} from '../src/engine/price-protocol.js';
import {parseMarketPrices} from '../src/engine/market-import.js';
import {priceDefaults,mergeMarketSnapshot,validPrice} from '../src/engine/item-prices.js';
import {sortCollectionRows} from '../src/collection-sorting.js';
import {sortNumericRows} from '../src/table-sorting.js';
const setup=()=>{const w=defaults();Object.assign(w.character,{initialized:true,worldTick:1000000,bank:{},pack:{}});for(const skill in w.character.config.levels)w.character.config.levels[skill]=100;return w;};
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<=Math.max(1,Math.abs(expected))*Number.EPSILON*4,`${actual} vs ${expected}`);
// Deliberately synthetic protocol for invalid-result injection; real quotes retain strict validation.
const prices=(values)=>({getItem:id=>({sellPrice:Object.hasOwn(values,id)?values[id]:null,buyPrice:Object.hasOwn(values,id)?values[id]:null,market:{generatedAt:1}})});
const bronze=craftingJobs.find(j=>j.id===41),leviathan=craftingJobs.find(j=>j.id===306);

test('estimated coins support the full finite range while invalid values fail explicitly',()=>{
 assert.equal(amount(Number.MAX_SAFE_INTEGER+1),Number.MAX_SAFE_INTEGER+1);
 assert.equal(multiplyAmount(1e7,1.1e9),1.1e16);assert.equal(addAmount(8e15,8e15),1.6e16);
 assert.equal(divideAmount(1e16,2000),5e12);
 for(const value of [NaN,Infinity,-Infinity,-1,'1',null])assert.throws(()=>amount(value),/invalidAmount/);
 for(const divisor of [0,-1,Infinity,NaN,'2'])assert.throws(()=>divideAmount(1,divisor),/invalidAmount/);
 assert.deepEqual(estimateAmount(()=>multiplyAmount(Number.MAX_VALUE,2)),{value:null,error:'invalidAmount'});
 assert.deepEqual(estimateAmount(()=>addAmount(Number.MAX_VALUE,Number.MAX_VALUE)),{value:null,error:'invalidAmount'});
 assert.throws(()=>estimateAmount(()=>{throw Error('invalidConfiguration');}),/invalidConfiguration/);
});

test('official high quotes estimate all collection horizons including the Leviathan ten-million target',()=>{
 const w=setup(),players=collectionPlayers(w.character),source=collectionRows(w.character,players).filter(r=>r.status==='ok'&&craftingJobs.some(j=>j.id===r.jobId));
 const ids=[...new Set(source.flatMap(r=>Object.keys(r.materials)))];
 for(const scalePrice of [900719925,900719926,1e9,1.1e9]){
  const items=Object.fromEntries(ids.map(id=>[id,{lowestSell:Number(id)===355?scalePrice:1,highestBuy:1,sellQty:100000000,buyQty:100000000}]));
  const ps=createPriceSnapshot(mergeMarketSnapshot(priceDefaults(),parseMarketPrices({game:'Deep Vein Idle',generatedAt:new Date().toISOString(),refreshSeconds:300,items})));
  const rows=source.map(r=>estimateCollectionCost({...r,key:`${r.id}:${r.jobId}:${r.target}`,job:craftingJobs.find(j=>j.id===r.jobId)},w.character,ps));
  assert.ok(rows.every(r=>r.costError===undefined&&r.costPerPointError===undefined));
  const largest=rows.find(r=>r.jobId===306&&r.target===1e7&&r.tier===undefined&&r.id===leviathan.output.itemId);
  assert.ok(largest);assert.equal(largest.materials[355],1e7);
  const expected=Object.entries(largest.materials).reduce((sum,[id,n])=>sum+n*(Number(id)===355?scalePrice:1),0);
  near(largest.cost,expected);near(largest.costPerPoint,expected/largest.points);
  for(const column of ['coins','cost'])for(const direction of ['asc','desc'])assert.equal(sortCollectionRows(rows,column,direction).length,rows.length);
  putLine(w.collectionOrder,{kind:'collection',itemId:largest.id,jobId:largest.jobId,target:largest.target});
  const plan=estimateOrders({...w,orders:[w.collectionOrder]},ps,players);
  near(plan.materialCost,expected);near(plan.total,expected);assert.equal(plan.blocked,0);
  assert.equal(plan.rows.find(r=>r.id===355).purchase,1e7);
 }
});

test('amount errors remain local, distinguish missing/zero quotes and propagate only to dependent metrics',()=>{
 const w=setup(),source={materials:{1:2},points:4,job:bronze,key:'bad'};
 const invalid=estimateCollectionCost(source,w.character,prices({1:Number.MAX_VALUE}));
 assert.equal(invalid.cost,null);assert.equal(invalid.costError,'invalidAmount');assert.equal(invalid.costPerPointError,'invalidAmount');assert.deepEqual(invalid.materials,source.materials);
 const missing=estimateCollectionCost({...source,key:'missing'},w.character,prices({}));assert.equal(missing.cost,null);assert.equal(missing.costError,undefined);
 const zero=estimateCollectionCost({...source,key:'zero'},w.character,prices({1:0}));assert.equal(zero.cost,0);assert.equal(zero.costPerPoint,0);
 const valid=estimateCollectionCost({...source,key:'valid'},w.character,prices({1:10}));assert.equal(valid.cost,20);
 const badPoints=estimateCollectionCost({...source,points:0},w.character,prices({1:10}));assert.equal(badPoints.cost,20);assert.equal(badPoints.costPerPointError,'invalidAmount');
 assert.deepEqual([invalid,missing,zero,valid].filter(r=>r.costPerPoint!==null&&r.costPerPoint<=5).map(r=>r.key),['zero','valid']);
 for(const direction of ['asc','desc'])assert.ok(sortCollectionRows([invalid,valid,missing],'cost',direction).slice(1).every(r=>r.costPerPoint===null));
 assert.equal(valueItems({1:0},prices({1:Infinity}),'ask'),0);
 assert.equal(estimateCollectionCost(source,w.character,prices({1:undefined})).costError,'invalidAmount');
 assert.throws(()=>estimateCollectionCost({...source,materials:{1:-1}},w.character,prices({1:10})),/quantityOverflow/);
});

test('single recipe valuations and intermediate comparisons use large finite money without changing counts',()=>{
 const w=setup(),ps=prices({1:8e15,2:8e15,40:7e15});
 const recipe=estimateCraftRecipe(w.character,bronze,0,ps);assert.equal(recipe.cost,1.6e16);assert.equal(recipe.productValue,7e15);
 assert.deepEqual(recipe.materials,{1:1,2:1});assert.equal(recipe.costError,undefined);
 const route=createIntermediatePricing(w.character,prices({1:8e15,2:8e15,40:1.8e16})).get(40);
 assert.equal(route.price,1.6e16);assert.equal(route.craft,true);
 const same=createIntermediatePricing(w.character,prices({1:8e15,2:8e15,40:1.6e16})).get(40);assert.equal(same.craft,false);
 const invalid=estimateCraftRecipe(w.character,bronze,0,prices({1:Number.MAX_VALUE,2:Number.MAX_VALUE,40:1}));
 assert.equal(invalid.costError,'invalidAmount');assert.equal(invalid.productValue,1);assert.equal(invalid.status,'ok');
 const invalidProduct=estimateCraftRecipe(w.character,bronze,0,prices({1:1,2:1,40:Infinity}));assert.equal(invalidProduct.cost,2);assert.equal(invalidProduct.productValueError,'invalidAmount');
 const invalidRoute=createIntermediatePricing(w.character,prices({1:Number.MAX_VALUE,2:Number.MAX_VALUE,40:1})).get(40);assert.equal(invalidRoute.priceError,'invalidAmount');assert.equal(invalidRoute.price,null);
});

test('order estimates isolate invalid money without blocking valid actions, quantities or purchase rows',()=>{
 const w=setup();putLine(w.orders[0],{kind:'craft',jobId:41,tier:0,count:2});w.orders[0].fees={fixed:1,percent:10,minute:2};
 let plan=estimateOrders(w,prices({1:Number.MAX_VALUE,2:3})),order=plan.orders[0];
 assert.equal(order.materialValueError,'invalidAmount');assert.equal(order.fees.percentError,'invalidAmount');assert.ok(order.fees.minute>0);assert.equal(order.suggestedPriceError,'invalidAmount');
 assert.equal(plan.materialCostError,'invalidAmount');assert.equal(plan.totalError,'invalidAmount');assert.equal(plan.subtotal,null);assert.equal(plan.total,null);
 assert.equal(plan.rows.find(r=>r.id===1).costError,'invalidAmount');assert.equal(plan.rows.find(r=>r.id===2).cost,6);assert.equal(plan.rows.find(r=>r.id===1).purchase,2);
 assert.equal(plan.blocked,0);assert.ok(plan.actions.every(a=>a.issues.length===0&&a.count===2));assert.ok(plan.craftSeconds>0);
 w.orders[0].fees.percent=0;plan=estimateOrders(w,prices({1:Number.MAX_VALUE,2:3}));assert.equal(plan.orders[0].fees.percent,0);assert.ok(plan.orders[0].fees.total>0);
 w.character.bank={1:2};plan=estimateOrders(w,prices({1:Number.MAX_VALUE,2:3}));assert.equal(plan.materialCost,null);assert.equal(plan.total,6);assert.equal(plan.totalError,undefined);
 // Missing quotes cannot hide an invalid known quote in the same estimate or subtotal.
 w.character.bank={};plan=estimateOrders(w,prices({2:Number.MAX_VALUE}));assert.equal(plan.missingPrices,1);assert.equal(plan.subtotalError,'invalidAmount');
});

test('large fees and totals remain estimates while quantity, quote and storage boundaries remain strict',()=>{
 const w=setup();putLine(w.orders[0],{kind:'craft',jobId:41,tier:0,count:100});w.orders[0].fees={fixed:1,percent:100,minute:Number.MAX_SAFE_INTEGER};
 const p=estimateOrders(w,prices({1:8e15,2:8e15})),o=p.orders[0];
 assert.equal(o.materialValue,1.6e18);assert.equal(o.fees.percent,1.6e18);near(o.suggestedPrice,o.materialValue+o.fees.fixed+o.fees.percent+o.fees.minute);
 assert.throws(()=>add(Number.MAX_SAFE_INTEGER,1),/quantityOverflow/);
 assert.throws(()=>craftingMaterials(bronze,0,Number.MAX_SAFE_INTEGER+1),/invalidQuantity/);
 assert.equal(validPrice(Number.MAX_SAFE_INTEGER+1),false);
 w.orders[0].fees.fixed=Number.MAX_SAFE_INTEGER+1;assert.throws(()=>validateWorkspace(w),/invalidOrders/);
});

test('money sorting accepts large values only for amount columns and retains unknowns last',()=>{
 const rows=[{id:40,cost:1e16},{id:41,cost:2e16},{id:42,cost:null}];
 assert.deepEqual(sortNumericRows(rows,r=>r.cost,'desc',r=>r.id,{amount:true}).map(r=>r.cost),[2e16,1e16,null]);
 assert.throws(()=>sortNumericRows(rows,r=>r.cost),/invalidSortValue/);
 assert.throws(()=>sortNumericRows([{id:40,cost:Infinity}],r=>r.cost,'asc',r=>r.id,{amount:true}),/invalidSortValue/);
});

test('nonfinite aggregate sums and fees cannot turn into a normal subtotal or hide an independent metric',()=>{
 const w=setup();putLine(w.orders[0],{kind:'craft',jobId:41,tier:0,count:1});
 // Each line is finite; only their sum overflows.
 let plan=estimateOrders(w,prices({1:Number.MAX_VALUE,2:Number.MAX_VALUE}));
 assert.ok(plan.rows.every(r=>r.cost===Number.MAX_VALUE&&r.costError===undefined));
 assert.equal(plan.subtotalError,'invalidAmount');assert.equal(plan.materialCostError,'invalidAmount');assert.equal(plan.total,null);
 w.orders[0].fees={fixed:1,percent:Number.MAX_SAFE_INTEGER,minute:2};
 plan=estimateOrders(w,prices({1:1e300,2:1}));
 assert.equal(plan.orders[0].materialValue,1e300);assert.equal(plan.orders[0].fees.percentError,'invalidAmount');assert.ok(plan.orders[0].fees.minute>0);assert.equal(plan.orders[0].fees.totalError,'invalidAmount');assert.equal(plan.totalError,undefined);
 assert.equal(plan.total,1e300);assert.equal(plan.orders[0].suggestedPriceError,'invalidAmount');
});
