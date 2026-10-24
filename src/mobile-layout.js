// The game owns mode selection, including coarse-pointer landscape mode.
export const mobileMode=doc=>doc.documentElement?.classList.contains('m-on')??false;
export const mobilePageIs=(doc,page)=>doc.documentElement?.dataset.mtab===page&&doc.querySelector('.m-shell')?.dataset.mtab===page;
export function viewportBounds(view){
 const v=view.visualViewport;
 const left=v?.offsetLeft??0,top=v?.offsetTop??0;
 return {left,top,right:left+(v?.width??view.innerWidth),bottom:top+(v?.height??view.innerHeight)};
}
export function visibleElement(el){
 if(!el?.isConnected||el.closest('[hidden]'))return false;
 const r=el.getBoundingClientRect(),style=el.ownerDocument.defaultView.getComputedStyle(el);
 return r.width>0&&r.height>0&&style.visibility!=='hidden'&&style.display!=='none';
}
