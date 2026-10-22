import * as game from './upstream.js';
import {validItemId} from './item-prices.js';

export const priceProtocolVersion=1;
const freeze=value=>{if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;};
const fieldStatus=(side,quantity=false)=>{
 if(!side)return 'unread';
 if(quantity)return side.quantityInvalid?'invalid':side.quantity===undefined?'unread':'available';
 return side.invalid?'invalid':side.value===null?'noOrders':'available';
};
// The captured copy is private. Lazy item reads keep even broad simulations on
// one immutable revision without enumerating every rarity/enhancement variant.
export function createPriceSnapshot(state,ids,revision=0){
 const captured=structuredClone({prices:state.prices,quotes:state.quotes}),cache=new Map();
 const getItem=rawId=>{
  const id=Number(rawId);if(!validItemId(id))throw Error('invalidPriceItem');
  if(cache.has(id))return cache.get(id);
  const p=captured.prices[id],q=captured.quotes[id],ask=q?.ask,bid=q?.bid;
  const item=freeze({itemId:id,price:p?.price??null,vendorPrice:game.canSell(id)?game.vendorPrice(id):null,
   sellPrice:ask&&!ask.invalid?ask.value:null,sellQuantity:ask&&!ask.quantityInvalid?ask.quantity??null:null,
   buyPrice:bid&&!bid.invalid?bid.value:null,buyQuantity:bid&&!bid.quantityInvalid?bid.quantity??null:null,
   configured:{locked:p?.locked??false,source:p?.source??null,updatedAt:p?.updatedAt??null},
   market:{generatedAt:Math.max(ask?.capturedAt??0,bid?.capturedAt??0)||null,status:{sellPrice:fieldStatus(ask),sellQuantity:fieldStatus(ask,true),buyPrice:fieldStatus(bid),buyQuantity:fieldStatus(bid,true)}}});
  cache.set(id,item);return item;
 };
 const snapshot={version:priceProtocolVersion,revision,getItem};
 if(ids!==undefined)snapshot.items=Object.fromEntries([...new Set(ids)].map(id=>[id,getItem(id)]));
 return freeze(snapshot);
}
