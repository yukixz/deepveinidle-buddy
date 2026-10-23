import {encodePlanPayload,decodePlanPayload} from './plan-transfer.js';
import {estimateCraftAction} from './crafting-estimates.js';
import * as game from './engine/upstream.js';
import {craftingJobs,craftingTiers,craftingMaterials} from './engine/crafting-model.js';
import {collectionDefaults,validateCollection,collectionTarget,collectionRoutes,collectionPlayers,estimateCollection,collectionPrice} from './engine/collection-model.js';
import {validateCollectionPlan} from './engine/collection-plan.js';
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
export const filterDefaults=(mode='craft')=>({skill:'all',tier:'all',query:'',route:'all',sort:mode==='collection'?'cost':'item',sortDirection:'asc',page:1,minPoints:'',maxSecondsPerPoint:'',maxCost:''});
export function defaults(){const order=createOrder();return {version:1,revision:0,orders:[order],currentOrderId:order.id,character:{...collectionDefaults(),buyMode:'ask'},prices:priceDefaults(),productPriceMode:'bid',excludeInsufficientAsks:false,autoRemove:false,language:'zh',filters:{craft:filterDefaults(),collection:filterDefaults('collection')}};}
export function validateWorkspace(raw){
 if(!record(raw)||raw.version!==1||!quantity(raw.revision)||typeof raw.autoRemove!=='boolean'||!['zh','en'].includes(raw.language)||!record(raw.filters)||raw.prices?.version!==4)throw Error('invalidWorkspace');
 if(raw.excludeInsufficientAsks!==undefined&&typeof raw.excludeInsufficientAsks!=='boolean')throw Error('invalidPriceMode');
 if(!['ask','bid'].includes(raw.productPriceMode)||!['ask','bid'].includes(raw.character?.buyMode))throw Error('invalidPriceMode');
 const orders=validateOrders(raw.orders),filters={};
 for(const mode of ['craft','collection']){
  const f=raw.filters[mode],columns=mode==='craft'?['item','rarity']:['item','rarity','points','duration','time','cost','coins'];
  const keys=['skill','tier','query','route','sort','sortDirection','page','minPoints','maxSecondsPerPoint','maxCost'];
  if(!record(f)||Object.keys(f).some(key=>!keys.includes(key))||!['all',...game.allSkills].includes(f.skill)||!['all','0','1','2','3','4'].includes(f.tier)||typeof f.query!=='string'||!['all','craft','gather'].includes(f.route)||!columns.includes(f.sort)||!['asc','desc'].includes(f.sortDirection)||!Number.isSafeInteger(f.page)||f.page<1||!['minPoints','maxSecondsPerPoint','maxCost'].every(key=>typeof f[key]==='string'&&(f[key]===''||safe(Number(f[key])))))throw Error('invalidFilters');
  filters[mode]={...f};
 }
 if(!orders.length||!orders.some(order=>order.id===raw.currentOrderId))throw Error('invalidWorkspace');
 return {version:1,revision:raw.revision,orders,currentOrderId:raw.currentOrderId,character:validateCollection(raw.character),prices:normalizePriceState(raw.prices),productPriceMode:raw.productPriceMode,excludeInsufficientAsks:raw.excludeInsufficientAsks??false,autoRemove:raw.autoRemove,language:raw.language,filters};
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
function summarizeExecutionActions(entries,rows,canAssess){
 const groups=new Map(),stockById=new Map(rows.map(row=>[row.id,row]));
 const increment=(row,field,value)=>{if(row[field]===null)return;try{row[field]=add(row[field],value);}catch(error){row[field]=null;row.issues.add(error.message);}};
 for(const entry of entries){
  if(entry.status==='complete')continue;
  const tier=entry.kind==='craft'?entry.tier:game.itemTier(entry.itemId),key=String(entry.jobId)+':'+tier;
  if(!groups.has(key))groups.set(key,{key,jobId:entry.jobId,tier,craftCount:0,collectionAttempts:0,seconds:0,timeUnknown:false,materials:{},issues:new Set()});
  const row=groups.get(key);
  if(entry.kind==='craft')increment(row,'craftCount',entry.count);
  else if(entry.status==='ok'&&entry.attempts!==null&&entry.attempts!==undefined)increment(row,'collectionAttempts',entry.attempts);
  else row.collectionAttempts=null;
  if(entry.status==='ok'&&entry.seconds!==null&&entry.seconds!==undefined)increment(row,'seconds',entry.seconds);
  else row.timeUnknown=true;
  if(entry.status!=='ok')row.issues.add(entry.status);
  else for(const [id,qty]of Object.entries(entry.materials)){try{row.materials[id]=add(row.materials[id]??0,qty);}catch(error){row.issues.add(error.message);}}
 }
 return [...groups.values()].map(row=>{
  let count=null;
  if(row.craftCount!==null&&row.collectionAttempts!==null)try{count=add(row.craftCount,row.collectionAttempts);}catch(error){row.issues.add(error.message);}
  const materials=Object.entries(row.materials);
  const sufficient=canAssess&&row.issues.size===0&&materials.length>0&&materials.every(([id,qty])=>{
   const stock=stockById.get(Number(id));
   return stock?.owned!=null&&stock.owned>=Math.ceil(qty);
  });
  const materialStatus=sufficient?(materials.every(([id])=>{
   const stock=stockById.get(Number(id));
   return stock.owned>=stock.required;
  })?'ready':'shared'):null;
  return {key:row.key,jobId:row.jobId,tier:row.tier,craftCount:row.craftCount,collectionAttempts:row.collectionAttempts,count,seconds:row.timeUnknown?null:row.seconds,materialStatus,issues:[...row.issues]};
 }).sort((a,b)=>String(a.jobId).localeCompare(String(b.jobId),undefined,{numeric:true})||a.tier-b.tier);
}
export function estimateOrders(workspace,prices,now=Date.now()){
 const state=workspace.character,players=collectionPlayers(state,now),selected=workspace.orders.filter(o=>o.enabled),materials=new Map(),seen=new Set(),conflicts=new Set();
 for(const order of selected)for(const line of order.lines)if(line.kind==='collection'){
  if(seen.has(line.itemId))conflicts.add(line.itemId);seen.add(line.itemId);
 }
 const entries=[],orders=[];let blocked=0,points=0,craftSeconds=0,collectionSeconds=0;
 const materialAdd=(map,id,qty)=>map.set(Number(id),add(map.get(Number(id))??0,qty));
 for(const order of selected){
  const own=new Map();let ownBlocked=false,ownSeconds=0,ownMaterialsUnknown=false;
  for(const line of order.lines){
   let entry={...line,orderId:order.id,status:'ok',materials:{}};
   try{
    if(line.kind==='craft'){
     const job=craftingJobs.find(j=>j.id===line.jobId);entry.materials=craftingMaterials(job,line.tier,line.count);
     Object.assign(entry,estimateCraftAction(state,job,line.count,players));
     if(entry.status==='ok')craftSeconds=add(craftSeconds,entry.seconds);
    }else{
     const estimate=estimateCollection(state,line.itemId,collectionRoutes(line.itemId).find(j=>j.id===line.jobId),players,line.target);
     entry={...entry,...estimate,remaining:state.initialized?Math.max(0,line.target-(state.counts[line.itemId]??0)):null};
     if(conflicts.has(line.itemId))entry.status='collectionConflict';
     if(entry.status==='ok'){points=add(points,entry.points);collectionSeconds=add(collectionSeconds,entry.seconds);}
    }
    if(!['ok','complete'].includes(entry.status)){blocked++;ownBlocked=true;if(line.kind==='collection')ownMaterialsUnknown=true;}
    if(entry.status==='ok')ownSeconds=add(ownSeconds,entry.seconds);
    // Fixed crafting requirements remain available even when action time is unknown.
    if(line.kind==='craft'||entry.status==='ok')for(const [id,qty]of Object.entries(entry.materials)){materialAdd(materials,id,qty);materialAdd(own,id,qty);}
   }catch(error){entry.status=error.message;blocked++;ownBlocked=true;ownMaterialsUnknown=true;}
   entries.push(entry);
  }
  let materialValue=0,unknown=false;
  for(const [id,qty]of own){const price=collectionPrice(id,prices,state.buyMode).price;if(price===null&&qty>0)unknown=true;else materialValue=add(materialValue,qty*(price??0));}
  const nonempty=order.lines.some(l=>l.kind==='craft'||!state.initialized||!collectionTarget(state,l.itemId,l.target).complete);
  const fixed=nonempty?order.fees.fixed:0,percent=order.fees.percent===0?0:unknown||ownMaterialsUnknown?null:add(0,materialValue*(order.fees.percent/100));
  const minute=!nonempty||order.fees.minute===0?0:ownBlocked?null:add(0,ownSeconds/60*order.fees.minute);
  const total=percent===null||minute===null?null:add(add(fixed,percent),minute);
  const cost=unknown||ownMaterialsUnknown?null:materialValue;
  orders.push({id:order.id,fees:{fixed,percent,minute,total},blocked:ownBlocked,seconds:ownBlocked?null:ownSeconds,materialValue:cost,suggestedPrice:cost===null||total===null?null:add(cost,total)});
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
 return {entries,orders,rows,actions:summarizeExecutionActions(entries,rows,blocked===0&&!unknownInventory),blocked,conflicts:[...conflicts],points:blocked?null:points,craftSeconds:entries.some(e=>e.kind==='craft'&&e.status!=='ok')?null:craftSeconds,collectionSeconds:entries.some(e=>e.kind==='collection'&&!['ok','complete'].includes(e.status))?null:collectionSeconds,missingPrices,unknownInventory,subtotal,total:blocked||missingPrices||unknownInventory?null:subtotal};
}
export function exportOrder(order){return {format:'deepveinidle-buddy-order',version:1,order:validateOrders([order])[0]};}
export async function exportOrderText(order){return encodePlanPayload(exportOrder(order));}
export async function importOrder(text){
 const raw=await decodePlanPayload(text);
 if(!record(raw)||raw.format!=='deepveinidle-buddy-order'||raw.version!==1||Object.keys(raw).some(key=>!['format','version','order'].includes(key)))throw Error('invalidOrders');
 return validateOrders([raw.order])[0];
}
