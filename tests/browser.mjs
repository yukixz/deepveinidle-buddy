import {chromium} from 'playwright-core';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {createScenario} from '../src/engine/simulation.js';import * as game from '../src/engine/upstream.js';import {craftingSlots,craftingSkills} from '../src/engine/crafting-model.js';import {gatheringSlots,gatheringSkills} from '../src/engine/gathering-model.js';
const base=process.env.BUDDY_URL??'http://127.0.0.1:4178';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
await fs.mkdir('.test-artifacts',{recursive:true});const checks=[],errors=[];
const page=await browser.newPage({viewport:{width:1440,height:1080}});page.on('pageerror',e=>errors.push(e.message));
page.on('dialog',d=>d.accept());
const root=page.locator('#deepveinidle-buddy');
try{
 await page.goto(base);await root.locator('[data-action="mode-collection"]').waitFor();
 await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').shadowRoot.querySelector('.summary')?.textContent.includes('精通点 4'),{timeout:30000});checks.push('actual Blob Worker completes manufacturing while collection reports four points');
 assert.equal(await root.locator('[data-material="1"] td').nth(2).textContent(),'150 / 101');checks.push('mixed materials merge once against shared stock');
 await root.locator('[data-action="mode-collection"]').click();await root.locator('#search').fill('青铜锭');await root.locator('#search').press('Tab');
 await root.locator('[data-key="40:41:100"]').waitFor();assert.equal(await root.locator('[data-key="40:41:100"]').isDisabled(),true);checks.push('existing collection milestone is included in current mixed order');
 await root.locator('#order-name').fill('混合订单 A');await root.locator('[data-action="new-order"]').click();await root.locator('[data-action="edit-order"]').filter({hasText:'混合订单 A'}).waitFor();assert.equal(await root.locator('[data-action="edit-order"]').count(),2);checks.push('committing focused name does not lose New order click');
 await root.locator('[data-action="delete-order"]').last().click();await page.waitForTimeout(250);assert.equal(await root.locator('[data-action="edit-order"]').count(),1);assert.equal(await root.locator('#order-name').inputValue(),'混合订单 A');checks.push('delete removes only targeted order and preserves other orders');
 await root.locator('#transfer > summary').click();await root.locator('#transfer-text').fill('draft survives refresh');await root.locator('#transfer-text').press('Tab');await root.locator('[data-action="language"]').click();assert.equal(await root.locator('#transfer-text').inputValue(),'draft survives refresh');checks.push('unfocused transfer draft survives redraw and language changes');
 await root.locator('[data-action="export"]').click();const exportText=await root.locator('#transfer-text').inputValue();assert.equal(JSON.parse(exportText).format,'deepveinidle-buddy-orders');checks.push('JSON export includes mixed typed lines');
 await root.locator('[data-action="language"]').click();await root.locator('[data-action="collapse"]').click();assert.equal(await root.locator('.content').count(),0);await root.locator('[data-action="collapse"]').click();await root.locator('[data-action="mode-collection"]').waitFor();checks.push('collapse unmounts content and expansion restores order');
 await page.reload();await root.locator('#order-name').waitFor();assert.equal(await root.locator('#order-name').inputValue(),'混合订单 A');checks.push('async saved workspace survives reload');
 await root.locator('[data-action="mode-collection"]').click();await root.locator('#search').fill('青铜锭');await root.locator('#search').press('Tab');await root.locator('[data-key="40:41:100"]').waitFor();await page.screenshot({path:'.test-artifacts/buddy-desktop-zh.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.test-artifacts/buddy-mobile-zh.png'});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks.push('narrow viewport contains panel; tables scroll internally');
 await page.setViewportSize({width:1440,height:1080});await root.locator('[data-action="language"]').click();await page.screenshot({path:'.test-artifacts/buddy-desktop-en.png'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.test-artifacts/buddy-mobile-en.png'});await page.setViewportSize({width:1440,height:1080});
 // Real userscript bundle, isolated origin and fake game socket; no game connection.
 await page.goto(base+'/tests/fixture.html');await page.evaluate(()=>{
  window.unsafeWindow=window;window.__saved=new Map();window.GM_getValue=(k,v)=>window.__saved.get(k)??v;window.GM_setValue=(k,v)=>window.__saved.set(k,v);window.GM_addValueChangeListener=()=>1;window.GM_removeValueChangeListener=()=>{};window.GM_setClipboard=()=>{};window.GM_xmlhttpRequest=opts=>opts.onerror();
  window.WebSocket=class extends EventTarget{constructor(url){super();this.url=url;}send(){throw Error('unexpected game command');}};
 });
 await page.addScriptTag({url:base+'/dist/deepveinidle-buddy.user.js'});
 const {player}=createScenario({});for(const skill of [...craftingSkills,...gatheringSkills])player.skills[skill]=game.levelXp(70);for(const slot of [...craftingSlots,...gatheringSlots])player.equipment[slot]=null;Object.assign(player,{id:42,house:{},houseFurniture:{},collections:{40:9},masteries:{},perks:{},ironman:false,homeBank:null,bank:{1:30,2:30},pack:[]});
 const send=async(you,t='welcome',tick=1000)=>page.evaluate(({you,t,tick})=>{window.__socket??=new WebSocket('ws://'+location.host+'/ws');window.__socket.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({tick,m:[{t,you,guild:null,windows:[]}]})}));},{you,t,tick});
 await send(player);await root.locator('[data-action="mode-collection"]').waitFor();checks.push('actual userscript boots from intercepted welcome and role-specific GM storage');
 const theme=await root.locator('button').first().evaluate(el=>({color:getComputedStyle(el).color,fontSize:getComputedStyle(el).fontSize}));assert.notEqual(theme.color,'rgb(255, 0, 255)');assert.equal(theme.fontSize,'12px');assert.equal(await page.locator('#host-button').evaluate(el=>getComputedStyle(el).color),'rgb(255, 0, 255)');checks.push('host hostile CSS and buddy CSS are mutually isolated');
 await root.locator('[data-action="mode-collection"]').click();await root.locator('#search').fill('青铜锭');await root.locator('#search').press('Tab');await root.locator('[data-key="40:41:100"]').click();
 await page.waitForTimeout(200);const updated=structuredClone(player);updated.collections[40]=100;updated.bank={1:10,2:10};await send(updated,'snapshot',1001);await page.waitForTimeout(500);assert.ok((await page.evaluate(()=>[...window.__saved.values()].filter(Boolean).at(-1)))?.orders[0].lines.length===0);checks.push('progress snapshot removes completed target without game commands');
 await page.evaluate(()=>window.__socket.dispatchEvent(new Event('close')));await page.waitForTimeout(300);assert.ok(await root.locator('[role="status"]').first().textContent().then(s=>s.includes('断开')));checks.push('socket closure shows stale disconnected state');
 const other=structuredClone(player);other.id=43;await page.evaluate(()=>window.__socket=new WebSocket('ws://'+location.host+'/ws'));await send(other,'welcome',1002);await page.waitForTimeout(500);const keys=await page.evaluate(()=>[...window.__saved.keys()]);assert.ok(keys.some(k=>k.endsWith(':42')));assert.ok(keys.some(k=>k.endsWith(':43')));checks.push('role change uses separate GM buckets');
 assert.deepEqual(errors,[]);checks.push('no uncaught browser errors');
 await fs.writeFile('.test-artifacts/browser-summary.json',JSON.stringify({checks,errors},null,2)+'\n');console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}catch(error){await page.screenshot({path:'.test-artifacts/failure.png'});await fs.writeFile('.test-artifacts/browser-failure.json',JSON.stringify({checks,errors,error:error.stack},null,2));throw error;}finally{await browser.close();}
