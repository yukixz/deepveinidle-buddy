import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/engine/upstream.js';
import {collectionDefaults,collectionPlayers,estimateCollection,gatheringCollectionRows,importCollection,validateCollection} from '../src/engine/collection-model.js';
import {estimateCraftRecipe} from '../src/crafting-estimates.js';
import {plannedProducts} from '../src/planned-products.js';
import {defaults,estimateOrders,putLine} from '../src/workspace.js';
import {createPriceSnapshot} from '../src/engine/price-protocol.js';
import {playerFixture} from './fixtures/player.js';

const current={gather:104,rare:105},other={craft:106};
const bindings={masteryPage:1,masterySkills:{smithing:2,mining:3},masteryAway:{2:other,3:{}}};
const job=id=>game.recipes.find(recipe=>recipe.id===id);
const prices=createPriceSnapshot(defaults().prices);
function character(masteries,pages){
 const player={...playerFixture(),masteries,...pages};
 return importCollection(collectionDefaults(),{version:2,player,capturedAt:Date.now(),worldTick:player.lastTick,worldBuffs:[],worldBuffsVersion:1});
}
test('craft candidates and mixed orders match independent single-page estimates in either action order',()=>{
 const workspace=defaults(),bound=character(current,bindings),smith=character(other),fletcher=character(current);
 workspace.character=bound;
 const recipes=[job(41),job(56)],expected=[smith,fletcher].map((state,i)=>estimateCraftRecipe(state,recipes[i],0,prices));
 assert.notEqual(expected[0].seconds,estimateCraftRecipe(fletcher,recipes[0],0,prices).seconds);
 for(let i=0;i<recipes.length;i++){
  assert.deepEqual(estimateCraftRecipe(bound,recipes[i],0,prices),expected[i]);
  putLine(workspace.orders[0],{kind:'craft',jobId:recipes[i].id,tier:0,count:1});
 }
 const seconds=expected[0].seconds+expected[1].seconds;
 assert.equal(estimateOrders(workspace,prices).craftSeconds,seconds);
 workspace.orders[0].lines.reverse();
 assert.equal(estimateOrders(workspace,prices).craftSeconds,seconds);
});
test('gathering target, rarity details and planned products use the whole bound page',()=>{
 const source=job(1);
 function gathering(state){
  const players=collectionPlayers(state),row=estimateCollection(state,4001,source,players,1);
  return {row,details:gatheringCollectionRows(state,[row],players),products:plannedProducts(source,0,5,players)};
 }
 const empty=gathering(character({}));
 assert.notEqual(empty.row.seconds,gathering(character(current)).row.seconds);
 assert.deepEqual(gathering(character(current,bindings)),empty);
 const mineOnCurrent={...bindings,masterySkills:{smithing:2,mining:1}};
 assert.deepEqual(gathering(character(current,mineOnCurrent)),gathering(character(current)));
});
test('collection plan prices and times a bronze rod and its bronze bar using each recipe skill',()=>{
 const workspace=defaults();
 workspace.character=character(current,bindings);
 workspace.intermediateStrategy='optimal';
 workspace.orders=[workspace.collectionOrder];
 workspace.collectionOrder.fees.minute=60;
 putLine(workspace.collectionOrder,{kind:'collection',itemId:85,jobId:56,target:1});
 const pricedBar=createPriceSnapshot({quotes:{1:{ask:{value:2}},2:{ask:{value:3}},40:{ask:{value:10}}}});
 const plan=estimateOrders(workspace,pricedBar);
 const rod=estimateCollection(character(current),85,job(56),undefined,1);
 const bar=estimateCraftRecipe(character(other),job(41),0,prices);
 assert.equal(plan.entries[0].seconds,rod.seconds);
 assert.equal(plan.entries[0].barSteps[0].seconds,bar.seconds);
 assert.equal(plan.collectionSeconds,rod.seconds+bar.seconds);
 assert.equal(plan.orders[0].fees.minute,plan.collectionSeconds/60*60);
 assert.deepEqual(plan.rows.map(row=>[row.id,row.purchase]),[[1,1],[2,1],[10,1],[40,0]]);
});
test('character validation preserves complete skill maps, rejects damaged ranks, and accepts legacy configs',()=>{
 const legacy=character(current),bound=character(current,bindings);
 assert.deepEqual(validateCollection(legacy),legacy);
 assert.deepEqual(validateCollection(bound).config.skillMasteries?.smithing,{craft:106});
 for(const ranks of [undefined,null,{}, {craft:201},{craft:0,rare:1}]){
  const invalid=structuredClone(bound);
  invalid.config.skillMasteries.smithing=ranks;
  assert.throws(()=>validateCollection(invalid),/invalidConfiguration/);
 }
});
