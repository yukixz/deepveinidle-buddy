import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/engine/upstream.js';
import {collectionDefaults,validateCollection,collectionTarget,pointsForProduction,collectionRoutes,estimateCollection,collectionRows,importCollection,collectionPlayers} from '../src/engine/collection-model.js';
import {craftingSlots,craftingSkills} from '../src/engine/crafting-model.js';
import {gatheringSlots,gatheringSkills} from '../src/engine/gathering-model.js';
import {createScenario,simulationTick,START_TICK} from './reference/simulation.js';
import {createCraftingScenario} from './reference/crafting-simulation.js';
import {simulateCollection} from './reference/collection-simulation.js';
const setup=()=>({...collectionDefaults(),initialized:true,worldTick:1000000});
const job=id=>collectionRoutes(id)[0];
function snapshot(){
 const {player}=createScenario();for(const k of [...craftingSkills,...gatheringSkills])player.skills[k]=game.levelXp(1);
 for(const slot of [...craftingSlots,...gatheringSlots])player.equipment[slot]=null;
 player.house={};player.houseFurniture={};player.collections={40:9};player.masteries={};player.perks={};player.brews={};
 return {version:2,capturedAt:Date.now(),player,worldTick:1000000,worldBuffs:[],worldBuffsVersion:1};
}
test('original collection rewards agree at each threshold and rarity',()=>{
 const thresholds=game.collectionThresholds(40);assert.deepEqual(thresholds,[1,10,100,1000,10000,100000,1000000,10000000]);
 for(let tier=0;tier<5;tier++)for(const target of thresholds){const id=game.withRarity(40,tier),s=setup();s.counts[id]=0;assert.equal(collectionTarget(s,id,target).points,game.collectionPoints(target,tier,40));assert.equal(pointsForProduction(id,0,target),game.collectionPoints(target,tier,40));}
});
test('craft collection retains burn probability and deterministic materials',()=>{
 const s=setup(),j=game.recipes.find(j=>j.skill==='cooking'&&j.burn&&!j.retired);s.config.levels.cooking=j.levelReq;
 const r=estimateCollection(s,j.output.itemId,j);assert.equal(r.status,'ok');assert.ok(r.burn>0);assert.equal(r.attempts,Math.ceil(r.missing/j.output.qty)/(1-r.burn));assert.ok(Object.values(r.materials).every(q=>q>0));
});
test('gathering qualities and catches follow original stopping probabilities',()=>{
 const s=setup(),normal=estimateCollection(s,1,job(1)),rare=estimateCollection(s,4001,job(4001));assert.equal(normal.attempts,1/normal.quality);assert.ok(rare.seconds>normal.seconds);
 const j=game.recipes.find(j=>j.skill==='thieving'&&j.caught&&game.collectionItems.has(j.output.itemId)&&j.output.itemId!==game.coinItemId);s.config.levels.thieving=j.levelReq;
 const players=collectionPlayers(s),r=estimateCollection(s,j.output.itemId,j,players);assert.equal(r.seconds,r.attempts*(game.tickMs/1000/game.workChance(j,players.gather)+r.caught*Math.max(0,(j.caught.stunTicks??0)-1)*game.tickMs/1000));
});
test('only source game tick decides rarity hot bonuses; wall clock does not',()=>{
 const s=setup();s.worldTick=42978000;const r=estimateCollection(s,4001,job(4001));assert.equal(game.hotSkill(s.worldTick).skill,'mining');assert.equal(game.hotSkill(s.worldTick).kind,'rarity');assert.equal(r.attempts,120000);
 const prior=Date.now;try{Date.now=()=>0;assert.deepEqual(estimateCollection(s,4001,job(4001)),r);Date.now=()=>Number.MAX_SAFE_INTEGER;assert.deepEqual(estimateCollection(s,4001,job(4001)),r);}finally{Date.now=prior;}
 s.worldTick=1000000;assert.equal(estimateCollection(s,4001,job(4001)).attempts,150000);
});
test('future targets, completion, level limits and invalid routes stay explicit',()=>{
 const s=setup();s.counts[40]=9;const rows=collectionRows(s).filter(r=>r.id===40);assert.deepEqual(rows.map(r=>r.target),[10,100,1000,10000,100000,1000000,10000000]);assert.equal(rows[1].quantity,91);
 s.counts[40]=10000000;assert.equal(collectionRows(s).find(r=>r.id===40).status,'complete');s.initialized=false;assert.equal(estimateCollection(s,40,job(40)).status,'uninitialized');assert.throws(()=>estimateCollection(s,40,null),/invalidRoute/);
});
test('atomic import preserves only useful work configuration and source clock',()=>{
 const raw=snapshot(),p=raw.player;p.brews.hunter=p.lastTick+100;p.brewTier.hunter=3;p.brews.blessing=p.lastTick+100;
 raw.worldTick=42978000;raw.worldBuffs=[{fromTick:0,toTick:raw.worldTick,rarityMult:1.075},{fromTick:raw.worldTick,toTick:raw.worldTick+1,rarityMult:1.0125}];
 const s=importCollection(setup(),raw);assert.equal(s.worldTick,raw.worldTick);assert.equal(s.config.worldRarity,8.75);assert.equal(s.config.brews.hunter,3);assert.equal(s.config.blessing,true);assert.deepEqual(s.counts,{40:9});assert.deepEqual(validateCollection(s),s);
 for(const key of ['edited','guild','guildXp','weeklyXp','homeBank','ironman','hotSetting']){assert.equal(Object.hasOwn(s,key),false);assert.equal(Object.hasOwn(s.config,key),false);}
 delete p.homeBank;delete p.ironman;delete p.guildBonus;p.foodItemId='unused';assert.equal(importCollection(s,raw).initialized,true);
});
test('invalid world capability, clock or rarity fails atomically instead of defaulting to zero',()=>{
 const s=setup();s.config.worldRarity=20;const before=structuredClone(s);
 for(const edit of [v=>delete v.worldBuffsVersion,v=>v.worldTick=null,v=>v.worldTick=-1,v=>v.worldBuffs=null,v=>v.worldBuffs=[{fromTick:0,toTick:1000001,rarityMult:'invalid'}],v=>v.worldBuffs=[{fromTick:2,toTick:1}]]){const raw=snapshot();edit(raw);assert.throws(()=>importCollection(s,raw),/invalidWorldBuffs/);assert.deepEqual(s,before);}
 assert.equal(importCollection(s,snapshot()).config.worldRarity,0);
});
test('hunter, blessing, world rarity, equipment and masteries combine by native rules',()=>{
 const s=setup();s.config.gear.pickaxe={id:84,tier:4,plus:5};s.config.gear.amulet={id:186,tier:3,plus:2};s.config.house.shrine=10;s.config.masteries.rare=7;s.config.masteries.gather=10;s.config.perks.quick=5;s.config.brews.hunter=4;s.config.blessing=true;s.config.worldRarity=8.75;
 const p=collectionPlayers(s).gather,r=estimateCollection(s,4001,job(4001));const mult=(1+game.toolLuck(p.equipment.pickaxe)+game.equipmentLuck(p.equipment))*game.combine(game.brewRarityMultiplier(p),game.houseRarityMultiplier(p),game.masteryMultiplier(p.masteries,'rare'),1+s.config.worldRarity/100,game.hotRarityMultiplier(s.worldTick,'mining'));
 assert.ok(Math.abs(r.quality-Math.min(1,game.rarityThresholds.legendary*mult))<1e-12);assert.equal(r.actionSeconds,game.tickMs/1000/game.workChance(job(4001),p));
});
test('target reference matches independent original tick products and quantities',()=>{
 const s=setup();s.counts[40]=9;const j=job(40),r=simulateCollection(s,40,j.id,{target:100,seed:87,maxTicks:6000}),{player,context}=createCraftingScenario(s.config,j,0,6000,{seed:87,maxTicks:6000});let elapsed=0,qty=0;
 for(let t=1;t<=6000;t++){const events=[];simulationTick(player,context,START_TICK+t,events);for(const e of events)if(e.kind==='produced'&&e.itemId===40)qty+=e.qty??1;if(qty>=91){elapsed=t;break;}}
 assert.equal(r.elapsedTicks,elapsed);assert.equal(r.quantity,qty);assert.equal(r.complete,true);assert.deepEqual(r.materials,{1:91,2:91});
});
test('invalid inventory rejects atomically and valid quantities keep bank and pack separate',()=>{
 const s=setup(),raw=snapshot();raw.player.bank={1:7};raw.player.pack=[{itemId:1,qty:2},{itemId:1,qty:3}];const valid=importCollection(s,raw);assert.deepEqual(valid.bank,{1:7});assert.deepEqual(valid.pack,{1:5});
 for(const field of ['bank','pack','skills','collections']){const broken=structuredClone(raw);delete broken.player[field];assert.throws(()=>importCollection(valid,broken));assert.deepEqual(valid.bank,{1:7});}
 assert.throws(()=>importCollection(valid,{...raw,capturedAt:raw.capturedAt-1}),/inventoryOutdated/);
});
test('invalid collection records retain valid entries and clear their warning after recovery',()=>{
 const raw=snapshot();raw.player.collections={40:9,bad:1,42:-1};const s=importCollection(setup(),raw);assert.deepEqual(s.counts,{40:9});assert.deepEqual(s.importWarnings,['collections.invalid:2']);raw.player.collections={40:10};assert.deepEqual(importCollection(s,raw).importWarnings,[]);
});
