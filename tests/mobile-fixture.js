// Authored layout fixture based on the reviewed game selectors; no game code/state.
export function installMobileFixture(){
 if(!document.querySelector('meta[name=viewport]')){const meta=document.createElement('meta');meta.name='viewport';meta.content='width=device-width, initial-scale=1';document.head.append(meta);}
 const style=document.createElement('style');style.dataset.mobileFixture='';style.textContent=`
 [hidden]{display:none!important}.m-shell{display:none}.m-on .nav-strip{display:none!important}.m-on .m-shell{display:block;position:fixed;inset:0;z-index:5;pointer-events:none}
 .m-top{position:fixed;top:0;left:0;right:0;height:46px;background:#352516}.m-top header.top{height:46px}
 .m-tabs{position:fixed;bottom:0;left:0;right:0;height:58px;z-index:30;background:#352516;display:flex}.m-tabs button{min-height:44px;flex:1}
 .m-chat-fab{position:fixed;right:12px;bottom:70px;width:44px;height:44px;z-index:29;background:#352516;color:#fff}
 html:not(.m-on) [data-m-chat],html:not(.m-on) [data-m-tabs]{display:none}
 [data-m-fixture-exit]{position:fixed;right:12px;bottom:122px;width:44px;height:44px;z-index:29}
 `;document.head.append(style);
 const shell=document.createElement('div');shell.className='m-shell';shell.dataset.mtab='world';shell.innerHTML='<div class="m-top"><header class="top">Game top</header></div><main class="m-content"><section data-view="play"></section><section data-view="more" hidden></section></main>';
 const tabs=document.createElement('nav');tabs.className='m-tabs';tabs.dataset.mTabs='';tabs.innerHTML='<button data-m-tab="play">Play</button><button data-m-tab="bag">Bag</button><button data-m-tab="bank">Bank</button><button data-m-tab="market">Market</button><button data-m-tab="more">More</button>';
 const chat=document.createElement('button');chat.className='m-chat-fab';chat.dataset.mChat='';chat.textContent='Chat';
 document.body.append(shell,tabs,chat);
 window.__mobileTabClicks=[];window.__chatClicks=0;chat.onclick=()=>window.__chatClicks++;
 for(const button of tabs.querySelectorAll('[data-m-tab]'))button.onclick=()=>{
  const next=button.dataset.mTab;window.__mobileTabClicks.push(next);
  shell.dataset.mtab=next===shell.dataset.mtab?'world':next;document.documentElement.dataset.mtab=shell.dataset.mtab;
  if(next==='market'){const market=document.querySelector('[data-market-window]');if(market)market.hidden=false;}
 };
 const mq=matchMedia('(max-width: 640px), (pointer: coarse) and (max-height: 640px)');
 const apply=()=>{document.documentElement.classList.toggle('m-on',mq.matches);if(mq.matches)document.documentElement.dataset.mtab=shell.dataset.mtab;else delete document.documentElement.dataset.mtab;};mq.addEventListener('change',apply);apply();
 return {shell,tabs,chat};
}
