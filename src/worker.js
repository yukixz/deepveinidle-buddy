import {simulateCrafting,simulateCraftingWindow} from './engine/crafting-simulation.js';
import {craftingJobs} from './engine/crafting-model.js';
self.onmessage=({data})=>{
 for(const task of data.tasks){
  try{const job=craftingJobs.find(j=>j.id===task.line.jobId);if(!job)throw Error('invalidRecipe');
   const options={seed:data.seed,now:data.now};
   const result=task.rate?simulateCraftingWindow(data.config,job,task.line.tier,options):simulateCrafting(data.config,job,task.line.tier,task.line.count,options);
   self.postMessage({generation:data.generation,key:task.key,result});
  }catch(error){self.postMessage({generation:data.generation,key:task.key,result:{complete:false,error:error.message}});}
 }self.postMessage({generation:data.generation,done:true});
};
