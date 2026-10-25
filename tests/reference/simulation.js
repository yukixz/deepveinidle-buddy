import * as game from '../../src/engine/upstream.js';
import {craftingDefaults,craftingPlayer} from '../../src/engine/crafting-model.js';
export const START_TICK=game.predictionStartTick;
export function referencePlayer(player,raw={}){
 const bank=game.world.bankById.get(raw.homeBank)||game.world.banks[0];
 const result={id:1,x:bank.x,y:bank.y,overflow:{},bankOrder:[],bankLocked:[],route:null,enhance:null,order:null,plots:{},queue:[],tunics:[],guide:{},
  housePoints:{},houseCells:[],houseBuild:null,houseUpgrades:{},quests:{day:0,week:0,daily:[],weekly:[]},path:null,streak:{},
  tally:{items:{},monsters:{},coinsEarned:0},collection:{},collections:{},forgeLog:{},achievements:{},titles:[],coins:0,hp:100,
  unlimitedBank:true,bankSlotsBought:0,offlineCapTicks:0,foodMaxTier:4,foodItemId:null,foodPerTrip:-1,
  activity:'idle',pathIndex:0,stride:0,strideSpeed:1000,actionIndex:0,rollIndex:{},foeIndex:null,foeHp:0,foeTicks:0,attemptTicks:0,
  stunUntil:0,workSiteId:null,workJobId:null,...structuredClone(player),lastTick:START_TICK,homeBank:bank.id,bank:{},pack:[],eatAt:0,fallback:null,guildBonus:0,ironman:false,
  masteries:player.masteries,perks:{meals:0,pockets:0,rest:0,...player.perks},brews:{...player.brews},brewTier:{...player.brewTier}};
 return result;
}
export function createScenario(){return {player:referencePlayer(craftingPlayer(craftingDefaults()).player)};}
export function simulationTick(player,context,tick,events){
 player.quests.day=game.questDay(tick);player.quests.week=game.questWeek(tick);game.tick(player,context,tick,events);
}
export function referenceWindows(worldRarity,start,end){
 return worldRarity?[{fromTick:start,toTick:end,rarityMult:1+worldRarity/100}]:[];
}
