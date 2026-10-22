import {craftConfig,craftSignature} from './workspace.js';
export function createComputer(source,onResult,onError){
 const results=new Map();let worker=null,url=null,generation=0,timer=null,pending=[],running=false,disposed=false,latestCharacter=null,failed=false;
 function stop(){generation++;worker?.terminate();worker=null;if(url)URL.revokeObjectURL(url);url=null;running=false;}
 function launch(){
  const character=latestCharacter;
  if(disposed||failed||!pending.length||running)return;
  const tasks=pending.filter(t=>!results.has(t.key));pending=[];if(!tasks.length)return;const own=++generation;
  try{url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));worker=new Worker(url);running=true;
   worker.onmessage=({data})=>{if(data.generation!==generation)return;if(data.result){results.set(data.key,data.result);onResult();}
    if(data.done){stop();if(pending.length)launch();}};
   worker.onerror=event=>{failed=true;stop();onError(new Error(event.message||'workerFailed'));};
   const seed=crypto.getRandomValues(new Uint32Array(1))[0];worker.postMessage({generation:own,config:craftConfig(character),seed,now:Date.now(),tasks});
  }catch(error){failed=true;stop();onError(error);}
 }
 return {results,
  schedule(character,lines,rates=[]){
   latestCharacter=structuredClone(character);
   const tasks=[...lines.map(line=>({key:craftSignature(character,line),line})),...rates.map(line=>({key:`rate:${craftSignature(character,line)}`,line,rate:true}))];
   pending=[...new Map(tasks.filter(t=>!results.has(t.key)).map(t=>[t.key,t])).values()];
   clearTimeout(timer);timer=setTimeout(()=>launch(),180);
  },
  retry(){failed=false;results.clear();},
  pause(){clearTimeout(timer);stop();pending=[];},
  dispose(){disposed=true;clearTimeout(timer);stop();},
 };
}
