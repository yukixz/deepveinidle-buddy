import {questlessOffline,questlessTick} from '../scripts/native-questless.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/engine/upstream.js';
import {START_TICK} from '../src/engine/simulation.js';
import {craftingDefaults,craftingTiers,normalizeCrafting,craftingJobs,craftingSkills,craftingPlan,craftingMaterials,materialRequirements,materialBudget,priceItems,craftingPlayer,craftingStats,importCrafting,planKey} from '../src/engine/crafting-model.js';
import {createCraftingScenario,simulateCrafting,MAX_CRAFT_TICKS} from '../src/engine/crafting-simulation.js';
import {combatHot,combatHotWindows} from '../src/engine/combat-hot.js';
import {setItemPrice,priceDefaults} from '../src/engine/item-prices.js';

const first=skill=>craftingJobs.find(j=>j.skill===skill);
function nativeResult(s,job,tier,count){
 const {player,context}=createCraftingScenario(s,job,tier,count),xp=player.skills[job.skill];
 const report=questlessOffline(game,player,context,START_TICK+60000);
 return {player,report,xp:player.skills[job.skill]-xp};
}
test('five crafting skills, default tiers, normalization and independent tools',()=>{
 assert.deepEqual(craftingSkills.map(s=>craftingJobs.filter(j=>j.skill===s).length),[8,66,38,8,74]);
 const d=craftingDefaults();assert.equal(d.tiers[61],0);assert.deepEqual(d.plans,{});
 assert.equal(d.period,'day');
 for(const period of [undefined,null,'bad','day'])assert.equal(normalizeCrafting({period}).period,'day');
 assert.equal(normalizeCrafting({period:'hour'}).period,'hour');
 const s=normalizeCrafting({...d,skill:'smithing',levels:{smithing:50},gear:{hammer:{id:365,tier:3,plus:5}},plans:{'41:0':10,'61:1':20,'bad':10,'41:1':-1,'41:2':1.2,'41:3':Number.MAX_SAFE_INTEGER+1},owned:{1:7,1001:9,bad:1}});
 assert.deepEqual(s.plans,{'41:0':10,'61:1':20});assert.equal(s.owned[1001],9);assert.equal(s.owned.bad,undefined);
 assert.equal(craftingPlan(s).length,2);const p=craftingPlayer(s).player;
 assert.equal(p.skills.smithing,game.levelXp(50));assert.equal(p.equipment.hammer,game.encode(game.withRarity(365,3),5));assert.equal(p.eatAt,0);assert.deepEqual(p.bank,{});
 assert.ok(craftingStats(s).speedBonus>0);assert.equal(d.levels.cooking,1);
});
test('materials aggregate across skills, qualities and hidden plans; stock never reduces consumption value',()=>{
 const s=craftingDefaults();s.plans={'41:0':10,'41:1':4,'323:0':7,'56:0':2};s.owned={1:3,2:50,40:2};
 assert.deepEqual(craftingMaterials(first('smithing'),0,10),{1:10,2:10});
 assert.deepEqual(craftingMaterials(first('smithing'),1,4),{1001:4,1002:4});
 assert.deepEqual(materialRequirements(s),{1:10,2:10,40:9,10:2,1001:4,1002:4});
 let prices=priceDefaults();for(const id of [1,2,40,10,1001,1002])prices=setItemPrice(prices,id,id===2?0:5,Date.now());
 const b=materialBudget(s,prices.prices);assert.equal(b.rows.find(r=>r.id===1).purchase,7);assert.equal(b.rows.find(r=>r.id===2).purchase,0);assert.equal(b.rows.find(r=>r.id===40).purchase,7);assert.equal(b.total,120);assert.deepEqual(b.missing,[]);
 assert.equal(priceItems(materialRequirements(s),prices.prices).value,145);
 delete s.plans['41:0'];assert.equal(normalizeCrafting(s).owned[1],3);s.plans['41:0']=10;assert.equal(materialBudget(s,prices.prices).rows.find(r=>r.id===1).owned,3);
});
test('quality mapping keeps non-quality ingredients unchanged and uses original recipe outputs',()=>{
 const job=craftingJobs.find(j=>game.recipeInputs(j,4).some((i,n)=>i.itemId===j.inputs[n].itemId));assert.ok(job);
 const mapped=craftingMaterials(job,4,3);for(const input of game.recipeInputs(job,4))assert.equal(mapped[input.itemId],input.qty*3);
 for(const j of craftingJobs.filter(j=>!j.upgrade))for(const tier of craftingTiers(j)){assert.equal(game.recipeOutput(j,tier),game.withRarity(j.output.itemId,tier));assert.ok(game.item(game.recipeOutput(j,tier)));assert.deepEqual(craftingMaterials(j,tier,2),Object.fromEntries(game.recipeInputs(j,tier).map(i=>[i.itemId,i.qty*2])));}
});
test('budget zero, fallback warnings and quantity/money overflow fail explicitly',()=>{
 const s=craftingDefaults();assert.deepEqual(materialBudget(s,{}),{rows:[],total:0,missing:[]});s.plans={'41:0':1};s.owned={1:2,2:2};
 assert.deepEqual(materialBudget(s,{}).missing,[]);assert.equal(materialBudget(s,{}).total,0);
 s.owned={};assert.deepEqual(materialBudget(s,{}).missing,[1,2]);
 let prices=setItemPrice(priceDefaults(),1,0);assert.equal(materialBudget(s,prices.prices).rows.find(r=>r.id===1).cost,0);assert.deepEqual(materialBudget(s,prices.prices).missing,[2]);
 const coal=craftingJobs.find(j=>j.inputs.some(i=>i.qty>1));assert.throws(()=>craftingMaterials(coal,0,Number.MAX_SAFE_INTEGER),/quantityOverflow/);
 s.plans={'41:0':2};prices=setItemPrice(prices,1,Number.MAX_SAFE_INTEGER);assert.throws(()=>materialBudget(s,prices.prices),/priceOverflow/);
 assert.throws(()=>priceItems({1:Number.MAX_SAFE_INTEGER+1},{}),/quantityOverflow/);
});
for(const skill of craftingSkills)test(`${skill}: count-limited engine matches independent original offline XP, products, burning and banking`,()=>{
 const s=craftingDefaults();s.skill=skill;s.hotSetting='off';s.brews.elixir=2;s.masteries.xp=40;s.masteries.craft=10;s.perks.quick=5;s.house={...s.house,[{cooking:'range',smithing:'forge',fletching:'fletchrack',herblore:'herbrack',crafting:'loom'}[skill]]:5};
 const job=first(skill),actual=simulateCrafting(s,job,2,500),native=nativeResult(s,job,2,500);
 assert.equal(actual.complete,true);assert.equal(actual.completed,500);assert.equal(actual.success+actual.burnt,500);assert.equal(actual.xp,native.xp);assert.deepEqual(actual.sampleItems,native.report.itemsGained);assert.equal(actual.deposits,native.report.deposits);assert.equal(actual.burnt,native.report.burnt);
 assert.equal(actual.endLevel,game.level(native.player.skills[skill]));assert.equal(actual.elapsedTicks,native.player.lastStop.tick-START_TICK-1);
 assert.deepEqual(actual.consumed,craftingMaterials(job,2,500));assert.ok(actual.endLevel>actual.startLevel);if(skill==='cooking')assert.ok(actual.burnt>0);if(skill==='fletching'||skill==='crafting')assert.ok(actual.deposits>0);
});
test('every saved crafting recipe and rarity completes at unlocked level with original offline agreement',()=>{
 const s=craftingDefaults();s.hotSetting='off';for(const k of craftingSkills)s.levels[k]=game.maxLevel;
 for(const job of craftingJobs.filter(j=>!j.upgrade))for(const tier of craftingTiers(job)){
  const actual=simulateCrafting(s,job,tier,3),native=nativeResult(s,job,tier,3);
  assert.equal(actual.complete,true,`${job.id}:${tier}`);assert.equal(actual.completed,3);assert.equal(actual.xp,native.xp,`${job.id}:${tier} XP`);assert.deepEqual(actual.sampleItems,native.report.itemsGained,`${job.id}:${tier} products`);
 }
});
test('burns award no XP; safe cooking levels remove burns; per-craft rounding precedes summation',()=>{
 const s=craftingDefaults();s.hotSetting='off';const j=first('cooking'),r=simulateCrafting(s,j,1,10);assert.equal(r.xp,r.success*6);assert.equal(r.burnt,5);assert.equal(r.consumed[1020],10);
 s.levels.cooking=26;assert.equal(simulateCrafting(s,j,4,100).burnt,0);
 s.guildXp=10;const smith=simulateCrafting(s,first('smithing'),0,10);assert.equal(smith.xp,70);
});
test('manual depot, partial time limit and invalid plans preserve trustworthy results',()=>{
 const s=craftingDefaults();s.hotSetting='off';s.homeBank=game.world.banks.at(-1).id;s.levels.smithing=30;
 const scenario=createCraftingScenario(s,first('smithing'),0,20);assert.equal(scenario.bank.id,s.homeBank);assert.equal(scenario.player.homeBank,s.homeBank);
 const r=simulateCrafting(s,first('smithing'),0,100,{maxTicks:200});assert.equal(r.complete,false);assert.equal(r.error,'timeLimit');assert.equal(r.elapsedTicks,200);assert.ok(r.completed<100);
 assert.throws(()=>simulateCrafting(s,first('smithing'),0,0),/invalidQuantity/);assert.throws(()=>simulateCrafting(s,first('smithing'),0,1,{maxTicks:MAX_CRAFT_TICKS+1}),/invalidDuration/);
 s.levels.smithing=1;assert.throws(()=>simulateCrafting(s,craftingJobs.find(j=>j.skill==='smithing'&&j.levelReq>1),0,10),/levelTooLow/);
});
test('current-time hot windows are mapped to the crafting skill and change no material quantities',()=>{
 const s=craftingDefaults();s.skill='smithing';s.hotSetting='current';const now=Date.UTC(2026,9,12,8),job=first('smithing'),scenario=createCraftingScenario(s,job,0,10,{now,maxTicks:6000});
 const expected=combatHotWindows(combatHot(now,1,'smithing'));for(const window of expected)assert.ok(scenario.context.windows.some(w=>JSON.stringify(w)===JSON.stringify(window)));
 assert.deepEqual(scenario.materials,{1:10,2:10});
});
test('character import uses shared protocol and retains plans, stock, failures and independent settings',()=>{
 const s=craftingDefaults();s.plans={'61:1':12};s.owned={1020:9};const p=craftingPlayer(s).player;p.skills.cooking=game.levelXp(40);p.equipment.pan=game.withRarity(360,2);p.house.range=8;p.houseFurniture.range={cell:0,slot:0};p.brews.elixir=p.lastTick+100;p.brewTier.elixir=2;
 const snapshot={version:2,capturedAt:Date.now(),player:p,worldTick:p.lastTick,worldBuffs:[]},result=importCrafting(s,snapshot);
 assert.equal(result.state.levels.cooking,40);assert.equal(result.state.gear.pan.id,360);assert.equal(result.state.gear.pan.tier,2);assert.equal(result.state.house.range,8);assert.equal(result.state.brews.elixir,2);assert.deepEqual(result.state.plans,s.plans);assert.deepEqual(result.state.owned,s.owned);assert.equal(result.state.hotSetting,'game');assert.equal(result.state.homeBank,0);
 delete p.skills.smithing;const partial=importCrafting(result.state,snapshot);assert.ok(partial.warnings.includes('skills.smithing'));assert.equal(partial.state.levels.smithing,result.state.levels.smithing);
 assert.throws(()=>importCrafting(s,{...snapshot,version:1}),/invalidSnapshot/);assert.deepEqual(s.plans,{'61:1':12});
});

test('24-hour rates include native XP, products and consumption independently of planned counts',async()=>{
 const {simulateCraftingWindow}=await import('../src/engine/crafting-simulation.js');
 const s=craftingDefaults();s.hotSetting='off';const job=first('cooking'),ticks=24*3600000/game.tickMs;
 const result=simulateCraftingWindow(s,job,0);
 const {player,context}=createCraftingScenario(s,job,0,ticks,{maxTicks:ticks});
 const xp=player.skills[job.skill],events=[];
 for(let i=1;i<=ticks;i++)questlessTick(game,player,context,START_TICK+i,events);
 assert.equal(result.complete,true);assert.equal(result.error,null);assert.equal(result.elapsedTicks,ticks);
 assert.equal(result.xp,player.skills[job.skill]-xp);
 assert.equal(result.completed,events.filter(e=>['produced','burnt'].includes(e.kind)).length);
 assert.deepEqual(result.consumed,craftingMaterials(job,0,result.completed));
 s.plans[planKey(job.id,0)]=1;assert.deepEqual(simulateCraftingWindow(s,job,0),result);
});
