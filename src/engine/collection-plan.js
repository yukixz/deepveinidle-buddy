import * as game from './upstream.js';
import {collectionIds,collectionRoutes,collectionPlayers,estimateCollection,collectionPrice} from './collection-model.js';

export const collectionPlanStorageKey='dvi-collection-plan-v1';
const ids=new Set(collectionIds),record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export const collectionPlanDefaults=()=>({version:1,selections:[]});
function selection(raw){
 if(!record(raw)||!Number.isSafeInteger(raw.itemId)||!ids.has(raw.itemId)||!Number.isSafeInteger(raw.jobId)||!collectionRoutes(raw.itemId).some(j=>j.id===raw.jobId)||!game.collectionThresholds(game.baseItemId(raw.itemId)).includes(raw.target))throw Error('invalidPlan');
 return {itemId:raw.itemId,jobId:raw.jobId,target:raw.target};
}
export function validateCollectionPlan(raw){
 if(!record(raw)||raw.version!==1||!Array.isArray(raw.selections))throw Error('invalidPlan');
 const selections=new Map();
 for(const value of raw.selections){
  const entry=selection(value),previous=selections.get(entry.itemId);
  if(previous&&previous.jobId!==entry.jobId)throw Error('invalidPlan');
  if(!previous||entry.target>previous.target)selections.set(entry.itemId,entry);
 }
 return {version:1,selections:[...selections.values()].sort((a,b)=>a.itemId-b.itemId)};
}
export function addCollectionPlan(plan,value){
 const entry=selection(value),current=validateCollectionPlan(plan),previous=current.selections.find(s=>s.itemId===entry.itemId);
 return validateCollectionPlan({version:1,selections:[...current.selections.filter(s=>s.itemId!==entry.itemId),{...entry,target:previous?.jobId===entry.jobId?Math.max(entry.target,previous.target):entry.target}]});
}
export function addCollectionPlans(plan,values){
 const current=validateCollectionPlan(plan);
 return validateCollectionPlan({...current,selections:[...current.selections,...values]});
}
export function setCollectionPlanTarget(plan,itemId,target){
 const current=validateCollectionPlan(plan);
 if(!current.selections.some(entry=>entry.itemId===itemId))throw Error('invalidPlan');
 return validateCollectionPlan({...current,selections:current.selections.map(entry=>entry.itemId===itemId?{...entry,target}:entry)});
}
export function removeCollectionPlan(plan,itemId){return validateCollectionPlan({version:1,selections:plan.selections.filter(s=>s.itemId!==itemId)});}
export function calculateCollectionPlan(state,raw,prices,{now=Date.now()}={}){
 const plan=validateCollectionPlan(raw),players=collectionPlayers(state,now),materials=new Map();
 let points=0,blockedCount=0,completedCount=0,quantityOverflow=false;
 const entries=plan.selections.map(entry=>{
  let result;
  try{result=estimateCollection(state,entry.itemId,collectionRoutes(entry.itemId).find(j=>j.id===entry.jobId),players,entry.target);}
  catch(error){result={status:error.message,points:0,materials:{}};}
  if(result.status==='complete')completedCount++;
  else if(result.status!=='ok')blockedCount++;
  else{
   points+=result.points;
   if(!Number.isSafeInteger(points))quantityOverflow=true;
   for(const [id,qty]of Object.entries(result.materials)){
    const itemId=Number(id),material=materials.get(itemId)??{itemId,quantity:0};
    if(material.quantity!==null){
     const sum=material.quantity+qty;
     if(!Number.isFinite(sum)||sum<0||sum>Number.MAX_SAFE_INTEGER){material.quantity=null;quantityOverflow=true;}else material.quantity=sum;
    }
    materials.set(itemId,material);
   }
  }
  return {...entry,...result,remaining:state.initialized?Math.max(0,entry.target-(state.counts[entry.itemId]??0)):null};
 });
 const timeSum=entries.reduce((sum,entry)=>sum+(entry.status==='complete'?0:entry.seconds??0),0);
 const timeOverflow=!Number.isFinite(timeSum)||timeSum>Number.MAX_SAFE_INTEGER;
 const seconds=blockedCount||timeOverflow?null:timeSum;
 let knownCost=0,missingPrices=0,amountOverflow=false;
 const missingInventory=materials.size>0&&(state.bank==null||state.pack==null);
 const priced=[...materials.values()].sort((a,b)=>a.itemId-b.itemId).map(material=>{
  const quote=collectionPrice(material.itemId,prices,state.buyMode);
  const quantity=material.quantity===null?null:Math.ceil(material.quantity);
  const inventory=state.bank==null||state.pack==null?null:(state.bank[material.itemId]??0)+(state.pack[material.itemId]??0);
  const purchase=quantity===null||inventory===null?null:Math.ceil(Math.max(0,quantity-inventory));
  if(purchase>0&&quote.price===null)missingPrices++;
  let cost=purchase===0?0:purchase===null||quote.price===null?null:purchase*quote.price;
  const overflow=cost!==null&&(!Number.isFinite(cost)||cost>Number.MAX_SAFE_INTEGER);
  if(overflow){cost=null;amountOverflow=true;}
  if(cost!==null&&knownCost!==null){knownCost+=cost;if(!Number.isFinite(knownCost)||knownCost>Number.MAX_SAFE_INTEGER){knownCost=null;amountOverflow=true;}}
  return {...material,...quote,quantity,inventory,purchase,cost,overflow};
 });
 const coveredMaterials=new Set(priced.filter(material=>material.quantity>0&&material.inventory!==null&&material.inventory>=material.quantity).map(material=>String(material.itemId)));
 for(const entry of entries){
  const dependencies=Object.keys(entry.materials);
  entry.materialsReady=entry.status==='ok'&&dependencies.length>0&&dependencies.every(id=>coveredMaterials.has(id));
 }
 const complete=blockedCount===0&&!quantityOverflow&&!amountOverflow&&!missingInventory&&missingPrices===0;
 return {entries,materials:priced,blockedCount,completedCount,quantityOverflow,amountOverflow,timeOverflow,seconds,missingInventory,missingPrices,points:blockedCount||quantityOverflow?null:points,knownCost,cost:complete?knownCost:null,complete:complete&&!timeOverflow};
}
