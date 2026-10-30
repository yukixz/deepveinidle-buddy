import {build} from 'esbuild';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {launchBrowser,baseUrl,toggleGameLanguage} from './browser-helper.mjs';
import {userDefaults,exportOrderText} from '../src/workspace.js';
import {gameSnapshot} from './game-snapshot.mjs';
await fs.mkdir('.test-artifacts/assistant-modes',{recursive:true});
await build({stdin:{contents:`
 import {collectionRows} from './src/engine/collection-model.js';
 import {mountPanel} from './src/app.js';import css from './src/theme.css';import {createGamePrefill} from './src/game-prefill.js';
 window.mountModes=async(raw,snapshot)=>{
  window.panel?.dispose();document.querySelector('#deepveinidle-buddy')?.remove();window.raw=raw;window.writes=[];window.hints=[];window.sequence=0;
  window.deepvein={session:{state:{id:42}},routes:()=>window.__routes,panels:{show:name=>window.__ui.push(['panel',name])}};
  const host=document.createElement('div');host.id='deepveinidle-buddy';document.body.append(host);
  const integration=createGamePrefill(window,{wait:ms=>window.__wait?window.__wait(ms):new Promise(resolve=>setTimeout(resolve,ms))});
  window.panel=await mountPanel(host.attachShadow({mode:'open'}),{css,storageKey:'modes-test',platform:{
   get:async(key,fallback)=>key==='modes-test'?structuredClone(window.raw):key.startsWith('dvi-buddy-debug')?true:fallback,
   set:async(key,value)=>{if(key==='modes-test'){window.raw=structuredClone(value);window.writes.push(value);}},
   market:async()=>{throw Error('fixture-market');},copy:async value=>window.clip=value,readClipboard:()=>new Promise(resolve=>window.resolveClipboard=resolve)
  },gameIntegration:integration,onPrefillFeedback:value=>window.hints.push(value)});
  window.gatherAttempts=key=>collectionRows(window.panel.getWorkspace().character).find(row=>[row.id,row.jobId,row.target].join(':')===key).attempts;
  window.expectedGather=key=>Math.ceil(window.gatherAttempts(key));
  window.sendSnapshot=value=>window.panel.receive({role:'42',connection:1,sequence:++window.sequence,status:'live',source:'client',snapshot:value});
  window.sendSnapshot(snapshot);window.panel.open();
 };
 `,resolveDir:process.cwd()},outfile:'.test-artifacts/assistant-modes/harness.js',bundle:true,format:'iife',target:'es2022',loader:{'.css':'text'}});
