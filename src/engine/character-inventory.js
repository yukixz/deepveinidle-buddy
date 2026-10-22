import * as game from './upstream.js';
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function validateInventoryMap(raw){
 if(!record(raw))throw Error('incompleteSnapshot');
 const items={};
 for(const [key,quantity]of Object.entries(raw)){
  const id=Number(key);
  if(String(id)!==key||!Number.isSafeInteger(id)||id<1||typeof quantity!=='number'||!Number.isSafeInteger(quantity)||quantity<0)throw Error('invalidSnapshot');
  try{if(game.item(id).id!==id)throw Error();}catch{throw Error('invalidSnapshot');}
  items[id]=quantity;
 }
 return items;
}
export function readInventoryParts(player){
 const bank=validateInventoryMap(player?.bank);
 if(!Array.isArray(player.pack))throw Error('incompleteSnapshot');
 const pack={};
 for(const stack of player.pack){
  if(!record(stack)||!Number.isSafeInteger(stack.itemId)||!Number.isSafeInteger(stack.qty)||stack.qty<1)throw Error('invalidSnapshot');
  validateInventoryMap({[stack.itemId]:stack.qty});
  const quantity=(pack[stack.itemId]??0)+stack.qty;
  if(!Number.isSafeInteger(quantity))throw Error('invalidSnapshot');
  pack[stack.itemId]=quantity;
 }
 const items={...bank};for(const [id,qty]of Object.entries(pack)){
  const total=(items[id]??0)+qty;if(!Number.isSafeInteger(total))throw Error('invalidSnapshot');items[id]=total;
 }
 return {bank,pack,items};
}
export function validateCharacterInventory(raw){
 if(!record(raw)||!Number.isSafeInteger(raw.capturedAt)||raw.capturedAt<=0||raw.capturedAt>Date.now()+60000)throw Error('invalidSnapshot');
 return {capturedAt:raw.capturedAt,items:validateInventoryMap(raw.items)};
}
export function readCharacterInventory(snapshot){
 if(!record(snapshot)||snapshot.version!==2||!record(snapshot.player))throw Error('invalidSnapshot');
 const inventory=validateCharacterInventory({capturedAt:snapshot.capturedAt,items:{}});
 return {...inventory,items:readInventoryParts(snapshot.player).items};
}
