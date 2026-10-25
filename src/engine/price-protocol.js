import {validItemId} from './item-prices.js';
const freeze=value=>{if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;};
// Read-only quote snapshot used by actual valuation and supply checks.
export function createPriceSnapshot(state){
 const quotes=structuredClone(state.quotes),cache=new Map();
 const getItem=raw=>{
  const id=Number(raw);if(!validItemId(id))throw Error('invalidPriceItem');
  if(cache.has(id))return cache.get(id);
  const ask=quotes[id]?.ask,bid=quotes[id]?.bid;
  const item=freeze({sellPrice:ask&&!ask.invalid?ask.value:null,sellQuantity:ask&&!ask.quantityInvalid?ask.quantity??null:null,
   buyPrice:bid&&!bid.invalid?bid.value:null,market:{generatedAt:Math.max(ask?.capturedAt??0,bid?.capturedAt??0)||null}});
  cache.set(id,item);return item;
 };
 return Object.freeze({getItem});
}
