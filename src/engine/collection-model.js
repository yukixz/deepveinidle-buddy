import {validateInventoryMap as validateBank,readInventoryParts} from './character-inventory.js';
import * as game from './upstream.js';
import {craftingDefaults,craftingPlayer,normalizeCrafting,importCrafting,craftingSkills} from './crafting-model.js';
import {gatheringDefaults,gatheringPlayer,normalizeGathering,importGathering,gatheringSkills} from './gathering-model.js';
import {manualWindows} from './manual-settings.js';
import {workQualities} from './work-expectation.js';
import {readWorldBuffs} from './world-buffs.js';
import {combatHot,combatHotWindows} from './combat-hot.js';
import {epoch} from './hot-forecast.js';

export const collectionStorageKey='dvi-collection-v1';
export const collectionSkills=[...gatheringSkills,...craftingSkills];
export const collectionIds=[...game.collectionItems].sort((a,b)=>a-b).flatMap(base=>Array.from({length:game.itemSupportsRarity(base)?5:1},(_,tier)=>game.withRarity(base,tier)));
const idSet=new Set(collectionIds),record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function collectionInteger(value,max=Number.MAX_SAFE_INTEGER){
 if(!['number','string'].includes(typeof value)||String(value).trim()==='')throw Error('invalidInteger');
 const n=Number(value);if(!Number.isSafeInteger(n)||n<0||n>max)throw Error('invalidInteger');return n;
}
export function collectionNumber(value,min=0,max=1e7){
 if(!['number','string'].includes(typeof value)||String(value).trim()==='')throw Error('invalidNumber');
 const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw Error('invalidNumber');return n;
}
const configGroups=['levels','gear','brews','house','masteries','perks'];
function mergeConfig(gather,craft){
 const config={};
 for(const group of configGroups)config[group]={...gather[group],...craft[group]};
 for(const key of ['guild','guildXp','weeklyXp','worldRarity','blessing','ironman','homeBank','hotSetting'])config[key]=gather[key];
 return config;
}
export function collectionDefaults(){return {version:1,initialized:false,capturedAt:null,inventoryCapturedAt:null,edited:false,importWarnings:[],counts:{},bank:null,pack:null,buyMode:'global',config:mergeConfig(gatheringDefaults(),craftingDefaults())};}
export function collectionWorkConfig(state,kind){
 const config=(kind==='gather'?normalizeGathering:normalizeCrafting)(state.config);
 config.weeklyXp=state.config.weeklyXp;
 return config;
}
function validateCounts(raw,onInvalid){
 if(!record(raw))throw Error('incompleteSnapshot');
 const counts={};for(const [key,n]of Object.entries(raw)){
  try{
   const id=Number(key);if(String(id)!==key||typeof n!=='number'||!Number.isSafeInteger(n)||n<0)throw Error('invalidSnapshot');
   // The game can log valid items outside the visible collection catalogue.
   try{if(game.itemTier(id)>4||game.item(id).id!==id||id!==game.withRarity(game.baseItemId(id),game.itemTier(id)))throw Error();}catch{throw Error('invalidSnapshot');}
   if(idSet.has(id))counts[id]=n;
  }catch(error){if(!onInvalid||error.message!=='invalidSnapshot')throw error;onInvalid();}
 }return counts;
}
export function validateCollection(raw){
 if(!record(raw)||raw.version!==1||typeof raw.initialized!=='boolean'||typeof raw.edited!=='boolean')throw Error('invalidConfiguration');
 if(raw.capturedAt!==null&&(!Number.isSafeInteger(raw.capturedAt)||raw.capturedAt<=0||raw.capturedAt>Date.now()+60000))throw Error('invalidConfiguration');
 const inventoryCapturedAt=raw.inventoryCapturedAt===undefined?(raw.bank!=null&&raw.pack!=null?raw.capturedAt:null):raw.inventoryCapturedAt;
 if(inventoryCapturedAt!==null&&(!Number.isSafeInteger(inventoryCapturedAt)||inventoryCapturedAt<=0||inventoryCapturedAt>Date.now()+60000))throw Error('invalidConfiguration');
 const buyMode=raw.buyMode;
 if(!['global','ask','bid','vendor'].includes(buyMode))throw Error('invalidConfiguration');
 const importWarnings=raw.importWarnings;
 if(!Array.isArray(importWarnings)||importWarnings.some(w=>!['worldBuffs.upgrade','weeklyXp.reset'].includes(w)&&!(typeof w==='string'&&/^collections\.invalid:[1-9]\d*$/.test(w)&&Number.isSafeInteger(Number(w.split(':')[1])))))throw Error('invalidConfiguration');
 const state={version:1,initialized:raw.initialized,edited:raw.edited,capturedAt:raw.capturedAt,inventoryCapturedAt,buyMode,importWarnings:[...importWarnings],counts:validateCounts(raw.counts),bank:raw.bank==null?null:validateBank(raw.bank),pack:raw.pack==null?null:validateBank(raw.pack),config:null};
 if(state.bank&&state.pack)for(const [id,qty]of Object.entries(state.pack))if(!Number.isSafeInteger(qty+(state.bank[id]??0)))throw Error('invalidSnapshot');
 if(!record(raw.config))throw Error('invalidConfiguration');
 const gather=normalizeGathering(raw.config),craft=normalizeCrafting(raw.config);
 state.config=mergeConfig(gather,craft);
 for(const group of configGroups)for(const [key,value]of Object.entries(state.config[group])){
  if(JSON.stringify(raw.config[group]?.[key])!==JSON.stringify(value))throw Error('invalidConfiguration');
 }
 for(const key of ['guildXp','weeklyXp','worldRarity'])state.config[key]=collectionNumber(raw.config[key]);
 for(const key of ['blessing','ironman'])if(typeof raw.config[key]!=='boolean')throw Error('invalidConfiguration');
 if(raw.config.homeBank!==state.config.homeBank||!['game','current','off'].includes(raw.config.hotSetting))throw Error('invalidConfiguration');

 return state;
}
export function importCollection(current,snapshot,{configuration=true,inventory=true}={}){
 if(!record(snapshot)||snapshot.version!==2||!Number.isSafeInteger(snapshot.capturedAt)||snapshot.capturedAt<=0||snapshot.capturedAt>Date.now()+60000||!record(snapshot.player))throw Error('invalidSnapshot');
 const stock=inventory?readInventoryParts(snapshot.player):{bank:current.bank,pack:current.pack};
 if(inventory&&current.inventoryCapturedAt&&snapshot.capturedAt<current.inventoryCapturedAt)throw Error('inventoryOutdated');
 const inventoryCapturedAt=inventory?snapshot.capturedAt:current.inventoryCapturedAt;
 if(!configuration)return validateCollection({...current,bank:stock.bank,pack:stock.pack,inventoryCapturedAt});
 let invalidCounts=0;
 const counts=validateCounts(snapshot.player.collections,()=>invalidCounts++),{bank,pack}=stock,craft=importCrafting(collectionWorkConfig(current,'craft'),snapshot),gather=importGathering(collectionWorkConfig(current,'gather'),snapshot);
 const warnings=[...craft.warnings,...gather.warnings].filter(k=>/^(skills|equipment|house|masteries|perks|ironman|homeBank|brews|brewBuckets|brewTier|blessing|guildBonus)/.test(k));
 if(warnings.length)throw Error('incompleteSnapshot');
 const world=readWorldBuffs(snapshot);
 gather.state.weeklyXp=world.weeklyXp;gather.state.worldRarity=world.worldRarity;
 return validateCollection({...current,initialized:true,capturedAt:snapshot.capturedAt,edited:false,importWarnings:[...(world.warning?[world.warning]:[]),...(invalidCounts?[`collections.invalid:${invalidCounts}`]:[])],counts,bank,pack,inventoryCapturedAt,config:mergeConfig(gather.state,craft.state)});
}
export function collectionTarget(state,id,target){
 const current=state.counts[id]??0,base=game.baseItemId(id),thresholds=game.collectionThresholds(base);
 const goal=target??thresholds.find(n=>n>current)??null;
 if(goal===null)return {current,target:null,missing:0,points:0,complete:true};
 if(!thresholds.includes(goal))throw Error('invalidTarget');
 return {current,target:goal,missing:Math.max(0,goal-current),points:Math.max(0,game.collectionPoints(goal,game.itemTier(id),base)-game.collectionPoints(current,game.itemTier(id),base)),complete:goal<=current};
}
export function pointsForProduction(id,current,quantity){return game.collectionPoints(current+quantity,game.itemTier(id),game.baseItemId(id))-game.collectionPoints(current,game.itemTier(id),game.baseItemId(id));}
export function collectionRoutes(id){
 const base=game.baseItemId(id);
 if(game.collectionExcluded(id))return [];
 return game.recipes.filter(j=>j.output.itemId===base&&!j.retired&&collectionSkills.includes(j.skill));
}
export function collectionPrice(id,prices,buyMode='global'){
 const item=prices.getItem(id);
 if(buyMode==='global')return {price:item.price,source:'global',time:item.configured.updatedAt};
 if(buyMode==='vendor')return {price:item.vendorPrice,source:'vendor',time:null};
 if(!['ask','bid'].includes(buyMode))throw Error('invalidPriceMode');
 return {price:buyMode==='ask'?item.sellPrice:item.buyPrice,source:buyMode,time:item.market.generatedAt};
}
export function priceCollection(result,prices,buyMode='global'){
 const materials=Object.entries(result.materials??{}).map(([id,qty])=>({id:Number(id),qty,...collectionPrice(Number(id),prices,buyMode)}));
 let sum=0,missing=false;
 for(const row of materials){
  if(!Number.isFinite(row.qty)||row.qty<0)throw Error('quantityOverflow');
  if(row.qty>0&&row.price===null)missing=true;
  sum+=row.qty*(row.price??0);
 }
 const overflow=!Number.isFinite(sum)||sum>Number.MAX_SAFE_INTEGER,cost=missing||overflow?null:sum;
 return {...result,materialsPriced:materials,overflowFields:overflow?['cost']:[],cost,costPerPoint:result.points>0&&cost!==null?cost/result.points:null};
}
export function collectionWindows(config,skill,ticks,now){
 const start=game.predictionStartTick,windows=manualWindows(start,start+ticks,config.weeklyXp,config.hotSetting!=='game',skill,config.worldRarity??0);
 if(config.hotSetting==='current')windows.push(...combatHotWindows(combatHot(now,Math.max(1,Math.ceil(ticks*game.tickMs/60000))/60,skill)));
 return windows;
}
export function collectionPlayers(state,now=Date.now()){
 const configs={craft:collectionWorkConfig(state,'craft'),gather:collectionWorkConfig(state,'gather')};
 return {craft:craftingPlayer(configs.craft).player,gather:gatheringPlayer(configs.gather).player,configs,now};
}
export function estimateCollection(state,id,job,players=collectionPlayers(state),goal){
 if(!job)throw Error('invalidRoute');
 const target=collectionTarget(state,id,goal),base={id,jobId:job.id,skill:job.skill,...target,seconds:null,secondsPerPoint:null,materials:{},attempts:null,status:'uninitialized'};
 if(!state.initialized)return {...base,status:'uninitialized'};
 if(target.complete)return {...base,status:'complete'};
 const gathering=gatheringSkills.includes(job.skill),kind=gathering?'gather':'craft',p=players[kind],config=players.configs[kind];
 if(game.level(p.skills[job.skill])<job.levelReq)return {...base,status:'levelTooLow'};
 if(!game.world.sites.some(s=>s.jobIds.includes(job.id)))return {...base,status:'noSites'};
 const tier=game.itemTier(id),chance=game.workChance(job,p),burn=game.burnChance(job,p),caught=game.caughtChance(job,p);
 const at=config.hotSetting==='current'?Math.floor((players.now-epoch)/game.tickMs):game.predictionStartTick;
 const context={hypothetical:true,windows:manualWindows(at,at,config.weeklyXp,config.hotSetting==='off',job.skill,config.worldRarity??0)};
 const qualities=gathering&&game.itemSupportsRarity(job.output.itemId)?workQualities(p,context,job,at):[1];
 const quality=gathering?qualities[tier]:1;
 const success=(1-burn)*(1-caught)*quality;
 if(!(chance>0&&success>0))return {...base,status:'unreachable'};
 const successes=Math.ceil(target.missing/job.output.qty),attempts=successes/success,quantity=successes*job.output.qty;
 const seconds=attempts*(game.tickMs/1000/chance+caught*Math.max(0,(job.caught?.stunTicks??0)-1)*game.tickMs/1000);
 const points=pointsForProduction(id,target.current,quantity),materials=Object.fromEntries(game.recipeInputs(job,tier).map(i=>[i.itemId,i.qty*attempts]));
 if(!Number.isFinite(seconds)||!Number.isFinite(attempts)||Object.values(materials).some(n=>!Number.isFinite(n)||n>Number.MAX_SAFE_INTEGER))throw Error('quantityOverflow');
 return {...base,status:'ok',seconds,secondsPerPoint:seconds/points,points,quantity,attempts,materials,burn,caught,quality,actionSeconds:game.tickMs/1000/chance};
}
export function collectionRows(state,{now=Date.now()}={}){
 const players=collectionPlayers(state,now);
 return collectionIds.flatMap(id=>{
  const routes=collectionRoutes(id),future=game.collectionThresholds(game.baseItemId(id)).filter(n=>n>(state.counts[id]??0));
  return routes.flatMap(job=>(future.length?future:[undefined]).map(goal=>estimateCollection(state,id,job,players,goal)));
 });
}
