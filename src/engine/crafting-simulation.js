import * as game from './upstream.js';
import {craftingPlayer,craftingMaterials,planKey,validQuantity,safeAdd,calculateUpgrade} from './crafting-model.js';
import {manualWindows} from './manual-settings.js';
import {combatHot,combatHotWindows} from './combat-hot.js';
import {START_TICK,simulationTick} from './simulation.js';
import {validateSimulationSeed} from './simulation-seed.js';

import {beforeWork,expectedWorkRewards,expectedCraftProduct,addExpected} from './work-expectation.js';

export const MAX_CRAFT_TICKS=30*24*3600000/game.tickMs;
export function createCraftingScenario(raw,job,tier,count,{now=Date.now(),maxTicks=MAX_CRAFT_TICKS,seed=0}={}){
 if(job.upgrade)throw Error('instantUpgrade');
 if(!validQuantity(count)||count===0)throw Error('invalidQuantity');
 if(!Number.isSafeInteger(maxTicks)||maxTicks<1||maxTicks>MAX_CRAFT_TICKS)throw Error('invalidDuration');
 const {state:s,player:p}=craftingPlayer(raw);
 if(s.levels[job.skill]<job.levelReq)throw Error('levelTooLow');
 const materials=craftingMaterials(job,tier,count),context={...game.createContext(game.world,validateSimulationSeed(seed)),hypothetical:true,windows:manualWindows(START_TICK,START_TICK+maxTicks,s.weeklyXp,s.hotSetting!=='game',job.skill)};
 if(s.hotSetting==='current')context.windows.push(...combatHotWindows(combatHot(now,maxTicks*game.tickMs/3600000,job.skill)));
 let prepared;game.predict(p,context,player=>{prepared=player;return false;});
 const siteId=game.nearestWorkSite(context,job.id,prepared.x,prepared.y),site=game.world.siteById.get(siteId);
 if(!site||!site.jobIds.includes(job.id))throw Error('noSites');
 const bank=s.homeBank?game.world.bankById.get(s.homeBank):game.homeBank(context,site);
 if(!bank)throw Error('unreachable');
 prepared.homeBank=bank.id;
 // Reinitialize from the chosen depot so automatic and manual starts use the
 // same upstream predictor initialization as gathering.
 p.homeBank=bank.id;game.predict(p,context,player=>{prepared=player;return false;});
 prepared.offlineCapTicks=maxTicks*2;
 // At most one recipe can complete per tick. Supply the whole achievable
 // quantity up front, keeping upstream withdrawal sizes and bank trips intact.
 for(const i of game.recipeInputs(job,tier))prepared.bank[i.itemId]=i.qty*Math.min(count,maxTicks);
 if(!game.startWork(prepared,context,site.id,job.id,'bank',count,tier))throw Error('invalidRoute');
 return {player:prepared,context,site,bank,maxTicks,materials};
}
export function simulateCrafting(raw,job,tier,count,{onProgress=()=>{},...options}={}){
 if(job.upgrade){const result=calculateUpgrade(raw,job,tier,count);return {...result,key:planKey(job.id,tier),jobId:job.id,skill:job.skill,tier,count,materials:craftingMaterials(job,tier,count),success:count,burnt:0,movingTicks:0,workingTicks:0,deposits:0};}
 const {player:p,context,site,bank,maxTicks,materials}=createCraftingScenario(raw,job,tier,count,options),initialXp=p.skills[job.skill];
 const r={key:planKey(job.id,tier),jobId:job.id,skill:job.skill,tier,count,completed:0,success:0,burnt:0,xp:0,items:{},sampleItems:{},consumed:{},materials,elapsedTicks:0,movingTicks:0,workingTicks:0,deposits:0,siteId:site.id,homeBank:bank.id,startLevel:game.level(initialXp),endLevel:game.level(initialXp),complete:false,error:null};
 r.seed=context.seed;
 for(let tick=1;tick<=maxTicks;tick++){
  if(p.activity==='walking')r.movingTicks++;
  if(p.activity==='working')r.workingTicks++;
  const at=START_TICK+tick,before=beforeWork(p,job,at),events=[];simulationTick(p,context,at,events);
  const produced=events.find(e=>e.kind==='produced'),executed=produced||events.some(e=>e.kind==='burnt');
  if(executed){if(!before)throw Error('missingWorkState');expectedCraftProduct(r.items,job,tier,before.burn);expectedWorkRewards(r.items,p,context,job,at,before,produced);}
  for(const e of events){
   if(e.kind==='produced'||e.kind==='burnt'){
    r.completed++;if(e.kind==='burnt')r.burnt++;else r.success++;
    r.sampleItems[e.itemId]=safeAdd(r.sampleItems[e.itemId]??0,e.qty??1);
    for(const i of game.recipeInputs(job,tier))r.consumed[i.itemId]=safeAdd(r.consumed[i.itemId]??0,i.qty);
   }
   if(['bonus','pet','mount','voidshard','box'].includes(e.kind)){const id=e.kind==='box'?(e.itemId??game.lootBoxItemId):e.itemId;if(!Number.isSafeInteger(id))throw Error('invalidReward');r.sampleItems[id]=safeAdd(r.sampleItems[id]??0,e.qty??1);if(e.kind==='box')addExpected(r.items,id,e.qty??1);}
   if(e.kind==='deposited')r.deposits++;
   if(e.kind==='routeStopped'&&e.reason!=='done')r.error=`routeStopped:${e.reason}`;
  }
  r.elapsedTicks=tick;
  if(r.completed===count){r.complete=true;break;}
  if(r.error||p.route===null){r.error??='routeStopped';break;}
  if(tick%Math.max(game.predictionChunkTicks,6000)===0)onProgress({completed:r.completed,count,ticks:tick});
 }
 if(!r.complete&&!r.error)r.error='timeLimit';
 r.xp=p.skills[job.skill]-initialXp;r.endLevel=game.level(p.skills[job.skill]);return r;
}

// A completed time window is valid even though an unlimited count is unfinished.
export function simulateCraftingWindow(raw,job,tier,options={}){
 if(job.upgrade)return simulateCrafting(raw,job,tier,1,options);
 const ticks=24*3600000/game.tickMs;
 const result=simulateCrafting(raw,job,tier,ticks,{...options,maxTicks:ticks});
 if(result.error==='timeLimit'){result.error=null;result.complete=true;}
 return result;
}
