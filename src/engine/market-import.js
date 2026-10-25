import {validItemId,itemFamily,validPrice} from './item-prices.js';

export const marketPricesUrl='https://deepveinidle.com/api/market/prices.json';
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function parseMarketPrices(raw){
 const at=typeof raw?.generatedAt==='string'?Date.parse(raw.generatedAt):NaN;
 if(!record(raw)||raw.game!=='Deep Vein Idle'||!Number.isSafeInteger(at)||at<=0||at>Date.now()+60000||!Number.isSafeInteger(raw.refreshSeconds)||raw.refreshSeconds<=0||!record(raw.items))throw Error('invalidMarketData');
 const quotes={};let invalid=0;
 for(const [key,item]of Object.entries(raw.items)){
  const id=Number(key);
  if(String(id)!==key||!validItemId(id)||!itemFamily(id)||!record(item)){invalid++;continue;}
  const quote={};
  for(const [side,field,quantityField]of [['ask','lowestSell','sellQty'],['bid','highestBuy','buyQty']]){
   const value=item[field];
   quote[side]=value===null||validPrice(value)&&value>0?{value,capturedAt:at}:{invalid:true,capturedAt:at};
   const quantity=item[quantityField];
   if(Number.isSafeInteger(quantity)&&quantity>=0)quote[side].quantity=quantity;
   else quote[side].quantityInvalid=true;
  }
  quotes[key]=quote;
 }
 if(!Object.keys(quotes).length)throw Error(Object.keys(raw.items).length?'invalidMarketData':'noMarketData');
 return {version:1,quotes,invalid};
}
