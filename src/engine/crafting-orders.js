import {validateCharacterInventory} from './character-inventory.js';
import {craftingDefaults,normalizeCrafting,craftingPlan,craftingMaterials,priceItems,materialBudget,materialRequirements,safeAdd,validQuantity} from './crafting-model.js';

export const craftingOrdersStorageKey='dvi-crafting-orders-v1';
export const emptyWorkspace=()=>({version:1,build:craftingDefaults(),orders:[],currentOrderId:null,inventory:null});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const amount=value=>value===null||typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER;
export function normalizeWorkspace(raw){
 if(!object(raw)||raw.version!==1||!object(raw.build)||!Array.isArray(raw.orders))throw Error('invalidOrders');
 const ids=new Set();
 const orders=raw.orders.map(order=>{
  if(!object(order)||typeof order.id!=='string'||!order.id||ids.has(order.id)||typeof order.name!=='string'||order.name.length>120||typeof order.enabled!=='boolean'||!object(order.plans)||!object(order.fees)||!['fixed','percent','minute'].every(key=>amount(order.fees[key])))throw Error('invalidOrders');
  ids.add(order.id);
  const plans=normalizeCrafting({...craftingDefaults(),plans:order.plans}).plans;
  if(Object.keys(order.plans).some(key=>!validQuantity(order.plans[key])||order.plans[key]===0||plans[key]!==order.plans[key])||Object.keys(plans).length!==Object.keys(order.plans).length)throw Error('invalidOrders');
  return {id:order.id,name:order.name,enabled:order.enabled,plans,fees:{fixed:order.fees.fixed,percent:order.fees.percent,minute:order.fees.minute}};
 });
 if(raw.currentOrderId!==null&&!ids.has(raw.currentOrderId))throw Error('invalidOrders');
 return {version:1,build:normalizeCrafting({...raw.build,plans:{},owned:{},upgradeMigration:false}),orders,currentOrderId:raw.currentOrderId??orders[0]?.id??null,inventory:raw.inventory==null?null:validateCharacterInventory(raw.inventory)};
}
export function createOrder(id,name){return {id,name,enabled:true,plans:{},fees:{fixed:null,percent:null,minute:null}};}
export function orderPlans(order){return craftingPlan({plans:order.plans});}
export function combinedPlans(orders){
 const plans={};for(const order of orders)for(const [key,count]of Object.entries(order.plans))plans[key]=safeAdd(plans[key]??0,count);return plans;
}
export function setOrderCount(order,key,count){
 if(!validQuantity(count))throw Error('invalidQuantity');
 if(count)order.plans[key]=count;else delete order.plans[key];
}
export function batchOrderCount(order,count){
 if(!validQuantity(count))throw Error('invalidQuantity');
 for(const key of Object.keys(order.plans))setOrderCount(order,key,count);
}
const money=value=>{if(!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER)throw Error('priceOverflow');return value;};
export function orderEstimate(order,prices,resultFor,tickMs){
 const plans=orderPlans(order),materials={};let ticks=0,complete=true;
 for(const plan of plans){
  for(const [id,count]of Object.entries(craftingMaterials(plan.job,plan.tier,plan.count)))materials[id]=safeAdd(materials[id]??0,count);
  const entry=resultFor(plan),result=entry?.result;
  if(!result?.complete||entry.error)complete=false;else ticks=safeAdd(ticks,result.elapsedTicks);
 }
 const material=priceItems(materials,prices),minutes=complete?ticks*tickMs/60000:null;
 const fixed=plans.length?order.fees.fixed??0:0;
 const percent=plans.length?money(material.value*((order.fees.percent??0)/100)):0;
 const minute=!plans.length||!order.fees.minute?0:minutes===null?null:money(minutes*order.fees.minute);
 return {material,minutes,complete,fees:{fixed,percent,minute,total:minute===null?null:money(money(fixed+percent)+minute)}};
}

export function orderMaterialBudget(build,orders,inventory,prices){
 const raw={...build,plans:combinedPlans(orders)};
 const budget=materialBudget({...raw,owned:inventory?.items??materialRequirements(raw)},prices);
 if(inventory||!budget.rows.length)return budget;
 return {...budget,rows:budget.rows.map(row=>({...row,owned:null,purchase:null,cost:null})),total:null,missing:[]};
}
