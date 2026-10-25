import {importWorkConfig} from './work-import.js';
import * as game from './upstream.js';
import {createWorkPlayer} from './work-player.js';

export const gatheringSkills=['mining','fishing','woodcutting','thieving'];
export const toolSlots={mining:'pickaxe',fishing:'rod',woodcutting:'axe',thieving:'gloves'};
export const gatheringSlots=[...Object.values(toolSlots),'amulet'];
const gatheringPotions=game.potions.filter(p=>p.kind==='hunter');
export const gatheringRooms=game.rooms.filter(r=>r.bonus.kind==='rareChance'||r.bonus.kind==='gatherSpeed'&&gatheringSkills.includes(r.bonus.skill));
export const gatheringMasteries=game.masteries.filter(m=>['gather','rare'].includes(m.id));
export const gatheringPerks=game.perks.filter(p=>['quick','hands'].includes(p.id));
const integer=(v,min,max,fallback=min)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Math.floor(Number(v)))):fallback;
export const slotItems=slot=>slot==='amulet'?game.equipment.filter(g=>g.slot===slot):game.tools.filter(g=>g.slot===slot);
export const gatheringGear=(slot,id)=>slot==='amulet'?game.gear(id):game.tool(id);
export function gatheringDefaults(){return {
 levels:Object.fromEntries(gatheringSkills.map(k=>[k,1])),
 gear:Object.fromEntries(gatheringSlots.map(k=>[k,{id:0,tier:0,plus:0}])),
 brews:Object.fromEntries(gatheringPotions.map(p=>[p.kind,-1])),
 house:Object.fromEntries(gatheringRooms.map(r=>[r.id,0])),masteries:Object.fromEntries(gatheringMasteries.map(m=>[m.id,0])),
 perks:Object.fromEntries(gatheringPerks.map(p=>[p.id,0])),worldRarity:0,blessing:false,
};}
export function normalizeGathering(raw){
 const s=gatheringDefaults();if(!raw||typeof raw!=='object')return s;
 for(const k of gatheringSkills)s.levels[k]=integer(raw.levels?.[k]??1,1,game.maxLevel);
 for(const slot of gatheringSlots){const v=raw.gear?.[slot];if(v&&slotItems(slot).some(g=>g.itemId===Number(v.id)))s.gear[slot]={id:Number(v.id),tier:integer(v.tier??0,0,4),plus:integer(v.plus??0,0,game.maxEnhancement)};}
 for(const p of gatheringPotions)s.brews[p.kind]=integer(raw.brews?.[p.kind]??-1,-1,4,-1);
 for(const r of gatheringRooms)s.house[r.id]=integer(raw.house?.[r.id]??0,0,Number.MAX_SAFE_INTEGER);
 for(const m of gatheringMasteries)s.masteries[m.id]=integer(raw.masteries?.[m.id]??0,0,game.masteryRankLimit);
 for(const p of gatheringPerks)s.perks[p.id]=integer(raw.perks?.[p.id]??0,0,p.ranks);
 s.blessing=raw.blessing===true;s.worldRarity=typeof raw.worldRarity==='number'&&Number.isFinite(raw.worldRarity)?raw.worldRarity:0;
 return s;
}
export function gatheringPlayer(raw,tick=0){const state=normalizeGathering(raw);return {state,player:createWorkPlayer(state,gatheringSkills,gatheringSlots,tick)};}
export function importGathering(current,snapshot){
 return importWorkConfig(current,snapshot,{skills:gatheringSkills,slots:gatheringSlots,potions:gatheringPotions,rooms:gatheringRooms,masteries:gatheringMasteries,perks:gatheringPerks,normalize:normalizeGathering,gear:gatheringGear});
}
