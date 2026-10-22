import {readGuild} from './guild.js';
import {selectedEnemies} from './enemy-selection.js';
import {manualDefaults,normalizeManual,skillXp,applyManualPlayer} from './manual-settings.js';
import * as game from './upstream.js';
export {game};
export const slots=['weapon','shield','helmet','body','legs','ring','amulet','mount'];
export const skills=['melee','ranged','magic','defence','hitpoints'];
export const foods=game.items.filter(x=>x.id<1000&&x.heals>0);
export const potions=game.potions.map(p=>{
 const recipe=game.recipes.find(r=>r.skill==='herblore'&&r.output.itemId===p.itemId);
 if(!recipe||!Number.isFinite(recipe.levelReq))throw new Error(`Missing potion crafting level: ${p.kind}`);
 return {...p,craftingLevel:recipe.levelReq};
}).sort((a,b)=>a.craftingLevel-b.craftingLevel);
export const baseGear=[...game.equipment.filter(x=>slots.includes(x.slot)),...game.tools.filter(x=>x.slot==='mount').map(x=>({...x,needs:'none',levelReq:0}))];
export const gearDetails=(slot,id)=>slot==='mount'?game.tool(id):game.gear(id);
export const damageRooms=game.rooms.filter(x=>x.bonus.kind==='dmg');
export function defaults(){return {guild:null,manual:manualDefaults(),levels:{melee:1,ranged:1,magic:1,defence:1,hitpoints:10},gear:Object.fromEntries(slots.map(s=>[s,{id:0,tier:0,plus:0}])),food:{id:64,tier:0},eatAt:50,homeBank:0,fed:false,rooted:false,brews:Object.fromEntries(game.potions.map(p=>[p.kind,-1])),masteries:Object.fromEntries(game.masteries.map(x=>[x.id,0])),house:Object.fromEntries(game.rooms.map(x=>[x.id,0])),meals:0};}
const integer=(v,min,max,fallback=min)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Math.floor(Number(v)))):fallback;
export function normalize(raw){
 const s=defaults(); if(!raw||typeof raw!=='object')return s;
 s.guild=readGuild(raw.guild);
 s.manual=normalizeManual(raw.manual,{fractionalWorldXp:true});
 for(const k of skills)s.levels[k]=integer(raw.levels?.[k]??s.levels[k],1,game.maxLevel,s.levels[k]);
 for(const slot of slots){const v=raw.gear?.[slot];if(!v)continue;const id=integer(v.id,0,999);if(baseGear.some(x=>x.itemId===id&&x.slot===slot))s.gear[slot]={id,tier:integer(v.tier??0,0,4),plus:integer(v.plus??0,0,game.maxEnhancement)};}
 if(foods.some(x=>x.id===Number(raw.food?.id)))s.food={id:Number(raw.food.id),tier:integer(raw.food.tier??0,0,4)};
 for(const k of Object.keys(s.brews))s.brews[k]=integer(raw.brews?.[k]??-1,-1,4,-1);
 for(const k of Object.keys(s.masteries))s.masteries[k]=integer(raw.masteries?.[k]??0,0,game.masteryRankLimit);
 for(const k of Object.keys(s.house))s.house[k]=integer(raw.house?.[k]??0,0,Number.MAX_SAFE_INTEGER);
 s.style=['melee','ranged','magic'].includes(raw.style)?raw.style:(game.gear(s.gear.weapon.id)?.magic?'magic':game.gear(s.gear.weapon.id)?.ranged?'ranged':'melee');

 s.eatAt=[25,50,75].includes(Number(raw.eatAt))?Number(raw.eatAt):50;
 s.homeBank=game.world.banks.some(b=>b.id===Number(raw.homeBank))?Number(raw.homeBank):0;
 s.meals=integer(raw.meals??0,0,10);s.fed=raw.fed===true;s.rooted=raw.rooted===true;return s;
}
export function makePlayer(raw){
 const s=normalize(raw),p={skills:Object.fromEntries(skills.map(k=>[k,skillXp(s,k)])),equipment:Object.fromEntries(game.equipmentSlots.map(k=>[k,null])),lastTick:0,brews:{},brewTier:{},masteries:s.masteries,house:s.house,houseFurniture:{},perks:{meals:s.meals}},issues=[];
 for(const slot of slots){const v=s.gear[slot];if(!v.id)continue;const id=game.encode(game.withRarity(v.id,v.tier),v.plus),g=gearDetails(slot,id);
  if(!g){issues.push({kind:'missing',slot});continue;}
  if(slot!=='mount'&&g.needs!=='none'&&s.levels[g.needs]<g.levelReq){issues.push({kind:'level',slot,skill:g.needs,level:g.levelReq});}
  p.equipment[slot]=id;
 }
 if(game.gear(p.equipment.weapon)?.twoHanded&&p.equipment.shield!==null){p.equipment.shield=null;issues.push({kind:'twoHanded',slot:'shield'});}
 for(const [k,tier]of Object.entries(s.brews))if(tier>=0){p.brews[k]=1e9;p.brewTier[k]=tier;}
 if(s.fed)p.brews.fed=1e9;if(s.rooted)p.brews.rooted=1e9;
 for(const [k,v]of Object.entries(s.house))if(v>0)p.houseFurniture[k]={cell:0,slot:0};
 for(const slot of slots){const g=game.gear(p.equipment[slot]);if(g?.style&&g.style!==game.style(p)&&(g.accuracy||g.strength))issues.push({kind:'style',slot});}
 applyManualPlayer(p,s);
 return {state:s,player:p,issues};
}
export function calculate(raw){
 const {state,player:p,issues}=makePlayer(raw),hit=game.maxHit(p),accuracy=game.accuracy(p),evasion=game.evasion(p),style=game.style(p);
 const selected=selectedEnemies(state.manual.enemySelection);
 const rows=selected.monsters.map(m=>({...m,key:`monster-${m.id}`,max:hit,chance:game.hitChance(accuracy,10+m.defence*game.armourMultiplier(p)),enemyChance:game.hitChance(10+m.attack,evasion),enemyMax:Math.max(1,Math.floor(m.maxHit*(1-game.damageReduction(p,p.lastTick))))}));
 const food=game.item(game.withRarity(state.food.id,state.food.tier));
 const healing=Math.floor(food.heals*game.combine(1+.025*state.meals,1+.25*game.brewScale(p,'nourish')));
 return {state,player:p,issues,rows,stats:{hit,accuracy,evasion,style,strength:game.strength(p),armour:game.armour(p),hp:game.maxHp(p),seconds:game.attackTicks(p)*game.tickMs/1000},food:{...food,healing,fedSeconds:(game.foodBuff(state.food.tier)?.ticks??0)*game.tickMs/1000,rootSeconds:game.isCrop(food.id)?game.cropDuration(food.id)*game.tickMs/1000:0}};
}
export function preset(style){const s=defaults();for(const k of skills)s.levels[k]=85;
 slots.filter(slot=>slot!=='mount').forEach(slot=>{const candidates=baseGear.filter(g=>g.slot===slot&&g.levelReq<=85&&(slot==='weapon'?(style==='magic'?g.magic:style==='ranged'?g.ranged&&!g.magic:!g.magic&&!g.ranged&&!g.twoHanded):!g.style||g.style===style)).sort((a,b)=>b.levelReq-a.levelReq);s.gear[slot]={id:candidates[0]?.itemId??0,tier:2,plus:5};});s.style=style;return s;}
