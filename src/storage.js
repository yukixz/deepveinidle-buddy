export function createStore({get,set},key,validate){
 let revision=0,blocked=false,pending=null,writing=false,disposed=false,flushWaiters=[];
 return {
  async load(){const saved=await get(key,null);if(saved===null)return null;
   try{const value=validate(saved);revision=value.revision;blocked=false;return value;}catch(error){blocked=true;throw error;}
  },
  async save(value){
   if(blocked)throw Error('storageBlocked');
   pending=structuredClone(value);if(writing)return;
   writing=true;
   try{while(pending&&!disposed){
    const next=pending;pending=null;const current=await get(key,null);
    if(current===null?revision!==0:current.revision!==revision) throw Error('storageConflict');
    next.revision=revision+1;
    await set(key,next);revision=next.revision;
   }}catch(error){pending=null;blocked=true;throw error;}finally{writing=false;for(const resolve of flushWaiters)resolve();flushWaiters=[];}
  },
  async reset(){if(writing)throw Error('storageBusy');pending=null;await set(key,null);revision=0;blocked=false;},
  flush(){return writing?new Promise(resolve=>flushWaiters.push(resolve)):Promise.resolve();},
  dispose(){disposed=true;pending=null;},
 };
}
