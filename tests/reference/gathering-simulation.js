import * as game from '../../src/engine/upstream.js';
import {gatheringPlayer} from '../../src/engine/gathering-model.js';
import {START_TICK,referencePlayer,referenceWindows} from './simulation.js';
import {validateSimulationSeed} from './simulation-seed.js';
export function createGatheringScenario(raw,job,site,{maxTicks,seed=0}={}){
 const {state,player}=gatheringPlayer(raw),s={...state,worldRarity:raw.worldRarity??0,homeBank:raw.homeBank??0},p=referencePlayer(player,raw);
 if(!site||!site.jobIds.includes(job.id)||job.skill!==raw.skill)throw Error('invalidSite');
 if(s.levels[job.skill]<job.levelReq)throw Error('levelTooLow');
 if(!Number.isSafeInteger(maxTicks)||maxTicks<1)throw Error('invalidDuration');
 const durationTicks=maxTicks;
 const context={...game.createContext(game.world,validateSimulationSeed(seed)),hypothetical:true,windows:referenceWindows(s.worldRarity,START_TICK,START_TICK+durationTicks)};
 const bank=s.homeBank?game.world.bankById.get(s.homeBank):game.homeBank(context,site);
 if(!bank)throw Error('unreachable');
 p.homeBank=bank.id;p.x=bank.x;p.y=bank.y;
 return {player:p,context,durationTicks,bank,discardGathered:false};
}
