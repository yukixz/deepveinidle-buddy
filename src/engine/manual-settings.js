import {normalizeEnemySelection} from './enemy-selection.js';
import * as game from './upstream.js';
export const MAX_SIMULATION_MINUTES=Math.floor(8.64e15/60000/2);
const limit=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):fallback;
const int=(v,min,max,fallback)=>Math.floor(limit(v,min,max,fallback));
export function manualDefaults(){return {
 progress:Object.fromEntries(game.allSkills.map(k=>[k,0])),xp:Object.fromEntries(game.allSkills.map(k=>[k,-1])),
 perks:Object.fromEntries(game.perks.filter(p=>p.id!=='meals').map(p=>[p.id,0])),
 enemySelection:'all',guildXp:0,weeklyXp:0,worldRarity:0,simulationHours:24,vendorValues:true,valuationMode:'custom',customSimulation:false,hotSetting:'game',blessing:false,blessingMinutes:-1,
 brewMinutes:Object.fromEntries(game.potions.map(p=>[p.kind,-1])),fedMinutes:-1,rootedMinutes:-1,
 foodRule:0,foodMaxTier:4,foodPerTrip:-1,actualInventory:false,bank:[],pack:[],overflow:[],
 bankSlotsBought:0,unlimitedBank:true,ironman:false,coins:0,
 placed:Object.fromEntries(game.rooms.map(r=>[r.id,true])),upgradeMinutes:Object.fromEntries(game.rooms.map(r=>[r.id,-1])),
 windows:[],hotMode:1,hotMinutes:-1,allGear:false,playerId:1,seed:0,currentTick:game.predictionStartTick,
};}
export function normalizeManual(raw={}, {wholeHours=true,fractionalWorldXp=false}={}){
 const s=manualDefaults();raw=raw??{};
 for(const p of game.perks)if(p.id!=='meals')s.perks[p.id]=int(raw.perks?.[p.id]??0,0,p.ranks,0);
 for(const key of ['blessing','ironman','allGear','customSimulation','vendorValues'])s[key]=raw[key]===undefined?s[key]:raw[key]===true;
 for(const key of ['guildXp'])s[key]=limit(raw[key]??s[key],key.endsWith('Minutes')?-1:0,1e7,s[key]);
 for(const key of ['coins'])s[key]=int(raw[key]??s[key],0,Number.MAX_SAFE_INTEGER,s[key]);
 for(const key of ['foodRule','foodMaxTier'])s[key]=int(raw[key]??s[key],0,key==='foodMaxTier'?4:3,s[key]);
 s.foodPerTrip=[5,10,20,-2,-1].includes(Number(raw.foodPerTrip))?Number(raw.foodPerTrip):-1;
 s.hotSetting=['game','current','off'].includes(raw.hotSetting)?raw.hotSetting:typeof raw.hotForecast==='boolean'?(raw.hotForecast?'current':'off'):'game';
 s.valuationMode='custom';
 s.vendorValues=s.valuationMode!=='quantity';
 s.enemySelection=normalizeEnemySelection(raw.enemySelection);
 s.weeklyXp=(fractionalWorldXp?limit:int)(raw.weeklyXp??0,0,1e7,0);
 s.worldRarity=limit(raw.worldRarity??0,0,1e7,0);
 s.simulationHours=wholeHours
  ?Math.round(limit(raw.simulationHours??s.simulationHours,1,Math.floor(MAX_SIMULATION_MINUTES/60),s.simulationHours))
  :Math.round(limit(Number(raw.simulationHours??s.simulationHours)*60,1,MAX_SIMULATION_MINUTES,s.simulationHours*60))/60;
 return s;
}
export function skillXp(s,k){return game.levelXp(s.levels[k]??1);}
export const minutesToTicks=minutes=>Math.round(minutes*60000/game.tickMs);
export function expiry(minutes,now){return minutes<0?Number.MAX_SAFE_INTEGER:now+minutesToTicks(minutes);}
export function applyManualPlayer(p,s){
 const m=s.manual;p.lastTick=m.currentTick;p.guildBonus=m.guildXp/100;
 Object.assign(p.perks,m.perks);
 for(const [kind,tier]of Object.entries(s.brews))if(tier>=0)p.brews[kind]=expiry(m.brewMinutes[kind],p.lastTick);
 if(m.blessing)p.brews.blessing=expiry(m.blessingMinutes,p.lastTick);
 for(const kind of ['fed','rooted'])if(s[kind])p.brews[kind]=Number.MAX_SAFE_INTEGER;
 return p;
}
// Hypothetical engines suppress native hot bonuses. Add the selected game
// schedule explicitly, including initialization and the final tick.
export function manualWindows(start=game.predictionStartTick,end=start+6000,weeklyXp=0,skipGameHot=true,skill='combat',worldRarity=0){
 const windows=weeklyXp||worldRarity?[{fromTick:start,toTick:end,xpMult:1+weeklyXp/100,rarityMult:1+worldRarity/100}]:[];
 if(skipGameHot)return windows;
 for(let tick=start;tick<=end;){
  const hot=game.hotSkill(tick),until=Math.min(end,hot.until-1);
  const xp=hot.skill===skill&&hot.kind==='xp'?hot.mult-1:0;
  const rare=hot.skill===skill&&hot.kind==='rarity'?hot.mult-1:0;
  if(xp||rare)windows.push({fromTick:tick,toTick:until,xpMult:1+xp,rarityMult:1+rare});
  tick=until+1;
 }
 return windows;
}
