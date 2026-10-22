import {game,potions} from './model.js';
// Scope: static combat and independent combat routes, without gathering/crafting.
// Keep upstream data and saved fields intact; filter only the settings shown.
export const combatPotions=potions.filter(p=>p.kind!=='gatherer');
export const combatRooms=game.rooms.filter(r=>['combatXp','skillXp','dmg','rareChance','bankSlots'].includes(r.bonus.kind));
export const combatMasteries=game.masteries.filter(m=>['xp','move','hp','maxhit','accuracy','rare'].includes(m.id));
export const combatPerks=game.perks.filter(p=>['pockets','rest','meals'].includes(p.id));
