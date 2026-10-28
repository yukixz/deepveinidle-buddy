import * as game from './upstream.js';
import {toolSlots} from './gathering-model.js';
import {rarityProbabilities} from './rarity-probabilities.js';

export function addExpected(items,id,quantity){
 if(!Number.isFinite(quantity)||quantity<0)throw Error('invalidResult');
 const total=(items[id]??0)+quantity;
 if(!Number.isFinite(total)||total>Number.MAX_SAFE_INTEGER)throw Error('quantityOverflow');
 if(quantity>0)items[id]=total;
}

export function workQualities(player,job,tick,worldRarity){
 if(job.plain)return [1,0,0,0,0];
 const equipped=player.equipment[toolSlots[job.skill]];
 const luck=(equipped==null?0:game.toolLuck(equipped))+game.equipmentLuck(player.equipment);
 const multiplier=(1+luck)*game.combine(1+worldRarity/100,game.brewRarityMultiplier(player),game.hotRarityMultiplier(tick,job.skill),game.houseRarityMultiplier(player),game.masteryMultiplier(player.masteries,'rare'));
 return rarityProbabilities(multiplier);
}

export function expectedCraftProduct(items,job,tier,burn){
 addExpected(items,game.recipeOutput(job,tier),(1-burn)*job.output.qty);
 if(job.burn)addExpected(items,job.burn.itemId,burn);
}
