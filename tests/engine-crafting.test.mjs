import {questlessOffline} from '../scripts/native-questless.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/engine/upstream.js';
import {START_TICK} from './reference/simulation.js';
import {craftingDefaults,craftingTiers,normalizeCrafting,craftingJobs,craftingSkills,craftingMaterials,craftingPlayer,importCrafting} from '../src/engine/crafting-model.js';
import {createCraftingScenario,simulateCrafting,MAX_CRAFT_TICKS} from './reference/crafting-simulation.js';

const first=skill=>craftingJobs.find(j=>j.skill===skill);
function nativeResult(s,job,tier,count){
 const {player,context}=createCraftingScenario(s,job,tier,count),xp=player.skills[job.skill];
 const report=questlessOffline(game,player,context,START_TICK+60000);
 return {player,report,xp:player.skills[job.skill]-xp};
}
test('five crafting skills use independent work tools and character inputs',()=>{
 assert.deepEqual(craftingSkills.map(s=>craftingJobs.filter(j=>j.skill===s).length),[8,66,38,8,74]);
 const d=craftingDefaults(),s=normalizeCrafting({...d,levels:{smithing:50},gear:{hammer:{id:365,tier:3,plus:5}}}),p=craftingPlayer(s).player;
 assert.equal(p.skills.smithing,game.levelXp(50));assert.equal(p.equipment.hammer,game.encode(game.withRarity(365,3),5));assert.equal(d.levels.cooking,1);
 assert.deepEqual(craftingMaterials(first('smithing'),0,10),{1:10,2:10});assert.deepEqual(craftingMaterials(first('smithing'),1,4),{1001:4,1002:4});
 const coal=craftingJobs.find(j=>j.inputs.some(i=>i.qty>1));assert.throws(()=>craftingMaterials(coal,0,Number.MAX_SAFE_INTEGER),/quantityOverflow/);
});
test('quality mapping keeps non-quality ingredients unchanged and uses original recipe outputs',()=>{
 const job=craftingJobs.find(j=>game.recipeInputs(j,4).some((i,n)=>i.itemId===j.inputs[n].itemId));assert.ok(job);
 const mapped=craftingMaterials(job,4,3);for(const input of game.recipeInputs(job,4))assert.equal(mapped[input.itemId],input.qty*3);
 for(const j of craftingJobs.filter(j=>!j.upgrade))for(const tier of craftingTiers(j)){assert.equal(game.recipeOutput(j,tier),game.withRarity(j.output.itemId,tier));assert.ok(game.item(game.recipeOutput(j,tier)));assert.deepEqual(craftingMaterials(j,tier,2),Object.fromEntries(game.recipeInputs(j,tier).map(i=>[i.itemId,i.qty*2])));}
});
for(const skill of craftingSkills)test(`${skill}: count-limited engine matches independent original offline XP, products, burning and banking`,()=>{
 const s=craftingDefaults();s.masteries.craft=10;s.perks.quick=5;s.house={...s.house,[{cooking:'range',smithing:'forge',fletching:'fletchrack',herblore:'herbrack',crafting:'loom'}[skill]]:5};
 const job=first(skill),actual=simulateCrafting(s,job,2,500),native=nativeResult(s,job,2,500);
 assert.equal(actual.complete,true);assert.equal(actual.completed,500);assert.equal(actual.success+actual.burnt,500);assert.equal(actual.xp,native.xp);assert.deepEqual(actual.sampleItems,native.report.itemsGained);assert.equal(actual.deposits,native.report.deposits);assert.equal(actual.burnt,native.report.burnt);
 assert.equal(actual.endLevel,game.level(native.player.skills[skill]));assert.equal(actual.elapsedTicks,native.player.lastStop.tick-START_TICK-1);
 assert.deepEqual(actual.consumed,craftingMaterials(job,2,500));assert.ok(actual.endLevel>actual.startLevel);if(skill==='cooking')assert.ok(actual.burnt>0);if(skill==='fletching'||skill==='crafting')assert.ok(actual.deposits>0);
});
test('every saved crafting recipe and rarity completes at unlocked level with original offline agreement',()=>{
 const s=craftingDefaults();for(const k of craftingSkills)s.levels[k]=game.maxLevel;
 for(const job of craftingJobs.filter(j=>!j.upgrade))for(const tier of craftingTiers(job)){
  const actual=simulateCrafting(s,job,tier,3),native=nativeResult(s,job,tier,3);
  assert.equal(actual.complete,true,`${job.id}:${tier}`);assert.equal(actual.completed,3);assert.equal(actual.xp,native.xp,`${job.id}:${tier} XP`);assert.deepEqual(actual.sampleItems,native.report.itemsGained,`${job.id}:${tier} products`);
 }
});
test('burns award no XP; safe cooking levels remove burns; per-craft rounding precedes summation',()=>{
 const s=craftingDefaults();const j=first('cooking'),r=simulateCrafting(s,j,1,10);assert.equal(r.xp,r.success*6);assert.equal(r.burnt,5);assert.equal(r.consumed[1020],10);
 s.levels.cooking=26;assert.equal(simulateCrafting(s,j,4,100).burnt,0);
 const smith=simulateCrafting(s,first('smithing'),0,10);assert.equal(smith.xp,60);
});
test('manual depot, partial time limit and invalid plans preserve trustworthy results',()=>{
 const s=craftingDefaults();s.homeBank=game.world.banks.at(-1).id;s.levels.smithing=30;
 const scenario=createCraftingScenario(s,first('smithing'),0,20);assert.equal(scenario.bank.id,s.homeBank);assert.equal(scenario.player.homeBank,s.homeBank);
 const r=simulateCrafting(s,first('smithing'),0,100,{maxTicks:200});assert.equal(r.complete,false);assert.equal(r.error,'timeLimit');assert.equal(r.elapsedTicks,200);assert.ok(r.completed<100);
 assert.throws(()=>simulateCrafting(s,first('smithing'),0,0),/invalidQuantity/);assert.throws(()=>simulateCrafting(s,first('smithing'),0,1,{maxTicks:MAX_CRAFT_TICKS+1}),/invalidDuration/);
 s.levels.smithing=1;assert.throws(()=>simulateCrafting(s,craftingJobs.find(j=>j.skill==='smithing'&&j.levelReq>1),0,10),/levelTooLow/);
});
test('character import uses shared protocol and preserves valid data on field failures',()=>{
 const s=craftingDefaults();const p=craftingPlayer(s).player;p.skills.cooking=game.levelXp(40);p.equipment.pan=game.withRarity(360,2);p.house.range=8;p.houseFurniture.range={cell:0,slot:0};
 const snapshot={version:2,capturedAt:Date.now(),player:p,worldTick:p.lastTick,worldBuffs:[]},result=importCrafting(s,snapshot);
 assert.equal(result.state.levels.cooking,40);assert.equal(result.state.gear.pan.id,360);assert.equal(result.state.gear.pan.tier,2);assert.equal(result.state.house.range,8);
 delete p.skills.smithing;const partial=importCrafting(result.state,snapshot);assert.ok(partial.warnings.includes('skills.smithing'));assert.equal(partial.state.levels.smithing,result.state.levels.smithing);
 assert.throws(()=>importCrafting(s,{...snapshot,version:1}),/invalidSnapshot/);
});
