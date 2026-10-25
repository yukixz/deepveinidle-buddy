import * as game from './upstream.js';
import {requireKeys} from './record-shape.js';
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const time=v=>Number.isSafeInteger(v)&&v>0&&v<=Date.now()+60000;
export const validPrice=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=Number.MAX_SAFE_INTEGER;
export function validItemId(id){
 if(!Number.isSafeInteger(id)||id<=0)return false;
 try{const base=game.baseItemId(id),tier=game.itemTier(id),plus=Math.floor(id/game.encode(0,1));return tier>=0&&tier<=4&&plus<=game.maxEnhancement&&game.encode(game.withRarity(base,tier),plus)===id&&game.item(id).id===id&&(!plus||game.canEnhance(id));}catch{return false;}
}
export function itemFamily(id){try{return game.marketFamily(game.baseItemId(id));}catch{return null;}}

export const priceDefaults=()=>({version:1,quotes:{}});
export function normalizePriceState(raw){
 requireKeys(raw,['version','quotes'],'invalidPriceStorage');
 if(raw.version!==1)throw Error('invalidPriceStorage');
 return {version:1,quotes:validateQuotes(raw.quotes)};
}
function validateQuotes(raw){
 if(!record(raw))throw Error('invalidMarketData');
 const quotes={};
 for(const [key,q]of Object.entries(raw)){
  const id=Number(key);
  if(String(id)!==key||!validItemId(id)||!itemFamily(id)||!record(q)||!Object.keys(q).length||Object.keys(q).some(side=>!['ask','bid'].includes(side)))throw Error('invalidMarketData');
  const entry={};
  for(const [side,v]of Object.entries(q)){
   if(!record(v)||!time(v.capturedAt)||!(v.invalid===true||v.value===null||validPrice(v.value)&&v.value>0)||Object.keys(v).some(k=>!['invalid','value','capturedAt','quantityInvalid','quantity'].includes(k)))throw Error('invalidMarketData');
   entry[side]=v.invalid===true?{invalid:true,capturedAt:v.capturedAt}:{value:v.value,capturedAt:v.capturedAt};
   if(v.quantityInvalid===true)entry[side].quantityInvalid=true;
   else if(Object.hasOwn(v,'quantity')){if(!Number.isSafeInteger(v.quantity)||v.quantity<0)throw Error('invalidMarketData');entry[side].quantity=v.quantity;}
  }
  quotes[key]=entry;
 }
 return quotes;
}
export function mergeMarketSnapshot(current,snapshot){
 requireKeys(snapshot,['version','quotes','invalid'],'invalidMarketData');
 if(snapshot.version!==1||!Number.isSafeInteger(snapshot.invalid)||snapshot.invalid<0)throw Error('invalidMarketData');
 const incoming=validateQuotes(snapshot.quotes),quotes=structuredClone(current.quotes);
 for(const [id,q]of Object.entries(incoming))for(const [side,value]of Object.entries(q))if(!quotes[id]?.[side]||value.capturedAt>=quotes[id][side].capturedAt){quotes[id]??={};quotes[id][side]={...value};}
 return {version:1,quotes};
}
