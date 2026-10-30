import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {launchBrowser,baseUrl,toggleGameLanguage,longPressTitle} from './browser-helper.mjs';
const browser=await launchBrowser(),checks=[],errors=[];
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
await fs.mkdir('.test-artifacts/mobile-tables',{recursive:true});
try{
 await page.goto(baseUrl);await page.locator('[data-buddy-launcher]').click();await page.locator('#deepveinidle-buddy').locator('[data-action="mode-craft"]').click();
 await page.evaluate(async()=>{const {installMobileFixture}=await import('/tests/mobile-fixture.js');installMobileFixture();});
 const root=page.locator('#deepveinidle-buddy');await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').hasAttribute('data-mobile'));
 await root.locator('#orders>summary').tap();
 const row=root.locator('[data-order-row]').first(),edit=row.locator('[data-action="edit-order"]');
 await edit.tap();await row.locator('[data-action="copy-order"]').click();
 assert.equal(await root.locator('.order-detail-row:not([hidden])').count(),2);await root.locator('[data-order-row]').last().locator('[data-enabled]').uncheck();
 await root.locator('[data-order-name]').first().fill('Long order name / '+ '订单'.repeat(40));await root.locator('[data-order-name]').first().press('Tab');await page.evaluate(()=>document.querySelector('#deepveinidle-buddy').shadowRoot.activeElement?.blur());
 for(const language of ['zh','en']){
  if(language==='en')await toggleGameLanguage(page);
  for(const [width,height]of [[320,844],[360,844],[390,844],[430,844],[844,390]]){
   await page.setViewportSize({width,height});await page.waitForFunction(()=>Math.abs(document.querySelector('#deepveinidle-buddy').getBoundingClientRect().width-innerWidth)<1);
   const sizes=await root.evaluate(el=>{
    const r=el.shadowRoot,orders=r.querySelector('#orders'),scroll=orders.querySelector(':scope>.scroll'),content=r.querySelector('.content');
    return {order:orders.clientWidth,orderExtent:orders.scrollWidth,client:scroll.clientWidth,extent:scroll.scrollWidth,content:content.clientWidth,contentExtent:content.scrollWidth,nested:orders.querySelectorAll('.scroll').length,font:getComputedStyle(r.querySelector('table')).fontSize,controls:[...r.querySelectorAll('button,input,select')].map(n=>({height:n.getBoundingClientRect().height,id:n.id||n.dataset.action||n.tagName})).filter(n=>n.height>0),items:[...r.querySelectorAll('.frozen-table th:first-child')].map(n=>n.getBoundingClientRect().width)};
   });
   if(width<=430)assert.ok(sizes.extent>sizes.client+20,JSON.stringify(sizes));assert.ok(sizes.orderExtent<=sizes.order+1,JSON.stringify(sizes));assert.ok(sizes.contentExtent<=sizes.content+1,JSON.stringify(sizes));assert.equal(sizes.nested,1);assert.equal(sizes.font,'12px');for(const control of sizes.controls)assert.equal(control.height,32,JSON.stringify(control));for(const w of sizes.items)assert.ok(Math.abs(w-72)<1,String(w));
   const scroll=root.locator('#orders>.scroll');await scroll.evaluate(n=>n.scrollLeft=n.scrollWidth);if(sizes.extent>sizes.client+20)assert.ok(await scroll.evaluate(n=>n.scrollLeft>20));
   // The last operation column and detail tables share this same scroll layer.
   const right=await scroll.evaluate(n=>({edge:n.getBoundingClientRect().right,children:[...n.querySelectorAll('table')].map(t=>t.getBoundingClientRect().right)}));for(const edge of right.children)assert.ok(edge<=right.edge+1,JSON.stringify({width,height,language,right,edge}));
   await scroll.evaluate(n=>n.scrollLeft=0);
  }
  checks.push(`${language}: 320/360/390/430 portrait and touch landscape keep all order content in one bounded horizontal scroller and retain 72px frozen item columns`);
 }
 await page.setViewportSize({width:390,height:844});await toggleGameLanguage(page);
 const scroll=root.locator('#orders>.scroll'),content=root.locator('.content');await scroll.evaluate(n=>n.scrollLeft=0);await row.scrollIntoViewIfNeeded();
 const before=await edit.getAttribute('aria-expanded'),box=await row.boundingBox(),client=await page.context().newCDPSession(page);
 async function swipe(x1,y1,x2,y2){
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x1,y:y1}]});
  for(let i=1;i<=10;i++){await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x1+(x2-x1)*i/10,y:y1+(y2-y1)*i/10}]});await page.waitForTimeout(18);}
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(1200);
 }
 await swipe(345,box.y+box.height/2,55,box.y+box.height/2);
 assert.ok(await scroll.evaluate(n=>n.scrollLeft>30));assert.equal(await edit.getAttribute('aria-expanded'),before);checks.push('native horizontal touch swipe scrolls orders without toggling an order');
 await scroll.evaluate(n=>n.scrollLeft=60);const retained=await scroll.evaluate(n=>n.scrollLeft);
 await toggleGameLanguage(page);assert.equal(await scroll.evaluate(n=>n.scrollLeft),retained);
 await root.locator('[data-action="close"]').tap();await page.locator('[data-buddy-launcher]').tap();assert.equal(await scroll.evaluate(n=>n.scrollLeft),retained);assert.equal(await root.locator('.order-detail-row:not([hidden])').count(),2);checks.push('language redraw and close/reopen retain order scroll nodes, position and expanded details');
 await scroll.evaluate(n=>n.scrollLeft=0);await row.scrollIntoViewIfNeeded();const top=await content.evaluate(n=>n.scrollTop),b=await row.boundingBox();await swipe(180,b.y+20,180,Math.max(55,b.y-140));assert.ok(await content.evaluate(n=>n.scrollTop)>top);checks.push('native vertical touch swipe over orders continues scrolling panel content');
 await root.locator('#execution-actions').scrollIntoViewIfNeeded();
 const density=await root.evaluate(el=>{
  const r=el.shadowRoot,table=r.querySelector('#execution-actions'),input=r.querySelector('#recipe-candidates input')??r.querySelector('.order-details input[type=number]');
  return {rows:[...table.querySelectorAll('tbody tr')].filter(n=>!n.querySelector('[colspan]')).map(n=>({height:n.getBoundingClientRect().height,nameHeight:n.querySelector('.item-name')?.getBoundingClientRect().height??0})),input:getComputedStyle(input).fontSize,control:input.getBoundingClientRect().height,checkbox:r.querySelector('#order-list input[type=checkbox]').getBoundingClientRect().height,buttons:table.querySelectorAll('tbody button').length,titles:table.querySelectorAll('tr[title]').length};
 });
 assert.ok(density.rows.length>0);for(const row of density.rows)assert.ok(row.height<=(row.nameHeight<20?30:42),JSON.stringify(density));assert.equal(density.input,'16px');assert.equal(density.control,32);assert.equal(density.checkbox,32);assert.equal(density.buttons,0);assert.ok(density.titles>0);checks.push('single-line display rows fit 30px, inline inputs/checkboxes use 32px, input text stays 16px and execution rows need no status control');
 const label=root.locator('#execution-actions .item-name').first();
 await label.evaluate(n=>{n.textContent='A very long item name with all details preserved and visible when focused';});
 const collapsed=await label.evaluate(n=>n.getBoundingClientRect().height);await label.tap();assert.ok(await label.evaluate(n=>n.getBoundingClientRect().height)>collapsed);await root.locator('h1').tap();assert.equal(await label.evaluate(n=>n.getBoundingClientRect().height),collapsed);checks.push('long frozen names clamp to two lines and reveal complete text on focus without widening the column');
 await root.locator('#orders>summary').scrollIntoViewIfNeeded();await page.screenshot({path:'.test-artifacts/mobile-tables/orders.png'});
 await longPressTitle(root);assert.equal(await root.getByRole('menuitemcheckbox').evaluate(n=>n.getBoundingClientRect().height),32);await page.keyboard.press('Escape');checks.push('all visible mobile window buttons, inputs and selects including title close and hidden menu share a 32px height');
 await page.setViewportSize({width:1440,height:1080});await page.waitForFunction(()=>!document.querySelector('#deepveinidle-buddy').hasAttribute('data-mobile'));
 assert.equal(await root.locator('table').first().evaluate(n=>getComputedStyle(n).fontSize),'12px');assert.ok(await root.locator('#order-list input[type=checkbox]').first().evaluate(n=>n.getBoundingClientRect().height)<32);checks.push('desktop leaves mobile density overrides and keeps shared order scrolling');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}catch(error){await page.screenshot({path:'.test-artifacts/mobile-tables/failure.png'});console.error(JSON.stringify({checks,errors,error:error.stack},null,2));throw error;}finally{await browser.close();}
