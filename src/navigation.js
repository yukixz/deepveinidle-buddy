import {gameLanguage} from './game-language.js';
import {mobileMode,mobilePageIs,viewportBounds,visibleElement} from './mobile-layout.js';
// Only our own markers and listener: never attach game navigation commands.
export function installNavigationLauncher(doc,onOpen,onGameNavigation=()=>{}){
 const view=doc.defaultView,button=doc.createElement('button'),separator=doc.createElement('span'),style=doc.createElement('style'),hint=doc.createElement('div');
 hint.dataset.buddyHint='';hint.setAttribute('role','status');hint.setAttribute('aria-live','polite');hint.hidden=true;
 button.type='button';button.dataset.buddyLauncher='';separator.dataset.buddySeparator='';separator.setAttribute('role','separator');
 button.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 9h16l-3 4h-5v4h5v3H7v-3h3v-4H7zM5 5h7v4H5z"/></svg>';
 style.textContent='[data-buddy-launcher].buddy-mobile-launcher{position:fixed;z-index:29;display:flex;align-items:center;justify-content:center;width:44px;height:44px;padding:0;border:1px solid var(--edge,#c79352);background:var(--panel,#25170d);color:var(--ink,#f5e6c8);pointer-events:auto;cursor:pointer}[data-buddy-launcher][hidden]{display:none!important}[data-buddy-launcher]:disabled{opacity:.5}[data-buddy-hint]{position:fixed;z-index:2147483647;box-sizing:border-box;width:max-content;max-width:340px;padding:10px 12px;border:1px solid #c79352;border-radius:6px;background:#25170d;color:#f5e6c8;font:14px/1.5 sans-serif;overflow-wrap:anywhere;pointer-events:none;box-shadow:0 2px 10px #0008}[data-buddy-hint][hidden]{display:none!important}';
 let nav=null,anchor=null,ready=false,open=false,status='',scheduled=false,disposed=false,missingTimer=null,hintTimer=null,navigationTimer=null;
 const resize=new view.ResizeObserver(()=>schedule());
 function positionHint(){
  if(!hint.textContent)return;
  hint.hidden=!ready||!anchor?.isConnected;if(hint.hidden)return;
  const bounds=viewportBounds(view),r=button.hidden&&mobileMode(doc)?{left:parseFloat(button.style.left),top:parseFloat(button.style.top),bottom:parseFloat(button.style.top)+parseFloat(button.style.height)}:button.getBoundingClientRect(),margin=8;
  hint.style.maxWidth=`${Math.max(1,Math.min(340,bounds.right-bounds.left-2*margin))}px`;
  const h=hint.getBoundingClientRect();
  const left=Math.max(bounds.left+margin,Math.min(r.left,bounds.right-h.width-margin));
  const top=r.bottom+margin+h.height<=bounds.bottom-margin?r.bottom+margin:r.top-h.height-margin;
  hint.style.left=`${left}px`;hint.style.top=`${Math.max(bounds.top+margin,Math.min(top,bounds.bottom-h.height-margin))}px`;
 }
 function showHint(message){
  if(disposed)return;view.clearTimeout(hintTimer);hint.textContent=message;hint.hidden=true;if(!message){hintTimer=null;return;}positionHint();
  hintTimer=view.setTimeout(()=>{hint.hidden=true;hint.textContent='';hintTimer=null;},5000);
 }
 function updateLabels(){
  const zh=gameLanguage(doc)==='zh',label=zh?'工匠精通助手':'Crafting & Mastery Buddy';
  if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);
  const title=status?`${label} · ${status}`:label;if(button.title!==title)button.title=title;
  button.disabled=!ready;if(button.getAttribute('aria-pressed')!==String(open))button.setAttribute('aria-pressed',String(open));
  positionHint();
 }
 function repair(){
  scheduled=false;if(disposed)return;
  if(!style.isConnected)(doc.head??doc.documentElement)?.append(style);
  if(!hint.isConnected)(doc.body??doc.documentElement)?.append(hint);
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
  const world=mobilePageIs(doc,'world')&&visibleElement(doc.querySelector('.m-shell'));
  const overlay=mobile&&[...doc.querySelectorAll('.veil,[data-m-sub]')].some(visibleElement);
  button.hidden=!anchor||mobile&&(!world||overlay);updateLabels();
  if(!anchor&&missingTimer===null)missingTimer=view.setTimeout(()=>{if(!disposed&&!anchor)console.error('[DVI Buddy] Launcher anchor missing:',mobileMode(doc)?'mobile chat button':'game navigation');},10000);
  if(anchor&&missingTimer!==null){view.clearTimeout(missingTimer);missingTimer=null;}
 }
 function schedule(){if(scheduled||disposed)return;scheduled=true;view.queueMicrotask(repair);}
 const nativeAnchors='nav[aria-label="Game navigation"],nav[aria-label="游戏导航"],[data-m-chat],[data-m-exit],[data-m-board],.m-shell,[data-m-sub],.veil';
 const observer=new view.MutationObserver(records=>{
  if((!button.isConnected&&anchor?.isConnected)||(!style.isConnected&&doc.documentElement)){schedule();return;}
  const relevant=records.some(r=>{
   if(r.target===button||r.target===separator||r.target===style||r.target===hint)return false;
   if(r.type==='attributes')return r.target===doc.documentElement||r.target===nav||r.target===anchor||r.target.contains?.(anchor)||r.target.matches?.('[data-m-exit],[data-m-board],.m-shell,[data-m-sub],.veil');
   if(r.target===nav)return nav.lastElementChild!==button||[...r.addedNodes,...r.removedNodes].some(n=>n!==button&&n!==separator);
   return [...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&(n.matches(nativeAnchors)||n.querySelector(nativeAnchors)));
  });
  if(relevant)schedule();
 });
 observer.observe(doc,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-label','lang','class','hidden','data-mtab','style']});
 function gameNavigation(event){
  if(!event.isTrusted||!mobileMode(doc)||!open)return;
  const target=event.target.closest?.('[data-m-tab]');
  if(!target?.closest('[data-m-tabs]')||!['play','bag','bank','market','more'].includes(target.dataset.mTab))return;
  const tab=target.dataset.mTab,next=doc.documentElement.dataset.mtab===tab?'world':tab;
  // Native event dispatch can run microtasks between listeners. Wait for the full click.
  view.clearTimeout(navigationTimer);navigationTimer=view.setTimeout(()=>{navigationTimer=null;if(!disposed&&open&&mobileMode(doc)&&doc.documentElement.dataset.mtab===next)onGameNavigation();},0);
 }
 function click(event){event.preventDefault();event.stopPropagation();if(ready&&!button.hidden)onOpen();}
 doc.addEventListener('click',gameNavigation,true);button.addEventListener('click',click);view.addEventListener('resize',schedule);view.addEventListener('scroll',schedule,true);view.visualViewport?.addEventListener('resize',schedule);view.visualViewport?.addEventListener('scroll',schedule);repair();
 return {
  showHint,
  update(next){if(disposed)return;if(next.ready!==undefined)ready=next.ready;if(next.open!==undefined)open=next.open;if(next.status!==undefined)status=next.status;updateLabels();},
  dispose(){disposed=true;view.clearTimeout(missingTimer);view.clearTimeout(hintTimer);view.clearTimeout(navigationTimer);hint.remove();observer.disconnect();resize.disconnect();doc.removeEventListener('click',gameNavigation,true);view.removeEventListener('resize',schedule);view.removeEventListener('scroll',schedule,true);view.visualViewport?.removeEventListener('resize',schedule);view.visualViewport?.removeEventListener('scroll',schedule);button.removeEventListener('click',click);button.remove();separator.remove();style.remove();},
 };
}
