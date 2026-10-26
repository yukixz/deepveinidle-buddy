import {mobileMode,mobilePageIs} from './mobile-layout.js';
import {characterRole} from './game-sync.js';
const failure=code=>{throw Error(code);};
export function createGamePrefill(page,{doc=document,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 let busy=false,disposed=false;
 const visible=el=>el&&el.isConnected&&!el.closest('[hidden]')&&el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0;
 const find=selector=>{const all=[...doc.querySelectorAll(selector)].filter(visible);if(all.length>1)failure('gameControlAmbiguous');return all[0];};
 const required=selector=>find(selector)??failure('gameControlMissing');
 const click=selector=>{const el=required(selector);if(el.disabled)failure('gameControlUnavailable');el.click();return el;};
 const input=(selector,value)=>{
  const el=required(selector);if(el.disabled||el.readOnly)failure('gameControlUnavailable');
  // Dispatch input only. No key events, change handlers or submitting forms.
  const setter=Object.getOwnPropertyDescriptor(page.HTMLInputElement.prototype,'value').set;
  setter.call(el,String(value));el.dispatchEvent(new page.Event('input',{bubbles:true}));return el;
 };
 async function until(read,check){for(let n=0;n<60;n++){check();const value=read();if(value)return value;await wait(50);}failure('gameControlMissing');}
 async function run(request,guard,work){
  if(busy)failure('prefillBusy');busy=true;
  const session=page.deepvein?.session;
  const check=()=>{if(disposed||!session||page.deepvein?.session!==session||characterRole(session.state?.id)!==request.role)failure('gameRoleChanged');if(!guard())failure('planChanged');};
  try{check();await work(check);check();}
  finally{busy=false;}
 }
 return {
  async purchase(request,guard=()=>true){
   if(!Number.isSafeInteger(request.itemId)||request.itemId<=0||!Number.isSafeInteger(request.baseId)||request.baseId<=0||!Number.isInteger(request.tier)||request.tier<0||request.tier>4||!Number.isSafeInteger(request.quantity)||request.quantity<1||!Number.isSafeInteger(request.price)||request.price<1||request.price>1e9)failure('invalidPrefill');
   return run(request,guard,async check=>{
    if(find('[data-market-trade]')){
     click('[data-market-trade] [data-trade-close]');
     await until(()=>!find('[data-market-trade]'),check);
    }
    if(!find('[data-market-window]'))click(mobileMode(doc)?'[data-m-tabs] [data-m-tab="market"]':'[data-open="market"]');
    await until(()=>find('[data-market-window]'),check);
    click('[data-market-mode="buy"]');
    if(find('[data-market-sheet]')){
     click('[data-market-allitems]');
     await until(()=>!find('[data-market-sheet]'),check);
    }
    const all=required('[data-market-chips] [data-family="all"]');if(all.getAttribute('aria-pressed')!=='true')all.click();
    const saleControls=[...doc.querySelectorAll('[data-market-window] [data-market-forsale]')];if(saleControls.length!==1||saleControls[0].disabled)failure('gameControlMissing');
    const onSale=saleControls[0];if(onSale.checked){onSale.checked=false;onSale.dispatchEvent(new page.Event('change',{bubbles:true}));}
    for(const button of [...doc.querySelectorAll('[data-market-rarities] [data-rarity][aria-pressed="true"]')].filter(visible))button.click();
    for(const selector of ['[data-market-onlyfavs]','[data-market-onsale]']){const button=find(selector);if(button?.getAttribute('aria-pressed')==='true')button.click();}
    input('[data-market-search]',request.search);
    const tile=await until(()=>find(`[data-market-list] button[data-item="${request.itemId}"]`)??find(`[data-market-list] button[data-item="${request.baseId}"]`),check);
    tile.click();
    await until(()=>find('[data-sheet-icon][data-item]'),check);
    const actual=()=>Number(required('[data-sheet-icon]').dataset.item);
    if(actual()!==request.itemId){
     if(actual()!==request.baseId)failure('gameItemMismatch');
     click(`[data-sheet-rarity] [data-rarity="${request.tier}"]`);
    }
    if(actual()!==request.itemId)failure('gameItemMismatch');
    click('[data-list-side="buy"]');
    await until(()=>find('[data-trade-qty-in]'),check);
    input('[data-trade-qty-in]',request.quantity);input('[data-trade-price-in]',request.price);
    const price=required('[data-trade-price-in]');price.focus();price.blur();
    await wait(0);check();
    if(actual()!==request.itemId||Number(required('[data-trade-qty-in]').value)!==request.quantity||Number(required('[data-trade-price-in]').value)!==request.price)failure('gamePrefillMismatch');
    required('[data-trade-qty-in]').focus();
   });
  },
  async action(request,guard=()=>true){
   if(!Number.isSafeInteger(request.jobId)||request.jobId<=0||!Number.isSafeInteger(request.quantity)||request.quantity<1||!Number.isInteger(request.tier)||request.tier<0||request.tier>4)failure('invalidPrefill');
   return run(request,guard,async check=>{
    const routes=page.deepvein?.routes?.();
    if(!routes||typeof routes.show!=='function'||typeof routes.preselect!=='function')failure('gameControlMissing');
    const panels=page.deepvein.panels;if(!panels||typeof panels.show!=='function')failure('gameControlMissing');
    if(mobileMode(doc)){
     const play=()=>mobilePageIs(doc,'play');
     if(!play())click('[data-m-tabs] [data-m-tab="play"]');
     await until(()=>play(),check);
    }
    panels.show('skills');routes.show(request.skill);routes.preselect({jobId:request.jobId});check();
    if(routes.pending?.jobId!==request.jobId)failure('gameControlUnavailable');
    const rarityChoice=()=>{
     required('.routes [data-rarity-choices]');
     required('.routes [data-rarity-choices] [data-rarity="0"]');
     const choice=find(`.routes [data-rarity-choices] [data-rarity="${request.tier}"]`);
     if(!choice)failure('gameRarityUnavailable');
     if(choice.disabled)failure('gameControlUnavailable');return choice;
    };
    if(request.manufacturing)rarityChoice();
    const options=required('.routes [data-opt-line]'),expanded=options.getAttribute('aria-expanded');
    if(expanded==='false')click('.routes [data-opt-line]');
    else if(expanded!=='true')failure('gameControlUnavailable');
    await until(()=>find('.routes [data-opt-line]')?.getAttribute('aria-expanded')==='true'&&find('.routes [data-stop-mode="count"]'),check);
    click('.routes [data-stop-mode="count"]');
    await until(()=>find('.routes [data-amount-any]'),check);
    input('.routes [data-amount-any]',request.quantity);
    if(request.manufacturing)rarityChoice().click();
    if(routes.pending?.jobId!==request.jobId||routes.stopMode!=='count'||routes.amount!==request.quantity||request.manufacturing&&(routes.rarity!==request.tier||routes.best))failure('gamePrefillMismatch');
    required('.routes [data-amount-any]').focus();
   });
  },
  dispose(){disposed=true;},
 };
}
