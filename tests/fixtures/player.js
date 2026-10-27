import {craftingDefaults,craftingPlayer} from '../../src/engine/crafting-model.js';

// Minimal client state used by read-only synchronization and browser fixtures.
export function playerFixture(){
 return {...craftingPlayer(craftingDefaults()).player,id:1,lastTick:1000000,
  bank:{},pack:[],collections:{},houseFurniture:{},route:null,queue:[],queueSlots:3,
  workJobId:null,workRarity:0,held:false,raidHeld:false};
}
