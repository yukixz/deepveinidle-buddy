import {installCapture} from './capture.js';
import {mountPanel} from './app.js';
import {userscriptPlatform,browserPlatform} from './platform.js';
import {defaults,putLine} from './workspace.js';
import {craftingJobs} from './engine/crafting-model.js';
import {collectionRoutes} from './engine/collection-model.js';
import css from './theme.css';
/* WORKER_SOURCE is supplied at build time; the Worker is a self-contained bundle. */
const workerSource=WORKER_SOURCE;
export async function startDemo(){
 const host=document.createElement('div');host.id='deepveinidle-buddy';document.body.append(host);const root=host.attachShadow({mode:'open'});
 const initial=defaults();initial.follow=false;initial.character.initialized=true;initial.character.bank={1:150,2:150};initial.character.pack={};initial.character.counts={40:9};
 for(const k of Object.keys(initial.character.config.levels))initial.character.config.levels[k]=70;
 const bronze=craftingJobs.find(j=>j.output.itemId===40&&!j.upgrade);
 putLine(initial.orders[0],{kind:'craft',jobId:bronze.id,tier:0,count:10});
 putLine(initial.orders[0],{kind:'collection',itemId:40,jobId:collectionRoutes(40)[0].id,target:100});
 return mountPanel(root,{platform:browserPlatform(),workerSource,css,initial,demo:true});
}
export function startUserscript(page,api){
 if(page.document.getElementById('deepveinidle-buddy'))return;
 const platform=userscriptPlatform(api);let latest=null,panel=null,host=null,currentRole=null,starting=false,disposed=false,pendingTimer=null;
 const disposeCapture=installCapture(page,envelope=>{
  latest=envelope;
  if(envelope.status==='waiting'){panel?.receive(envelope);return;}
  clearTimeout(pendingTimer);pendingTimer=setTimeout(()=>void synchronize(),100);
 });
 async function synchronize(){
  if(disposed||!latest)return;if(starting)return;
  const role=latest.role;
  if(!role){panel?.receive(latest);waiting.textContent='Buddy · 缺少稳定角色标识，未读取或覆盖存档 / Stable character identity missing; storage protected';return;}
  if(panel&&role===currentRole){panel.receive(latest);return;}
  if(!document.documentElement){pendingTimer=setTimeout(()=>void synchronize(),50);return;}
  starting=true;const connection=latest.connection;
  try{
   panel?.dispose();host?.remove();host=document.createElement('div');host.id='deepveinidle-buddy';document.documentElement.append(host);currentRole=role;
   panel=await mountPanel(host.attachShadow({mode:'open'}),{platform,workerSource,css,storageKey:`dvi-buddy-v1:${location.host}:${role}`});
   if(disposed){panel.dispose();host.remove();return;}
   if(latest?.role===role)panel.receive(latest);
  }catch(error){
   if(host)host.textContent=`Buddy: ${error.message}`;console.error('[DVI Buddy]',error);
  }finally{starting=false;if(latest?.role&&latest.role!==currentRole)void synchronize();}
 }
 // A missing/late welcome must remain visible; never open a second socket.
 const waiting=document.createElement('div');waiting.id='deepveinidle-buddy-wait';waiting.style.cssText='position:fixed;right:16px;bottom:16px;z-index:9000;padding:8px 12px;background:#25170d;color:#f5e6c8;border:1px solid #c79352;border-radius:6px;font:12px system-ui';waiting.textContent='Buddy · 等待角色快照，请在安装后刷新游戏 / Waiting for a character snapshot; refresh after installing';
 const mountWaiting=()=>{if(document.documentElement&&!disposed){if(!host)document.documentElement.append(waiting);else waiting.remove();}};
 const waitingTimer=setInterval(mountWaiting,1000);mountWaiting();
 page.addEventListener('pagehide',()=>{disposed=true;disposeCapture();panel?.dispose();host?.remove();waiting.remove();clearTimeout(pendingTimer);clearInterval(waitingTimer);},{once:true});
 return {dispose(){disposed=true;disposeCapture();panel?.dispose();host?.remove();waiting.remove();clearTimeout(pendingTimer);clearInterval(waitingTimer);}};
}
