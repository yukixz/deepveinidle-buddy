import {build} from 'esbuild';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {launchBrowser,baseUrl} from './browser-helper.mjs';
await fs.mkdir('.test-artifacts/stable-view',{recursive:true});
await build({stdin:{contents:"import {createStableView} from './src/stable-view.js';window.createStableView=createStableView;",resolveDir:process.cwd()},bundle:true,outfile:'.test-artifacts/stable-view/harness.js'});
const browser=await launchBrowser(),checks=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1000,height:800}});page.on('pageerror',error=>errors.push(error.message));
 await page.goto(baseUrl+'/tests/fixture.html');
 await page.addScriptTag({url:baseUrl+'/.test-artifacts/stable-view/harness.js'});
 await page.evaluate(()=>{
  const host=document.createElement('div');host.id='stable-fixture';document.body.append(host);
  const root=host.attachShadow({mode:'open'}),container=document.createElement('div');root.append(container);
  window.state={value:'saved',label:'Before',number:1,option:false,rows:Array.from({length:30},(_,i)=>i)};
  const render=()=>{
   const template=document.createElement('template');
   template.innerHTML=`<div id="content" style="position:fixed;top:10px;left:10px;width:600px;height:400px;overflow:auto;background:white;color:black">
    ${state.prefix?'<div id="prefix">New section</div>':''}
    <p id="label">${state.label}</p><span id="number">${state.number}</span>
    <p id="alert">${state.alert??''}</p><button id="action" ${state.disabled?'disabled':''}>Action</button>
    <input id="draft" value="${state.value}">
    <select id="choice"><option value="a">A</option><option value="b">B</option>${state.option?'<option value="c">C</option>':''}</select>
    <div id="rows">${state.rows.map(id=>`<p data-view-key="${id}" style="height:35px">Row ${id}</p>`).join('')}</div>
   </div>`;
   window.renderer.update(template.content);
  };
  window.renderer=createStableView(container,render);window.refresh=render;render();
  window.original={content:root.getElementById('content'),input:root.getElementById('draft'),select:root.getElementById('choice'),row:root.querySelector('[data-view-key="0"]')};
  window.removed=[];new MutationObserver(records=>{for(const record of records)for(const node of record.removedNodes)if(node===original.content||node.contains?.(original.input)||node.contains?.(original.select))removed.push(node.nodeName);}).observe(container,{childList:true,subtree:true});
 });
 const root=page.locator('#stable-fixture');
 const unchanged=await page.evaluate(async()=>{
  const root=document.getElementById('stable-fixture').shadowRoot;let mutations=0;
  const observer=new MutationObserver(records=>mutations+=records.length);
  observer.observe(root,{subtree:true,childList:true,attributes:true,characterData:true});refresh();
  await new Promise(resolve=>requestAnimationFrame(resolve));observer.disconnect();return mutations;
 });
 assert.equal(unchanged,0);checks.push('unchanged state produces no DOM mutations');
 await root.locator('#draft').fill('uncommitted draft');await root.locator('#draft').evaluate(input=>input.setSelectionRange(2,7));
 await page.evaluate(()=>{state.number=2;state.value='remote value';state.prefix=true;refresh();});
 assert.equal(await root.locator('#prefix').count(),0);assert.equal(await root.locator('#number').textContent(),'2');assert.equal(await root.locator('#draft').inputValue(),'uncommitted draft');
 assert.deepEqual(await root.locator('#draft').evaluate(input=>[input.selectionStart,input.selectionEnd]),[2,7]);
 assert.equal(await page.evaluate(()=>original.input===document.getElementById('stable-fixture').shadowRoot.getElementById('draft')&&original.input.isConnected),true);
 checks.push('focused input remains connected with draft and selection while independent numbers update');
 await root.locator('#draft').blur();assert.equal(await root.locator('#prefix').count(),1);assert.equal(await root.locator('#draft').inputValue(),'remote value');
 await root.locator('#choice').focus();await page.keyboard.press('Alt+ArrowDown');
 await page.evaluate(()=>{state.option=true;state.number=3;refresh();});
 assert.equal(await root.locator('#choice option').count(),2);assert.equal(await root.locator('#number').textContent(),'3');
 assert.equal(await page.evaluate(()=>original.select===document.getElementById('stable-fixture').shadowRoot.activeElement),true);
 await page.keyboard.press('Escape');await root.locator('#choice').blur();assert.equal(await root.locator('#choice option').count(),3);
 checks.push('focused native select keeps its node and options while live data updates; options sync on blur');
 await root.locator('#content').evaluate(el=>{el.scrollTop=150;});
 await page.waitForTimeout(220);
 const scrollBefore=await root.locator('#content').evaluate(el=>el.scrollTop);
 await root.locator('#content').dispatchEvent('wheel',{deltaY:20,bubbles:true});
 await page.evaluate(()=>{state.rows.push(30);state.number=4;refresh();state.rows.push(31);state.number=5;refresh();});
 assert.equal(await root.locator('#rows > p').count(),30);assert.equal(await root.locator('#number').textContent(),'5');
 await page.waitForFunction(()=>document.getElementById('stable-fixture').shadowRoot.querySelectorAll('#rows > p').length===32);
 assert.equal(await root.locator('#content').evaluate(el=>el.scrollTop),scrollBefore);
 checks.push('scrolling defers structural changes, coalesces latest state and preserves the original scroll container and offset');
 await root.locator('#content').evaluate(el=>el.scrollTop=0);await page.waitForTimeout(220);
 await root.locator('#label').dispatchEvent('pointerdown',{pointerId:1,bubbles:true});
 await page.evaluate(()=>{state.rows.reverse();state.alert='Action unavailable';state.disabled=true;refresh();});
 assert.equal(await root.locator('#rows > p').first().textContent(),'Row 0');
 assert.equal(await root.locator('#alert').textContent(),'Action unavailable');assert.equal(await root.locator('#action').isDisabled(),true);
 await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:1})));
 assert.equal(await root.locator('#rows > p').first().textContent(),'Row 31');
 assert.equal(await page.evaluate(()=>original.row===document.getElementById('stable-fixture').shadowRoot.querySelector('[data-view-key="0"]')),true);
 checks.push('pointer hold defers row moves and release reorders existing keyed nodes');
 await page.evaluate(()=>{
  const root=document.getElementById('stable-fixture').shadowRoot,range=document.createRange();range.selectNodeContents(root.getElementById('label'));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
  state.label='After';state.number=6;state.rows.pop();refresh();
 });
 assert.equal(await root.locator('#label').textContent(),'Before');assert.equal(await root.locator('#number').textContent(),'6');assert.equal(await root.locator('#rows > p').count(),32);
 await page.evaluate(()=>getSelection().removeAllRanges());
 await page.waitForFunction(()=>document.getElementById('stable-fixture').shadowRoot.getElementById('label').textContent==='After');
 assert.equal(await root.locator('#rows > p').count(),31);
 checks.push('text selection survives updates; affected text and structure apply after selection clears');
 assert.deepEqual(await page.evaluate(()=>removed),[]);assert.deepEqual(errors,[]);
 checks.push('persistent containers and controls are never removed; no browser errors');
 await page.evaluate(()=>renderer.dispose());
 console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}finally{await browser.close();}
