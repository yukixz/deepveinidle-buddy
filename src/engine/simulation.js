import {DAY_TICKS,simulationTicks,combatHot,combatHotWindows} from './combat-hot.js';
import {manualWindows} from './manual-settings.js';
import {game,makePlayer} from './model.js';
import {combatPotions} from './combat-options.js';
import {validateSimulationSeed} from './simulation-seed.js';
import {createCombatExpectation} from './combat-expectation.js';
export const HOUR_TICKS=3600000/game.tickMs;
export {DAY_TICKS};
export const TRIALS=1;
export const START_TICK=game.predictionStartTick;
const add=(obj,key,amount=1)=>{obj[key]=(obj[key]??0)+amount;};

// Synthetic builds have no account quests, including after a daily reset.
export function simulationTick(player,context,tick,events){
 player.quests.day=game.questDay(tick);player.quests.week=game.questWeek(tick);
 game.tick(player,context,tick,events);
}

export function createScenario(raw,monster=null,{now=Date.now(),seed=0}={}){
 if(raw?.format)throw Error('Unsupported simulation format');
 const {state,player:p}=makePlayer(raw),zone=monster&&game.world.zones.find(z=>z.monsterId===monster.id);
 if(monster&&!zone)throw Error('No combat zone for monster '+monster.id);
 const target=zone?game.combatTargetTile(zone,state.manual.playerId):game.world.banks[0];
 const bank=state.homeBank?game.world.bankById.get(state.homeBank):game.homeBank({world:game.world},target);
 if(!bank)throw Error('No starting depot');
 const durationTicks=simulationTicks(state.manual.simulationHours);
 const foodId=game.withRarity(state.food.id,state.food.tier);
 Object.assign(p,{
  id:state.manual.playerId,x:bank.x,y:bank.y,homeBank:bank.id,skills:{...Object.fromEntries(game.allSkills.map(k=>[k,0])),...p.skills},
  pack:[],bank:{[foodId]:1e9},overflow:{},bankOrder:[],bankLocked:[],route:null,enhance:null,order:null,plots:{},queue:[],tunics:[],guide:{},
  perks:{quick:0,rest:0,pockets:0,hands:0,...p.perks},housePoints:{},houseCells:[],houseBuild:null,houseUpgrades:{},
  quests:{day:0,week:0,daily:[],weekly:[]},path:null,streak:{},tally:{items:{},monsters:{},coinsEarned:0},collection:{},collections:{},forgeLog:{},achievements:{},titles:[],
  coins:state.manual.coins,hp:game.maxHp(p),unlimitedBank:state.manual.unlimitedBank,bankSlotsBought:state.manual.bankSlotsBought,offlineCapTicks:durationTicks*2,foodMaxTier:state.manual.foodMaxTier,foodItemId:state.manual.foodRule===0?foodId:state.manual.foodRule===2?-2:null,foodPerTrip:state.manual.foodPerTrip,eatAt:state.eatAt/100,
  ironman:state.manual.ironman,activity:'idle',pathIndex:0,stride:0,strideSpeed:1000,actionIndex:0,rollIndex:{},foeIndex:null,foeHp:0,foeTicks:0,attemptTicks:0,stunUntil:0,workSiteId:null,workJobId:null,
 });
 const m=state.manual;
 if(m.foodRule===3)p.eatAt=0;
 const context={...game.createContext(game.world,validateSimulationSeed(seed)),windows:manualWindows(START_TICK,START_TICK+durationTicks,m.weeklyXp,m.hotSetting!=='game','combat',m.worldRarity),hypothetical:true};
 if(m.hotSetting==='current')context.windows.push(...combatHotWindows(combatHot(now,m.simulationHours)));
 return {player:p,context,durationTicks};
}

export function dropValue(items){
 return Object.entries(items).reduce((total,[id,qty])=>total+(game.canSell(Number(id))?game.vendorPrice(Number(id))*qty:0),0);
}

export function simulateMonster(raw,monster,options={}){
 const scenario=createScenario(raw,monster,options),context=scenario.context,durationTicks=scenario.durationTicks;
 let p;
 // Reuse all original predictor initialization without modifying its source.
 game.predict(scenario.player,context,prepared=>{p=prepared;return false;});
 p.offlineCapTicks=durationTicks*2;
 const zone=game.world.zones.find(z=>z.monsterId===monster.id);
 if(!zone||!game.startFight(p,context,zone.id))throw Error('No combat route for monster '+monster.id);
 const initialSkills={...p.skills};
 const potionItems=Object.fromEntries(combatPotions.filter(b=>(p.brews[b.kind]??0)>0).map(b=>[game.withRarity(b.itemId,p.brewTier[b.kind]??0),durationTicks/HOUR_TICKS]));
 const result={key:`monster-${monster.id}`,trials:1,durationTicks,homeBank:game.homeBank(context,p)?.id??null,kills:0,attacks:0,xp:0,coins:0,normal:0,rare:0,food:0,deaths:0,bySkill:{},normalItems:{},rareItems:{},foodItems:{},potionItems:{},elapsedTicks:0,movingTicks:0,restocks:0,endedEarly:false};
 const expectation=createCombatExpectation(monster);
 result.seed=context.seed;
 for(let tick=1;tick<=durationTicks;tick++){
  if(p.activity==='walking')result.movingTicks++;
  const events=[];
  simulationTick(p,context,START_TICK+tick,events);
  for(const e of events){
   if(e.kind==='killed'){result.kills++;expectation.kill(result,p,context,START_TICK+tick);}
   if(e.kind==='hit'&&e.by==='player'){result.attacks++;expectation.attack(result,p);}
   if(e.kind==='ate'){result.food++;add(result.foodItems,e.itemId);}
   if(e.kind==='died')result.deaths++;
   if(e.kind==='withdrew')result.restocks++;
  }
  result.elapsedTicks=tick;
  if(tick%game.predictionChunkTicks===0&&(result.deaths>0||p.route===null)){result.endedEarly=true;break;}
 }
 for(const [skill,xp]of Object.entries(initialSkills)){const gain=p.skills[skill]-xp;if(gain){result.bySkill[skill]=gain;result.xp+=gain;}}
 result.potionItems=potionItems;
 result.normal=Object.values(result.normalItems).reduce((sum,qty)=>sum+qty,0);
 result.rare=Object.values(result.rareItems).reduce((sum,qty)=>sum+qty,0);
 result.normalValue=dropValue(result.normalItems);
 result.rareValue=dropValue(result.rareItems);
 result.totalIncome=result.coins+result.normalValue+result.rareValue;
 return result;
}
