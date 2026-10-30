import {longPressTitle,launchBrowser,baseUrl} from './browser-helper.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {build} from 'esbuild';
import * as game from '../src/engine/upstream.js';import {playerFixture} from './fixtures/player.js';
import {craftingSkills,craftingSlots} from '../src/engine/crafting-model.js';import {gatheringSkills,gatheringSlots} from '../src/engine/gathering-model.js';
const browser=await launchBrowser(),checks=[],errors=[];let page;
await fs.mkdir('.test-artifacts/mobile',{recursive:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1080},hasTouch:true,isMobile:true});
 // Deterministic visual viewport changes exercise keyboard code paths, not OS keyboards.
 await context.addInitScript(()=>{const v=new EventTarget();Object.assign(v,{offsetTop:0,offsetLeft:0,scale:1,testHeight:null,testWidth:null});Object.defineProperties(v,{width:{get:()=>v.testWidth??innerWidth},height:{get:()=>v.testHeight??innerHeight}});Object.defineProperty(window,'visualViewport',{value:v,configurable:true});});
 page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(baseUrl);await page.locator("[data-buddy-launcher]").click();const root=page.locator('#deepveinidle-buddy');await root.locator('.resize-right').waitFor();
 await root.locator('.resize-right').focus();await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>localStorage.getItem('dvi-buddy-demo-geometry-v1')!==null);
 const desktop=await root.boundingBox(),saved=await page.evaluate(()=>localStorage.getItem('dvi-buddy-demo-geometry-v1'));
 await page.evaluate(async()=>{const {installMobileFixture}=await import('/tests/mobile-fixture.js');installMobileFixture();});
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').hasAttribute('data-mobile'));
 let bounds=await root.boundingBox();assert.equal(bounds.y,0);assert.equal(bounds.x,0);assert.equal(bounds.height,786);assert.equal(await root.locator('.titlebar').evaluate(el=>el.getBoundingClientRect().height),46);assert.equal(bounds.width,390);assert.equal(await root.locator('.resize-right').isVisible(),false);
 const launcher=page.locator('[data-buddy-launcher]'),chat=page.locator('[data-m-chat]');let a=await launcher.boundingBox(),c=await chat.boundingBox();assert.equal(a.y+a.height+8,c.y);assert.equal(a.x,c.x);assert.equal(await launcher.count(),1);assert.equal(await root.locator('[data-action="settings"]').count(),0);checks.push('actual mobile mode hides desktop navigation and positions a 44px launcher above chat; panel touches top and sides, excludes only the bottom bar and matches the game toolbar height');
 assert.equal(await root.locator('.shell').evaluate(el=>getComputedStyle(el).borderRadius),'0px');
 await page.locator('.m-top header.top').evaluate(el=>el.style.height='64px');await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').shadowRoot.querySelector('.titlebar').getBoundingClientRect().height===64);assert.equal((await root.boundingBox()).y,0);
 await page.locator('.m-top header.top').evaluate(el=>{const next=el.cloneNode(true);next.style.height='36px';el.replaceWith(next);});await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').shadowRoot.querySelector('.titlebar').getBoundingClientRect().height===36);
 const compactTitle=await root.locator('.titlebar').boundingBox(),close=await root.locator('[data-action="close"]').boundingBox();assert.ok(close.y>=compactTitle.y&&close.y+close.height<=compactTitle.y+compactTitle.height);
 await page.locator('.m-top').evaluate(el=>el.remove());await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').shadowRoot.querySelector('.titlebar').getBoundingClientRect().height===46);
 await page.evaluate(()=>{const top=document.createElement('div');top.className='m-top';top.innerHTML='<header class="top">Game top</header>';document.querySelector('.m-shell').prepend(top);});
 checks.push('title height follows game toolbar resizing and replacement, constrains close button and uses 46px when no toolbar exists');
 await page.locator('[data-m-tabs]').evaluate(el=>el.hidden=true);await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').getBoundingClientRect().bottom===innerHeight);
 await page.locator('[data-m-tabs]').evaluate(el=>el.hidden=false);await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').getBoundingClientRect().bottom===786);
 await page.evaluate(()=>{Object.assign(visualViewport,{offsetLeft:12,offsetTop:18,testWidth:360,testHeight:600});visualViewport.dispatchEvent(new Event('resize'));});await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').getBoundingClientRect().left===12);
 bounds=await root.boundingBox();assert.deepEqual(bounds,{x:12,y:18,width:360,height:600});
 await page.evaluate(()=>{Object.assign(visualViewport,{offsetLeft:0,offsetTop:0,testWidth:null,testHeight:null});visualViewport.dispatchEvent(new Event('resize'));});await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').getBoundingClientRect().left===0);
 assert.equal(await page.evaluate(()=>localStorage.getItem('dvi-buddy-demo-geometry-v1')),saved);checks.push('bottom bar visibility and visual viewport offsets affect only the mobile bounds without changing saved desktop geometry');
 await root.locator('#search').fill('青铜');await root.locator('#search').press('Tab');await page.waitForTimeout(200);
 const ordersBeforeNavigation=await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-buddy-demo-v1')).orders);
 await root.locator('.content').evaluate(el=>{el.scrollTop=120;window.__mobileContent=el;});const navigationScroll=await root.locator('.content').evaluate(el=>el.scrollTop);
 for(const tab of ['play','bag','bank','market','more']){
  await page.locator(`[data-m-tab="${tab}"]`).tap();await root.waitFor({state:'hidden'});assert.equal(await launcher.isVisible(),false,tab);assert.equal(await root.isVisible(),false,tab);
  await page.locator(`[data-m-tab="${tab}"]`).tap();assert.equal(await launcher.isVisible(),true,tab);assert.equal(await root.isVisible(),false,tab);
  await launcher.tap();assert.equal(await root.isVisible(),true);assert.equal(await root.locator('#search').inputValue(),'青铜');assert.equal(await root.locator('.content').evaluate(el=>el.scrollTop),navigationScroll);assert.equal(await root.locator('.content').evaluate(el=>el===window.__mobileContent),true);
 }
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-buddy-demo-v1')).orders),ordersBeforeNavigation);checks.push('trusted mobile tab taps close the assistant only after native navigation; returning stays closed and reopening preserves orders, input, nodes and scroll');
 await root.locator('#search').fill('');await root.locator('#search').press('Tab');
 await page.evaluate(()=>{const button=document.querySelector('[data-m-tab="play"]');window.__playClick=button.onclick;button.onclick=()=>{};});await page.locator('[data-m-tab="play"]').tap();assert.equal(await root.isVisible(),true);await page.evaluate(()=>document.querySelector('[data-m-tab="play"]').onclick=window.__playClick);
 await page.evaluate(()=>document.querySelector('[data-m-tab="play"]').click());assert.equal(await root.isVisible(),true);await page.evaluate(()=>document.querySelector('[data-m-tab="play"]').click());assert.equal(await root.isVisible(),true);
 checks.push('failed native navigation and programmatic tab clicks leave the mobile assistant open');
 // Native market/bank windows can mark the root tab while the shell stays on world.
 await page.evaluate(()=>document.documentElement.dataset.mtab='market');assert.equal(await launcher.isVisible(),false);await page.evaluate(()=>document.documentElement.dataset.mtab='world');assert.equal(await launcher.isVisible(),true);
 await page.evaluate(()=>{const overlay=document.createElement('div');overlay.className='veil';overlay.style.cssText='position:fixed;inset:100px;background:#333';document.body.append(overlay);});assert.equal(await launcher.isVisible(),false);
 await page.locator('.veil').evaluate(el=>el.remove());assert.equal(await launcher.isVisible(),true);
 await page.evaluate(()=>{const sub=document.createElement('section');sub.dataset.mSub='';sub.style.cssText='position:fixed;inset:100px;background:#333';document.body.append(sub);});assert.equal(await launcher.isVisible(),false);await page.locator('[data-m-sub]').evaluate(el=>el.hidden=true);assert.equal(await launcher.isVisible(),true);await page.locator('[data-m-sub]').evaluate(el=>el.remove());
 await page.evaluate(()=>delete document.documentElement.dataset.mtab);assert.equal(await launcher.isVisible(),false);await page.evaluate(()=>document.documentElement.dataset.mtab='world');assert.equal(await launcher.isVisible(),true);
 checks.push('mobile launcher appears only on world; play, bag, bank, market, more, native overlays, chat and unknown state hide it and returning restores it');
 await root.locator('[data-action="close"]').tap();await page.screenshot({path:'.test-artifacts/mobile/launcher.png'});await launcher.tap();assert.equal(await root.isVisible(),true);assert.equal(await page.evaluate(()=>window.__chatClicks),0);checks.push('touch launcher reopens assistant without triggering game chat');
 await chat.evaluate(el=>{const exit=document.createElement('button');exit.dataset.mExit='';exit.dataset.mFixtureExit='';el.parentElement.append(exit);});await page.waitForFunction(()=>document.querySelector('[data-buddy-launcher]').getBoundingClientRect().bottom+8<=document.querySelector('[data-m-exit]').getBoundingClientRect().top);
 await page.locator('[data-m-exit]').evaluate(el=>el.remove());await chat.evaluate(el=>{el.hidden=true;});assert.equal(await launcher.isVisible(),true);await chat.evaluate(el=>{el.hidden=false;const replacement=el.cloneNode(true);el.replaceWith(replacement);});await page.waitForFunction(()=>document.querySelectorAll('[data-buddy-launcher]').length===1);checks.push('launcher avoids existing game buttons and survives hidden or replaced chat anchors');
 await page.evaluate(()=>document.documentElement.lang='en');await launcher.getAttribute('aria-label').then(value=>assert.equal(value,'Crafting & Mastery Buddy'));await page.evaluate(()=>document.documentElement.lang='zh-CN');checks.push('mobile launcher follows game language independently of the hidden desktop navigation');
 await longPressTitle(root);await root.getByRole('menuitemcheckbox').tap();assert.equal(await root.locator('#execution-actions th').count(),6);await longPressTitle(root);await root.getByRole('menuitemcheckbox').tap();checks.push('long-press title shares the existing debug toggle and preserves the default hidden action columns');
 assert.equal(await root.locator('[data-action="action-status"],.action-status-details').count(),0);assert.ok(await root.locator('#execution-actions tr[title]').count()>0);checks.push('execution rows share material colors and title explanations without a mobile status control');
 await root.locator('#orders > summary').tap();await root.locator('[data-action="edit-order"]').first().tap();await root.locator('[data-action="plan-text"]').tap();await root.locator('[data-action="export-text"]').tap();await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').shadowRoot.querySelector('#plan-text')?.value.startsWith('DVI-BUDDY-PLAN:')).catch(async error=>{console.error(await root.locator('.content').evaluate(el=>({alert:el.querySelector('[role=alert]').textContent,transfer:el.querySelector('.transfer-text').outerHTML,value:el.querySelector('#plan-text').value})));throw error;});const plan=await root.locator('#plan-text').inputValue();assert.ok(plan.startsWith('DVI-BUDDY-PLAN:'));
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-buddy-demo-v1')).orders);
 await root.locator('#plan-text').fill('invalid');await root.locator('[data-action="import-text"]').tap();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-buddy-demo-v1')).orders),before);
 await root.locator('#plan-text').fill(plan);page.once('dialog',dialog=>dialog.accept());await root.locator('[data-action="import-text"]').tap();await root.locator('[data-action="close-transfer"]').tap();assert.equal(await root.locator('#plan-text').count(),0);checks.push('manual text export/import retains the current plan format, confirmation and invalid-input protection');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('blocked');},readText:async()=>{throw Error('blocked');}}}));
 await root.locator('[data-action="export-order"]').tap();await root.locator('.content > [role="alert"]').filter({hasText:'复制失败'}).waitFor();assert.ok((await root.locator('#plan-text').inputValue()).startsWith('DVI-BUDDY-PLAN:'));
 await root.locator('[data-action="close-transfer"]').tap();await root.locator('[data-action="import-order"]').tap();await root.locator('.content > [role="alert"]').filter({hasText:'读取剪贴板失败'}).waitFor();assert.equal(await root.locator('#plan-text').inputValue(),'');await root.locator('[data-action="close-transfer"]').tap();checks.push('clipboard read/write failures show explicit errors and retain a manual text path without altering orders');

 const input=root.locator('[data-order-name]');await input.focus();await page.evaluate(()=>{visualViewport.testHeight=440;visualViewport.dispatchEvent(new Event('resize'));});await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').getBoundingClientRect().bottom===440);
 assert.ok((await input.boundingBox()).y>=0);assert.ok((await input.boundingBox()).y+(await input.boundingBox()).height<=440);
 await page.evaluate(()=>{visualViewport.testHeight=null;visualViewport.dispatchEvent(new Event('resize'));});await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').getBoundingClientRect().bottom===786);checks.push('visual viewport keyboard shrink keeps input visible and restores panel height without saving mobile geometry');
 for(const size of [{width:320,height:720},{width:360,height:780},{width:430,height:900},{width:844,height:390}]){await page.setViewportSize(size);await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').getBoundingClientRect().width===innerWidth);const r=await root.boundingBox();assert.ok(r.y+r.height<=size.height-58);assert.equal(await root.locator('.resize-right').isVisible(),false);}
 assert.equal(await page.evaluate(()=>localStorage.getItem('dvi-buddy-demo-geometry-v1')),saved);checks.push('320–430px portrait and coarse-pointer landscape retain mobile layout without overwriting desktop geometry');
 await page.setViewportSize({width:390,height:844});await root.locator('#execution-actions').scrollIntoViewIfNeeded();await page.screenshot({path:'.test-artifacts/mobile/portrait.png'});
 await page.setViewportSize({width:1440,height:1080});await page.waitForFunction(()=>!document.querySelector('#deepveinidle-buddy').hasAttribute('data-mobile'));bounds=await root.boundingBox();for(const key of ['x','y','width','height'])assert.equal(bounds[key],desktop[key]);assert.equal(await root.locator('[data-action="settings"]').count(),0);assert.equal(await root.locator('.resize-right').isVisible(),true);checks.push('leaving mobile mode restores desktop geometry, launcher and resize handles');
 // Use the existing guarded game fixture, with mobile DOM and navigation behavior.
 await build({entryPoints:['tests/integration-entry.js'],outfile:'.test-artifacts/mobile/harness.js',bundle:true,format:'esm',target:'es2022',loader:{'.css':'text'}});
 await page.setViewportSize({width:390,height:844});await page.goto(baseUrl+'/tests/game-integration-fixture.html');
 const player=playerFixture();for(const skill of [...craftingSkills,...gatheringSkills])player.skills[skill]=game.levelXp(70);for(const slot of [...craftingSlots,...gatheringSlots])player.equipment[slot]=null;
 Object.assign(player,{id:42,lastTick:1000,house:{},houseFurniture:{},collections:{40:9},masteries:{},perks:{},ironman:false,homeBank:null,bank:{1:20,2:10},pack:[],route:null,queue:[],queueSlots:3,workJobId:null,workRarity:0,held:false,raidHeld:false});
 const bronze=game.recipes.find(j=>j.output.itemId===40);
 await page.evaluate(async({player,bronze})=>{
  window.deepvein={session:{state:player,context:{windows:[]},tick:1000,guildInfo:null},routes:()=>window.__routes,panels:{show:name=>{
   window.__ui.push(['panel',name]);
   // Match the desktop panel switch: mobile tab changes do not undo these flags.
   for(const key of ['pack','worn','skills'])document.querySelector(`.${key}`).hidden=key!==name;
  }}};
  window.__testLines=[{kind:'craft',jobId:bronze,tier:0,count:100}];
  const {priceDefaults}=await import('/src/engine/item-prices.js');window.__testPrices=priceDefaults();window.__testPrices.quotes={1:{ask:{value:112,capturedAt:Date.now()}},2:{ask:{value:80,capturedAt:Date.now()}}};
  const {installMobileFixture}=await import('/tests/mobile-fixture.js');installMobileFixture();
  const bag=document.createElement('section');bag.dataset.view='bag';bag.innerHTML='<div class="pack">Inventory items</div><div class="worn">Worn items</div>';document.querySelector('.m-content').append(bag);
  const skills=document.createElement('div');skills.className='skills';skills.textContent='Skills';document.querySelector('[data-view="play"]').append(skills);
  const routes=document.querySelector('.routes');document.querySelector('.m-shell [data-view="play"]').append(routes);document.getElementById('game').style.zIndex='1';document.querySelector('[data-open="market"]').hidden=true;
  const style=document.createElement('style');style.textContent='.m-shell:not([data-mtab="bag"]) [data-view="bag"]{display:none!important}.m-shell:not([data-mtab="play"]) .routes{display:none!important}.m-on .m-shell .routes{pointer-events:auto}';document.head.append(style);
 },{player,bronze:bronze.id});
 await page.waitForFunction(()=>document.documentElement.classList.contains('m-on'));await page.addScriptTag({type:'module',url:baseUrl+'/.test-artifacts/mobile/harness.js'});await page.waitForFunction(()=>window.__panel?.getWorkspace().character.initialized);assert.equal(await page.locator('#deepveinidle-buddy').isVisible(),false);assert.equal(await page.locator('[data-buddy-hint]').isVisible(),false);checks.push('mobile starts hidden without an opening hint');await page.locator('[data-buddy-launcher]').click();
 const r=page.locator('#deepveinidle-buddy');await longPressTitle(r);await r.getByRole('menuitemcheckbox').tap();
 await page.evaluate(()=>document.querySelector('.m-shell').dataset.mtab='more');await r.locator('[data-action="prefill-action"]').tap();await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').hasAttribute('data-closed'));assert.deepEqual(await page.evaluate(()=>window.__mobileTabClicks),['play']);assert.equal(await page.evaluate(()=>window.__routes.amount),100);assert.equal(await page.evaluate(()=>window.__routes.pending.jobId),bronze.id);assert.equal(await page.locator('[data-buddy-hint]').isVisible(),false);assert.equal(await page.locator('[data-buddy-hint]').textContent(),'');checks.push('mobile action prefill enters play, fills the draft and closes only after success');
 await page.evaluate(()=>window.__panel.open());await r.locator('[data-action="prefill-action"]').tap();await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').hasAttribute('data-closed'));assert.deepEqual(await page.evaluate(()=>window.__mobileTabClicks),['play']);checks.push('already active play tab is not clicked twice or toggled back to world');
 assert.equal(await page.evaluate(()=>window.__ui.filter(([kind])=>kind==='panel').length),0);
 await page.locator('[data-m-tab="bag"]').tap();
 assert.equal(await page.locator('[data-view="bag"] .pack').isVisible(),true);
 assert.equal(await page.locator('[data-view="bag"] .worn').isVisible(),true);
 await page.locator('[data-m-tab="bag"]').tap();
 checks.push('mobile action prefill never switches desktop panels; inventory and worn items remain visible when returning to bag');
 await page.evaluate(()=>{window.__panel.open();window.__maxAmount=2;});await r.locator('[data-action="prefill-action"]').tap();await page.locator('[data-buddy-hint]').filter({hasText:'输入'}).waitFor();assert.equal(await r.isVisible(),true);assert.ok((await page.locator('[data-buddy-hint]').textContent()).includes('输入'));checks.push('rejected mobile draft values keep the panel open and show the actual failure');
 await page.screenshot({path:'.test-artifacts/mobile/prefill-failure.png'});
 // Tapping the selected native tab folds back to world, including after prefill failure.
 await page.locator('[data-m-tab="play"]').tap();
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.mtab),'world');
 await page.waitForTimeout(50);assert.equal(await r.isVisible(),false);
 await page.locator('[data-m-tab="play"]').tap();await page.evaluate(()=>window.__panel.open());
 checks.push('tapping the selected mobile tab after a failed draft closes the assistant when the game returns to world');
 await page.evaluate(()=>{window.__maxAmount=1e9;window.__routes.pending=null;document.querySelector('[data-market-window]').hidden=true;});await r.locator('[data-action="prefill-purchase"][data-item="1"]').tap();await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').hasAttribute('data-closed'));assert.equal(await page.locator('[data-buddy-hint]').isVisible(),false);assert.equal(await page.locator('[data-buddy-hint]').textContent(),'');assert.equal(await page.locator('[data-trade-qty-in]').inputValue(),'80');assert.equal(await page.locator('[data-trade-price-in]').inputValue(),'112');assert.equal(await page.evaluate(()=>window.__mobileTabClicks.at(-1)),'market');assert.deepEqual(await page.evaluate(()=>window.__commands),[]);checks.push('mobile market uses the visible tab, fills quantity/price and closes after success with zero game action submissions');
 await page.screenshot({path:'.test-artifacts/mobile/prefill.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.mtab),'market');assert.equal(await page.evaluate(()=>document.querySelector('.m-shell').dataset.mtab),'play');
 await page.evaluate(()=>window.__panel.open());await r.locator('[data-action="prefill-action"]').tap();await r.waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.mtab),'play');assert.equal(await page.locator('[data-market-window]').isVisible(),false);assert.equal(await page.evaluate(()=>window.__routes.amount),100);assert.equal(await page.evaluate(()=>window.__mobileTabClicks.at(-1)),'play');assert.deepEqual(await page.evaluate(()=>window.__commands),[]);checks.push('action prefill leaves a market overlay even when its underlying mobile container still says play');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}catch(error){await page?.screenshot({path:'.test-artifacts/mobile/failure.png'});console.error(JSON.stringify({checks,errors,error:error.stack},null,2));throw error;}finally{await browser.close();}
