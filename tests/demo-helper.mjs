import {build} from 'esbuild';
import {workspaceForStorage,applyUserWorkspace} from '../src/workspace.js';
let harness;const fixtures=new WeakMap();
export async function prepareDemo(page){
 harness??=build({stdin:{contents:`import {startDemo} from './src/main.js';startDemo(window.__demoInitial).then(panel=>window.__demoPanel=panel).catch(error=>{document.getElementById('demo-status').textContent=error.message;console.error(error);});`,resolveDir:process.cwd()},bundle:true,write:false,format:'iife',target:'es2022',loader:{'.css':'text'}}).then(result=>result.outputFiles[0].text);
 const body=await harness;await page.route('**/dist/demo.js',route=>route.fulfill({contentType:'text/javascript',body:'window.__demoInitial='+(JSON.stringify(fixtures.get(page))??'undefined')+';'+body}));
}
export async function readDemoWorkspace(page){
 const {runtime,saved}=await page.evaluate(()=>({runtime:window.__demoPanel.getWorkspace(),saved:JSON.parse(localStorage.getItem('dvi-buddy-demo-v1'))}));
 return saved?applyUserWorkspace(runtime,saved):runtime;
}
export async function seedDemoWorkspace(page,runtime){
 fixtures.set(page,structuredClone(runtime));
 await page.evaluate(user=>localStorage.setItem('dvi-buddy-demo-v1',JSON.stringify(user)),workspaceForStorage(runtime));
}
