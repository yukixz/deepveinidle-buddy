import * as game from './upstream.js';
// Pure work-calculation input. No context, seed, duration or predictor setup.
export function createWorkPlayer(state,skills,slots,tick){
 const player={lastTick:tick,skills:Object.fromEntries(game.allSkills.map(k=>[k,0])),
  equipment:Object.fromEntries(game.equipmentSlots.map(k=>[k,null])),brews:{},brewTier:{},
  masteries:{...Object.fromEntries(game.masteries.map(m=>[m.id,0])),...state.masteries},
  house:{...Object.fromEntries(game.rooms.map(r=>[r.id,0])),...state.house},houseFurniture:{},
  perks:{quick:0,hands:0,...state.perks}};
 for(const k of skills)player.skills[k]=game.levelXp(state.levels[k]);
 for(const slot of slots){const v=state.gear[slot];player.equipment[slot]=v.id?game.encode(game.withRarity(v.id,v.tier),v.plus):null;}
 for(const [id,value]of Object.entries(player.house))if(value>0)player.houseFurniture[id]={cell:0,slot:0};
 for(const [kind,tier]of Object.entries(state.brews))if(tier>=0){player.brews[kind]=Number.MAX_SAFE_INTEGER;player.brewTier[kind]=tier;}
 if(state.blessing)player.brews.blessing=Number.MAX_SAFE_INTEGER;
 return player;
}
