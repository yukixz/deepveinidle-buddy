import {addAmount,multiplyAmount,estimateAmount,amountError} from './amounts.js';
import {requireKeys} from './engine/record-shape.js';
import {plannedProducts} from './planned-products.js';
import {valueItems,createIntermediatePricing,estimateBarSteps,estimateCraftAction,withBarTime} from './crafting-estimates.js';
import * as game from './engine/upstream.js';
import {craftingJobs,craftingTiers,craftingMaterials} from './engine/crafting-model.js';
import {gatheringSkills} from './engine/gathering-model.js';
import {collectionDefaults,validateCollection,collectionTarget,collectionRoutes,collectionPlayers,estimateCollection,collectionPrice} from './engine/collection-model.js';
import {validateCollectionSelection} from './engine/collection-plan.js';
import {priceDefaults,normalizePriceState} from './engine/item-prices.js';
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const safe=v=>Number.isFinite(v)&&v>=0&&v<=Number.MAX_SAFE_INTEGER;
const quantity=v=>Number.isSafeInteger(v)&&v>=0;
export const add=(a,b)=>{const value=a+b;if(!safe(value))throw Error('quantityOverflow');return value;};
export function createOrder(id=crypto.randomUUID(),name='订单 1'){return {id,name,enabled:true,fees:{fixed:0,percent:0,minute:0},lines:[]};}
function createCollectionOrder(){return createOrder('collection-craft','收藏（制造）');}
function validateCollectionOrder(raw){
 const order=validateOrders([raw])[0],fixed=createCollectionOrder();
 if(order.id!==fixed.id||order.name!==fixed.name||!order.enabled||Object.values(order.fees).some(value=>value!==0)||order.lines.some(line=>line.kind!=='collection'||gatheringSkills.includes(game.recipes.find(job=>job.id===line.jobId)?.skill)))throw Error('invalidOrders');
 return order;
}
export function ordersForMode(workspace,mode){
 if(mode==='craft')return workspace.orders;
 if(mode==='collection')return [workspace.collectionOrder];
 if(mode==='collectionGather')return [];
 throw Error('invalidMode');
}
export const lineKey=line=>line.kind==='craft'?`craft:${line.jobId}:${line.tier}`:`collection:${line.itemId}`;
export function validateLine(raw){
 if(!record(raw))throw Error('invalidLine');
 if(raw.kind==='craft'){
  requireKeys(raw,['kind','jobId','tier','count'],'invalidLine');
  const job=craftingJobs.find(j=>j.id===raw.jobId);
  if(!job||!craftingTiers(job).includes(raw.tier)||!quantity(raw.count)||raw.count===0)throw Error('invalidLine');
  return {kind:'craft',jobId:job.id,tier:raw.tier,count:raw.count};
 }
 if(raw.kind==='collection'){
  requireKeys(raw,['kind','itemId','jobId','target'],'invalidLine');
  return {kind:'collection',...validateCollectionSelection(raw)};
 }
 throw Error('invalidLine');
}
export function validateOrders(raw){
 if(!Array.isArray(raw)||raw.length>1000)throw Error('invalidOrders');
 const ids=new Set();return raw.map(order=>{
  requireKeys(order,['id','name','enabled','fees','lines'],'invalidOrders');requireKeys(order.fees,['fixed','percent','minute'],'invalidOrders');
  if(!record(order)||typeof order.id!=='string'||!order.id||order.id.length>100||ids.has(order.id)||typeof order.name!=='string'||order.name.length>120||typeof order.enabled!=='boolean'||!record(order.fees)||!['fixed','percent','minute'].every(k=>safe(order.fees[k]))||!Array.isArray(order.lines)||order.lines.length>10000)throw Error('invalidOrders');
  ids.add(order.id);const keys=new Set(),lines=order.lines.map(validateLine);
  for(const line of lines){const key=lineKey(line);if(keys.has(key))throw Error('duplicateLine');keys.add(key);}
  return {id:order.id,name:order.name,enabled:order.enabled,fees:{...order.fees},lines};
 });
}
export const filterDefaults=(mode='craft')=>({skill:'all',tier:'all',query:'',route:'all',sort:mode==='collection'?'cost':'item',sortDirection:'asc',page:1,minPoints:'',maxSecondsPerPoint:'',maxCost:''});
export function userDefaults(){const order=createOrder();return {version:2,revision:0,selectedMode:'craft',intermediateStrategy:'buy',orders:[order],currentOrderId:order.id,collectionOrder:createCollectionOrder(),materialPriceMode:'ask',productPriceMode:'bid',excludeInsufficientAsks:false,inventoryOnly:false,autoRemove:false,filters:{craft:filterDefaults(),collection:filterDefaults('collection'),collectionGather:{...filterDefaults('collection'),sort:'time'}}};}
const optionalWorkspaceKeys=['collectionOrder','selectedMode','inventoryOnly','intermediateStrategy','expandMetalBars'];
export function defaults(){return applyUserWorkspace({character:collectionDefaults(),prices:priceDefaults()},userDefaults());}
// Runtime composition for the calculation engine; never persist this object.
export function validateWorkspace(raw){
 requireKeys(raw,['version','revision','orders','currentOrderId','character','prices','productPriceMode','excludeInsufficientAsks','autoRemove','filters',...optionalWorkspaceKeys.filter(key=>Object.hasOwn(raw,key))],'invalidWorkspace');
 if(raw.version!==1)throw Error('invalidWorkspace');
 const user=workspaceForStorage(raw);
 return composeWorkspace({character:validateCollection(raw.character),prices:normalizePriceState(raw.prices)},user);
}
export function validateUserWorkspace(raw){
 if(!record(raw)||raw.version!==2)throw Error('unsupportedWorkspaceVersion');
 requireKeys(raw,['version','revision','orders','currentOrderId','materialPriceMode','productPriceMode','excludeInsufficientAsks','autoRemove','filters',...optionalWorkspaceKeys.filter(key=>Object.hasOwn(raw,key))],'invalidWorkspace');
 const legacy=Object.hasOwn(raw,'expandMetalBars'),hasStrategy=Object.hasOwn(raw,'intermediateStrategy');
 if(legacy&&(typeof raw.expandMetalBars!=='boolean'||hasStrategy))throw Error('invalidWorkspace');
 const intermediateStrategy=hasStrategy?raw.intermediateStrategy:raw.expandMetalBars===true?'optimal':'buy';
 if(!['optimal','buy','craft'].includes(intermediateStrategy))throw Error('invalidWorkspace');
 const inventoryOnly=Object.hasOwn(raw,'inventoryOnly')?raw.inventoryOnly:false;
 if(typeof inventoryOnly!=='boolean')throw Error('invalidPriceMode');
 const selectedMode=Object.hasOwn(raw,'selectedMode')?raw.selectedMode:'craft';
 if(!['craft','collection','collectionGather'].includes(selectedMode))throw Error('invalidWorkspace');
 const hasGather=record(raw.filters)&&Object.hasOwn(raw.filters,'collectionGather');
 requireKeys(raw.filters,hasGather?['craft','collection','collectionGather']:['craft','collection'],'invalidFilters');
 if(!quantity(raw.revision)||typeof raw.autoRemove!=='boolean')throw Error('invalidWorkspace');
 if(inventoryOnly&&(raw.materialPriceMode!=='ask'||raw.excludeInsufficientAsks!==false))throw Error('invalidPriceMode');
 if(typeof raw.excludeInsufficientAsks!=='boolean'||!['ask','bid'].includes(raw.productPriceMode)||!['ask','bid'].includes(raw.materialPriceMode))throw Error('invalidPriceMode');
 const orders=validateOrders(raw.orders),collectionOrder=Object.hasOwn(raw,'collectionOrder')?validateCollectionOrder(raw.collectionOrder):createCollectionOrder(),filters={};
 if(orders.some(order=>order.id===collectionOrder.id))throw Error('invalidOrders');
 for(const mode of hasGather?['craft','collection','collectionGather']:['craft','collection']){
  const f=raw.filters[mode],columns=mode==='craft'?['item','rarity']:['item','rarity','points','duration','time','cost','coins'];
  const keys=['skill','tier','query','route','sort','sortDirection','page','minPoints','maxSecondsPerPoint','maxCost'];
  requireKeys(f,keys,'invalidFilters');
  if(!record(f)||Object.keys(f).some(key=>!keys.includes(key))||!['all',...game.allSkills].includes(f.skill)||!['all','0','1','2','3','4'].includes(f.tier)||typeof f.query!=='string'||!['all','craft','gather'].includes(f.route)||!columns.includes(f.sort)||!['asc','desc'].includes(f.sortDirection)||!Number.isSafeInteger(f.page)||f.page<1||!['minPoints','maxSecondsPerPoint','maxCost'].every(key=>typeof f[key]==='string'&&(f[key]===''||safe(Number(f[key])))))throw Error('invalidFilters');
  filters[mode]={...f};
 }
 // A validated legacy shared filter seeds an independent gathering preference.
 if(!hasGather)filters.collectionGather={...filters.collection};
 if(!orders.length||!orders.some(order=>order.id===raw.currentOrderId))throw Error('invalidWorkspace');
 return {version:2,revision:raw.revision,selectedMode,inventoryOnly,intermediateStrategy,orders,currentOrderId:raw.currentOrderId,collectionOrder,materialPriceMode:raw.materialPriceMode,productPriceMode:raw.productPriceMode,excludeInsufficientAsks:raw.excludeInsufficientAsks,autoRemove:raw.autoRemove,filters};
}
export function workspaceForStorage(workspace){
 return validateUserWorkspace({version:2,revision:workspace.revision,orders:workspace.orders,currentOrderId:workspace.currentOrderId,...Object.fromEntries(optionalWorkspaceKeys.filter(key=>Object.hasOwn(workspace,key)).map(key=>[key,workspace[key]])),materialPriceMode:workspace.character.buyMode,productPriceMode:workspace.productPriceMode,excludeInsufficientAsks:workspace.excludeInsufficientAsks,autoRemove:workspace.autoRemove,filters:workspace.filters});
}
export function applyUserWorkspace(workspace,raw){
 return composeWorkspace(workspace,validateUserWorkspace(raw));
}
function composeWorkspace(workspace,{materialPriceMode,...user}){
 return {...user,prices:workspace.prices,version:1,character:{...workspace.character,buyMode:materialPriceMode}};
}
export function putLine(order,raw){
 if(raw.kind==='craft'&&raw.count===0){order.lines=order.lines.filter(l=>lineKey(l)!==lineKey(raw));return;}
 const line=validateLine(raw),key=lineKey(line),previous=order.lines.find(l=>lineKey(l)===key);
 if(previous?.kind==='collection'&&previous.jobId===line.jobId)line.target=Math.max(line.target,previous.target);
 order.lines=order.lines.filter(l=>lineKey(l)!==key);order.lines.push(line);
}
export function removeCompleted(workspace){
 if(!workspace.autoRemove||!workspace.character.initialized)return false;
 let changed=false;
 for(const order of [...workspace.orders,...(workspace.collectionOrder?[workspace.collectionOrder]:[])]){const lines=order.lines.filter(l=>l.kind!=='collection'||!collectionTarget(workspace.character,l.itemId,l.target).complete);if(lines.length!==order.lines.length){order.lines=lines;changed=true;}}
 return changed;
}
function summarizeExecutionActions(entries,state,canAssess){
 const groups=new Map(),required=new Map();
 const owned=id=>state.bank===null||state.pack===null?null:state.bankLocked.includes(Number(id))?0:add(state.bank[id]??0,state.pack[id]??0);
 const increment=(row,field,value)=>{if(row[field]===null)return;try{row[field]=add(row[field],value);}catch(error){row[field]=null;row.issues.add(error.message);}};
 const actions=entries.flatMap(entry=>[...(entry.barSteps??[]),entry]);
 for(const entry of actions){
  if(entry.status==='complete')continue;
  const tier=entry.kind==='craft'?entry.tier:game.itemTier(entry.itemId),key=entry.prerequisite?'bar:'+entry.jobId+':'+tier:String(entry.jobId)+':'+tier;
  if(!groups.has(key))groups.set(key,{key,...(entry.prerequisite?{prerequisite:true}:{}),jobId:entry.jobId,tier,craftCount:0,collectionAttempts:0,seconds:0,timeUnknown:false,materials:{},issues:new Set()});
  const row=groups.get(key);
  if(entry.kind==='craft'){if(entry.count===null)row.craftCount=null;else increment(row,'craftCount',entry.count);}
  else if(entry.status==='ok'&&entry.attempts!==null&&entry.attempts!==undefined)increment(row,'collectionAttempts',entry.attempts);
  else row.collectionAttempts=null;
  if(entry.status==='ok'&&entry.seconds!==null&&entry.seconds!==undefined)increment(row,'seconds',entry.seconds);
  else row.timeUnknown=true;
  if(entry.status!=='ok')row.issues.add(entry.status);
  else for(const [id,qty]of Object.entries(entry.materials)){try{row.materials[id]=add(row.materials[id]??0,qty);required.set(id,add(required.get(id)??0,qty));}catch(error){row.issues.add(error.message);}}
 }
 return [...groups.values()].map(row=>{
  let count=null;
  if(row.craftCount!==null&&row.collectionAttempts!==null)try{count=add(row.craftCount,row.collectionAttempts);}catch(error){row.issues.add(error.message);}
  const materials=Object.entries(row.materials);
  const sufficient=canAssess&&row.issues.size===0&&materials.length>0&&materials.every(([id,qty])=>owned(id)>=Math.ceil(qty));
  const materialStatus=sufficient?(materials.every(([id])=>owned(id)>=Math.ceil(required.get(id)))?'ready':'shared'):null;
  return {key:row.key,...(row.prerequisite?{prerequisite:true}:{}),jobId:row.jobId,tier:row.tier,craftCount:row.craftCount,collectionAttempts:row.collectionAttempts,count,seconds:row.timeUnknown?null:row.seconds,materialStatus,issues:[...row.issues]};
 }).sort((a,b)=>String(a.jobId).localeCompare(String(b.jobId),undefined,{numeric:true})||a.tier-b.tier);
}
export function estimateOrders(workspace,prices,players=collectionPlayers(workspace.character),pricing){
 const state=workspace.character,selected=workspace.orders.filter(o=>o.enabled),materials=new Map(),products=new Map(),seen=new Set(),conflicts=new Set();
 for(const order of selected)for(const line of order.lines)if(line.kind==='collection'){
  if(seen.has(line.itemId))conflicts.add(line.itemId);seen.add(line.itemId);
 }
 // Expansion belongs only to the fixed Collection (Craft) calculation scope.
 const strategy=workspace.intermediateStrategy??(workspace.expandMetalBars?'optimal':'buy');
 const expandMetalBars=strategy!=='buy'&&selected.length===1&&selected[0].id===workspace.collectionOrder?.id;
 if(expandMetalBars)pricing??=createIntermediatePricing(state,prices,players,strategy);
 const prerequisiteProducts=new Map();
 const uncertainOutputs=new Set(),uncertainRequirements=new Set();
 const availableBars=expandMetalBars&&state.bank!==null&&state.pack!==null?new Map():null;
 if(availableBars)for(const inventory of [state.bank,state.pack])for(const [id,qty]of Object.entries(inventory)){
  const itemId=Number(id);
  if(!state.bankLocked.includes(itemId))availableBars.set(itemId,add(availableBars.get(itemId)??0,qty));
 }
 const entries=[],orders=[];let blocked=0,globallyBlocked=false,points=0,craftSeconds=0,collectionSeconds=0;
 const materialAdd=(map,id,qty)=>map.set(Number(id),add(map.get(Number(id))??0,qty));
 for(const order of selected){
  const own=new Map();let ownBlocked=false,ownSeconds=0,ownMaterialsUnknown=false,ownMaterialsError=null;
  for(const line of order.lines){
   let entry={...line,orderId:order.id,status:'ok',materials:{}};
   try{
    if(line.kind==='craft'){
     const job=craftingJobs.find(j=>j.id===line.jobId);entry.materials=craftingMaterials(job,line.tier,line.count);
     Object.assign(entry,estimateCraftAction(state,job,line.count,players));
    }else{
     const job=collectionRoutes(line.itemId).find(j=>j.id===line.jobId),estimate=estimateCollection(state,line.itemId,job,players,line.target);
     entry={...entry,...estimate,remaining:state.initialized?Math.max(0,line.target-(state.counts[line.itemId]??0)):null};
     if(conflicts.has(line.itemId))entry.status='collectionConflict';
     if(entry.status==='ok'){
      const attempts=Math.ceil(entry.attempts);
      if(!quantity(attempts)||attempts<=0)throw Error('quantityOverflow');
      const seconds=attempts===entry.attempts?entry.seconds:add(0,entry.seconds/entry.attempts*attempts);
      const tier=game.itemTier(line.itemId);
      entry={...entry,attempts,seconds,secondsPerPoint:seconds/entry.points,
       materials:job.upgrade?craftingMaterials(job,tier,attempts):Object.fromEntries(game.recipeInputs(job,tier).map(input=>[input.itemId,add(0,input.qty*attempts)])),
      };
     }
    }
    const tier=line.kind==='craft'?line.tier:game.itemTier(line.itemId);
    const expanded=expandMetalBars?estimateBarSteps(entry.materials,availableBars,pricing):{costMaterials:entry.materials,requirements:entry.materials,stockUsed:{},steps:[]};
    if(expanded.issue)ownMaterialsUnknown=true;
    if(expanded.issue==='invalidAmount')ownMaterialsError='invalidAmount';
    if(expanded.steps.length)entry.barSteps=expanded.steps.map(step=>({...step,prerequisite:true}));
    const timing=expanded.issue?{status:expanded.issue,seconds:null}:withBarTime(entry,expanded.steps);
    for(const route of expanded.unpricedRoutes??[]){
     uncertainOutputs.add(route.itemId);
     for(const id of route.inputIds)uncertainRequirements.add(id);
    }
    if(!['ok','complete'].includes(timing.status)){
     if(!expanded.unpricedRoutes?.length)globallyBlocked=true;
     blocked++;ownBlocked=true;if(line.kind==='collection'&&entry.status!=='ok')ownMaterialsUnknown=true;
    }
    if(entry.status==='ok'){
     const job=craftingJobs.find(j=>j.id===line.jobId)??game.recipes.find(j=>j.id===line.jobId);
     if(timing.status==='ok'){
      entry.products=plannedProducts(job,tier,line.kind==='craft'?line.count:entry.attempts,players);
      for(const [id,qty]of Object.entries(entry.products))materialAdd(products,id,qty);
     }
     for(const step of expanded.steps)if(step.status==='ok')materialAdd(prerequisiteProducts,step.outputItemId,step.count);
     if(line.kind==='collection')points=add(points,entry.points);
     if(timing.status==='ok'){
      ownSeconds=add(ownSeconds,timing.seconds);
      if(line.kind==='craft')craftSeconds=add(craftSeconds,timing.seconds);
      else collectionSeconds=add(collectionSeconds,timing.seconds);
     }
    }
    // Fixed crafting requirements remain available even when action time is unknown.
    if(line.kind==='craft'||entry.status==='ok'){
     for(const [id,qty]of Object.entries(expanded.requirements))materialAdd(materials,id,qty);
     for(const [id,qty]of Object.entries(expanded.costMaterials))materialAdd(own,id,qty);
     for(const [id,qty]of Object.entries(expanded.stockUsed))availableBars.set(Number(id),availableBars.get(Number(id))-qty);
    }
    if(expanded.issue){entry.status=expanded.issue;entry.seconds=null;}
   }catch(error){entry.status=error.message;blocked++;globallyBlocked=true;ownBlocked=true;ownMaterialsUnknown=true;}
   entries.push(entry);
  }
  const valuation=estimateAmount(()=>ownMaterialsUnknown?null:valueItems(Object.fromEntries(own),prices,state.buyMode),ownMaterialsError);
  const cost=valuation.value;
  const nonempty=order.lines.some(l=>l.kind==='craft'||!state.initialized||!collectionTarget(state,l.itemId,l.target).complete);
  const fixed=nonempty?order.fees.fixed:0;
  const percent=estimateAmount(()=>order.fees.percent===0?0:cost===null?null:multiplyAmount(cost,order.fees.percent/100),order.fees.percent===0?null:valuation.error);
  const minute=estimateAmount(()=>!nonempty||order.fees.minute===0?0:ownBlocked?null:multiplyAmount(ownSeconds/60,order.fees.minute));
  const fee=estimateAmount(()=>percent.value===null||minute.value===null?null:addAmount(addAmount(fixed,percent.value),minute.value),percent.error,minute.error);
  const suggested=estimateAmount(()=>cost===null||fee.value===null?null:addAmount(cost,fee.value),valuation.error,fee.error);
  orders.push({id:order.id,fees:{fixed,percent:percent.value,minute:minute.value,total:fee.value,...amountError('percent',percent),...amountError('minute',minute),...amountError('total',fee)},blocked:ownBlocked,seconds:ownBlocked?null:ownSeconds,materialValue:cost,...amountError('materialValue',valuation),suggestedPrice:suggested.value,...amountError('suggestedPrice',suggested)});
 }
 let subtotal=0,subtotalError=null,missingPrices=0,unknownInventory=false;
 const rows=[...materials].sort((a,b)=>a[0]-b[0]).map(([id,exact])=>{
  const required=uncertainRequirements.has(id)?null:Math.ceil(exact);if(required!==null&&!quantity(required))throw Error('quantityOverflow');
  const owned=state.bank===null||state.pack===null?null:state.bankLocked.includes(id)?0:add(state.bank[id]??0,state.pack[id]??0);
  const independentProducts=products.get(id)??0,prerequisiteCount=prerequisiteProducts.get(id)??0;
  const produced=globallyBlocked||uncertainOutputs.has(id)?null:state.bankLocked.includes(id)?0:add(independentProducts,prerequisiteCount);
  const purchase=required===null||owned===null||produced===null?null:Math.ceil(Math.max(0,required-owned-produced));
  const quote=collectionPrice(id,prices,state.buyMode);
  if(owned===null)unknownInventory=true;if(purchase>0&&quote.price===null)missingPrices++;
  const valuation=estimateAmount(()=>purchase===0?0:purchase===null||quote.price===null?null:multiplyAmount(purchase,quote.price));
  const cost=valuation.value;
  const sum=estimateAmount(()=>cost===null?subtotal:addAmount(subtotal,cost),subtotalError,valuation.error);
  subtotal=sum.value;subtotalError=sum.error;
  const row={id,required,owned,produced,purchase,price:quote.price,cost,...amountError('cost',valuation)};
  if(prerequisiteCount>0&&(strategy==='craft'||pricing.get(id).strictlyCheaper)){
   row.selfCrafted=true;
   row.directPurchase=purchase===null?null:Math.ceil(Math.max(0,required-owned-independentProducts));
  }
  return row;
 });
 const material=estimateAmount(()=>orders.some(order=>order.materialValue===null)?null:orders.reduce((sum,order)=>addAmount(sum,order.materialValue),0),...orders.map(order=>order.materialValueError));
 const materialCost=material.value;
 return {entries,orders,rows,materialCost,...amountError('materialCost',material),...(subtotalError?{subtotalError,totalError:subtotalError}:{}),actions:summarizeExecutionActions(entries,state,blocked===0&&state.bank!==null&&state.pack!==null),blocked,conflicts:[...conflicts],points:globallyBlocked?null:points,craftSeconds:entries.some(e=>e.kind==='craft'&&e.status!=='ok')?null:craftSeconds,collectionSeconds:entries.some(e=>e.kind==='collection'&&(!['ok','complete'].includes(e.status)||e.barSteps?.some(step=>step.status!=='ok')))?null:collectionSeconds,missingPrices,unknownInventory,subtotal,total:blocked||missingPrices||unknownInventory?null:subtotal};
}
// Editable collection rows retain intent identity, including completed/blocked targets.
export function collectionActions(plan){
 const actions=new Map(plan.actions.map(row=>[row.key,row]));
 return [...plan.actions.filter(row=>row.prerequisite),...plan.entries.map(entry=>{
  const tier=game.itemTier(entry.itemId),action=actions.get(`${entry.jobId}:${tier}`);
  return {key:lineKey(entry),jobId:entry.jobId,tier,itemId:entry.itemId,target:entry.target,status:entry.status,
   count:entry.status==='complete'?0:entry.status==='ok'?entry.attempts:null,
   seconds:entry.status==='complete'?0:entry.status==='ok'?entry.seconds:null,
   materialStatus:entry.status==='ok'?action?.materialStatus:null,issues:['ok','complete'].includes(entry.status)?[]:[entry.status]};
 })];
}
