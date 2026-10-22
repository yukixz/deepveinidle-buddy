import * as game from './engine/upstream.js';
import {craftingJobs,craftingTiers,craftingMaterials,normalizeCrafting} from './engine/crafting-model.js';
import {collectionDefaults,validateCollection,collectionTarget,collectionRoutes,collectionPlayers,estimateCollection,collectionPrice} from './engine/collection-model.js';
import {validateCollectionPlan} from './engine/collection-plan.js';
import {normalizeWorkspace as legacyCraft} from './engine/crafting-orders.js';
import {decodeCollectionPlan} from './engine/collection-plan-transfer.js';
import {priceDefaults,normalizePriceState} from './engine/item-prices.js';
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const safe=v=>Number.isFinite(v)&&v>=0&&v<=Number.MAX_SAFE_INTEGER;
const quantity=v=>Number.isSafeInteger(v)&&v>=0;
export const add=(a,b)=>{const value=a+b;if(!safe(value))throw Error('quantityOverflow');return value;};
export function createOrder(id=crypto.randomUUID(),name='订单 1'){return {id,name,enabled:true,fees:{fixed:0,percent:0,minute:0},lines:[]};}
export const lineKey=line=>line.kind==='craft'?`craft:${line.jobId}:${line.tier}`:`collection:${line.itemId}`;
export function validateLine(raw){
 if(!record(raw))throw Error('invalidLine');
 if(raw.kind==='craft'){
  const job=craftingJobs.find(j=>j.id===raw.jobId);
  if(!job||!craftingTiers(job).includes(raw.tier)||!quantity(raw.count)||raw.count===0)throw Error('invalidLine');
  return {kind:'craft',jobId:job.id,tier:raw.tier,count:raw.count};
 }
 if(raw.kind==='collection'){
  const {selections}=validateCollectionPlan({version:1,selections:[raw]});return {kind:'collection',...selections[0]};
 }
 throw Error('invalidLine');
}
export function validateOrders(raw){
 if(!Array.isArray(raw)||raw.length>1000)throw Error('invalidOrders');
 const ids=new Set();return raw.map(order=>{
  if(!record(order)||typeof order.id!=='string'||!order.id||order.id.length>100||ids.has(order.id)||typeof order.name!=='string'||order.name.length>120||typeof order.enabled!=='boolean'||!record(order.fees)||!['fixed','percent','minute'].every(k=>safe(order.fees[k]))||!Array.isArray(order.lines)||order.lines.length>10000)throw Error('invalidOrders');
  ids.add(order.id);const keys=new Set(),lines=order.lines.map(validateLine);
  for(const line of lines){const key=lineKey(line);if(keys.has(key))throw Error('duplicateLine');keys.add(key);}
  return {id:order.id,name:order.name,enabled:order.enabled,fees:{...order.fees},lines};
 });
}
export const filterDefaults=()=>({skill:'all',tier:'0',query:'',route:'all',sort:'level',group:'',page:1,minPoints:'',maxTime:'',maxCost:''});
export function defaults(){const order=createOrder();return {version:1,revision:0,orders:[order],currentOrderId:order.id,character:collectionDefaults(),prices:priceDefaults(),follow:true,autoRemove:true,language:'zh',filters:{craft:filterDefaults(),collection:filterDefaults()}};}
export function validateWorkspace(raw){
 if(!record(raw)||raw.version!==1||!quantity(raw.revision)||typeof raw.follow!=='boolean'||typeof raw.autoRemove!=='boolean'||!['zh','en'].includes(raw.language))throw Error('invalidWorkspace');
 const orders=validateOrders(raw.orders);
 const filters={};for(const mode of ['craft','collection']){const f=raw.filters?.[mode]??filterDefaults();if(!record(f)||!['all',...game.allSkills].includes(f.skill)||!['all','0','1','2','3','4'].includes(f.tier)||typeof f.query!=='string'||typeof f.group!=='string'||!['all','craft','gather'].includes(f.route)||!['level','time','cost','points'].includes(f.sort)||!Number.isSafeInteger(f.page)||f.page<1||!['minPoints','maxTime','maxCost'].every(k=>typeof f[k]==='string'&&(f[k]===''||safe(Number(f[k])))))throw Error('invalidFilters');filters[mode]={...f};}
 if(!orders.length||!orders.some(o=>o.id===raw.currentOrderId))throw Error('invalidWorkspace');
 return {version:1,revision:raw.revision,orders,currentOrderId:raw.currentOrderId,character:validateCollection(raw.character),prices:normalizePriceState(raw.prices),follow:raw.follow,autoRemove:raw.autoRemove,language:raw.language,filters};
}
export function putLine(order,raw){
 if(raw.kind==='craft'&&raw.count===0){order.lines=order.lines.filter(l=>lineKey(l)!==lineKey(raw));return;}
 const line=validateLine(raw),key=lineKey(line),previous=order.lines.find(l=>lineKey(l)===key);
 if(previous?.kind==='collection'&&previous.jobId===line.jobId)line.target=Math.max(line.target,previous.target);
 order.lines=order.lines.filter(l=>lineKey(l)!==key);order.lines.push(line);
}
export function removeCompleted(workspace){
 if(!workspace.autoRemove||!workspace.character.initialized)return;
 for(const order of workspace.orders)order.lines=order.lines.filter(l=>l.kind!=='collection'||!collectionTarget(workspace.character,l.itemId,l.target).complete);
}
export const craftConfig=character=>normalizeCrafting(character.config);
export const craftSignature=(character,line)=>{
 const config=craftConfig(character),job=craftingJobs.find(j=>j.id===line.jobId),slot={cooking:'pan',smithing:'hammer',fletching:'knife',herblore:'mortar',crafting:'needle'}[job.skill];
 return JSON.stringify({jobId:line.jobId,tier:line.tier,count:line.count,level:config.levels[job.skill],tool:config.gear[slot],mount:config.gear.mount,brews:config.brews,house:game.rooms.filter(r=>r.bonus.kind==='craftSpeed'&&r.bonus.skill===job.skill).map(r=>[r.id,config.house[r.id]]),masteries:config.masteries,perks:{pockets:config.perks.pockets,quick:config.perks.quick,hands:job.skill==='cooking'?config.perks.hands:0},guildXp:config.guildXp,weeklyXp:config.weeklyXp,ironman:config.ironman,blessing:config.blessing,homeBank:config.homeBank,hotSetting:config.hotSetting,window:config.hotSetting==='current'?Math.floor(Date.now()/1800000):null});
};
export function estimateOrders(workspace,prices,results=new Map(),now=Date.now()){
 const state=workspace.character,players=collectionPlayers(state,now),selected=workspace.orders.filter(o=>o.enabled),materials=new Map(),seen=new Set(),conflicts=new Set();
 for(const order of selected)for(const line of order.lines)if(line.kind==='collection'){
  if(seen.has(line.itemId))conflicts.add(line.itemId);seen.add(line.itemId);
 }
 const entries=[],orders=[];let blocked=0,points=0,craftSeconds=0,collectionSeconds=0;
 const materialAdd=(map,id,qty)=>map.set(Number(id),add(map.get(Number(id))??0,qty));
 for(const order of selected){
  const own=new Map();let ownBlocked=false,ownCraftSeconds=0,hasCollection=false,ownMaterialsUnknown=false;
  for(const line of order.lines){
   let entry={...line,orderId:order.id,status:'ok',materials:{}};
   try{
    if(line.kind==='craft'){
     const job=craftingJobs.find(j=>j.id===line.jobId);entry.materials=craftingMaterials(job,line.tier,line.count);
     if(!state.initialized)entry.status='uninitialized';
     else if(state.config.levels[job.skill]<job.levelReq)entry.status='levelTooLow';
     const result=results.get(craftSignature(state,line));entry.result=result;
     if(entry.status==='ok'){
      if(result?.complete&&!result.error){entry.seconds=result.elapsedTicks*game.tickMs/1000;craftSeconds=add(craftSeconds,entry.seconds);ownCraftSeconds=add(ownCraftSeconds,entry.seconds);}
      else entry.status=result?.error??'calculating';
     }
    }else{
     const estimate=estimateCollection(state,line.itemId,collectionRoutes(line.itemId).find(j=>j.id===line.jobId),players,line.target);
     entry={...entry,...estimate,remaining:state.initialized?Math.max(0,line.target-(state.counts[line.itemId]??0)):null};
     if(conflicts.has(line.itemId))entry.status='collectionConflict';
     if(entry.status==='ok'){points=add(points,entry.points);collectionSeconds=add(collectionSeconds,entry.seconds);hasCollection=true;}
     else if(entry.status!=='complete')hasCollection=true;
    }
    if(!['ok','complete'].includes(entry.status)){blocked++;ownBlocked=true;if(line.kind==='collection')ownMaterialsUnknown=true;}
    // Deterministic crafting requirements stay available while simulation runs.
    if(line.kind==='craft'||entry.status==='ok')for(const [id,qty]of Object.entries(entry.materials)){materialAdd(materials,id,qty);materialAdd(own,id,qty);}
   }catch(error){entry.status=error.message;blocked++;ownBlocked=true;ownMaterialsUnknown=true;}
   entries.push(entry);
  }
  let materialValue=0,unknown=false;
  for(const [id,qty]of own){const price=collectionPrice(id,prices,state.buyMode).price;if(price===null&&qty>0)unknown=true;else materialValue=add(materialValue,qty*(price??0));}
  const nonempty=order.lines.some(l=>l.kind==='craft'||!state.initialized||!collectionTarget(state,l.itemId,l.target).complete);
  const fixed=nonempty?order.fees.fixed:0,percent=order.fees.percent===0?0:unknown||ownMaterialsUnknown?null:materialValue*order.fees.percent/100;
  const minute=!nonempty||order.fees.minute===0?0:hasCollection||ownBlocked?null:ownCraftSeconds/60*order.fees.minute;
  const total=percent===null||minute===null?null:add(add(fixed,percent),minute);
  orders.push({id:order.id,fees:{fixed,percent,minute,total},blocked:ownBlocked,materialValue:unknown?null:materialValue});
 }
 let subtotal=0,missingPrices=0,unknownInventory=false;
 const rows=[...materials].sort((a,b)=>a[0]-b[0]).map(([id,exact])=>{
  const required=Math.ceil(exact);if(!quantity(required))throw Error('quantityOverflow');
  const owned=state.bank===null||state.pack===null?null:add(state.bank[id]??0,state.pack[id]??0),purchase=owned===null?null:Math.max(0,required-owned),quote=collectionPrice(id,prices,state.buyMode);
  if(owned===null)unknownInventory=true;if(purchase>0&&quote.price===null)missingPrices++;
  const cost=purchase===0?0:purchase===null||quote.price===null?null:purchase*quote.price;
  if(cost!==null)subtotal=add(subtotal,cost);
  return {id,required,owned,purchase,price:quote.price,cost};
 });
 for(const entry of entries){const dependencies=Object.keys(entry.materials);entry.ready=entry.status==='ok'&&dependencies.length>0&&dependencies.every(id=>{const row=rows.find(r=>r.id===Number(id));return row&&row.owned!==null&&row.owned>=row.required;});
  const jobId=entry.jobId;entry.overlap=entry.kind==='collection'?entries.some(e=>e.kind==='craft'&&e.jobId===jobId&&e.tier===game.itemTier(entry.itemId)):entries.some(e=>e.kind==='collection'&&e.jobId===jobId&&game.itemTier(e.itemId)===entry.tier);
 }
 return {entries,orders,rows,blocked,conflicts:[...conflicts],points:blocked?null:points,craftSeconds,collectionSeconds,missingPrices,unknownInventory,subtotal,total:blocked||missingPrices||unknownInventory?null:subtotal};
}
export function exportOrders(workspace){return {format:'deepveinidle-buddy-orders',version:1,orders:validateOrders(workspace.orders),autoRemove:workspace.autoRemove,buyMode:workspace.character.buyMode};}
export async function importOrders(text){
 let raw;try{raw=JSON.parse(text);}catch{raw=null;}
 if(raw?.format==='deepveinidle-buddy-orders'){
  if(raw.version!==1||typeof raw.autoRemove!=='boolean'||!['global','ask','bid','vendor'].includes(raw.buyMode))throw Error('invalidOrders');
  const orders=validateOrders(raw.orders);return {orders,autoRemove:raw.autoRemove,buyMode:raw.buyMode};
 }
 if(raw?.version===1&&Array.isArray(raw.orders)){
  const old=legacyCraft(raw);return {orders:old.orders.map(o=>({...o,fees:Object.fromEntries(Object.entries(o.fees).map(([k,v])=>[k,v??0])),lines:Object.entries(o.plans).map(([key,count])=>{const split=key.lastIndexOf(':'),id=key.slice(0,split);return validateLine({kind:'craft',jobId:id.startsWith('upgrade-')?id:Number(id),tier:Number(key.slice(split+1)),count});})}))};
 }
 const plan=await decodeCollectionPlan(text),order=createOrder(crypto.randomUUID(),'收藏计划');order.lines=plan.selections.map(s=>({kind:'collection',...s}));return {orders:[order]};
}
