import * as game from './upstream.js';

export const priceStorageKey='dvi-item-prices-v1';
export const marketFamilies=game.marketFamilies;
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const time=v=>Number.isSafeInteger(v)&&v>0&&v<=Date.now()+60000;
export const validPrice=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=Number.MAX_SAFE_INTEGER;
export function validItemId(id){
 if(!Number.isSafeInteger(id)||id<=0)return false;
 try{const base=game.baseItemId(id),tier=game.itemTier(id),plus=Math.floor(id/game.encode(0,1));return tier>=0&&tier<=4&&plus<=game.maxEnhancement&&game.encode(game.withRarity(base,tier),plus)===id&&game.item(id).id===id&&(!plus||game.canEnhance(id));}catch{return false;}
}
export function itemFamily(id){try{return game.marketFamily(game.baseItemId(id));}catch{return null;}}
export function priceDefaults(){return {version:4,prices:{},quotes:{},preferences:{autoImport:true,categories:Object.fromEntries(marketFamilies.map(f=>[f.key,'ask'])),vendorFallback:Object.fromEntries(marketFamilies.map(f=>[f.key,false]))}};}
export function normalizePriceState(raw){
 if(!record(raw)||![2,3,4].includes(raw.version)||!record(raw.prices)||!record(raw.quotes)||!record(raw.preferences)||!record(raw.preferences.categories))throw Error('invalidPriceStorage');
 // Game capture times and official generation times use different baselines.
 const next=priceDefaults();
 for(const [key,p] of Object.entries(raw.prices)){
  if(String(Number(key))!==key||!validItemId(Number(key))||!record(p)||p.price!==null&&!validPrice(p.price)||typeof p.locked!=='boolean'||!['manual','ask','bid','vendor'].includes(p.source)||!time(p.updatedAt)||p.quoteCapturedAt!==null&&!time(p.quoteCapturedAt))throw Error('invalidPriceStorage');
  next.prices[key]={price:p.price,locked:p.locked,source:p.source,updatedAt:p.updatedAt,quoteCapturedAt:raw.version===2?null:p.quoteCapturedAt};
 }
 if(raw.version>=3){
  const parsed=validateMarketSnapshot({version:1,quotes:raw.quotes,invalid:0});
  if(parsed.invalid)throw Error('invalidPriceStorage');next.quotes=parsed.quotes;
 }
 if(raw.version===4&&(typeof raw.preferences.autoImport!=='boolean'||!record(raw.preferences.vendorFallback)))throw Error('invalidPriceStorage');
 if(raw.version===4)next.preferences.autoImport=raw.preferences.autoImport;
 for(const f of marketFamilies){
  const mode=raw.preferences.categories[f.key],legacy=raw.version<4;
  if(!(legacy?['off','ask','bid','bidVendor','vendor']:['off','ask','bid','vendor']).includes(mode))throw Error('invalidPriceStorage');
  if(!legacy&&typeof raw.preferences.vendorFallback[f.key]!=='boolean')throw Error('invalidPriceStorage');
  next.preferences.categories[f.key]=mode==='bidVendor'?'bid':mode;
  next.preferences.vendorFallback[f.key]=legacy?mode==='bidVendor':raw.preferences.vendorFallback[f.key];
 }
 return next;
}
export function validateMarketSnapshot(raw){
 if(!record(raw)||raw.version!==1||!record(raw.quotes)||!Number.isSafeInteger(raw.invalid)||raw.invalid<0)throw Error('invalidMarketData');
 const quotes={};let invalid=raw.invalid;
 for(const [key,q]of Object.entries(raw.quotes)){
  const id=Number(key);if(String(id)!==key||!validItemId(id)||!itemFamily(id)||!record(q)){invalid++;continue;}
  const entry={};
  for(const side of ['ask','bid']){
   if(!Object.hasOwn(q,side))continue;const v=q[side];
   if(!record(v)||!time(v.capturedAt)||!(v.invalid===true||v.value===null||validPrice(v.value)&&v.value>0)){invalid++;continue;}
   entry[side]=v.invalid===true?{invalid:true,capturedAt:v.capturedAt}:{value:v.value,capturedAt:v.capturedAt};
   if(v.quantityInvalid===true)entry[side].quantityInvalid=true;
   else if(Object.hasOwn(v,'quantity')){
    if(Number.isSafeInteger(v.quantity)&&v.quantity>=0)entry[side].quantity=v.quantity;
    else {entry[side].quantityInvalid=true;invalid++;}
   }
  }
  if(Object.keys(entry).length)quotes[key]=entry;else invalid++;
 }
 return {quotes,invalid};
}
export function mergeQuotes(current,incoming){
 const quotes=structuredClone(current);
 for(const [id,q]of Object.entries(incoming))for(const side of ['ask','bid'])if(q[side]&&(!quotes[id]?.[side]||q[side].capturedAt>=quotes[id][side].capturedAt)){
  quotes[id]??={};quotes[id][side]={...q[side]};
 }
 return quotes;
}
export function setItemPrice(state,id,price,now=Date.now()){
 if(!validItemId(id)||price!==null&&!validPrice(price))throw Error('invalidPrice');
 return {...state,prices:{...state.prices,[id]:{price,locked:state.prices[id]?.locked??false,source:'manual',updatedAt:now,quoteCapturedAt:null}}};
}
export function lockItemPrices(state,ids,locked,now=Date.now()){
 if(typeof locked!=='boolean'||ids.some(id=>!validItemId(id)))throw Error('invalidPrice');
 const prices={...state.prices};let changed=0;
 for(const id of new Set(ids)){
  const old=prices[id];if((old?.locked??false)===locked)continue;
  prices[id]=old?{...old,locked}:{price:null,locked,source:'manual',updatedAt:now,quoteCapturedAt:null};changed++;
 }
 return {state:{...state,prices},changed};
}
export function clearUnlockedPrices(state){
 const prices=Object.fromEntries(Object.entries(state.prices).filter(([,p])=>p.locked));
 const cleared=Object.values(state.prices).filter(p=>!p.locked&&p.price!==null).length;
 return {state:{...state,prices},cleared};
}
export function importItemPrices(state,snapshot,preferences=state.preferences,now=Date.now()){
 const parsed=validateMarketSnapshot(snapshot),quotes=mergeQuotes(state.quotes,parsed.quotes),prices={...state.prices};
 const stats={updated:0,vendor:0,locked:0,missing:0,unavailable:0,stale:0,invalid:parsed.invalid};
 // Include configured items with no quote so missing coverage is visible.
 const ids=new Set([...game.items.filter(i=>i.id===game.baseItemId(i.id)&&itemFamily(i.id)&&game.canSell(i.id)).map(i=>i.id),...Object.keys(prices).map(Number),...Object.keys(quotes).map(Number)]);
 for(const id of ids){
  const category=itemFamily(id),mode=preferences.categories[category];if(!['ask','bid','vendor'].includes(mode))continue;const side=mode;
  const old=prices[id];if(old?.locked){stats.locked++;continue;}
  if(mode==='vendor'){
   if(!game.canSell(id)){stats.unavailable++;continue;}
   const value=game.vendorPrice(id);if(!validPrice(value))throw Error('invalidPrice');
   if(old?.price===value&&old.source==='vendor'&&old.quoteCapturedAt===null)continue;
   prices[id]={price:value,locked:false,source:'vendor',updatedAt:now,quoteCapturedAt:null};stats.updated++;stats.vendor++;continue;
  }
  // Import only this read's observations, never silently reuse a cached old side.
  const q=parsed.quotes[id]?.[side];if(!q){stats.missing++;continue;}
  if(q.invalid){stats.invalid++;continue;}
  if(q.capturedAt<(quotes[id]?.[side]?.capturedAt??0)||old?.quoteCapturedAt&&q.capturedAt<old.quoteCapturedAt){stats.stale++;continue;}
  let value=q.value,source=side;
  const fallback=preferences.vendorFallback?.[category]===true;
  if(value===null&&!fallback){stats.missing++;continue;}
  if(fallback){
   if(game.canSell(id)){
    const vendor=game.vendorPrice(id);if(!validPrice(vendor))throw Error('invalidPrice');
    if(value===null||vendor>=value){value=vendor;source='vendor';}
   }else if(value===null){stats.unavailable++;continue;}
  }
  if(!validPrice(value))throw Error('invalidPrice');
  if(old?.price===value&&old.source===source&&old.quoteCapturedAt===q.capturedAt)continue;
  prices[id]={price:value,locked:false,source,updatedAt:now,quoteCapturedAt:q.capturedAt};stats.updated++;if(source==='vendor')stats.vendor++;
 }
 return {state:{...state,prices,quotes},stats};
}
export function itemPrice(id,prices){return prices.getItem?prices.getItem(Number(id)).price:prices[id]?.price??null;}
export function valuationPrice(id,prices={}){
 id=Number(id);if(game.isPet(id))return {price:0,fallback:false};
 const price=itemPrice(id,prices);
 const vendor=prices.getItem?prices.getItem(id).vendorPrice:game.canSell(id)?game.vendorPrice(id):null;
 return {price:price??vendor??0,fallback:price===null};
}
export function valueItems(items,mode,prices={}){
 let partial=0;const missing=[];
 for(const [key,qty]of Object.entries(items)){
  if(!Number.isFinite(qty)||qty<0)throw Error('invalidDropQuantity');if(!qty)continue;
  const id=Number(key),{price,fallback}=valuationPrice(id,prices);
  if(fallback)missing.push(id);partial+=qty*price;
 }
 if(!Number.isFinite(partial)||partial>Number.MAX_SAFE_INTEGER)throw Error('priceOverflow');
 return {value:partial,partial,missing};
}
export function valueRewards(result,mode,prices={}){
 if(!result)return result;
 const normal=valueItems(result.normalItems,mode,prices),rare=valueItems(result.rareItems,mode,prices);
 const totalIncome=normal.value===null||rare.value===null?null:result.coins+normal.value+rare.value;
 if(totalIncome!==null&&(!Number.isFinite(totalIncome)||totalIncome>Number.MAX_SAFE_INTEGER))throw Error('priceOverflow');
 return {...result,normalValue:normal.value,rareValue:rare.value,totalIncome,normalMissingPrices:normal.missing,rareMissingPrices:rare.missing,missingPrices:[...normal.missing,...rare.missing]};
}

export function valueCombatRewards(result,prices={}){
 const valued=valueRewards(result,'custom',prices);if(!valued)return valued;
 const food=valueItems(result.foodItems??{},'custom',prices);
 const potions=valueItems(result.potionItems??{},'custom',prices);
 const consumableCost=food.value+potions.value;
 if(!Number.isFinite(consumableCost)||consumableCost>Number.MAX_SAFE_INTEGER)throw Error('priceOverflow');
 const profit=valued.totalIncome-consumableCost;
 if(!Number.isFinite(profit)||Math.abs(profit)>Number.MAX_SAFE_INTEGER)throw Error('priceOverflow');
 return {...valued,consumableCost,consumableMissingPrices:[...food.missing,...potions.missing],foodCost:food.value,potionCost:potions.value,foodMissingPrices:food.missing,potionMissingPrices:potions.missing,profitMissingPrices:[...valued.missingPrices,...food.missing,...potions.missing],profit};
}
