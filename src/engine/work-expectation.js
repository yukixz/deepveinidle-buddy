import * as game from './upstream.js';
import {toolSlots} from './gathering-model.js';
import {rarityProbabilities} from './combat-expectation.js';

export function addExpected(items,id,quantity){
 if(!Number.isFinite(quantity)||quantity<0)throw Error('invalidResult');
 const total=(items[id]??0)+quantity;
 if(!Number.isFinite(total)||total>Number.MAX_SAFE_INTEGER)throw Error('quantityOverflow');
 if(quantity>0)items[id]=total;
}

// Only bonus-bearing recipes need a pack snapshot. Character equipment and
// rarity modifiers stay unchanged by a work action; burn probability does not.
export function beforeWork(player,job,tick){
 if(player.activity!=='working'||player.workJobId!==job.id||tick<player.stunUntil)return null;
 return {burn:game.burnChance(job,player),pack:job.bonus?player.pack.map(i=>({...i})):null};
}

export function workQualities(player,context,job,tick){
 const equipped=player.equipment[toolSlots[job.skill]];
 const luck=(equipped==null?0:game.toolLuck(equipped))+game.equipmentLuck(player.equipment);
 const multiplier=(1+luck)*game.combine(game.windowModifiers(context.windows,tick).rarityMult,game.brewRarityMultiplier(player),game.hotRarityMultiplier(tick,job.skill,context.hypothetical),game.houseRarityMultiplier(player),game.masteryMultiplier(player.masteries,'rare'));
 return rarityProbabilities(multiplier);
}

export function expectedWorkRewards(items,player,context,job,tick,before,produced){
 if(!produced)return; // Burns and catches return before every reward check.
 if(!player.ironman){
  const chance=game.mountChance(1/game.workChance(job,player));
  rarityProbabilities(1+game.equipmentLuck(player.equipment),game.mountRarityThresholds).forEach((p,tier)=>addExpected(items,game.withRarity(game.mountItemId,tier),chance*p));
 }
 const pet=game.skillPet(job.skill);
 if(pet)addExpected(items,pet.itemId,game.skillPetChance(job.skill));
 if(!job.bonus)return;
 if(!before?.pack)throw Error('missingWorkState');
 const atBonus={...player,pack:before.pack.map(i=>({...i}))};
 // Reconstruct the exact pack after material consumption and the sampled main
// product, before bonus/pet insertion. Mounts and boxes go directly to storage.
 for(const input of game.recipeInputs(job,player.workRarity)){
  let remaining=input.qty;
  for(let i=atBonus.pack.length-1;i>=0&&remaining>0;i--){const item=atBonus.pack[i];if(item.itemId!==input.itemId)continue;const n=Math.min(item.qty,remaining);remaining-=n;item.qty-=n;if(item.qty===0)atBonus.pack.splice(i,1);}
  if(remaining)throw Error('missingWorkMaterials');
 }
 if(produced.itemId!==game.coinItemId)game.addPack(atBonus,produced.itemId,produced.qty??1);
 const qualities=game.itemSupportsRarity(job.bonus.itemId)?workQualities(player,context,job,tick):[1];
 qualities.forEach((p,tier)=>{
  const quality=game.bonusMinimumUncommon(job.bonus.itemId)?Math.max(1,tier):tier;
  const id=game.itemSupportsRarity(job.bonus.itemId)?game.withRarity(job.bonus.itemId,quality):job.bonus.itemId;
  const candidate={...atBonus,pack:atBonus.pack.map(i=>({...i}))};
  if(game.addPack(candidate,id,1))addExpected(items,id,job.bonus.chance*p);
 });
}

export function expectedCraftProduct(items,job,tier,burn){
 addExpected(items,game.recipeOutput(job,tier),(1-burn)*job.output.qty);
 if(job.burn)addExpected(items,job.burn.itemId,burn);
}
