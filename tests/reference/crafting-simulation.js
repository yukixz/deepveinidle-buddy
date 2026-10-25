import * as game from '../../src/engine/upstream.js';
import {craftingPlayer,craftingMaterials,validQuantity,safeAdd} from '../../src/engine/crafting-model.js';
import {START_TICK,simulationTick,referencePlayer} from './simulation.js';
import {validateSimulationSeed} from './simulation-seed.js';


const planKey=(jobId,tier)=>`${jobId}:${tier}`;
export const MAX_CRAFT_TICKS=30*24*3600000/game.tickMs;
export function createCraftingScenario(raw,job,tier,count,{maxTicks=MAX_CRAFT_TICKS,seed=0}={}){
 if(job.upgrade)throw Error('instantUpgrade');
 if(!validQuantity(count)||count===0)throw Error('invalidQuantity');
 if(!Number.isSafeInteger(maxTicks)||maxTicks<1||maxTicks>MAX_CRAFT_TICKS)throw Error('invalidDuration');
 const {state,player}=craftingPlayer(raw),s={...state,homeBank:raw.homeBank??0},p=referencePlayer(player,raw);
 if(s.levels[job.skill]<job.levelReq)throw Error('levelTooLow');
 const materials=craftingMaterials(job,tier,count),context={...game.createContext(game.world,validateSimulationSeed(seed)),hypothetical:true,windows:[]};
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
 const {player:p,context,site,bank,maxTicks,materials}=createCraftingScenario(raw,job,tier,count,options),initialXp=p.skills[job.skill];
 const r={key:planKey(job.id,tier),jobId:job.id,skill:job.skill,tier,count,completed:0,success:0,burnt:0,xp:0,sampleItems:{},consumed:{},materials,elapsedTicks:0,movingTicks:0,workingTicks:0,deposits:0,siteId:site.id,homeBank:bank.id,startLevel:game.level(initialXp),endLevel:game.level(initialXp),complete:false,error:null};
 r.seed=context.seed;
 for(let tick=1;tick<=maxTicks;tick++){
  if(p.activity==='walking')r.movingTicks++;
  if(p.activity==='working')r.workingTicks++;
  const events=[];simulationTick(p,context,START_TICK+tick,events);
  for(const e of events){
   if(e.kind==='produced'||e.kind==='burnt'){
    r.completed++;if(e.kind==='burnt')r.burnt++;else r.success++;
    r.sampleItems[e.itemId]=safeAdd(r.sampleItems[e.itemId]??0,e.qty??1);
    for(const i of game.recipeInputs(job,tier))r.consumed[i.itemId]=safeAdd(r.consumed[i.itemId]??0,i.qty);
   }
   if(['bonus','pet','mount','voidshard','box'].includes(e.kind)){const id=e.kind==='box'?(e.itemId??game.lootBoxItemId):e.itemId;if(!Number.isSafeInteger(id))throw Error('invalidReward');r.sampleItems[id]=safeAdd(r.sampleItems[id]??0,e.qty??1);}
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
