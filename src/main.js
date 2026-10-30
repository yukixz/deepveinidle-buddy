import {installGameSync,readClient} from './game-sync.js';
import {createGamePrefill} from './game-prefill.js';
import {installNavigationLauncher} from './navigation.js';
import {mountPanel} from './app.js';
import {userscriptPlatform,browserPlatform} from './platform.js';
import {defaults,putLine} from './workspace.js';
import {craftingJobs} from './engine/crafting-model.js';
import {collectionRoutes} from './engine/collection-model.js';
import css from './theme.css';
function demoWorkspace(){
 const initial=defaults();initial.character.initialized=true;initial.character.worldTick=1000000;initial.character.bank={1:150,2:150};initial.character.pack={};initial.character.counts={40:9};
 for(const k of Object.keys(initial.character.config.levels))initial.character.config.levels[k]=70;
 const bronze=craftingJobs.find(j=>j.output.itemId===40&&!j.upgrade);
 putLine(initial.orders[0],{kind:'craft',jobId:bronze.id,tier:0,count:10});
 putLine(initial.orders[0],{kind:'collection',itemId:40,jobId:collectionRoutes(40)[0].id,target:100});
 putLine(initial.collectionOrder,{kind:'collection',itemId:40,jobId:collectionRoutes(40)[0].id,target:100});
 return initial;
}
export async function startDemo(initial=demoWorkspace()){
 let panel=null;
 const navigation=installNavigationLauncher(document,()=>panel?.open(),()=>panel?.close());
 const host=document.createElement('div');host.id='deepveinidle-buddy';document.body.append(host);
 panel=await mountPanel(host.attachShadow({mode:'open'}),{platform:browserPlatform(),css,initial,demo:true,onPrefillFeedback:message=>navigation.showHint(message),onVisibilityChange:open=>navigation.update({open,ready:true})});
 return {...panel,dispose(){panel.dispose();navigation.dispose();host.remove();}};
}
export function startUserscript(page,api){
 if(document.getElementById('deepveinidle-buddy')||document.querySelector('[data-buddy-launcher]'))return;
 const platform=userscriptPlatform(api),gameIntegration=createGamePrefill(page);let latest=null,panel=null,host=null,currentRole=null,starting=false,disposed=false,pendingTimer=null;
 const navigation=installNavigationLauncher(document,()=>panel?.open(),()=>panel?.close());
 navigation.update({ready:false,status:'等待读取游戏角色 / Waiting for game character'});
 const disposeCapture=installGameSync(page,envelope=>{
  latest=envelope;
  if(!envelope.role){panel?.dispose();host?.remove();panel=host=null;currentRole=null;navigation.update({ready:false,status:envelope.error??'等待读取游戏角色 / Waiting for game character'});return;}
  clearTimeout(pendingTimer);pendingTimer=setTimeout(()=>void synchronize(),100);
 });
 async function synchronize(){
  if(disposed||!latest||starting)return;
  const role=latest.role;
  if(!role){panel?.receive(latest);navigation.update({ready:false,status:'缺少稳定角色标识，存档已保护 / Stable character identity missing; storage protected'});return;}
  if(panel&&role===currentRole){panel.receive(latest);return;}
  if(!document.documentElement){pendingTimer=setTimeout(()=>void synchronize(),50);return;}
  starting=true;let mountingHost=null,mountFailed=false;navigation.update({ready:false,status:'载入中 / Loading'});
  try{
   panel?.dispose();panel=null;host?.remove();mountingHost=document.createElement('div');host=mountingHost;host.id='deepveinidle-buddy';document.documentElement.append(host);currentRole=role;
   const nextPanel=await mountPanel(mountingHost.attachShadow({mode:'open'}),{platform,css,storageKey:`dvi-buddy-v1:${location.host}:${role}`,gameIntegration,readCharacter:()=>readClient(page),onPrefillFeedback:message=>{if(host===mountingHost)navigation.showHint(message);},onVisibilityChange:open=>navigation.update({open,ready:true,status:''})});
   if(disposed||latest?.role!==role||host!==mountingHost){nextPanel.dispose();mountingHost.remove();if(host===mountingHost){host=null;currentRole=null;}return;}
   panel=nextPanel;panel.receive(latest);
  }catch(error){mountFailed=true;mountingHost?.remove();if(host===mountingHost){host=null;panel=null;currentRole=null;}navigation.update({ready:false,status:`载入失败 / Load failed: ${error.message}`});console.error('[DVI Buddy]',error);}
  finally{starting=false;if(!mountFailed&&latest?.role&&latest.role!==currentRole)void synchronize();}
 }
 function dispose(){if(disposed)return;disposed=true;disposeCapture();gameIntegration.dispose();panel?.dispose();host?.remove();navigation.dispose();clearTimeout(pendingTimer);page.removeEventListener('pagehide',dispose);}
 page.addEventListener('pagehide',dispose,{once:true});return {dispose};
}
