import {requireKeys} from './record-shape.js';
import {validateInventoryMap as validateBank,readInventoryParts} from './character-inventory.js';
import * as game from './upstream.js';
import {craftingDefaults,craftingPlayer,normalizeCrafting,importCrafting,craftingSkills} from './crafting-model.js';
import {gatheringDefaults,gatheringPlayer,normalizeGathering,importGathering,gatheringSkills} from './gathering-model.js';
import {workQualities} from './work-expectation.js';
import {readWorldBuffs} from './world-buffs.js';

const collectionSkills=[...gatheringSkills,...craftingSkills];
export const collectionIds=[...game.collectionItems].sort((a,b)=>a-b).flatMap(base=>Array.from({length:game.itemSupportsRarity(base)?5:1},(_,tier)=>game.withRarity(base,tier)));
const idSet=new Set(collectionIds),record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const configGroups=['levels','gear','brews','house','masteries','perks'];
function mergeConfig(gather,craft){
 const config={};
 for(const group of configGroups)config[group]={...gather[group],...craft[group]};
 for(const key of ['worldRarity','blessing'])config[key]=gather[key];
 return config;
}
export function collectionDefaults(){return {version:1,initialized:false,capturedAt:null,inventoryCapturedAt:null,worldTick:null,importWarnings:[],counts:{},bank:null,pack:null,buyMode:'ask',config:mergeConfig(gatheringDefaults(),craftingDefaults())};}
export function collectionWorkConfig(state,kind){
 return (kind==='gather'?normalizeGathering:normalizeCrafting)(state.config);
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
 requireKeys(raw,['version','initialized','capturedAt','inventoryCapturedAt','worldTick','importWarnings','counts','bank','pack','buyMode','config'],'invalidConfiguration');
 requireKeys(raw.config,[...configGroups,'worldRarity','blessing'],'invalidConfiguration');
 if(!record(raw)||raw.version!==1||typeof raw.initialized!=='boolean'||(raw.worldTick!==null&&(!Number.isSafeInteger(raw.worldTick)||raw.worldTick<0)||raw.initialized&&raw.worldTick===null))throw Error('invalidConfiguration');
 if(raw.capturedAt!==null&&(!Number.isSafeInteger(raw.capturedAt)||raw.capturedAt<=0||raw.capturedAt>Date.now()+60000))throw Error('invalidConfiguration');
 const inventoryCapturedAt=raw.inventoryCapturedAt;
 if(inventoryCapturedAt!==null&&(!Number.isSafeInteger(inventoryCapturedAt)||inventoryCapturedAt<=0||inventoryCapturedAt>Date.now()+60000))throw Error('invalidConfiguration');
 const buyMode=raw.buyMode;
 if(!['ask','bid'].includes(buyMode))throw Error('invalidConfiguration');
 const importWarnings=raw.importWarnings;
 if(!Array.isArray(importWarnings)||importWarnings.some(w=>!(typeof w==='string'&&/^collections\.invalid:[1-9]\d*$/.test(w)&&Number.isSafeInteger(Number(w.split(':')[1])))))throw Error('invalidConfiguration');
 const state={version:1,initialized:raw.initialized,worldTick:raw.worldTick,capturedAt:raw.capturedAt,inventoryCapturedAt,buyMode,importWarnings:[...importWarnings],counts:validateCounts(raw.counts),bank:raw.bank==null?null:validateBank(raw.bank),pack:raw.pack==null?null:validateBank(raw.pack),config:null};
 if(state.bank&&state.pack)for(const [id,qty]of Object.entries(state.pack))if(!Number.isSafeInteger(qty+(state.bank[id]??0)))throw Error('invalidSnapshot');
 if(raw.bank===undefined||raw.pack===undefined)throw Error('invalidConfiguration');
 const gather=normalizeGathering(raw.config),craft=normalizeCrafting(raw.config);
 state.config=mergeConfig(gather,craft);
 for(const group of configGroups){requireKeys(raw.config[group],Object.keys(state.config[group]),'invalidConfiguration');}
 for(const gear of Object.values(raw.config.gear))requireKeys(gear,['id','tier','plus'],'invalidConfiguration');
 for(const group of configGroups)for(const [key,value]of Object.entries(state.config[group])){
  if(JSON.stringify(raw.config[group]?.[key])!==JSON.stringify(value))throw Error('invalidConfiguration');
 }
 if(typeof raw.config.worldRarity!=='number'||!Number.isFinite(raw.config.worldRarity)||raw.config.worldRarity<0||raw.config.worldRarity>1e7||typeof raw.config.blessing!=='boolean')throw Error('invalidConfiguration');
 state.config.worldRarity=raw.config.worldRarity;state.config.blessing=raw.config.blessing;

 return state;
}
export function importCollection(current,snapshot){
 if(!record(snapshot)||snapshot.version!==2||!Number.isSafeInteger(snapshot.capturedAt)||snapshot.capturedAt<=0||snapshot.capturedAt>Date.now()+60000||!record(snapshot.player))throw Error('invalidSnapshot');
 const stock=readInventoryParts(snapshot.player);
 if(current.inventoryCapturedAt&&snapshot.capturedAt<current.inventoryCapturedAt)throw Error('inventoryOutdated');
 const inventoryCapturedAt=snapshot.capturedAt;
 const world=readWorldBuffs(snapshot);
 let invalidCounts=0;
 const counts=validateCounts(snapshot.player.collections,()=>invalidCounts++),{bank,pack}=stock,craft=importCrafting(collectionWorkConfig(current,'craft'),snapshot),gather=importGathering(collectionWorkConfig(current,'gather'),snapshot);
 const warnings=[...craft.warnings,...gather.warnings].filter(k=>/^(skills|equipment|house|masteries|perks|brews|brewBuckets|brewTier|blessing)/.test(k));
 if(warnings.length)throw Error('incompleteSnapshot');
 gather.state.worldRarity=world.worldRarity;
 return validateCollection({...current,initialized:true,capturedAt:snapshot.capturedAt,worldTick:world.worldTick,importWarnings:[...(invalidCounts?[`collections.invalid:${invalidCounts}`]:[])],counts,bank,pack,inventoryCapturedAt,config:mergeConfig(gather.state,craft.state)});
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
export function collectionPrice(id,prices,buyMode='ask'){
 const item=prices.getItem(id);
 if(!['ask','bid'].includes(buyMode))throw Error('invalidPriceMode');
 return {price:buyMode==='ask'?item.sellPrice:item.buyPrice,source:buyMode,time:item.market.generatedAt};
}
export function collectionPlayers(state){
 if(state.initialized&&(!Number.isSafeInteger(state.worldTick)||state.worldTick<0))throw Error('invalidWorldBuffs');
 const tick=state.initialized?state.worldTick:0;
 const configs={craft:collectionWorkConfig(state,'craft'),gather:collectionWorkConfig(state,'gather')};
 return {craft:craftingPlayer(configs.craft,tick).player,gather:gatheringPlayer(configs.gather,tick).player,worldRarity:state.config.worldRarity,tick};
}
export function estimateCollection(state,id,job,players=collectionPlayers(state),goal){
 if(!job)throw Error('invalidRoute');
 const target=collectionTarget(state,id,goal),base={id,jobId:job.id,skill:job.skill,...target,seconds:null,secondsPerPoint:null,materials:{},attempts:null,status:'uninitialized'};
 if(!state.initialized)return {...base,status:'uninitialized'};
 if(target.complete)return {...base,status:'complete'};
 const gathering=gatheringSkills.includes(job.skill),kind=gathering?'gather':'craft',p=players[kind];
 if(game.level(p.skills[job.skill])<job.levelReq)return {...base,status:'levelTooLow'};
 if(!game.world.sites.some(s=>s.jobIds.includes(job.id)))return {...base,status:'noSites'};
 const tier=game.itemTier(id),chance=game.workChance(job,p),burn=game.burnChance(job,p),caught=game.caughtChance(job,p);
 const qualities=gathering&&game.itemSupportsRarity(job.output.itemId)?workQualities(p,job,players.tick,players.worldRarity):[1];
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
