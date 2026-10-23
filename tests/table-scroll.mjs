import {launchBrowser,baseUrl} from './browser-helper.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const browser=await launchBrowser();
const page=await browser.newPage({viewport:{width:1440,height:1080}}),checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
const root=page.locator('#deepveinidle-buddy'),content=root.locator('.content'),table=root.locator('.scroll').first();
const top=()=>content.evaluate(el=>el.scrollTop);
async function reset(){await content.evaluate(el=>{el.scrollTop=0;});}
async function wheelOverTable(dx,dy){const r=await table.boundingBox();await page.mouse.move(r.x+Math.min(100,r.width/2),Math.max(150,r.y+Math.min(55,r.height/2)));await page.mouse.wheel(dx,dy);}
async function until(fn){await page.waitForFunction(fn,null,{timeout:2000});}
await fs.mkdir('.test-artifacts/table-scroll',{recursive:true});
try{
 await page.goto(baseUrl);await table.waitFor();await root.locator('[data-action="mode-craft"]').click();await root.locator('.resize-right').waitFor();const grip=await root.locator('.resize-right').boundingBox();await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2-300,{steps:8});await page.mouse.up();
 await reset();await wheelOverTable(0,260);await until(()=>document.querySelector('#deepveinidle-buddy').shadowRoot.querySelector('.content').scrollTop>30);checks.push('desktop craft table vertical wheel scrolls outer panel');
 const down=await top();await wheelOverTable(0,-160);await page.waitForTimeout(150);assert.ok(await top()<down);checks.push('desktop craft table upward wheel scrolls outer panel');
 await page.setViewportSize({width:390,height:844});await reset();await table.evaluate(el=>el.scrollLeft=0);await wheelOverTable(200,0);await until(()=>document.querySelector('#deepveinidle-buddy').shadowRoot.querySelector('.scroll').scrollLeft>30);assert.equal(await top(),0);checks.push('narrow table horizontal wheel retains table scrolling without moving panel vertically');
 await wheelOverTable(0,260);await until(()=>document.querySelector('#deepveinidle-buddy').shadowRoot.querySelector('.content').scrollTop>30);checks.push('narrow horizontally scrolled craft table still passes vertical wheel to panel');
 await reset();await root.locator('[data-action="mode-collection-craft"]').click();await table.waitFor();await wheelOverTable(0,220);await until(()=>document.querySelector('#deepveinidle-buddy').shadowRoot.querySelector('.content').scrollTop>30);checks.push('collection table passes vertical wheel to panel');
 await page.evaluate(()=>{const spacer=document.createElement('div');spacer.style.height='3000px';document.body.append(spacer);});
 await content.evaluate(el=>el.scrollTop=el.scrollHeight);const bodyBefore=await page.evaluate(()=>scrollY);const last=root.locator('.scroll').last();const r=await last.boundingBox();await page.mouse.move(r.x+40,Math.max(90,Math.min(700,r.y+40)));await page.mouse.wheel(0,500);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>scrollY),bodyBefore);checks.push('panel boundary still contains vertical scroll instead of scrolling host page');
 assert.deepEqual(errors,[]);checks.push('no uncaught browser errors');await fs.writeFile('.test-artifacts/table-scroll/summary.json',JSON.stringify({checks,errors},null,2)+'\n');console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}catch(error){await fs.writeFile('.test-artifacts/table-scroll/failure.json',JSON.stringify({checks,errors,error:error.stack},null,2)+'\n');console.error(JSON.stringify({checks,errors,error:error.stack},null,2));throw error;}finally{await browser.close();}
