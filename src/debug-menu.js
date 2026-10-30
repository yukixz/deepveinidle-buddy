import {mobileMode} from './mobile-layout.js';
// Site-wide UI preference; deliberately separate from character/order storage.
export async function installDebugMenu(root,{platform,key,label,onChange,onError}){
 const doc=root.ownerDocument,menu=doc.createElement('div'),toggle=doc.createElement('button');
 menu.className='debug-menu';menu.hidden=true;menu.setAttribute('role','menu');
 toggle.type='button';toggle.setAttribute('role','menuitemcheckbox');menu.append(toggle);root.append(menu);
 let enabled=false,blocked=false,busy=false,disposed=false,press=null,pressTimer=null;
 function cancelPress(){doc.defaultView.clearTimeout(pressTimer);pressTimer=null;press=null;}
 const validate=value=>{if(typeof value!=='boolean')throw Error('invalidDebugPreference');return value;};
 const report=error=>{blocked=true;enabled=false;close();onError(error);onChange();};
 function close(){cancelPress();menu.hidden=true;}
 function update(){toggle.textContent=label();toggle.setAttribute('aria-checked',String(enabled));toggle.disabled=busy||blocked;}
 try{enabled=validate(await platform.get(key,false));}catch(error){report(error);}
 function openAt(x,y){
  if(root.host.hasAttribute('data-closed'))return;
  update();menu.hidden=false;menu.style.left='0px';menu.style.top='0px';
  const bounds=menu.getBoundingClientRect(),view=doc.defaultView;
  menu.style.left=Math.max(0,Math.min(x,view.innerWidth-bounds.width))+'px';
  menu.style.top=Math.max(0,Math.min(y,view.innerHeight-bounds.height))+'px';toggle.focus({preventScroll:true});
 }
 function contextmenu(event){
  const title=event.target.closest?.('.titlebar');
  if(!title||event.target.closest('button,input,select,a'))return;
  cancelPress();event.preventDefault();event.stopPropagation();openAt(event.clientX,event.clientY);
 }
 function down(event){
  cancelPress();
  if(!mobileMode(doc)||!['touch','pen'].includes(event.pointerType)||!event.isPrimary||event.button!==0||!event.target.closest?.('.titlebar')||event.target.closest('button,input,select,a'))return;
  press={id:event.pointerId,x:event.clientX,y:event.clientY};
  pressTimer=doc.defaultView.setTimeout(()=>{const point=press;cancelPress();if(point&&!disposed&&mobileMode(doc))openAt(point.x,point.y);},600);
 }
 function move(event){if(press&&event.pointerId===press.id&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>10)cancelPress();}
 function end(event){if(press&&event.pointerId===press.id)cancelPress();}
 async function change(event){
  event.stopPropagation();if(busy||blocked||disposed)return;
  const next=!enabled;busy=true;update();
  try{await platform.set(key,next);if(disposed||blocked)return;enabled=next;close();onChange();}
  catch(error){if(!disposed)onError(error);}
  finally{busy=false;if(!disposed)update();}
 }
 function outside(event){if(!event.composedPath().includes(menu))close();}
 function escape(event){if(event.key==='Escape'&&!menu.hidden){event.preventDefault();event.stopPropagation();close();}}
 root.addEventListener('contextmenu',contextmenu);root.addEventListener('pointerdown',down);toggle.addEventListener('click',change);
 doc.addEventListener('pointermove',move,true);doc.addEventListener('pointerup',end,true);doc.addEventListener('pointercancel',end,true);doc.defaultView.addEventListener('blur',cancelPress);
 doc.addEventListener('pointerdown',outside,true);doc.addEventListener('keydown',escape,true);
 doc.defaultView.addEventListener('resize',close);
 return {get enabled(){return enabled;},close,dispose(){disposed=true;cancelPress();root.removeEventListener('contextmenu',contextmenu);root.removeEventListener('pointerdown',down);toggle.removeEventListener('click',change);doc.removeEventListener('pointermove',move,true);doc.removeEventListener('pointerup',end,true);doc.removeEventListener('pointercancel',end,true);doc.defaultView.removeEventListener('blur',cancelPress);doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('keydown',escape,true);doc.defaultView.removeEventListener('resize',close);menu.remove();}};
}
