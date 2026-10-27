export function createStore({get,set},key,validate){
 let revision=0,blocked=true,pending=null,writing=false,reading=false,disposed=false,flushWaiters=[];
 return {
  async load(){
   if(writing||reading||disposed)throw Error('storageBusy');
   reading=true;blocked=true;
   try{const saved=await get(key,null),value=saved===null?null:validate(saved);revision=value?.revision??0;blocked=false;return value;}
   finally{reading=false;}
  },
  async save(value){
   if(blocked||disposed)throw Error('storageBlocked');
   try{pending=structuredClone(validate(value));}catch(error){pending=null;blocked=true;throw error;}
   if(writing)return;
   writing=true;
   try{
    while(pending&&!disposed){
     const next=pending;pending=null;const current=await get(key,null);
     if(current!==null)validate(current);
     if(current===null?revision!==0:current.revision!==revision)throw Error('storageConflict');
     if(!Number.isSafeInteger(revision+1))throw Error('storageRevisionOverflow');
     next.revision=revision+1;validate(next);
     await set(key,next);revision=next.revision;
    }
   }catch(error){pending=null;blocked=true;throw error;}finally{writing=false;for(const resolve of flushWaiters)resolve();flushWaiters=[];}
  },
  async reset(){
   if(writing||reading||disposed)throw Error('storageBusy');
   reading=true;blocked=true;pending=null;
   try{await set(key,null);revision=0;blocked=false;}finally{reading=false;}
  },
  flush(){return writing?new Promise(resolve=>flushWaiters.push(resolve)):Promise.resolve();},
  dispose(){disposed=true;pending=null;},
 };
}
