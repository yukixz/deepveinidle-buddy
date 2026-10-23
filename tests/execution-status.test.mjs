import test from 'node:test';
import assert from 'node:assert/strict';
import {readExecutionState,executionStatus} from '../src/execution-status.js';
const craft={id:41,inputs:[{itemId:1,qty:1}]},gather={id:1,inputs:[]};
const player=()=>({route:{zoneId:null,jobId:41,phase:'toBank'},queue:[],queueSlots:3,workJobId:null,workRarity:1,held:false,raidHeld:false});
const status=(value,job=craft,tier=1)=>executionStatus(readExecutionState(value),job,tier);

test('current manufacturing matches recipe and actual rarity, including travel/banking phases',()=>{
 const value=player();
 assert.equal(status(value).running,true);assert.equal(status(value,craft,0).running,false);
 assert.equal(status(value,{...craft,id:42}).running,false);
 value.workJobId=42;assert.equal(status(value).running,false);
});
test('fixed queued manufacturing matches rarity while best-first queue matches recipe',()=>{
 const value={...player(),route:null,queue:[{kind:'job',jobId:41,rarity:2}]};
 assert.equal(status(value,craft,1).queued,false);assert.equal(status(value,craft,2).queued,true);
 value.queue[0].best=true;
 assert.equal(status(value,craft,0).queued,true);assert.equal(status(value,craft,4).best,true);
});
test('active best-first manufacturing uses actual rarity rather than marking all tiers',()=>{
 const value=player();value.route.best=true;
 assert.equal(status(value,craft,1).running,true);assert.equal(status(value,craft,0).running,false);
});
test('gathering matches recipe for every planned output rarity',()=>{
 const value={...player(),route:{zoneId:null,jobId:1},queue:[{kind:'job',jobId:1,rarity:0}]};
 for(let tier=0;tier<=4;tier++){const result=status(value,gather,tier);assert.equal(result.running,true);assert.equal(result.queued,true);}
});
test('pause clears running mark while retaining queued mark and pause information',()=>{
 for(const field of ['held','raidHeld']){
  const value=player();value[field]=true;value.queue=[{kind:'job',jobId:41,rarity:1}];
  assert.deepEqual(status(value),{running:false,queued:true,best:false,held:true});
 }
});
test('non-work routes, unrelated queue entries and upgrades do not match',()=>{
 for(const route of [{zoneId:1,jobId:41},{zoneId:null,jobId:41,questId:1},null]){
  const value={...player(),route,queue:[{kind:'zone',zoneId:1},{kind:'quest',questId:1}]};
  assert.equal(status(value).running,false);assert.equal(status(value).queued,false);
 }
 assert.equal(status(player(),{id:'upgrade-1',upgrade:{}}).running,false);
});
test('missing state is unknown, not an inferred current task',()=>{
 assert.equal(readExecutionState({}),null);
 assert.equal(executionStatus(null,craft,1).running,false);
 const value=player();delete value.held;assert.equal(status(value).running,false);
 delete value.workRarity;value.held=false;assert.equal(status(value).running,false);
});
test('malformed state fails explicitly rather than claiming a queue match',()=>{
 for(const patch of [{route:[]},{queue:null},{queue:[null]},{route:{}},{queue:[{}]},{queue:[{kind:'unknown'}]},{queue:[{kind:'job',jobId:'41'}]},{queue:[{kind:'job',jobId:41,rarity:9}]},{held:1},{raidHeld:'no'},{queueSlots:-1},{workRarity:5},{workJobId:0}]){
  assert.throws(()=>readExecutionState({...player(),...patch}),/invalidExecutionState/);
 }
});
test('normalized status is detached from mutable game state and does not consume queue',()=>{
 const value=player();value.queue=[{kind:'job',jobId:41,rarity:1}];
 const state=readExecutionState(value);value.queue[0].jobId=42;value.route.jobId=42;
 assert.equal(executionStatus(state,craft,1).running,true);assert.equal(executionStatus(state,craft,1).queued,true);assert.equal(value.queue.length,1);
});
