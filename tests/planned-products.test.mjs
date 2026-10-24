import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/engine/upstream.js';
import {craftingJobs} from '../src/engine/crafting-model.js';
import {collectionDefaults,collectionPlayers,estimateCollection} from '../src/engine/collection-model.js';
import {plannedProducts} from '../src/planned-products.js';

function fixture(){
 const state=collectionDefaults();state.initialized=true;
 for(const skill in state.config.levels)state.config.levels[skill]=100;
 return state;
}
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<=1e-10*Math.max(1,expected),`${actual} != ${expected}`);

test('craft outputs preserve exact rarity and expected burns without reward drops',()=>{
 const state=fixture(),bronze=craftingJobs.find(j=>j.output.itemId===40&&!j.upgrade);
 assert.deepEqual(plannedProducts(bronze,1,3,collectionPlayers(state)),{[game.recipeOutput(bronze,1)]:3});
 state.config.levels.cooking=1;
 const job=game.recipes.find(j=>j.skill==='cooking'&&j.levelReq===1),players=collectionPlayers(state),burn=game.burnChance(job,players.craft);
 assert.ok(burn>0);
 const products=plannedProducts(job,0,3,players);
 assert.deepEqual(Object.keys(products).sort(),[job.output.itemId,job.burn.itemId].map(String).sort());
 close(products[job.output.itemId],3*(1-burn)*job.output.qty);close(products[job.burn.itemId],3*burn);
});

test('upgrades yield the real result once per planned action',()=>{
 const job=craftingJobs.find(j=>j.upgrade),id=game.upgradeResult(job.upgrade,game.withRarity(job.upgrade.from[0],1));
 assert.deepEqual(plannedProducts(job,1,7,collectionPlayers(fixture())),{[id]:7});
});

test('gathering distributes all output rarities with the collection estimate modifiers',()=>{
 const state=fixture(),job=game.recipes.find(j=>j.skill==='mining'&&j.output.itemId===1);
 for(const hotSetting of ['off','game','current']){
  state.config.hotSetting=hotSetting;state.config.worldRarity=15;
  const players=collectionPlayers(state),products=plannedProducts(job,0,123,players);
  close(Object.values(products).reduce((sum,value)=>sum+value,0),123*job.output.qty);
  for(let tier=0;tier<5;tier++){
   const id=game.withRarity(job.output.itemId,tier),estimate=estimateCollection(state,id,job,players);
   assert.equal(estimate.status,'ok');close(products[id]??0,123*estimate.quality*job.output.qty);
  }
 }
});

test('caught thieving actions produce nothing while successful actions retain quality distribution',()=>{
 const state=fixture();state.config.levels.thieving=1;
 const job=game.recipes.find(j=>j.id===244),players=collectionPlayers(state),caught=game.caughtChance(job,players.gather);
 assert.ok(caught>0);
 const products=plannedProducts(job,0,11,players);
 close(Object.values(products).reduce((sum,value)=>sum+value,0),11*(1-caught)*job.output.qty);
});

test('invalid counts and output overflow fail explicitly',()=>{
 const players=collectionPlayers(fixture()),job=game.recipes.find(j=>j.id===240);
 for(const count of [0,-1,1.5,Infinity])assert.throws(()=>plannedProducts(job,0,count,players),/invalidQuantity/);
 assert.throws(()=>plannedProducts(job,0,Number.MAX_SAFE_INTEGER,players),/quantityOverflow/);
});
