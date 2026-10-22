import * as game from './upstream.js';
import {gatheringPlayer,selectedGatheringSites} from './gathering-model.js';
import {simulationTicks,combatHot,combatHotWindows} from './combat-hot.js';
import {manualWindows} from './manual-settings.js';
import {dropValue,START_TICK,simulationTick} from './simulation.js';
import {validateSimulationSeed} from './simulation-seed.js';
import {beforeWork,workQualities,expectedWorkRewards,addExpected} from './work-expectation.js';
const add=(items,id,qty)=>{items[id]=(items[id]??0)+qty;};
const metrics=['completed','attempts','caught','stunnedTicks','xp','coins','normal','rare','elapsedTicks','workingTicks','movingTicks','deposits'];
export function createGatheringScenario(raw,job,site,{now=Date.now(),seed=0}={}){
 const {state:s,player:p}=gatheringPlayer(raw);
 if(!site||!site.jobIds.includes(job.id)||job.skill!==s.skill)throw Error('invalidSite');
 if(s.levels[job.skill]<job.levelReq)throw Error('levelTooLow');
 const durationTicks=simulationTicks(s.simulationHours);
 const context={...game.createContext(game.world,validateSimulationSeed(seed)),hypothetical:true,windows:manualWindows(START_TICK,START_TICK+durationTicks,s.weeklyXp,s.hotSetting!=='game',job.skill,s.worldRarity)};
 if(s.hotSetting==='current')context.windows.push(...combatHotWindows(combatHot(now,s.simulationHours,job.skill)));
 const bank=s.homeBank?game.world.bankById.get(s.homeBank):game.homeBank(context,site);
 if(!bank)throw Error('unreachable');
 p.homeBank=bank.id;p.x=bank.x;p.y=bank.y;
 return {player:p,context,durationTicks,bank,discardGathered:s.discardGathered};
}
export function simulateGatheringSite(raw,job,site,options={}){
 const scenario=createGatheringScenario(raw,job,site,options),{context,durationTicks,bank,discardGathered}=scenario;
 let p;game.predict(scenario.player,context,prepared=>{p=prepared;return false;});
 p.offlineCapTicks=durationTicks*2;
 if(!game.startWork(p,context,site.id,job.id,discardGathered?'drop':'bank',null))throw Error('invalidRoute');
 const initialXp=p.skills[job.skill];
 const result={siteId:site.id,x:site.x,y:site.y,homeBank:bank.id,durationTicks,normalItems:{},rareItems:{},sampleItems:{},startLevel:game.level(initialXp),endedEarly:false,...Object.fromEntries(metrics.map(k=>[k,0]))};
 result.seed=context.seed;
 // Only the main product and recipe bonus are discarded. Keep their current
 // pack segment separate from stored goods and non-discardable rewards.
 let pendingNormal={},pendingBonus={};
 const retainPending=()=>{
  for(const [id,qty]of Object.entries(pendingNormal))addExpected(result.normalItems,id,qty);
  for(const [id,qty]of Object.entries(pendingBonus))addExpected(result.rareItems,id,qty);
  pendingNormal={};pendingBonus={};
 };
 for(let tick=1;tick<=durationTicks;tick++){
  if(p.activity==='walking')result.movingTicks++;
  if(p.activity==='working'){if(START_TICK+tick<p.stunUntil)result.stunnedTicks++;else result.workingTicks++;}
  const at=START_TICK+tick,before=beforeWork(p,job,at),events=[];simulationTick(p,context,at,events);
  const produced=events.find(e=>e.kind==='produced');
  if(produced){
   if(produced.itemId===game.coinItemId)result.coins+=job.output.qty;
   else workQualities(p,context,job,at).forEach((prob,tier)=>addExpected(discardGathered?pendingNormal:result.normalItems,game.withRarity(job.output.itemId,tier),job.output.qty*prob));
   if(discardGathered){
    const rewards={};expectedWorkRewards(rewards,p,context,job,at,before,produced);
    for(const [id,qty]of Object.entries(rewards))addExpected(job.bonus&&game.baseItemId(Number(id))===game.baseItemId(job.bonus.itemId)?pendingBonus:result.rareItems,id,qty);
   }else expectedWorkRewards(result.rareItems,p,context,job,at,before,produced);
  }
  for(const e of events){
   if(e.kind==='produced'){result.completed++;result.attempts++;add(result.sampleItems,e.itemId,e.qty??1);}
   if(e.kind==='caught'){result.caught++;result.attempts++;}
   if(e.kind==='deposited'){result.deposits++;if(discardGathered)retainPending();}
   if(e.kind==='dropped'&&discardGathered){pendingNormal={};pendingBonus={};}
   if(['bonus','pet','mount','voidshard','box'].includes(e.kind)){const id=e.kind==='box'?(e.itemId??game.lootBoxItemId):e.itemId;if(!Number.isSafeInteger(id))throw Error('invalidReward');add(result.sampleItems,id,e.qty??1);if(e.kind==='box')addExpected(result.rareItems,id,e.qty??1);}
   if(e.kind==='routeStopped'&&!['done'].includes(e.reason))throw Error(`routeStopped:${e.reason}`);
  }
  result.elapsedTicks=tick;
  if(tick%game.predictionChunkTicks===0&&p.route===null){result.endedEarly=true;break;}
 }
 if(discardGathered)retainPending();
 result.normal=Object.values(result.normalItems).reduce((a,b)=>a+b,0);result.rare=Object.values(result.rareItems).reduce((a,b)=>a+b,0);
 result.xp=p.skills[job.skill]-initialXp;result.endLevel=game.level(p.skills[job.skill]);
 result.normalValue=dropValue(result.normalItems);result.rareValue=dropValue(result.rareItems);result.totalIncome=result.coins+result.normalValue+result.rareValue;
 return result;
}
export function averageGatheringSites(results,expectedCount=results.length){
 if(!results.length||results.length!==expectedCount)throw Error('incompleteSites');
 const durationTicks=results[0].durationTicks;
 if(results.some(r=>r.error||r.durationTicks!==durationTicks)||new Set(results.map(r=>r.siteId)).size!==results.length)throw Error('incompleteSites');
 if(results.some(r=>r.seed!==results[0].seed))throw Error('inconsistentSeeds');
 const result={seed:results[0].seed,durationTicks,siteCount:results.length,sites:results,normalItems:{},rareItems:{},endedEarly:results.some(r=>r.endedEarly),startLevel:results[0].startLevel,endLevelMin:Math.min(...results.map(r=>r.endLevel)),endLevelMax:Math.max(...results.map(r=>r.endLevel))};
 for(const key of metrics){if(results.some(r=>!Number.isFinite(r[key])||r[key]<0))throw Error('invalidResult');result[key]=results.reduce((sum,r)=>sum+r[key],0)/results.length;}
 for(const key of ['normalItems','rareItems'])for(const r of results)for(const [id,qty]of Object.entries(r[key])){if(!Number.isFinite(qty)||qty<0)throw Error('invalidResult');add(result[key],id,qty/results.length);}
 result.movingRatio=result.elapsedTicks?result.movingTicks/result.elapsedTicks:null;
 result.normalValue=dropValue(result.normalItems);result.rareValue=dropValue(result.rareItems);result.totalIncome=result.coins+result.normalValue+result.rareValue;
 return result;
}
export function simulateGatheringJob(raw,job,{onSite=()=>{},...options}={}){
 const sites=selectedGatheringSites(raw,job);if(!sites.length)throw Error('noSites');
 const results=[];
 for(const site of sites){try{const r=simulateGatheringSite(raw,job,site,options);results.push(r);onSite(r);}catch(error){onSite({siteId:site.id,x:site.x,y:site.y,error:String(error.message??error)});throw error;}}
 return {key:`job-${job.id}`,jobId:job.id,...averageGatheringSites(results,sites.length)};
}
