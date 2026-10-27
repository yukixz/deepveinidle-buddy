import * as game from '../src/engine/upstream.js';
import {createScenario} from './reference/simulation.js';
import {craftingSkills,craftingSlots} from '../src/engine/crafting-model.js';
import {gatheringSkills,gatheringSlots} from '../src/engine/gathering-model.js';
export function gameSnapshot(overrides={}){
 const {player}=createScenario({});
 for(const skill of [...craftingSkills,...gatheringSkills])player.skills[skill]=game.levelXp(70);
 for(const slot of [...craftingSlots,...gatheringSlots])player.equipment[slot]=null;
 Object.assign(player,{id:42,lastTick:1000000,house:{},houseFurniture:{},collections:{40:9},masteries:{},perks:{},bank:{},pack:[],route:null,queue:[],queueSlots:3,workJobId:null,workRarity:0,held:false,raidHeld:false},overrides);
 return {version:2,capturedAt:Date.now(),player,worldTick:1000000,worldBuffsVersion:1,worldBuffs:[]};
}
