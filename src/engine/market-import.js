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
export async function requestMarket(){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch(marketPricesUrl,{signal:controller.signal,credentials:'omit'});
  if(!response.ok)throw Error('marketHttpFailed');
  let raw;try{raw=await response.json();}catch(error){if(controller.signal.aborted)throw error;throw Error('invalidMarketData');}
  return {snapshot:parseMarketPrices(raw)};
 }catch(error){
  if(controller.signal.aborted)throw Error('marketTimeout');
  if(['marketHttpFailed','invalidMarketData','noMarketData'].includes(error.message))throw error;
  throw Error('marketNetworkFailed');
 }finally{clearTimeout(timeout);}
}

export const marketErrors={marketNetworkFailed:['官方市场价格请求失败，请检查网络后重试；已有价格保留。','Could not reach the official market API. Check your connection and retry; existing prices were kept.'],marketTimeout:['官方市场价格请求超时，请重试；已有价格保留。','The official market request timed out. Retry; existing prices were kept.'],marketHttpFailed:['官方市场价格接口返回错误，请稍后重试；已有价格保留。','The official market API returned an error. Retry later; existing prices were kept.'],marketStale:['官方市场价格早于当前缓存，已有报价与价格保留。','Official quotes are older than the current cache; existing quotes and prices were kept.'],invalidMarketData:['官方市场价格数据格式异常，已有价格保留。','Invalid official market data; existing prices were kept.'],noMarketData:['官方市场价格接口暂无物品报价，请稍后重试；已有价格保留。','The official API has no item quotes. Retry later; existing prices were kept.']};
