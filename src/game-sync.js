import {installCapture,copyCharacter} from './capture.js';
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function characterRole(value){return Number.isSafeInteger(value)&&value>0?String(value):typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value)?value:null;}
export function readClient(page,now=Date.now()){
 const session=page.deepvein?.session,p=session?.state;
 if(!p)return null;
 const role=characterRole(p.id);
 if(!role||!record(p.skills)||!record(p.equipment)||!record(p.bank)||!Array.isArray(p.pack)||!record(p.collections)||!Number.isSafeInteger(p.lastTick)||p.lastTick<0)throw Error('incompatibleCharacter');
 // Clone only approved data; never traverse the whole session or retain game objects.
 const player=copyCharacter(p);
 const windows=session.context?.windows;
 if(!Array.isArray(windows))throw Error('incompatibleCharacter');
 const worldBuffs=windows.map(w=>Object.fromEntries(['label','fromTick','toTick','xpMult','rarityMult'].filter(k=>Object.hasOwn(w,k)).map(k=>[k,w[k]])));
 const guild=session.guildInfo==null?null:{name:session.guildInfo.name,tag:session.guildInfo.tag};
 const tick=session.tick;
 if(!Number.isSafeInteger(tick)||tick<0)throw Error('incompatibleCharacter');
 return {role,snapshot:{version:2,capturedAt:now,player,guild,worldBuffs,worldTick:tick,worldBuffsVersion:1}};
}
export function createGameSync(page,emit,{now=Date.now}={}){
 let server=null,connection=0,sequence=0,identity='',previous='',lastSession=null,disposed=false;
 function deliver(data){
  const nextIdentity=`${data.role??''}:${data.source??''}`;
  const fingerprint=JSON.stringify({...data,snapshot:data.snapshot?{...data.snapshot,capturedAt:0}:null,playerCapturedAt:0,worldCapturedAt:0});
  if(nextIdentity===identity&&fingerprint===previous)return;
  if(identity!==nextIdentity){identity=nextIdentity;connection++;sequence=0;}
  previous=fingerprint;emit({...data,protocolVersion:1,connection,sequence:++sequence});
 }
 function sample(){
  if(disposed)return;
  const session=page.deepvein?.session;
  if(session&&session!==lastSession){if(lastSession)server=null;lastSession=session;}
  let client,error;
  try{client=readClient(page,now());}catch(e){error=e.message;}
  if(client){
   const {role,snapshot}=client;
   deliver({role,source:'client',status:'live',snapshot,playerCapturedAt:snapshot.capturedAt,worldCapturedAt:snapshot.capturedAt});return;
  }
  const hint=characterRole(session?.state?.id);
  const mayFallback=server&&(!session||hint===server.role);
  if(mayFallback){deliver({...server,source:'server',realtimeError:error??'realtimeUnavailable'});return;}
  deliver({role:null,source:'server',status:error?'error':'waiting',error,snapshot:null,realtimeError:error??'realtimeUnavailable'});
 }
 return {sample,receive(envelope){server=envelope;sample();},dispose(){disposed=true;server=null;lastSession=null;}};
}
export function installGameSync(page,emit,options={}){
 const sync=createGameSync(page,emit,options);
 const disposeCapture=installCapture(page,envelope=>sync.receive(envelope));
 sync.sample();const timer=setInterval(()=>sync.sample(),250);
 return ()=>{clearInterval(timer);sync.dispose();disposeCapture();};
}
