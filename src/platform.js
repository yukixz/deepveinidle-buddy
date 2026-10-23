import {parseMarketPrices,marketPricesUrl} from './engine/market-import.js';
export function browserPlatform(){return {
 get:async(key,fallback)=>{const raw=localStorage.getItem(key);return raw===null?fallback:JSON.parse(raw);},
 set:async(key,value)=>localStorage.setItem(key,JSON.stringify(value)),
 market:async()=>{const response=await fetch(marketPricesUrl,{credentials:'omit',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('marketHttpFailed');return parseMarketPrices(await response.json());},
 copy:text=>navigator.clipboard.writeText(text),
 readClipboard:()=>navigator.clipboard.readText(),
};}
export function userscriptPlatform(api){return {
 get:async(key,fallback)=>api.get(key,fallback),set:async(key,value)=>api.set(key,value),
 market:()=>new Promise((resolve,reject)=>api.request({method:'GET',url:marketPricesUrl,anonymous:true,timeout:10000,onload:r=>{
  try{if(r.status!==200)throw Error('marketHttpFailed');resolve(parseMarketPrices(JSON.parse(r.responseText)));}catch(error){reject(error);}
 },onerror:()=>reject(Error('marketNetworkFailed')),ontimeout:()=>reject(Error('marketTimeout'))})),
 copy:text=>Promise.resolve(api.copy(text)),
 readClipboard:()=>navigator.clipboard.readText(),
};}
