import * as game from './engine/upstream.js';
import {craftingMaterials} from './engine/crafting-model.js';
import {collectionPlayers,collectionPrice} from './engine/collection-model.js';
import {expectedCraftProduct} from './engine/work-expectation.js';
const checked=value=>{if(!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER)throw Error('quantityOverflow');return value;};
export function estimateCraftAction(state,job,count,players=collectionPlayers(state)){
 if(!Number.isSafeInteger(count)||count<=0)throw Error('invalidQuantity');
 if(!state.initialized)return {status:'uninitialized',seconds:null};
 if(state.config.levels[job.skill]<job.levelReq)return {status:'levelTooLow',seconds:null};
 const chance=job.upgrade?1:game.workChance(job,players.craft);
 if(!Number.isFinite(chance)||chance<=0)return {status:'unreachable',seconds:null};
 return {status:'ok',seconds:job.upgrade?0:checked(count*(game.tickMs/1000)/chance)};
}
function valueItems(items,prices,side){
 let total=0,missing=false;
 for(const [id,qty]of Object.entries(items)){
  checked(qty);const price=collectionPrice(Number(id),prices,side).price;
  if(qty>0&&price===null)missing=true;
  else total=checked(total+checked(qty*(price??0)));
 }
 return missing?null:total;
}
export function estimateCraftRecipe(state,job,tier,prices,players=collectionPlayers(state),productPriceMode='bid'){
 if(!['ask','bid'].includes(productPriceMode))throw Error('invalidPriceMode');
 const materials=craftingMaterials(job,tier,1),cost=valueItems(materials,prices,state.buyMode),action=estimateCraftAction(state,job,1,players);
 if(action.status!=='ok')return {...action,materials,cost,productValue:null};
 const products={};
 if(job.upgrade){const id=game.upgradeResult(job.upgrade,game.withRarity(job.upgrade.from[0],tier));if(id===null)throw Error('invalidUpgradeResult');products[id]=1;}
 else {const burn=game.burnChance(job,players.craft);if(!Number.isFinite(burn)||burn<0||burn>1)throw Error('invalidResult');expectedCraftProduct(products,job,tier,burn);}
 return {...action,materials,cost,products,productValue:valueItems(products,prices,productPriceMode)};
}
