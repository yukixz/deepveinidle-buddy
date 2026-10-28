import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export const scenarios=['pure-coal','ui-layout','mobile','mobile-tables','market-storage','user-storage','stable-view','recipe-availability','debug-menu','game-integration','browser','orders-tables-ime','fee-captions','point-cost-filter','mode-filters','bulk-pagination','extra-sorting','action-materials','execution-summary','execution-borders','order-row-toggle','panel-geometry','table-scroll','navigation'];
export async function runUIScenarios(selected){
 if(selected.some(name=>!scenarios.includes(name)))throw Error('Unknown UI scenario');
 const names=selected.length?selected:scenarios,directory='.test-artifacts/verification';await fs.mkdir(directory,{recursive:true});const results=[];
 for(const name of names){
  const result=await new Promise(resolve=>{let output='';const child=spawn(process.execPath,[`tests/${name}.mjs`],{stdio:['ignore','pipe','pipe'],timeout:120000});child.stdout.on('data',value=>output+=value);child.stderr.on('data',value=>output+=value);child.on('error',error=>resolve({name,code:1,output:output+'\n'+error.message}));child.on('close',code=>resolve({name,code:code??1,output}));});
  await fs.writeFile(`${directory}/${name}.log`,result.output);let passed=null;try{passed=JSON.parse(result.output).passed??null;}catch{/* Failed scenarios retain their full diagnostic log. */}
  results.push({name,passed,code:result.code});console.log(`${result.code===0?'PASS':'FAIL'} ${name}${passed===null?'':`: ${passed} checks`}`);
  if(result.code!==0){console.error(`See ${directory}/${name}.log`);break;}
 }
 await fs.writeFile(`${directory}/summary.json`,JSON.stringify({scenarios:results,totalChecks:results.reduce((sum,result)=>sum+(result.passed??0),0),complete:results.length===names.length&&results.every(result=>result.code===0)},null,2)+'\n');
 if(results.length!==names.length||results.some(result=>result.code!==0))process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)runUIScenarios(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
