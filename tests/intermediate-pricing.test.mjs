import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,estimateOrders,putLine} from '../src/workspace.js';
import {createPriceSnapshot} from '../src/engine/price-protocol.js';
import {createIntermediatePricing} from '../src/crafting-estimates.js';

function fixedPlan(quotes,extraBars=0,intermediateStrategy='optimal'){
 const w=defaults();
 Object.assign(w.character,{initialized:true,worldTick:1000000,bank:{40:4},pack:{},counts:{80:95,40:100-extraBars}});
 for(const skill in w.character.config.levels)w.character.config.levels[skill]=100;
 for(const [id,value]of Object.entries(quotes))w.prices.quotes[id]={ask:{value,capturedAt:1}};
 w.intermediateStrategy=intermediateStrategy;w.orders=[w.collectionOrder];
 putLine(w.collectionOrder,{kind:'collection',itemId:80,jobId:51,target:100});
 if(extraBars)putLine(w.collectionOrder,{kind:'collection',itemId:40,jobId:41,target:100});
 return estimateOrders(w,createPriceSnapshot(w.prices));
}
test('a strictly cheaper recipe enables direct purchase of the remaining independent gap',()=>{
 for(const [extra,expected] of [[0,6],[3,3],[7,0]]){
  const plan=fixedPlan({1:2,2:3,40:10},extra),bar=plan.rows.find(row=>row.id===40);
  assert.equal(bar.selfCrafted,true);assert.equal(bar.directPurchase,expected);assert.equal(bar.purchase,0);
 }
});
test('candidate valuation follows the material quote side and the required crafting level',()=>{
 const w=defaults(),state=w.character;
 state.initialized=true;state.worldTick=1000000;state.config.levels.smithing=100;
 for(const [id,ask,bid] of [[3,12,4],[41,10,30]]){
  w.prices.quotes[id]={ask:{value:ask,capturedAt:1},bid:{value:bid,capturedAt:1}};
 }
 const prices=createPriceSnapshot(w.prices);
 state.buyMode='bid';
 const bid=createIntermediatePricing(state,prices).get(41);
 assert.equal(bid.craft,true);assert.equal(bid.price,4);
 state.buyMode='ask';
 const ask=createIntermediatePricing(state,prices).get(41);
 assert.equal(ask.price,10);
 const forced=()=>createIntermediatePricing(state,prices,undefined,'craft').get(41);
 assert.equal(forced().price,12);assert.equal(forced().craft,true);
 state.buyMode='bid';state.config.levels.smithing=1;
 const unavailable=createIntermediatePricing(state,prices).get(41);
 assert.equal(unavailable.price,30);assert.equal(unavailable.craft,false);
 assert.equal(forced().price,null);assert.equal(forced().issue,'levelTooLow');
});
test('missing both route prices preserves demand and blocks speculative actions',()=>{
 const plan=fixedPlan({}),bar=plan.rows.find(row=>row.id===40);
 assert.equal(plan.materialCost,null);assert.equal(plan.collectionSeconds,null);assert.equal(bar.required,10);
 assert.equal(plan.entries[0].status,'missingIntermediatePrice');assert.equal(plan.actions.some(row=>row.prerequisite),false);
});
test('a missing intermediate quote affects only that route and its potentially shared inputs',()=>{
 const w=defaults();
 Object.assign(w.character,{initialized:true,worldTick:1000000,bank:{},pack:{},counts:{80:95,181:95,40:95}});
 for(const skill in w.character.config.levels)w.character.config.levels[skill]=100;
 for(const [id,value]of [[4,5],[180,10],[100,20],[1,2]])w.prices.quotes[id]={ask:{value,capturedAt:1}};
 w.intermediateStrategy='optimal';w.orders=[w.collectionOrder];
 for(const [itemId,jobId]of [[80,51],[181,231],[40,41]])putLine(w.collectionOrder,{kind:'collection',itemId,jobId,target:100});
 const prices=createPriceSnapshot(w.prices);
 const plan=estimateOrders(w,prices),direct=estimateOrders({...w,intermediateStrategy:'buy'},prices);
 const row=id=>plan.rows.find(row=>row.id===id);
 assert.equal(plan.points,direct.points);
 assert.equal(row(180).purchase,5);assert.equal(row(180).cost,50);
 assert.equal(row(4).purchase,5);assert.equal(row(4).cost,25);
 assert.equal(row(40).required,10);assert.equal(row(40).purchase,null);
 assert.equal(row(1).required,null);assert.equal(row(1).purchase,null);
 assert.equal(plan.entries[0].products,undefined);
 assert.equal(plan.subtotal,75);
 assert.equal(plan.total,null);assert.equal(plan.collectionSeconds,null);
});

test('buy, optimal and craft use the selected route after deducting stock',()=>{
 for(const [strategy,price,buy,craft] of [['buy',10,6,0],['optimal',10,0,6],['optimal',4,6,0],['craft',4,0,6]]){
  const plan=fixedPlan({1:2,2:3,40:price},0,strategy),bar=plan.rows.find(row=>row.id===40);
  assert.deepEqual([bar.owned,bar.purchase,bar.produced],[4,buy,craft]);
  assert.deepEqual(plan.actions.filter(row=>row.prerequisite).map(row=>row.count),craft?[6]:[]);
  assert.equal(plan.materialCost,4*price+buy*price+craft*5);
  if(craft){assert.equal(bar.selfCrafted,true);assert.equal(bar.directPurchase,6);}
 }
});

test('forced crafting keeps prerequisite quantities and duration when raw prices are missing',()=>{
 const plan=fixedPlan({40:4,1:2},0,'craft'),bar=plan.rows.find(row=>row.id===40);
 assert.equal(plan.materialCost,null);assert.ok(plan.collectionSeconds>0);
 assert.equal(plan.actions.find(row=>row.prerequisite)?.count,6);
 assert.equal(plan.rows.find(row=>row.id===2)?.purchase,6);
 assert.equal(bar.selfCrafted,true);assert.equal(bar.directPurchase,6);
});
