// Site-wide UI preference; deliberately separate from character/order storage.
export async function installDebugMenu(root,{platform,key,label,onChange,onError}){
 const doc=root.ownerDocument,menu=doc.createElement('div'),toggle=doc.createElement('button');
 menu.className='debug-menu';menu.hidden=true;menu.setAttribute('role','menu');
 toggle.type='button';toggle.setAttribute('role','menuitemcheckbox');menu.append(toggle);root.append(menu);
 let enabled=false,blocked=false,busy=false,disposed=false;
 const validate=value=>{if(typeof value!=='boolean')throw Error('invalidDebugPreference');return value;};
 const report=error=>{blocked=true;enabled=false;close();onError(error);onChange();};
 function close(){menu.hidden=true;}
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
  if(!title||event.target.closest('button,input,select,textarea,a'))return;
  event.preventDefault();event.stopPropagation();openAt(event.clientX,event.clientY);
 }
 async function change(event){
  event.stopPropagation();if(busy||blocked||disposed)return;
  const next=!enabled;busy=true;update();
  try{await platform.set(key,next);if(disposed||blocked)return;enabled=next;close();onChange();}
  catch(error){if(!disposed)onError(error);}
  finally{busy=false;if(!disposed)update();}
 }
 function outside(event){if(!event.composedPath().includes(menu))close();}
 function escape(event){if(event.key==='Escape'&&!menu.hidden){event.preventDefault();event.stopPropagation();close();}}
 root.addEventListener('contextmenu',contextmenu);toggle.addEventListener('click',change);
 doc.addEventListener('pointerdown',outside,true);doc.addEventListener('keydown',escape,true);
 doc.defaultView.addEventListener('resize',close);
 return {open(el){const r=el.getBoundingClientRect();openAt(r.left,r.bottom);},get enabled(){return enabled;},close,dispose(){disposed=true;root.removeEventListener('contextmenu',contextmenu);toggle.removeEventListener('click',change);doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('keydown',escape,true);doc.defaultView.removeEventListener('resize',close);menu.remove();}};
}