const browser=await launchBrowser(),checks=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1080}});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(baseUrl+'/tests/game-integration-fixture.html');await page.addScriptTag({url:baseUrl+'/.test-artifacts/assistant-modes/harness.js'});
 const root=page.locator('#deepveinidle-buddy'),select=async mode=>{await root.locator(`[data-action="mode-${mode}"]`).click();await root.locator(`[data-action="mode-${mode}"][aria-pressed="true"]`).waitFor();};
 const raw=userDefaults();raw.selectedMode='collection';raw.orders[0].lines=[{kind:'craft',jobId:41,tier:0,count:10000}];raw.collectionOrder.lines=[{kind:'collection',itemId:40,jobId:41,target:100}];
 const mount=async value=>page.evaluate(({raw,snapshot})=>window.mountModes(raw,snapshot),{raw:value,snapshot:gameSnapshot()});
 await mount({...raw,selectedMode:'craft'});
 assert.deepEqual(await root.locator('#global-settings .tabs button').allTextContents(),['制造','收藏(制造)','收藏(采集)']);
 assert.equal(await root.locator('[data-action="mode-craft"]').getAttribute('aria-pressed'),'true');
 await mount(raw);
 assert.deepEqual(await root.locator('.content > section').evaluateAll(els=>els.map(e=>e.id)),['global-settings','recipes','procurement','execution-plan']);
 assert.equal(await root.locator('[data-pricing="material"]').count(),1);assert.equal(await root.locator('[data-pricing="product"]').count(),1);assert.equal(await root.locator('#orders').count(),0);
 assert.equal(await root.locator('[data-material="1"] td').nth(3).textContent(),'91 / 0 / 0');
 const row=root.locator('[data-execution-action="collection:40"]');assert.equal(await row.locator('td').nth(3).textContent(),'91');assert.match(await row.textContent(),/9 → 100/);
 assert.deepEqual(await row.locator('td.actions button').allTextContents(),['+','−','×','执行']);
 assert.equal(await row.getByRole('button',{name:'移除',exact:true}).textContent(),'×');
 const autoHeader=await root.locator('#auto-remove').evaluate(input=>{const heading=input.closest('.execution-heading'),title=heading?.querySelector('h2').getBoundingClientRect(),label=input.parentElement.getBoundingClientRect(),bounds=heading?.getBoundingClientRect();return !!heading&&Math.abs(title.top-label.top)<2&&Math.abs(label.right-bounds.right)<2;});assert.ok(autoHeader);
 checks.push('collection manufacturing shows three sections, both global pricing controls and isolated fixed-order demand');
 await row.locator('[data-action="target-up"]').click();assert.match(await row.textContent(),/9 → 1,000/);assert.equal(await row.locator('td').nth(3).textContent(),'991');
 await row.locator('[data-action="target-down"]').click();assert.equal(await row.locator('td').nth(3).textContent(),'91');
 await root.locator('#search').fill('no-matching-recipe');await root.locator('#search').press('Tab');await root.locator('[data-action="add-collection"]').first().waitFor({state:'detached'});assert.equal(await root.locator('[data-action="add-collection"]').count(),0);assert.equal(await row.count(),1);
 checks.push('target edits use collection thresholds and update procurement even when candidates are filtered out');
 await page.evaluate(snapshot=>window.sendSnapshot(snapshot),gameSnapshot({collections:{40:100}}));await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').shadowRoot.querySelector('[data-execution-action="collection:40"]').textContent.includes('已完成'));assert.match(await row.textContent(),/已完成/);assert.equal(await row.locator('td').nth(3).textContent(),'0');assert.equal(await row.locator('[data-action="prefill-action"]').isDisabled(),true);await row.locator('[data-action="remove-line"]').click();assert.equal(await row.count(),0);
 checks.push('completed targets remain removable and never turn into executable attempts');
 await select('collection-gather');assert.deepEqual(await root.locator('.content > section').evaluateAll(els=>els.map(e=>e.id)),['global-settings','recipes']);assert.equal(await root.locator('[data-action="add-collection"],[data-action="add-all"]').count(),0);
 // Sparse results in a tall window must not stretch sections or their internal rows.
 const savedHeight=await root.evaluate(host=>host.style.height);
 await root.locator('#search').fill('no-matching-recipe');await root.locator('#search').press('Tab');
 await root.locator('[data-action="prefill-gather"]').first().waitFor({state:'detached'});
 const layoutAt=height=>root.evaluate((host,height)=>{host.style.height=height;const r=host.shadowRoot;return [...r.querySelectorAll('.content > *,#global-settings > *,#recipes > *')].map(el=>({top:el.getBoundingClientRect().top,height:el.getBoundingClientRect().height}));},height);
 const compact=await layoutAt('750px'),tall=await layoutAt('950px');
 for(let i=0;i<compact.length;i++)for(const key of ['top','height'])assert.ok(Math.abs(compact[i][key]-tall[i][key])<1,`gather layout ${i}.${key}: ${compact[i][key]} -> ${tall[i][key]}`);
 await root.evaluate((host,height)=>host.style.height=height,savedHeight);
 await root.locator('#search').fill('');await root.locator('#search').press('Tab');await root.locator('[data-action="prefill-gather"]').first().waitFor();
 checks.push('sparse gathering content retains section and control spacing when the window grows');
 const ordersBefore=await page.evaluate(()=>JSON.stringify([window.panel.getWorkspace().orders,window.panel.getWorkspace().collectionOrder]));
 assert.deepEqual((await root.locator('#recipe-candidates th').allTextContents()).map(value=>value.replace(/[▲▼]/g,'').trim()),['物品','稀有度','当前→目标','精通点','时间','秒/点','执行次数','操作']);
 assert.equal(await root.locator('#recipe-candidates tbody tr').first().locator('td').nth(2).locator('small').count(),0);
 assert.equal(await root.locator('[data-sort="coins"],[data-sort="cost"]').count(),0);
 assert.equal(await root.locator('[data-sort="time"]').evaluate(node=>node.parentElement.getAttribute('aria-sort')),'ascending');
 const execute=root.locator('[data-action="prefill-gather"]').first(),key=await execute.getAttribute('data-key');assert.ok(key);await execute.click();await page.waitForFunction(()=>window.__routes.pending!==null||window.hints.some(value=>value&&!value.includes('正在')));assert.notEqual(await page.evaluate(()=>window.__routes.pending),null,JSON.stringify(await page.evaluate(()=>window.hints)));
 assert.equal(await page.evaluate(()=>window.__routes.pending.jobId),Number(key.split(':')[1]));assert.equal(await page.evaluate(()=>window.__routes.amount),await page.evaluate(key=>window.expectedGather(key),key));const attempts=await execute.locator('xpath=ancestor::tr').locator('[data-collection-attempts]').textContent();assert.equal(attempts,await page.evaluate(key=>window.gatherAttempts(key).toLocaleString('zh-CN',{maximumFractionDigits:2}),key));
 assert.equal(await page.evaluate(()=>JSON.stringify([window.panel.getWorkspace().orders,window.panel.getWorkspace().collectionOrder])),ordersBefore);assert.deepEqual(await page.evaluate(()=>window.__commands),[]);
 checks.push('gathering executes directly from a candidate with integer draft counts, no order mutation and zero commands');
 // Delay a second prefill after the game options are intentionally folded.
 await page.evaluate(()=>{document.querySelector('[data-opt-line]').setAttribute('aria-expanded','false');document.querySelector('[data-opt-sheet]').hidden=true;window.__blockOptionOpen=true;window.__wait=()=>new Promise(resolve=>window.releaseWait=resolve);});
 await execute.click();await page.waitForFunction(()=>!!window.releaseWait);await select('craft');await select('collection-gather');await page.evaluate(()=>{window.__wait=null;window.__blockOptionOpen=false;window.releaseWait();});
 await page.waitForFunction(()=>window.hints.some(value=>value.includes('请重试')));assert.deepEqual(await page.evaluate(()=>window.__commands),[]);
 checks.push('switching away and back invalidates a pending gathering draft');
 await select('craft');assert.deepEqual(await root.locator('.content > section').evaluateAll(els=>els.map(e=>e.id)),['global-settings','recipes','procurement','execution-plan']);assert.equal(await root.locator('#orders').count(),1);assert.equal(await root.locator('[data-pricing="product"]').count(),1);assert.equal(await root.locator('[data-material="1"] td').nth(3).textContent(),'10,000 / 0 / 0');
 await root.locator('#global-product-price-mode').selectOption('ask');await select('collection-craft');await select('craft');assert.equal(await root.locator('#global-product-price-mode').inputValue(),'ask');
 await root.locator('#orders > summary').click();await root.locator('[data-action="edit-order"]').first().click();await root.locator('[data-action="import-order"]').click();await page.waitForFunction(()=>!!window.resolveClipboard);
 await select('collection-gather');await select('craft');await page.evaluate(text=>window.resolveClipboard(text),await exportOrderText({...raw.orders[0],name:'must-not-import'}));await page.waitForFunction(()=>!document.querySelector('#deepveinidle-buddy').shadowRoot.querySelector('[data-action="import-order"]')?.disabled);assert.equal(await page.evaluate(()=>window.raw.orders[0].lines[0].count),10000);assert.equal(await page.evaluate(()=>window.raw.orders[0].name),raw.orders[0].name);
 checks.push('manufacturing keeps multi-order controls and global pricing; switching cancels pending transfer');
 await mount(raw);
 await page.evaluate(()=>{const r=document.querySelector('#deepveinidle-buddy').shadowRoot;window.staleTarget=r.querySelector('[data-action="target-up"]');window.staleTarget.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1}));r.querySelector('[data-action="mode-craft"]').click();window.staleConnected=window.staleTarget.isConnected;window.staleDisabled=window.staleTarget.disabled;window.staleTarget.dispatchEvent(new MouseEvent('click',{bubbles:true}));window.dispatchEvent(new PointerEvent('pointerup',{pointerId:1}));});
 assert.equal(await page.evaluate(()=>window.staleConnected&&window.staleDisabled),true);assert.equal(await page.evaluate(()=>window.panel.getWorkspace().collectionOrder.lines[0].target),100);
 checks.push('deferred stale controls are disabled and cannot edit the next mode');
 await mount(raw);await root.locator('.titlebar h1').click({button:'right'});await root.getByRole('menuitemcheckbox').click();assert.equal(await row.locator('[data-action="target-up"]').count(),1);assert.equal(await row.locator('[data-action="prefill-action"]').count(),0);
 await row.locator('[data-action="target-down"]').click();assert.match(await row.textContent(),/9 → 10/);await row.locator('[data-action="target-down"]').click();assert.equal(await row.locator('[data-action="target-down"]').isDisabled(),true);
 await select('collection-gather');assert.equal(await root.locator('[data-action="prefill-gather"]').count(),0);assert.equal(await root.locator('#recipe-candidates th').count(),7);
 checks.push('turning debug off hides prefill only, leaves target operations and disables the lower boundary');
 await select('collection-craft');await toggleGameLanguage(page);assert.ok((await root.locator('#execution-actions').textContent()).includes('Current → target'));await page.setViewportSize({width:390,height:844});await page.evaluate(async()=>{const {installMobileFixture}=await import('/tests/mobile-fixture.js');installMobileFixture();});await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').hasAttribute('data-mobile'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await root.locator('#execution-actions').screenshot({path:'.test-artifacts/assistant-modes/mobile-execution.png'});await page.screenshot({path:'.test-artifacts/assistant-modes/mobile.png'});
 checks.push('translated editable plans fit the mobile layout with internal horizontal scrolling');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:checks.length,checks},null,2));
}finally{await browser.close();}
