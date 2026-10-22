export function createStore({get,set,subscribe},key,validate){
 let revision=0,blocked=false,pending=null,writing=false,remote=false,disposed=false,flushWaiters=[];
 const writer=crypto.randomUUID();let unsubscribe=()=>{};
 return {
  async load(){const saved=await get(key,null);if(saved===null)return null;
   try{const value=validate(saved);revision=value.revision;blocked=remote=false;return value;}catch(error){blocked=true;throw error;}
  },
  watch(onConflict){unsubscribe=subscribe?.(key,value=>{if(value===null||value.writer!==writer&&value.revision>=revision){remote=true;onConflict();}})??(()=>{});},
  async save(value){
   if(blocked||remote)throw Error('storageBlocked');
   pending=structuredClone(value);if(writing)return;
   writing=true;
   try{while(pending&&!disposed){
    const next=pending;pending=null;const current=await get(key,null);
    if(current===null?revision!==0:current.revision!==revision) {remote=true;throw Error('storageConflict');}
    next.revision=revision+1;
    await set(key,{...next,writer});revision=next.revision;
   }}catch(error){pending=null;blocked=true;throw error;}finally{writing=false;for(const resolve of flushWaiters)resolve();flushWaiters=[];}
  },
  async reset(){if(writing)throw Error('storageBusy');pending=null;await set(key,null);revision=0;blocked=remote=false;},
  flush(){return writing?new Promise(resolve=>flushWaiters.push(resolve)):Promise.resolve();},
  dispose(){disposed=true;pending=null;unsubscribe();},
 };
}
