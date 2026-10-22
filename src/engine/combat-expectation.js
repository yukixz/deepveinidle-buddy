import {game} from './model.js';

const UINT32_RANGE=2**32;
const add=(items,id,qty)=>{if(qty>0)items[id]=(items[id]??0)+qty;};

export function rarityProbabilities(multiplier,thresholds=game.rarityThresholds){
 const cumulative=['uncommon','rare','epic','legendary'].map(key=>Math.min(1,Math.max(0,thresholds[key]*multiplier)));
 return [1-cumulative[0],cumulative[0]-cumulative[1],cumulative[1]-cumulative[2],cumulative[2]-cumulative[3],cumulative[3]];
}

export function expectedGold(monster,multiplier){
 const [min,max]=monster.gold,range=max-min+1,base=Math.floor(UINT32_RANGE/range),extra=UINT32_RANGE%range;
 let total=0;
 for(let offset=0;offset<range;offset++)total+=Math.floor((min+offset)*multiplier)*(base+(offset<extra?1:0))/UINT32_RANGE;
 return total;
}

export function createCombatExpectation(monster){
 const goldCache=new Map();
 return {
  kill(result,player,context,tick){
   const goldMultiplier=1+game.abyssalGoldBonus*game.brewScale(player,'abyssal');
   if(!goldCache.has(goldMultiplier))goldCache.set(goldMultiplier,expectedGold(monster,goldMultiplier));
   result.coins+=goldCache.get(goldMultiplier);
   const luck=game.equipmentLuck(player.equipment),rare=game.combatRarityMultiplier(player,context,tick);
   const normalChance=monster.dropChance??1;
   const qualities=rarityProbabilities((1+luck)*game.combine(rare,game.houseRarityMultiplier(player)));
   qualities.forEach((chance,tier)=>add(result.normalItems,game.withRarity(monster.drop,tier),normalChance*chance));
   add(result.rareItems,monster.bonus.itemId,Math.min(1,monster.bonus.chance*(1+luck)*rare));
   add(result.rareItems,game.combatPetItem(monster.id),game.combatPetChance);
   add(result.rareItems,game.voidShardItemId,game.voidShardChance(monster.level)*game.voidShardQuantity(monster.level));
  },
  attack(result,player){
   if(player.ironman)return;
   const chance=game.mountChance(game.baseAttackTicks(player));
   const qualities=rarityProbabilities(1+game.equipmentLuck(player.equipment),game.mountRarityThresholds);
   qualities.forEach((quality,tier)=>add(result.rareItems,game.withRarity(game.mountItemId,tier),chance*quality));
  },
 };
}
