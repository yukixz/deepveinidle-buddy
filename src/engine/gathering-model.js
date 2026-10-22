import {importWorkConfig} from './work-import.js';
import * as game from './upstream.js';
import {normalizeManual} from './manual-settings.js';
import {createScenario} from './simulation.js';
import {readGuild} from './guild.js';

export const gatheringStorageKey='dvi-gathering-v1';
export const gatheringSkills=['mining','fishing','woodcutting','thieving'];
export const toolSlots={mining:'pickaxe',fishing:'rod',woodcutting:'axe',thieving:'gloves'};
export const gatheringSlots=[...Object.values(toolSlots),'amulet','mount'];
export const gatheringJobs=game.recipes.filter(r=>gatheringSkills.includes(r.skill));
export const gatheringPotions=game.potions.filter(p=>['gatherer','hunter','elixir','swift'].includes(p.kind)).sort((a,b)=>game.recipes.find(r=>r.output.itemId===a.itemId)?.levelReq-game.recipes.find(r=>r.output.itemId===b.itemId)?.levelReq);
export const gatheringRooms=game.rooms.filter(r=>r.bonus.kind==='rareChance'||r.bonus.kind==='gatherSpeed'&&gatheringSkills.includes(r.bonus.skill));
export const gatheringMasteries=game.masteries.filter(m=>['gather','xp','move','rare'].includes(m.id));
export const gatheringPerks=game.perks.filter(p=>['pockets','quick','hands'].includes(p.id));
const integer=(v,min,max,fallback=min)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Math.floor(Number(v)))):fallback;
export const slotItems=slot=>slot==='amulet'?game.equipment.filter(g=>g.slot===slot):game.tools.filter(g=>g.slot===slot);
export const gatheringGear=(slot,id)=>slot==='amulet'?game.gear(id):game.tool(id);
export const sitesForJob=job=>game.world.sites.filter(s=>s.jobIds.includes(job.id));
export function gatheringDefaults(){return {
 skill:'mining',levels:Object.fromEntries(gatheringSkills.map(k=>[k,1])),
 gear:Object.fromEntries(gatheringSlots.map(k=>[k,{id:0,tier:0,plus:0}])),
 brews:Object.fromEntries(gatheringPotions.map(p=>[p.kind,-1])),
 house:Object.fromEntries(gatheringRooms.map(r=>[r.id,0])),masteries:Object.fromEntries(gatheringMasteries.map(m=>[m.id,0])),
 perks:Object.fromEntries(gatheringPerks.map(p=>[p.id,0])),guild:null,guildXp:0,weeklyXp:0,worldRarity:0,blessing:false,ironman:false,homeBank:0,discardGathered:false,
 jobSelection:'all',siteSelection:0,simulationHours:24,customSimulation:false,hotSetting:'game',vendorValues:true,valuationMode:'custom',
};}
export function normalizeGathering(raw){
 const s=gatheringDefaults();if(!raw||typeof raw!=='object')return s;
 s.skill=gatheringSkills.includes(raw.skill)?raw.skill:s.skill;
 for(const k of gatheringSkills)s.levels[k]=integer(raw.levels?.[k]??1,1,game.maxLevel);
 for(const slot of gatheringSlots){const v=raw.gear?.[slot];if(v&&slotItems(slot).some(g=>g.itemId===Number(v.id)))s.gear[slot]={id:Number(v.id),tier:integer(v.tier??0,0,4),plus:integer(v.plus??0,0,game.maxEnhancement)};}
 for(const p of gatheringPotions)s.brews[p.kind]=integer(raw.brews?.[p.kind]??-1,-1,4,-1);
 for(const r of gatheringRooms)s.house[r.id]=integer(raw.house?.[r.id]??0,0,Number.MAX_SAFE_INTEGER);
 for(const m of gatheringMasteries)s.masteries[m.id]=integer(raw.masteries?.[m.id]??0,0,game.masteryRankLimit);
 for(const p of gatheringPerks)s.perks[p.id]=integer(raw.perks?.[p.id]??0,0,p.ranks);
 const manual=normalizeManual(raw,{wholeHours:false,fractionalWorldXp:true});for(const k of ['guildXp','weeklyXp','worldRarity','blessing','ironman','simulationHours','customSimulation','hotSetting','vendorValues','valuationMode'])s[k]=manual[k];
 s.homeBank=game.world.banks.some(b=>b.id===Number(raw.homeBank))?Number(raw.homeBank):0;
 s.discardGathered=raw.discardGathered===true;
 s.guild=readGuild(raw.guild);
 const job=gatheringJobs.find(j=>j.id===Number(raw.jobSelection)&&j.skill===s.skill);
 s.jobSelection=job?job.id:'all';s.siteSelection=raw.siteSelection==='nearest'?'nearest':job&&sitesForJob(job).some(p=>p.id===Number(raw.siteSelection))?Number(raw.siteSelection):0;
 return s;
}
export function selectedGatheringJobs(raw){const s=normalizeGathering(raw);return gatheringJobs.filter(j=>j.skill===s.skill&&(s.jobSelection==='all'||j.id===s.jobSelection));}
export function selectedGatheringSites(raw,job){
 const s=normalizeGathering(raw),all=sitesForJob(job);
 if(s.siteSelection==='nearest'){
  const {player}=gatheringPlayer(s),context=game.createContext(game.world,0);let prepared;
  game.predict(player,context,p=>{prepared=p;return false;});
  const id=game.nearestWorkSite(context,job.id,prepared.x,prepared.y);
  return all.filter(p=>p.id===id);
 }
 return s.jobSelection===job.id&&s.siteSelection?all.filter(p=>p.id===s.siteSelection):all;
}
// The combat scenario owns the common manual character initialization. Override
// only gathering-specific skills, equipment and buffs before predictor cloning.
export function gatheringPlayer(raw){
 const s=normalizeGathering(raw);
 const scenario=createScenario({levels:{},gear:{amulet:s.gear.amulet,mount:s.gear.mount},brews:s.brews,house:s.house,masteries:s.masteries,homeBank:s.homeBank,manual:{...s,perks:s.perks,foodRule:3,hotSetting:'game'}});
 const p=scenario.player;
 for(const k of gatheringSkills)p.skills[k]=game.levelXp(s.levels[k]);
 for(const slot of gatheringSlots){const v=s.gear[slot];p.equipment[slot]=v.id?game.encode(game.withRarity(v.id,v.tier),v.plus):null;}
 p.bank={};p.brews={};p.brewTier={};p.eatAt=0;p.fallback=null;
 for(const [kind,tier]of Object.entries(s.brews))if(tier>=0){p.brews[kind]=Number.MAX_SAFE_INTEGER;p.brewTier[kind]=tier;}
 if(s.blessing)p.brews.blessing=Number.MAX_SAFE_INTEGER;
 return {state:s,player:p};
}
export function gatheringStats(raw){const {state:s,player:p}=gatheringPlayer(raw),mod=game.workModifiers(p,s.skill),v=s.gear[toolSlots[s.skill]],tool=v.id?game.tool(game.encode(game.withRarity(v.id,v.tier),v.plus)):null;
 const luck=(v.id?game.toolLuck(p.equipment[toolSlots[s.skill]]):0)+game.equipmentLuck(p.equipment);
 const luckBonus=(1+luck)*game.combine(game.brewRarityMultiplier(p),game.houseRarityMultiplier(p),game.masteryMultiplier(p.masteries,'rare'))-1;
 return {level:s.levels[s.skill],toolBonus:tool?.bonus??0,speedBonus:mod.combined-1,luck,luckBonus,moveSpeed:Math.round(game.mountSpeed(p)*(1+.2*game.brewScale(p,'swift'))*(1+s.masteries.move*.005))/1000,capacity:game.packCapacity(p)};
}
export function gatheringJobStats(raw,job){const {player:p}=gatheringPlayer(raw),chance=game.workChance(job,p);return {chance,seconds:game.tickMs/1000/chance,caught:game.caughtChance(job,p)};}
export function importGathering(current,snapshot){
 return importWorkConfig(current,snapshot,{skills:gatheringSkills,slots:gatheringSlots,potions:gatheringPotions,rooms:gatheringRooms,masteries:gatheringMasteries,perks:gatheringPerks,normalize:normalizeGathering,gear:gatheringGear,reset:{jobSelection:'all',siteSelection:0,simulationHours:24,customSimulation:false,hotSetting:'game',vendorValues:true,valuationMode:'custom',discardGathered:false}});
}
