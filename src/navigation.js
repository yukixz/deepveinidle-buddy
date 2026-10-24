import {mobileMode,viewportBounds,visibleElement} from './mobile-layout.js';
// Only our own markers and listener: never attach game navigation commands.
export function installNavigationLauncher(doc,onOpen){
 const view=doc.defaultView,button=doc.createElement('button'),separator=doc.createElement('span'),style=doc.createElement('style');
 button.type='button';button.dataset.buddyLauncher='';separator.dataset.buddySeparator='';separator.setAttribute('role','separator');
 button.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 9h16l-3 4h-5v4h5v3H7v-3h3v-4H7zM5 5h7v4H5z"/></svg>';
 style.textContent='[data-buddy-launcher].buddy-mobile-launcher{position:fixed;z-index:29;display:flex;align-items:center;justify-content:center;width:44px;height:44px;padding:0;border:1px solid var(--edge,#c79352);background:var(--panel,#25170d);color:var(--ink,#f5e6c8);pointer-events:auto;cursor:pointer}[data-buddy-launcher][hidden]{display:none!important}[data-buddy-launcher]:disabled{opacity:.5}';
 let nav=null,anchor=null,ready=false,open=false,status='',scheduled=false,disposed=false,missingTimer=null;
 const resize=new view.ResizeObserver(()=>schedule());
 function updateLabels(){
  const lang=doc.documentElement?.lang??'';
  const zh=!mobileMode(doc)&&nav?nav.getAttribute('aria-label')==='游戏导航':lang?lang.toLowerCase().startsWith('zh'):nav?.getAttribute('aria-label')==='游戏导航',label=zh?'工匠精通助手':'Crafting & Mastery Buddy';
  if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);
  const title=status?`${label} · ${status}`:label;if(button.title!==title)button.title=title;
  button.disabled=!ready;if(button.getAttribute('aria-pressed')!==String(open))button.setAttribute('aria-pressed',String(open));
 }
 function repair(){
  scheduled=false;if(disposed)return;
  if(!style.isConnected)(doc.head??doc.documentElement)?.append(style);
  nav=doc.querySelector('nav[aria-label="Game navigation"],nav[aria-label="游戏导航"]');
  const mobile=mobileMode(doc),next=mobile?doc.querySelector('[data-m-chat]'):nav;
  if(next!==anchor){resize.disconnect();anchor=next;if(anchor)resize.observe(anchor);}
  for(const extra of doc.querySelectorAll('[data-buddy-launcher],[data-buddy-separator]'))if(extra!==button&&extra!==separator)extra.remove();
  if(mobile){
   separator.remove();button.className='buddy-mobile-launcher';
   if(anchor){
    if(button.parentElement!==anchor.parentElement)anchor.parentElement.append(button);
    const r=anchor.getBoundingClientRect(),s=view.getComputedStyle(anchor),bounds=viewportBounds(view);
    const width=Math.max(44,r.width||parseFloat(s.width)||44),height=Math.max(44,r.height||parseFloat(s.height)||44);
    const left=r.width?r.left:view.innerWidth-(parseFloat(s.right)||12)-width;
    let top=(r.height?r.top:view.innerHeight-(parseFloat(s.bottom)||68)-height)-height-8;
    const obstacles=[...doc.querySelectorAll('[data-m-exit],[data-m-board]')].filter(visibleElement).map(el=>el.getBoundingClientRect()).sort((a,b)=>b.top-a.top);
    for(const other of obstacles)if(left<other.right&&left+width>other.left&&top<other.bottom+8&&top+height>other.top-8)top=other.top-height-8;
    button.style.cssText=`left:${Math.max(bounds.left,Math.min(left,bounds.right-width))}px;top:${Math.max(bounds.top,Math.min(top,bounds.bottom-height))}px;width:${width}px;height:${height}px`;
   }
  }else{
   button.style.cssText='';
   if(nav){
    const peer=nav.querySelector(':scope > button:not([data-buddy-launcher])'),peerSeparator=nav.querySelector(':scope > [role="separator"]:not([data-buddy-separator])');
    button.className=peer?.className??'nav-icon';separator.className=peerSeparator?.className??'nav-sep';
    if(nav.lastElementChild!==button||button.previousElementSibling!==separator)nav.append(separator,button);
   }
  }
  button.hidden=!anchor;updateLabels();
  if(!anchor&&missingTimer===null)missingTimer=view.setTimeout(()=>{if(!disposed&&!anchor)console.error('[DVI Buddy] Launcher anchor missing:',mobileMode(doc)?'mobile chat button':'game navigation');},10000);
  if(anchor&&missingTimer!==null){view.clearTimeout(missingTimer);missingTimer=null;}
 }
 function schedule(){if(scheduled||disposed)return;scheduled=true;view.queueMicrotask(repair);}
 const nativeAnchors='nav[aria-label="Game navigation"],nav[aria-label="游戏导航"],[data-m-chat],[data-m-exit],[data-m-board]';
 const observer=new view.MutationObserver(records=>{
  if((!button.isConnected&&anchor?.isConnected)||(!style.isConnected&&doc.documentElement)){schedule();return;}
  const relevant=records.some(r=>{
   if(r.target===button||r.target===separator||r.target===style)return false;
   if(r.type==='attributes')return r.target===doc.documentElement||r.target===nav||r.target===anchor||r.target.contains?.(anchor)||r.target.matches?.('[data-m-exit],[data-m-board]');
   if(r.target===nav)return nav.lastElementChild!==button||[...r.addedNodes,...r.removedNodes].some(n=>n!==button&&n!==separator);
   return [...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&(n.matches(nativeAnchors)||n.querySelector(nativeAnchors)));
  });
  if(relevant)schedule();
 });
 observer.observe(doc,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-label','lang','class','hidden','data-mtab','style']});
 function click(event){event.preventDefault();event.stopPropagation();if(ready)onOpen();}
 button.addEventListener('click',click);view.addEventListener('resize',schedule);view.visualViewport?.addEventListener('resize',schedule);view.visualViewport?.addEventListener('scroll',schedule);repair();
 return {
  update(next){if(disposed)return;if(next.ready!==undefined)ready=next.ready;if(next.open!==undefined)open=next.open;if(next.status!==undefined)status=next.status;updateLabels();},
  dispose(){disposed=true;view.clearTimeout(missingTimer);observer.disconnect();resize.disconnect();view.removeEventListener('resize',schedule);view.visualViewport?.removeEventListener('resize',schedule);view.visualViewport?.removeEventListener('scroll',schedule);button.removeEventListener('click',click);button.remove();separator.remove();style.remove();},
 };
}
