// The reviewed game uses a semantic nav label; no data-nav/data-open commands
// are attached to our button, so it cannot trigger an original game action.
export function installNavigationLauncher(doc,onOpen){
 const view=doc.defaultView,button=doc.createElement('button'),separator=doc.createElement('span');
 button.type='button';button.dataset.buddyLauncher='';separator.dataset.buddySeparator='';separator.setAttribute('role','separator');
 button.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 9h16l-3 4h-5v4h5v3H7v-3h3v-4H7zM5 5h7v4H5z"/></svg>';
 let nav=null,ready=false,open=false,status='',scheduled=false,disposed=false;
 function updateLabels(){
  const zh=nav?.getAttribute('aria-label')==='游戏导航',label=zh?'制造助手':'Crafting buddy';
  if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);
  const title=status?`${label} · ${status}`:label;if(button.title!==title)button.title=title;
  button.disabled=!ready;if(button.getAttribute('aria-pressed')!==String(open))button.setAttribute('aria-pressed',String(open));
 }
 function repair(){
  scheduled=false;if(disposed)return;
  nav=doc.querySelector('nav[aria-label="Game navigation"],nav[aria-label="游戏导航"]');if(!nav)return;
  for(const extra of nav.querySelectorAll('[data-buddy-launcher],[data-buddy-separator]'))if(extra!==button&&extra!==separator)extra.remove();
  const peer=nav.querySelector(':scope > button:not([data-buddy-launcher])'),peerSeparator=nav.querySelector(':scope > [role="separator"]:not([data-buddy-separator])');
  const buttonClass=peer?.className??'nav-icon',separatorClass=peerSeparator?.className??'nav-sep';
  if(button.className!==buttonClass)button.className=buttonClass;
  if(separator.className!==separatorClass)separator.className=separatorClass;
  if(nav.lastElementChild!==button||button.previousElementSibling!==separator)nav.append(separator,button);
  updateLabels();
 }
 function schedule(){if(scheduled||disposed)return;scheduled=true;view.queueMicrotask(repair);}
 const observer=new view.MutationObserver(records=>{
  if(!nav?.isConnected||records.some(r=>r.type==='childList'&&nav.contains(r.target)||r.type==='attributes'&&(r.target===nav||r.target===doc.documentElement)))schedule();
 });
 observer.observe(doc,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-label','lang']});
 function click(event){event.preventDefault();event.stopPropagation();if(ready)onOpen();}
 button.addEventListener('click',click);repair();
 const missingTimer=view.setTimeout(()=>{if(!disposed&&!nav?.isConnected)console.error('[DVI Buddy] Game navigation panel not found; launcher could not be mounted.');},10000);
 return {
  update(next){if(disposed)return;if(next.ready!==undefined)ready=next.ready;if(next.open!==undefined)open=next.open;if(next.status!==undefined)status=next.status;updateLabels();},
  dispose(){disposed=true;observer.disconnect();view.clearTimeout(missingTimer);button.removeEventListener('click',click);button.remove();separator.remove();},
 };
}
