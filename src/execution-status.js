const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const id=value=>integer(value)&&value>0;
const rarity=value=>integer(value)&&value<=4;
const invalid=()=>{throw Error('invalidExecutionState');};

// Runtime-only state. Never restore it from order or character storage.
export function readExecutionState(player){
 if(!Object.hasOwn(player,'route')||!Object.hasOwn(player,'queue'))return null;
 if((player.route!==null&&!record(player.route))||!Array.isArray(player.queue))invalid();
 for(const key of ['held','raidHeld'])if(Object.hasOwn(player,key)&&typeof player[key]!=='boolean')invalid();
 if(Object.hasOwn(player,'queueSlots')&&!integer(player.queueSlots))invalid();
 if(Object.hasOwn(player,'workRarity')&&!rarity(player.workRarity))invalid();
 if(Object.hasOwn(player,'workJobId')&&player.workJobId!==null&&!id(player.workJobId))invalid();
 function job(task,current=false){
  if(!record(task))invalid();
  if(current){
   if(task.zoneId===undefined)invalid();
   if(task.zoneId!==null||task.questId!==undefined)return null;
  }else{
   if(!['job','zone','quest'].includes(task.kind))invalid();
   if(task.kind!=='job')return null;
  }
  if(!id(task.jobId)||(task.best!==undefined&&typeof task.best!=='boolean'))invalid();
  const tier=current?player.workRarity:task.rarity;
  if(tier!==undefined&&!rarity(tier))invalid();
  return {jobId:task.jobId,tier:tier??null,best:task.best===true};
 }
 const queued=player.queue.map(task=>job(task)).filter(Boolean);
 const current=player.route===null?null:job(player.route,true);
 const running=player.held===false&&player.raidHeld!==true&&current&&
  (player.workJobId==null||player.workJobId===current.jobId)?current:null;
 return {running,queued,queueSlots:player.queueSlots??null,held:player.held===true||player.raidHeld===true};
}

export function executionStatus(state,job,tier){
 if(!state||job.upgrade)return {running:false,queued:false,best:false,held:false};
 const gathering=job.inputs.length===0;
 const matches=(task,queued=false)=>task?.jobId===job.id&&(gathering||(queued&&task.best)||task.tier===tier);
 const queued=state.queued.filter(task=>matches(task,true));
 return {running:!!matches(state.running),queued:queued.length>0,best:queued.some(task=>task.best),held:state.held};
}
