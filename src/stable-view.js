// Retain live nodes; defer structural edits while a user is interacting.
export function createStableView(container,onIdle){
 const root=container.getRootNode(),doc=container.ownerDocument,view=doc.defaultView;
 const scrollQuietMs=180;
 let pending=false,pointer=false,scrollUntil=0,timer=null,disposed=false;
 const isControl=node=>node?.nodeType===1&&node.matches('input,select,textarea');
 function selectedRange(){
  const selected=root.getSelection?.()??doc.getSelection();
  if(!selected||selected.isCollapsed||!selected.rangeCount)return null;
  const range=selected.getRangeAt(0);
  return container.contains(range.commonAncestorContainer)?range:null;
 }
 // The caller recomputes the latest view; deferred templates are never queued.
 function wake(){if(!disposed&&pending)onIdle();}
 function scrolling(){
  scrollUntil=Date.now()+scrollQuietMs;clearTimeout(timer);
  timer=setTimeout(()=>{timer=null;wake();},scrollQuietMs+10);
 }
 function down(){pointer=true;}
 function up(){pointer=false;wake();}
 function activate(){scrollUntil=0;clearTimeout(timer);timer=null;wake();}
 const listeners=[
  [container,'wheel',scrolling,{passive:true}],
  [container,'scroll',scrolling,{capture:true,passive:true}],
  [container,'pointerdown',down,true],
  [view,'pointerup',up,true],
  [view,'pointercancel',up,true],
  [view,'blur',up],
  [container,'focusout',wake],
  [root,'click',activate],
  [root,'change',activate],
  [doc,'selectionchange',wake],
 ];
 for(const [target,type,fn,options]of listeners)target.addEventListener(type,fn,options);
 function nodeKey(node){
  if(node.nodeType!==1)return null;
  if(node.id)return 'id:'+node.id;
  for(const name of ['data-view-key','data-line-key','data-order-row','data-material','data-execution-action','data-order-lines']){
   if(node.hasAttribute(name))return name+':'+node.getAttribute(name);
  }
  if(node.hasAttribute('data-action'))return 'action:'+['action','id','key','item','table','column','sort'].map(name=>node.dataset[name]??'').join(':');
  return null;
 }
 function compatible(a,b){
  return a.nodeType===b.nodeType&&(a.nodeType!==1||(a.tagName===b.tagName&&a.classList[0]===b.classList[0]));
 }
 function patchChildren(parent,next,busy,active,range){
  const old=[...parent.childNodes],targets=[...next.childNodes],used=new Set(),desired=[];
  // Text bindings remain data updates, including an initially empty alert.
  if(old.length<=1&&targets.length<=1&&[...old,...targets].every(node=>node.nodeType===3)){
   if(parent.textContent===next.textContent)return;
   if(range?.intersectsNode(parent)||active===parent){pending=true;return;}
   if(old.length&&targets.length)old[0].nodeValue=targets[0].nodeValue;
   else if(targets.length)parent.append(targets[0]);
   else old[0].remove();
   return;
  }
  const keyed=new Map(old.filter(node=>nodeKey(node)!==null).map(node=>[nodeKey(node),node]));
  for(const target of targets){
   const id=nodeKey(target);
   const match=id!==null?keyed.get(id):old.find(node=>!used.has(node)&&nodeKey(node)===null&&compatible(node,target));
   const current=match&&!used.has(match)&&match.nodeName===target.nodeName?match:null;
   if(current){used.add(current);patchNode(current,target,busy,active,range);desired.push(current);}
   else desired.push(target);
  }
  const changed=old.length!==desired.length||old.some((node,index)=>node!==desired[index]);
  if(!changed)return;
  if(busy||active&&parent.contains(active)){pending=true;return;}
  for(let index=0;index<desired.length;index++){
   if(parent.childNodes[index]!==desired[index])parent.insertBefore(desired[index],parent.childNodes[index]??null);
  }
  for(const node of old)if(!used.has(node))node.remove();
 }
 function patchNode(current,next,busy,active,range){
  if(current.nodeType===3){
   if(current.nodeValue!==next.nodeValue){
    if(range?.intersectsNode(current)){pending=true;return;}
    current.nodeValue=next.nodeValue;
   }
   return;
  }
  if(current.nodeType!==1)return;
  const editing=current===active;
  for(const attr of [...current.attributes]){
   if(current.tagName==='DETAILS'&&attr.name==='open')continue;
   if(editing&&['value','checked','selected','aria-invalid'].includes(attr.name))continue;
   if(!next.hasAttribute(attr.name))current.removeAttribute(attr.name);
  }
  for(const attr of next.attributes){
   if(editing&&['value','checked','selected'].includes(attr.name))continue;
   if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
  }
  if(current.tagName==='SELECT'&&editing){
   if(current.innerHTML!==next.innerHTML||current.value!==next.value)pending=true;
   return;
  }
  patchChildren(current,next,busy,active,range);
  if(isControl(current)){
   if(editing){if(current.value!==next.value)pending=true;return;}
   if(current.value!==next.value)current.value=next.value;
   if(current.tagName==='INPUT'&&current.checked!==next.checked)current.checked=next.checked;
  }
 }
 return {
  update(fragment){
   pending=false;
   const focused=root.activeElement,active=isControl(focused)?focused:null,range=selectedRange();
   patchChildren(container,fragment,pointer||Date.now()<scrollUntil||!!range,active,range);
  },
  dispose(){
   disposed=true;clearTimeout(timer);
   for(const [target,type,fn,options]of listeners)target.removeEventListener(type,fn,options);
  },
 };
}
