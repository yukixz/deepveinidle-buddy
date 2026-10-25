import * as game from './engine/upstream.js';
import {gatheringSkills} from './engine/gathering-model.js';
import {addExpected,expectedCraftProduct,workQualities} from './engine/work-expectation.js';

export function plannedProducts(job,tier,count,players){
 if(!Number.isSafeInteger(count)||count<=0)throw Error('invalidQuantity');
 const perAction={};
 if(job.upgrade){
  const id=game.upgradeResult(job.upgrade,game.withRarity(job.upgrade.from[0],tier));
  if(id===null)throw Error('invalidUpgradeResult');
  perAction[id]=1;
 }else{
  const gathering=gatheringSkills.includes(job.skill),player=players[gathering?'gather':'craft'];
  const burn=game.burnChance(job,player),caught=game.caughtChance(job,player);
  if(![burn,caught].every(value=>Number.isFinite(value)&&value>=0&&value<=1))throw Error('invalidResult');
  if(!gathering)expectedCraftProduct(perAction,job,tier,burn);
  else{
   let qualities=[1];
   if(game.itemSupportsRarity(job.output.itemId)){
    qualities=workQualities(player,job,players.tick,players.worldRarity);
   }
   qualities.forEach((quality,rarity)=>addExpected(perAction,game.withRarity(job.output.itemId,rarity),(1-burn)*(1-caught)*quality*job.output.qty));
   if(job.burn)addExpected(perAction,job.burn.itemId,burn);
  }
 }
 const products={};
 for(const [id,amount]of Object.entries(perAction))addExpected(products,Number(id),amount*count);
 return products;
}
