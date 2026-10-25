import * as game from './upstream.js';
import {createWorkPlayer} from './work-player.js';
import {slotItems,gatheringGear} from './gathering-model.js';
import {importWorkConfig} from './work-import.js';

export const craftingSkills=['cooking','smithing','fletching','herblore','crafting'];
export const craftingToolSlots={cooking:'pan',smithing:'hammer',fletching:'knife',herblore:'mortar',crafting:'needle'};
export const craftingSlots=Object.values(craftingToolSlots);
export const craftingJobs=[...game.recipes.filter(r=>craftingSkills.includes(r.skill)&&!r.retired),...game.upgradeRecipes.map(upgrade=>({id:'upgrade-'+upgrade.id,name:upgrade.name,skill:upgrade.skill,group:'Upgrades',levelReq:upgrade.levelReq,xp:upgrade.xp,upgrade,output:{itemId:upgrade.to[0],qty:1}}))];
const craftingPotions=[];
export const craftingRooms=game.rooms.filter(r=>r.bonus.kind==='craftSpeed'&&craftingSkills.includes(r.bonus.skill));
export const craftingMasteries=game.masteries.filter(m=>['craft'].includes(m.id));
export const craftingPerks=game.perks.filter(p=>['quick','hands'].includes(p.id));
export const craftingTiers=job=>Array.from({length:5},(_,tier)=>tier).filter(tier=>job.upgrade||game.recipeRarity(job,tier)===tier);
export const validQuantity=value=>Number.isSafeInteger(value)&&value>=0;
export const safeAdd=(a,b)=>{const value=a+b;if(!Number.isSafeInteger(value)||value<0)throw Error('quantityOverflow');return value;};
export const safeMultiply=(a,b)=>{const value=a*b;if(!Number.isSafeInteger(value)||value<0)throw Error('quantityOverflow');return value;};
const integer=(v,min,max)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Math.floor(Number(v)))):min;
export function craftingDefaults(){return {
 levels:Object.fromEntries(craftingSkills.map(k=>[k,1])),gear:Object.fromEntries(craftingSlots.map(k=>[k,{id:0,tier:0,plus:0}])),
 brews:Object.fromEntries(craftingPotions.map(p=>[p.kind,-1])),house:Object.fromEntries(craftingRooms.map(r=>[r.id,0])),masteries:Object.fromEntries(craftingMasteries.map(m=>[m.id,0])),
 perks:Object.fromEntries(craftingPerks.map(p=>[p.id,0])),
};}
export function normalizeCrafting(raw){
 const s=craftingDefaults();if(!raw||typeof raw!=='object')return s;
 for(const k of craftingSkills)s.levels[k]=integer(raw.levels?.[k]??1,1,game.maxLevel);
 for(const slot of craftingSlots){const v=raw.gear?.[slot];if(v&&slotItems(slot).some(g=>g.itemId===Number(v.id)))s.gear[slot]={id:Number(v.id),tier:integer(v.tier??0,0,4),plus:integer(v.plus??0,0,game.maxEnhancement)};}
 for(const p of craftingPotions)s.brews[p.kind]=integer(raw.brews?.[p.kind]??-1,-1,4);
 for(const r of craftingRooms)s.house[r.id]=integer(raw.house?.[r.id]??0,0,Number.MAX_SAFE_INTEGER);
 for(const m of craftingMasteries)s.masteries[m.id]=integer(raw.masteries?.[m.id]??0,0,game.masteryRankLimit);
 for(const p of craftingPerks)s.perks[p.id]=integer(raw.perks?.[p.id]??0,0,p.ranks);
 return s;
}
export function craftingMaterials(job,tier,count){
 if(!validQuantity(count)||!Number.isInteger(tier)||!craftingTiers(job).includes(tier))throw Error('invalidQuantity');
 if(job.upgrade){
  const base=game.withRarity(job.upgrade.from[0],tier),items={[base]:count};
  for(const i of game.upgradeMaterials(job.upgrade,base).named)items[i.itemId]=safeAdd(items[i.itemId]??0,safeMultiply(i.qty,count));
  return items;
 }
 return Object.fromEntries(game.recipeInputs(job,tier).map(i=>[i.itemId,safeMultiply(i.qty,count)]));
}
export function craftingPlayer(raw,tick=0){const state=normalizeCrafting(raw);return {state,player:createWorkPlayer(state,craftingSkills,craftingSlots,tick)};}
export function importCrafting(current,snapshot){return importWorkConfig(current,snapshot,{skills:craftingSkills,slots:craftingSlots,potions:craftingPotions,rooms:craftingRooms,masteries:craftingMasteries,perks:craftingPerks,normalize:normalizeCrafting,gear:gatheringGear});}
