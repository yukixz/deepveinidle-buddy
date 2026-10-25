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
 for(const [id,qty]of Object.entries(pack))if(!Number.isSafeInteger((bank[id]??0)+qty))throw Error('invalidSnapshot');
 return {bank,pack};
}
