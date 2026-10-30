import {build} from 'esbuild';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {launchBrowser,baseUrl} from './browser-helper.mjs';
import {userDefaults} from '../src/workspace.js';
import {gameSnapshot} from './game-snapshot.mjs';
await fs.mkdir('.test-artifacts/user-storage',{recursive:true});
await build({stdin:{contents:`
 import {mountPanel} from './src/app.js';import css from './src/theme.css';
 window.mountUserPanel=async(raw,fail=false)=>{
  window.panel?.dispose();document.querySelector('#deepveinidle-buddy')?.remove();
  window.raw=raw;window.writes=[];window.failRead=fail;window.failSet=false;
  const host=document.createElement('div');host.id='deepveinidle-buddy';document.body.append(host);
  window.panel=await mountPanel(host.attachShadow({mode:'open'}),{css,storageKey:'user-test',platform:{
   get:async(key,fallback)=>{if(key!=='user-test')return fallback;if(window.failRead)throw Error('readFailed');return structuredClone(window.raw);},
   set:async(key,value)=>{if(key!=='user-test')return;if(window.failSet)throw Error('writeFailed');window.raw=structuredClone(value);window.writes.push(structuredClone(value));},
   market:async()=>{throw Error('disabled in fixture');},copy:()=>{},readClipboard:()=>{},
  }});window.panel.open();
 };
 `,resolveDir:process.cwd()},outfile:'.test-artifacts/user-storage/harness.js',bundle:true,format:'iife',target:'es2022',loader:{'.css':'text'}});
const browser=await launchBrowser(),checks=[],errors=[];
try{
 const page=await browser.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(baseUrl+'/tests/game-integration-fixture.html');await page.addScriptTag({url:baseUrl+'/.test-artifacts/user-storage/harness.js'});
 const root=page.locator('#deepveinidle-buddy');let sequence=0;
 const send=async(snapshot)=>{await page.evaluate(envelope=>window.panel.receive(envelope),{role:42,connection:1,sequence:++sequence,status:'live',source:'client',snapshot});};
 const writes=()=>page.evaluate(()=>window.writes.length);
 const mount=async(raw,fail=false)=>{sequence=0;await page.evaluate(({raw,fail})=>window.mountUserPanel(raw,fail),{raw,fail});};
 const character=()=>page.evaluate(()=>window.panel.getWorkspace().character);
 const base=userDefaults();base.orders[0].lines=[{kind:'collection',itemId:40,jobId:41,target:10}];
 await mount(base);assert.equal((await character()).initialized,false);await send(gameSnapshot());await send(gameSnapshot({bank:{1:17}}));
 assert.equal((await character()).bank[1],17);assert.equal(await writes(),0);checks.push('initial and changed character snapshots stay in memory with zero writes');
 const bad=gameSnapshot();bad.worldBuffs=null;await send(bad);assert.equal((await character()).bank[1],17);
 await root.locator('#global-product-price-mode').selectOption('ask');await page.waitForFunction(()=>window.raw.productPriceMode==='ask');
 const stored=await page.evaluate(()=>window.raw);assert.equal(stored.version,2);assert.equal(Object.hasOwn(stored,'character'),false);assert.equal(Object.hasOwn(stored,'prices'),false);checks.push('invalid game snapshot keeps valid character and does not block saving user input');
 const beforeCharacter=await character();
 await page.evaluate(()=>{window.raw.revision++;window.raw.filters.craft.query='青铜';window.raw.materialPriceMode='bid';});
 await root.locator('#global-product-price-mode').selectOption('bid');await root.evaluate(el=>el.shadowRoot.activeElement?.blur());await root.locator('.storage-alert').waitFor();
 const beforeReload=await writes();await root.locator('[data-action="reload"]').click();assert.equal(await root.locator('#search').inputValue(),'青铜');assert.equal(await root.locator('#global-material-price-mode').inputValue(),'bid');
 assert.equal(await writes(),beforeReload);assert.deepEqual(await character(),{...beforeCharacter,buyMode:'bid'});
 await root.locator('#search').fill('青铜锭');await page.waitForFunction(()=>window.raw.filters.craft.query==='青铜锭');checks.push('reload preserves character, restores local filter controls, and does not write on load');
 await page.evaluate(()=>{window.raw.revision++;});await root.locator('#global-product-price-mode').selectOption('bid');await root.evaluate(el=>el.shadowRoot.activeElement?.blur());await root.locator('.storage-alert').waitFor();
 await page.evaluate(()=>window.failSet=true);const beforeFailedReset=await page.evaluate(()=>window.panel.getWorkspace());await root.locator('[data-action="reset-storage"]').click();assert.deepEqual(await page.evaluate(()=>window.panel.getWorkspace()),beforeFailedReset);
 await page.evaluate(()=>window.failSet=false);await root.locator('[data-action="reset-storage"]').click();assert.equal(await root.locator('#search').inputValue(),'');assert.equal(await root.locator('#global-material-price-mode').inputValue(),'ask');assert.equal((await character()).bank[1],17);
 await root.locator('#search').fill('new');await page.waitForFunction(()=>window.raw?.filters.craft.query==='new');checks.push('failed reset keeps workspace; successful reset preserves character and fully resets user controls');
 await page.evaluate(()=>window.raw=null);await root.locator('#global-product-price-mode').selectOption('ask');
 // Force a changed setting even if ask is already selected.
 await root.locator('#global-product-price-mode').selectOption('bid');await root.evaluate(el=>el.shadowRoot.activeElement?.blur());await root.locator('.storage-alert').waitFor();await root.locator('[data-action="reload"]').click();assert.equal(await root.locator('.storage-alert').isHidden(),true);
 await root.locator('#search').fill('after deletion');await page.waitForFunction(()=>window.raw?.filters.craft.query==='after deletion');checks.push('explicit reload after external deletion unblocks persistence');
 await mount({...base,autoRemove:true});await send(gameSnapshot());assert.equal(await writes(),0);await send(gameSnapshot({collections:{40:10}}));await page.waitForFunction(()=>window.raw.orders[0].lines.length===0);
 const removedWrites=await writes();await send(gameSnapshot({collections:{40:10}}));assert.equal(await writes(),removedWrites);checks.push('automatic completion removal saves only an actual user order change');
 await mount({...base,version:99});const original=await page.evaluate(()=>structuredClone(window.raw));await send(gameSnapshot());await root.locator('#orders > summary').click();await root.locator('[data-action="new-order"]').click();assert.deepEqual(await page.evaluate(()=>window.raw),original);assert.equal(await writes(),0);assert.ok((await root.locator('.storage-alert').textContent()).includes('格式不支持'));checks.push('unsupported storage version remains untouched during synchronization and edits');
 await mount(base,true);await page.evaluate(()=>window.failRead=false);await send(gameSnapshot());await root.locator('#orders > summary').click();await root.locator('[data-action="new-order"]').click();assert.equal(await writes(),0);assert.ok((await root.locator('.storage-alert').textContent()).includes('readFailed'));checks.push('initial read failure keeps root error and blocks later automatic writes');
 await mount(base);assert.equal((await character()).initialized,false);assert.equal((await character()).bank,null);checks.push('remount restores user orders while waiting for fresh game data');
 assert.deepEqual(errors,[]);checks.push('no browser errors');console.log(JSON.stringify({passed:checks.length,checks},null,2));
}finally{await browser.close();}
