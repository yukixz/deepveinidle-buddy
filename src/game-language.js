import {mobileMode} from './mobile-layout.js';
const navigation='nav[aria-label="Game navigation"],nav[aria-label="游戏导航"]';
export function gameLanguage(doc){
 const nav=doc.querySelector(navigation),lang=doc.documentElement?.lang.toLowerCase();
 if(mobileMode(doc)&&lang)return lang.startsWith('zh')?'zh':'en';
 if(nav)return nav.getAttribute('aria-label')==='游戏导航'?'zh':'en';
 return lang?.startsWith('zh')?'zh':'en';
}
export function observeGameLanguage(doc,onChange){
 let language=gameLanguage(doc);
 const observer=new doc.defaultView.MutationObserver(records=>{
  if(!records.some(r=>r.type==='attributes'?r.target===doc.documentElement||r.target.matches?.('nav'):[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&(n.matches(navigation)||n.querySelector(navigation)))))return;
  const next=gameLanguage(doc);if(next!==language){language=next;onChange(next);}
 });
 observer.observe(doc,{subtree:true,childList:true,attributes:true,attributeFilter:['lang','aria-label','class']});
 return ()=>observer.disconnect();
}
