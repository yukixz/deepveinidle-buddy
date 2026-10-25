import * as game from '../../src/engine/upstream.js';
import {collectionWorkConfig,collectionTarget,collectionRoutes,pointsForProduction} from '../../src/engine/collection-model.js';
import {gatheringSkills} from '../../src/engine/gathering-model.js';
import {createCraftingScenario,MAX_CRAFT_TICKS} from './crafting-simulation.js';
import {createGatheringScenario} from './gathering-simulation.js';
import {START_TICK,simulationTick,referenceWindows} from './simulation.js';

export function simulateCollection(state,id,jobId,{target:goal,seed=0,maxTicks=MAX_CRAFT_TICKS,onProgress=()=>{}}={}){
 if(!Number.isSafeInteger(maxTicks)||maxTicks<1||maxTicks>MAX_CRAFT_TICKS)throw Error('invalidDuration');
 const job=collectionRoutes(id).find(j=>j.id===jobId),target=collectionTarget(state,id,goal);
 if(!state.initialized||!job||target.complete)throw Error('invalidTarget');
 const gathering=gatheringSkills.includes(job.skill),tier=game.itemTier(id),config=collectionWorkConfig(state,gathering?'gather':'craft');
 let p,context;
 if(gathering){
  // Choose the original nearest legal site from the configured depot.
  const gatheringConfig={...config,skill:job.skill};
  const initial=game.world.bankById.get(gatheringConfig.homeBank)||game.world.banks[0];
  const site=game.world.siteById.get(game.nearestWorkSite(game.createContext(game.world,seed),job.id,initial.x,initial.y));
  if(!site)throw Error('noSites');
  const scenario=createGatheringScenario(gatheringConfig,job,site,{seed,maxTicks});context=scenario.context;
  game.predict(scenario.player,context,prepared=>{p=prepared;return false;});
  p.offlineCapTicks=maxTicks*2;
  if(!game.startWork(p,context,site.id,job.id,'bank',null))throw Error('invalidRoute');
 }else{
  const scenario=createCraftingScenario(config,job,tier,maxTicks,{seed,maxTicks});p=scenario.player;context=scenario.context;
 }
 context.windows=referenceWindows(config.worldRarity,START_TICK,START_TICK+maxTicks);
 const initialXp=p.skills[job.skill];
 const result={id,jobId,seed,startLevel:game.level(initialXp),quantity:0,attempts:0,elapsedTicks:0,materials:{},outputs:{},complete:false,points:0,seconds:null,secondsPerPoint:null,error:null};
 for(let tick=1;tick<=maxTicks;tick++){
  const events=[];simulationTick(p,context,START_TICK+tick,events);
  for(const event of events){
   if(['produced','burnt','caught'].includes(event.kind))result.attempts++;
   if(event.kind==='produced'||event.kind==='burnt'){
    for(const input of game.recipeInputs(job,tier))result.materials[input.itemId]=(result.materials[input.itemId]??0)+input.qty;
    // Keep actual main and burnt outputs for offline event regression.
    if(event.itemId!==game.coinItemId){result.outputs[event.itemId]=(result.outputs[event.itemId]??0)+(event.qty??1);}
    if(event.kind==='produced'&&event.itemId===id)result.quantity+=event.qty??1;
   }
   if(event.kind==='routeStopped'&&event.reason!=='done')result.error=`routeStopped:${event.reason}`;
  }
  result.elapsedTicks=tick;
  if(result.quantity>=target.missing){result.complete=true;break;}
  if(result.error||p.route===null){result.error??='routeStopped';break;}
  if(tick%6000===0)onProgress({ticks:tick,quantity:result.quantity,target:target.missing});
 }
 result.seconds=result.elapsedTicks*game.tickMs/1000;result.xp=p.skills[job.skill]-initialXp;result.endLevel=game.level(p.skills[job.skill]);
 result.points=pointsForProduction(id,target.current,result.quantity);
 if(result.complete)result.secondsPerPoint=result.seconds/result.points;else result.error??='timeLimit';
 return result;
}
