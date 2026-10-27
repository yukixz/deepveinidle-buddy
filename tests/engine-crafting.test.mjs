import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/engine/upstream.js';
import {craftingDefaults,craftingTiers,normalizeCrafting,craftingJobs,craftingSkills,craftingMaterials,craftingPlayer,importCrafting} from '../src/engine/crafting-model.js';

const first=skill=>craftingJobs.find(j=>j.skill===skill);
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
test('character import uses shared protocol and preserves valid data on field failures',()=>{
 const s=craftingDefaults();const p=craftingPlayer(s).player;p.skills.cooking=game.levelXp(40);p.equipment.pan=game.withRarity(360,2);p.house.range=8;p.houseFurniture.range={cell:0,slot:0};
 const snapshot={version:2,capturedAt:Date.now(),player:p,worldTick:p.lastTick,worldBuffs:[]},result=importCrafting(s,snapshot);
 assert.equal(result.state.levels.cooking,40);assert.equal(result.state.gear.pan.id,360);assert.equal(result.state.gear.pan.tier,2);assert.equal(result.state.house.range,8);
 delete p.skills.smithing;const partial=importCrafting(result.state,snapshot);assert.ok(partial.warnings.includes('skills.smithing'));assert.equal(partial.state.levels.smithing,result.state.levels.smithing);
 assert.throws(()=>importCrafting(s,{...snapshot,version:1}),/invalidSnapshot/);
});