export function chooseLanguage(saved,languages){return ['zh','en'].includes(saved)?saved:languages.some(x=>/^zh(?:-|$)/i.test(x))?'zh':'en';}

export function gearForStyle(slot,style){return baseGear.filter(g=>g.slot===slot&&(slot==='weapon'?(g.magic?'magic':g.ranged?'ranged':'melee')===style:!g.style||g.style===style));}
export function selectStyle(raw,style){const s=normalize(raw);s.style=style;for(const slot of slots){const choices=s.manual.allGear&&slot!=='weapon'?baseGear.filter(g=>g.slot===slot):gearForStyle(slot,style);if(s.gear[slot].id&&!choices.some(g=>g.itemId===s.gear[slot].id))s.gear[slot]={id:0,tier:0,plus:0};if(slot==='weapon'&&!s.gear[slot].id&&style!=='melee')s.gear[slot]={id:choices[0].itemId,tier:0,plus:0};}return s;}
export function sortEnemies(rows,key,direction=key==='level'?'asc':'desc',value=row=>row[key]){
 const sign=direction==='asc'?1:-1;
 return [...rows].sort((a,b)=>{
  const av=value(a),bv=value(b),aValid=Number.isFinite(av),bValid=Number.isFinite(bv);
  if(aValid!==bValid)return aValid?-1:1;
  return aValid?(av-bv)*sign:0;
 });
}

// Storage keeps upstream ranks; UI shows effective values, preserving existing saves.
export function masteryValue(id,rank){const m=game.masteries.find(x=>x.id===id);const bonus=id==='enhance'?game.enhanceMasteryMultiplier({masteries:{enhance:rank}})-1:rank*m.perRank;return Number((bonus*(m.unit==='percent'?100:game.masteryOfflineBaseHours)).toFixed(6));}
export function masteryRank(id,value){const m=game.masteries.find(x=>x.id===id);return integer(Math.round(Number(value)/(m.perRank*(m.unit==='percent'?100:game.masteryOfflineBaseHours))),0,game.masteryRankLimit);}
