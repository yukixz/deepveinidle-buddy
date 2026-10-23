export const characterFields=['lastTick','skills','equipment','foodItemId','eatAt','foodMaxTier','foodPerTrip','brews','brewTier','brewBuckets','house','houseFurniture','masteries','perks','guildBonus','homeBank','ironman','bank','pack','collections','route','queue','queueSlots','workJobId','workRarity','held','raidHeld'];
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const routeFields=['zoneId','siteId','jobId','questId','onFull','limit','phase','best','errand','until'];
const queueFields=['kind','siteId','jobId','zoneId','questId','onFull','limit','rarity','best','ticks'];
export function copyCharacter(player){
 // Invalid tasks stay invalid without copying unknown nested game objects.
 const pick=(value,fields)=>{
  if(value===null)return null;
  if(!record(value))return false;
  const selected={};
  for(const key of fields)if(Object.hasOwn(value,key)){
   const field=value[key];
   if(field!==null&&!['number','string','boolean','undefined'].includes(typeof field))return false;
   selected[key]=field;
  }
  return selected;
 };
 const result=Object.fromEntries(characterFields.filter(key=>Object.hasOwn(player,key)).map(key=>[key,player[key]]));
 if(Object.hasOwn(result,'route'))result.route=pick(result.route,routeFields);
 if(Object.hasOwn(result,'queue'))result.queue=Array.isArray(result.queue)?result.queue.map(task=>pick(task,queueFields)):false;
 return JSON.parse(JSON.stringify(result));
}
export function createCapture(emit,{now=Date.now}={}){
 let connection=0,sequence=0,player=null,role=null,guild=null,windows=null,worldTick=null,playerAt=null,worldAt=null,lastTick=-1,live=false;
 const notify=(status,error)=>emit({protocolVersion:1,connection,sequence:++sequence,status,error,role,playerCapturedAt:playerAt,worldCapturedAt:worldAt,snapshot:player?{version:2,capturedAt:playerAt,player:structuredClone(player),guild,worldBuffs:structuredClone(windows),worldTick,worldBuffsVersion:1}:null});
 return {
  connect(){connection++;sequence=0;player=role=null;guild=windows=worldTick=playerAt=worldAt=null;lastTick=-1;live=true;notify('waiting');return connection;},
  receive(raw,token){
   if(token!==connection||!live||typeof raw!=='string')return;
   let frame;try{frame=JSON.parse(raw);}catch{return;}
   if(!Number.isSafeInteger(frame?.tick)||!Array.isArray(frame.m)||frame.tick<lastTick)return;
   let changed=false;
   try{
    for(const message of frame.m){
     if(message?.t==='welcome') {player=role=null;guild=null;windows=null;}
     if(['welcome','snapshot'].includes(message?.t)){
      const you=message.you;
      if(!record(you)||!record(you.skills)||!record(you.equipment)||!Number.isSafeInteger(you.lastTick))throw Error('incompatibleCharacter');
      const id=you.id;
      const nextRole=Number.isSafeInteger(id)&&id>0?String(id):typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id)?id:null;
      if(player&&role!==nextRole){player=null;notify('waiting');}
      role=nextRole;
      player=copyCharacter(you);playerAt=now();changed=true;
     }
     if(message?.t==='welcome'||message?.t==='guild'){
      const value=message.t==='welcome'?message.guild:message.info;guild=value==null?null:{name:value.name,tag:value.tag};changed=true;
     }
     if(['welcome','snapshot','windows','guild'].includes(message?.t)&&Object.hasOwn(message,'windows')){
      windows=Array.isArray(message.windows)?message.windows.map(w=>record(w)?Object.fromEntries(['label','fromTick','toTick','xpMult','rarityMult'].filter(k=>Object.hasOwn(w,k)).map(k=>[k,w[k]])):w):null;worldTick=frame.tick;worldAt=now();changed=true;
     }
    }
    lastTick=frame.tick;if(changed&&player)notify('live');
   }catch(error){live=false;notify('error',error.message);}
  },
  disconnect(token){if(token===connection){live=false;notify('disconnected');}},
  dispose(){live=false;player=null;},
 };
}
export function installCapture(page,emit){
 const capture=createCapture(emit),NativeSocket=page.WebSocket;let latest=null,token=0,disposed=false;
 const proxy=new Proxy(NativeSocket,{construct(target,args){
  const socket=Reflect.construct(target,args);let url;
  try{url=new URL(String(args[0]),page.location.href);}catch{return socket;}
  if(!disposed&&url.host===page.location.host&&url.pathname==='/ws'&&['wss:','ws:'].includes(url.protocol)){
   latest=socket;const own=capture.connect();token=own;
   socket.addEventListener('message',event=>{if(!disposed&&socket===latest)capture.receive(event.data,own);});
   socket.addEventListener('close',()=>{if(socket===latest)capture.disconnect(own);});
   socket.addEventListener('error',()=>{if(socket===latest)capture.disconnect(own);});
  }return socket;
 }});page.WebSocket=proxy;
 return ()=>{disposed=true;capture.dispose();if(page.WebSocket===proxy)page.WebSocket=NativeSocket;latest=null;token=0;};
}
