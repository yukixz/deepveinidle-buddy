import {launchBrowser,baseUrl} from './browser-helper.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await launchBrowser(),checks=[],errors=[];
try{
 const script=await fs.readFile('dist/deepveinidle-buddy.user.js','utf8');
 const name=script.match(/^\/\/ @name\s+(.+)$/m)?.[1];
 assert.equal(name,'DeepVeinIdle-Buddy');
 assert.match(name,/^[\x21-\x7E]+$/);
 assert.match(script,/^\/\/ @name:zh-CN +Deep Vein Idle · 工匠精通助手$/m);
 assert.match(script,/^\/\/ @name:en +Deep Vein Idle · Crafting & Mastery Buddy$/m);
 assert.match(script,/^\/\/ @namespace\s+https:\/\/dvi-lab\.pages\.dev$/m);
 assert.match(script,/^\/\/ @author\s+Alice$/m);
 assert.match(script,/^\/\/ @license\s+MIT$/m);
 const grants=[...script.matchAll(/^\/\/ @grant\s+(\S+)$/gm)].map(match=>match[1]);
 assert.deepEqual(grants,['unsafeWindow','GM_getValue','GM_setValue','GM_xmlhttpRequest','GM_setClipboard']);
 const description=script.match(/^\/\/ @description\s+(.+)$/m)?.[1];
 assert.ok(description);assert.doesNotMatch(description,/预填|prefill|调试|debug/i);
 const englishDescription=script.match(/^\/\/ @description:en\s+(.+)$/m)?.[1];
 assert.equal(englishDescription,'In-game assistant for mixed crafting and collection orders; syncs character data in real time and summarizes procurement materials and execution plans.');
 assert.doesNotMatch(englishDescription,/prefill|debug/i);
 const readme=await fs.readFile('README.md','utf8');assert.doesNotMatch(readme,/预填|prefill|启用调试功能|Enable debug features/i);
 checks.push('built userscript has ASCII default name, localized names, MIT license, namespace, author, five grants and no public prefill introduction');
 const page=await browser.newPage({viewport:{width:1440,height:1080}});page.on('pageerror',e=>errors.push(e.message));
 const root=page.locator('#deepveinidle-buddy'),menu=root.getByRole('menu'),toggle=root.getByRole('menuitemcheckbox');
 const open=()=>root.locator('.titlebar h1').click({button:'right'});
 await page.goto(baseUrl);await page.locator("[data-buddy-launcher]").click();await root.locator('.resize-right').waitFor();
 assert.equal(await root.evaluate(el=>getComputedStyle(el).zIndex),'7');assert.equal(await root.locator('#execution-actions th').count(),5);assert.equal(await root.locator('#purchase-materials th').count(),6);assert.equal(await root.locator('[data-action^="prefill-"]').count(),0);assert.doesNotMatch(await root.locator('.panel-mount').textContent(),/预填|prefill|调试|debug/i);checks.push('z-index is 7; default panel has no debug columns or prefill instructions');
 await root.locator('[data-action="language"]').click({button:'right'});assert.equal(await menu.isVisible(),false);
 await open();assert.equal(await toggle.textContent(),'启用调试功能');assert.equal(await toggle.getAttribute('aria-checked'),'false');await page.keyboard.press('Escape');assert.equal(await menu.isVisible(),false);
 await open();await root.locator('h2').first().click();assert.equal(await menu.isVisible(),false);checks.push('title blank opens menu; controls keep native context menu; Escape and outside click dismiss');
 await open();await toggle.click();await page.waitForFunction(()=>localStorage.getItem('dvi-buddy-demo-debug-v1')==='true');assert.equal(await root.locator('#execution-actions th').count(),6);assert.equal(await root.locator('#purchase-materials th').count(),7);assert.ok(await root.locator('[data-action^="prefill-"]').count()>0);checks.push('opt-in adds both complete action columns');
 await page.reload();await page.locator("[data-buddy-launcher]").click();await root.locator('.resize-right').waitFor();assert.equal(await root.locator('#execution-actions th').count(),6);
 await open();await toggle.click();assert.equal(await root.locator('#execution-actions th').count(),5);await page.reload();await page.locator("[data-buddy-launcher]").click();await root.locator('.resize-right').waitFor();assert.equal(await root.locator('#execution-actions th').count(),5);checks.push('local preference survives reload with either enabled or disabled value');
 await root.locator('[data-action="language"]').click();await open();assert.equal(await toggle.textContent(),'Enable debug features');await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});await root.locator('.titlebar').dispatchEvent('contextmenu',{clientX:389,clientY:843});const bounds=await menu.boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=390&&bounds.y+bounds.height<=844);await page.keyboard.press('Escape');checks.push('menu supports English and stays within viewport');
 // Exercise storage failures and site/role boundaries with the same production menu module.
 const result=await page.evaluate(async()=>{
  const {installDebugMenu}=await import('/src/debug-menu.js');const values=new Map(),seen=[],hosts=[];let failWrite=false;
  const platform={get:async(k,v)=>values.has(k)?values.get(k):v,set:async(k,v)=>{if(failWrite)throw Error('write failed');values.set(k,v);}};
  async function mount(key){const host=document.createElement('div');document.body.append(host);hosts.push(host);const root=host.attachShadow({mode:'open'});root.innerHTML='<header class="titlebar">Title</header>';const control=await installDebugMenu(root,{platform,key,label:()=> '启用调试功能',onChange:()=>{},onError:e=>seen.push(e.message)});return {root,control};}
  const click=async m=>{m.root.querySelector('button').click();await new Promise(r=>setTimeout(r,0));};
  const a=await mount('site:a');await click(a);a.control.dispose();const roleB=await mount('site:a'),siteB=await mount('site:b'),demo=await mount('demo');
  const boundaries=[roleB.control.enabled,siteB.control.enabled,demo.control.enabled];
  failWrite=true;await click(roleB);const failedSave=[roleB.control.enabled,values.get('site:a')];failWrite=false;
  values.set('bad',{invalid:true});const bad=await mount('bad');await click(bad);const protectedValue=values.get('bad');
  values.set('read-fail',false);const readFailHost=document.createElement('div');document.body.append(readFailHost);hosts.push(readFailHost);const readFail=await installDebugMenu(readFailHost.attachShadow({mode:'open'}),{platform:{...platform,get:async()=>{throw Error('read failed');}},key:'read-fail',label:()=>'',onChange:()=>{},onError:e=>seen.push(e.message)});
  const readFailed=readFail.enabled;readFail.dispose();
  for(const m of [roleB,siteB,demo,bad])m.control.dispose();for(const host of hosts)host.remove();
  return {boundaries,failedSave,protectedValue,readFailed,seen};
 });
 assert.deepEqual(result.boundaries,[true,false,false]);assert.deepEqual(result.failedSave,[true,true]);assert.deepEqual(result.protectedValue,{invalid:true});assert.equal(result.readFailed,false);assert.deepEqual(result.seen,['write failed','invalidDebugPreference','read failed']);checks.push('role reuse, site/demo isolation, explicit storage errors and invalid-value protection');
 await page.evaluate(()=>localStorage.setItem('dvi-buddy-demo-debug-v1','"bad"'));await page.reload();await page.locator("[data-buddy-launcher]").click();await root.locator('.resize-right').waitFor();assert.ok((await root.locator('[role="alert"]').textContent()).includes('Invalid debug preference'));assert.equal(await root.locator('#execution-actions th').count(),5);await open();assert.equal(await toggle.isDisabled(),true);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-buddy-demo-debug-v1'))),'bad');checks.push('invalid saved preference fails closed visibly and cannot be overwritten');
 assert.deepEqual(errors,[]);await fs.mkdir('.test-artifacts/debug-menu',{recursive:true});await fs.writeFile('.test-artifacts/debug-menu/summary.json',JSON.stringify({checks,errors},null,2)+'\n');console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}finally{await browser.close();}
