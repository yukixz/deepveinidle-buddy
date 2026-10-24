import * as game from './engine/upstream.js';
import {gatheringSkills} from './engine/gathering-model.js';
import {addExpected,expectedCraftProduct,workQualities} from './engine/work-expectation.js';
import {manualWindows} from './engine/manual-settings.js';
import {epoch} from './engine/hot-forecast.js';

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
    // Use the same instant and modifiers as estimateCollection.
    const config=players.configs.gather;
    const at=config.hotSetting==='current'?Math.floor((players.now-epoch)/game.tickMs):game.predictionStartTick;
    const context={hypothetical:true,windows:manualWindows(at,at,config.weeklyXp,config.hotSetting==='off',job.skill,config.worldRarity??0)};
    qualities=workQualities(player,context,job,at);
   }
   qualities.forEach((quality,rarity)=>addExpected(perAction,game.withRarity(job.output.itemId,rarity),(1-burn)*(1-caught)*quality*job.output.qty));
   if(job.burn)addExpected(perAction,job.burn.itemId,burn);
  }
 }
 const products={};
 for(const [id,amount]of Object.entries(perAction))addExpected(products,Number(id),amount*count);
 return products;
}
