// Geometry lives on the stable host and is stored separately from character data.
export async function installPanelGeometry(root,{platform,key,onError}){
 const host=root.host,view=host.ownerDocument.defaultView;
 const sides={left:'sw',right:'se',top:'n',bottom:'s',west:'w',east:'e','top-left':'nw','top-right':'ne'};
 const labels={left:'左下角',right:'右下角',top:'上边',bottom:'下边',west:'左边',east:'右边','top-left':'左上角','top-right':'右上角'};
 const handles=Object.entries(sides).map(([side,direction])=>{
  const handle=host.ownerDocument.createElement('button');handle.type='button';handle.className=`resize-handle resize-${side}`;handle.dataset.resizeSide=direction;
  handle.setAttribute('aria-label',`从${labels[side]}调整面板大小 / Resize ${direction}`);
  handle.title='拖动调整大小；方向键微调 / Drag to resize; use arrow keys to adjust';
  root.append(handle);return handle;
 });
 const rect=host.getBoundingClientRect();let box={left:rect.left,top:rect.top,width:rect.width,height:rect.height},drag=null,blocked=false,writes=Promise.resolve();
 try{
  const saved=await platform.get(key,null);
  if(saved!==null){
   if(!saved||!['left','top','width','height'].every(k=>Number.isFinite(saved[k]))||saved.width<=0||saved.height<=0)throw Error('Invalid saved panel geometry');
   box={left:saved.left,top:saved.top,width:saved.width,height:saved.height};
  }
 }catch(error){blocked=true;onError(error);}
 function save(){if(blocked)return;const value={...box};writes=writes.then(()=>{if(!blocked)return platform.set(key,value);}).catch(error=>{blocked=true;onError(error);});}
 const clamp=(value,min,max)=>Math.min(Math.max(min,value),max);
 const toolbarSelector='header.top,.ui-toolbar';
 function limits(){
  const margin=0,maxWidth=Math.max(1,view.innerWidth);
  const top=Math.min(Math.max(0,...toolbars.map(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<view.innerHeight&&view.getComputedStyle(el).visibility!=='hidden'?r.bottom:0;})),Math.max(0,view.innerHeight-1));
  const maxHeight=Math.max(1,view.innerHeight-top);
  return {margin,top,maxWidth,maxHeight,minWidth:Math.min(360,maxWidth),minHeight:Math.min(260,maxHeight)};
 }
 function apply(){
  const {margin,top,maxWidth,maxHeight,minWidth,minHeight}=limits();
  box.width=clamp(box.width,minWidth,maxWidth);box.height=clamp(box.height,minHeight,maxHeight);
  box.left=clamp(box.left,margin,Math.max(margin,view.innerWidth-margin-box.width));box.top=clamp(box.top,top,Math.max(top,view.innerHeight-margin-box.height));
  Object.assign(host.style,{left:`${box.left}px`,top:`${box.top}px`,right:'auto',width:`${box.width}px`,height:`${box.height}px`});
 }
 function resized(start,dx,dy,side){
  const {margin,top:topLimit,minWidth,minHeight}=limits(),right=start.left+start.width,bottom=start.top+start.height;
  const left=side.includes('w')?clamp(start.left+dx,margin,right-minWidth):start.left;
  const top=side.includes('n')?clamp(start.top+dy,topLimit,bottom-minHeight):start.top;
  const width=side.includes('w')?right-left:side.includes('e')?clamp(start.width+dx,minWidth,view.innerWidth-margin-start.left):start.width;
  const height=side.includes('n')?bottom-top:side.includes('s')?clamp(start.height+dy,minHeight,view.innerHeight-margin-start.top):start.height;
  return {left,top,width,height};
 }
 function finish(event){
  if(!drag||event&&event.pointerId!==drag.pointerId)return;
  const id=drag.pointerId;drag=null;host.removeAttribute('data-dragging');if(host.hasPointerCapture(id))host.releasePointerCapture(id);
  view.removeEventListener('pointermove',move);view.removeEventListener('pointerup',finish);view.removeEventListener('pointercancel',finish);save();
 }
 function move(event){
  if(!drag||event.pointerId!==drag.pointerId)return;
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
  box=drag.side?resized(drag.box,dx,dy,drag.side):{...drag.box,left:drag.box.left+dx,top:drag.box.top+dy};apply();event.preventDefault();
 }
 function down(event){
  if(event.button!==0||host.hasAttribute('data-closed'))return;
  const target=event.target,handle=target.closest?.('[data-resize-side]');
  if(!handle&&(!target.closest?.('.titlebar')||target.closest('button,input,select,a')))return;
  finish();drag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,box:{...box},side:handle?.dataset.resizeSide};
  host.setAttribute('data-dragging','');host.setPointerCapture(event.pointerId);
  view.addEventListener('pointermove',move,{passive:false});view.addEventListener('pointerup',finish);view.addEventListener('pointercancel',finish);event.preventDefault();event.stopPropagation();
 }
 function keydown(event){
  const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[event.key];
  if(!delta)return;box=resized(box,delta[0],delta[1],event.currentTarget.dataset.resizeSide);apply();save();event.preventDefault();event.stopPropagation();
 }
 let toolbars=[];
 const toolbarResize=new view.ResizeObserver(apply);
 function refreshToolbars(){
  const next=[...host.ownerDocument.querySelectorAll(toolbarSelector)];
  if(next.length===toolbars.length&&next.every((el,i)=>el===toolbars[i]))return;
  toolbarResize.disconnect();toolbars=next;for(const el of toolbars)toolbarResize.observe(el);apply();
 }
 const toolbarChanges=new view.MutationObserver(refreshToolbars);
 toolbarChanges.observe(host.ownerDocument,{childList:true,subtree:true});refreshToolbars();
 root.addEventListener('pointerdown',down);for(const handle of handles)handle.addEventListener('keydown',keydown);view.addEventListener('resize',apply);view.addEventListener('scroll',apply,{passive:true});apply();
 return ()=>{finish();toolbarChanges.disconnect();toolbarResize.disconnect();root.removeEventListener('pointerdown',down);for(const handle of handles){handle.removeEventListener('keydown',keydown);handle.remove();}view.removeEventListener('resize',apply);view.removeEventListener('scroll',apply);};
}
