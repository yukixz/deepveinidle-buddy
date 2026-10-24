import {launchBrowser,baseUrl} from './browser-helper.mjs';
import assert from 'node:assert/strict';
import {estimateOrders} from '../src/workspace.js';
import * as game from '../src/engine/upstream.js';
import {collectionRows} from '../src/engine/collection-model.js';
import {createPriceSnapshot} from '../src/engine/price-protocol.js';
const browser=await launchBrowser();
const checks=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1080}});page.on('pageerror',e=>errors.push(e.message));
 const root=page.locator('#deepveinidle-buddy');
 await page.goto(baseUrl);await root.locator('.summary').waitFor();
 await root.locator('[data-action="language"]').click();await page.waitForFunction(()=>localStorage.getItem('dvi-buddy-demo-v1')!==null);
 const base=await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-buddy-demo-v1')));base.language='zh';
 const number=(v,lang='zh')=>v===null?'—':v.toLocaleString(lang==='zh'?'zh-CN':'en',{maximumFractionDigits:2});
 const duration=(v,lang='zh')=>v===null?'—':(v>=3600?(v/3600).toLocaleString(lang==='zh'?'zh-CN':'en',{maximumFractionDigits:1})+(lang==='zh'?' 小时':' h'):v>=60?(v/60).toLocaleString(lang==='zh'?'zh-CN':'en',{maximumFractionDigits:1})+(lang==='zh'?' 分钟':' min'):v.toLocaleString(lang==='zh'?'zh-CN':'en',{maximumFractionDigits:1})+(lang==='zh'?' 秒':' s'));
 for(const kind of ['mixed','craft','collection','empty','burning','outputs','conflict']){
  const saved=structuredClone(base);
  if(kind==='craft'||kind==='collection')saved.orders[0].lines=saved.orders[0].lines.filter(l=>l.kind===kind);
  if(kind==='empty')saved.orders[0].lines=[];
  let burning=null;
  if(kind==='burning'){
   saved.character.config.levels.cooking=1;
   burning=collectionRows(saved.character).find(r=>r.status==='ok'&&r.burn>0&&!Number.isInteger(r.attempts));assert.ok(burning);
   saved.orders[0].lines=[{kind:'collection',itemId:burning.id,jobId:burning.jobId,target:burning.target},{kind:'craft',jobId:burning.jobId,tier:game.itemTier(burning.id),count:3}];
   const job=game.recipes.find(j=>j.id===burning.jobId);for(const input of game.recipeInputs(job,game.itemTier(burning.id)))saved.prices.quotes[input.itemId]={ask:{value:5,capturedAt:Date.now()}};
  }
  if(kind==='outputs'){
   saved.orders[0].lines=[{kind:'craft',jobId:41,tier:0,count:4},{kind:'craft',jobId:51,tier:0,count:5}];
   saved.character.bank={1:4,2:4,40:3};saved.character.pack={};
   saved.prices.quotes[40]={ask:{value:5,capturedAt:Date.now()}};
  }
  if(kind==='conflict')saved.orders.push({...structuredClone(saved.orders[0]),id:'second-order'});
  await page.evaluate(value=>localStorage.setItem('dvi-buddy-demo-v1',JSON.stringify(value)),saved);await page.reload();await root.locator('.summary').waitFor();
  const plan=estimateOrders(saved,createPriceSnapshot(saved.prices)),seconds=plan.craftSeconds===null||plan.collectionSeconds===null?null:plan.craftSeconds+plan.collectionSeconds;
  assert.deepEqual(await root.locator('.summary > span').allTextContents(),['采购 '+number(plan.total),'时间 '+duration(seconds),'精通点 '+number(plan.points)]);
  assert.deepEqual(await root.locator('#execution-plan .procurement-heading h3,#execution-plan > h3').allTextContents(),['采购材料','执行动作']);assert.equal(await root.locator('#execution-plan details,[id^="execute-"]').count(),0);assert.equal(await root.locator('#orders [data-action="edit-order"]').count(),saved.orders.length);
  assert.ok(await root.locator('#execution-actions').evaluate(el=>Boolean(el.closest('.scroll').previousElementSibling?.textContent.includes('执行动作'))));
  if(burning){const row=root.locator('#execution-actions tbody tr').first();assert.equal(await row.locator('td').nth(3).textContent(),number(Math.ceil(burning.attempts)+3));assert.equal(await row.locator('td').nth(4).textContent(),duration(plan.actions[0].seconds));}
  if(kind==='outputs'){const cells=root.locator('[data-material="40"] td');assert.equal(await cells.nth(2).textContent(),'3');assert.equal(await cells.nth(3).textContent(),'10 / 3 / 4');assert.equal(await cells.nth(5).textContent(),'15');assert.ok((await root.locator('[data-column="required"]').textContent()).includes('需求 / 库存 / 产物'));}
  checks.push(kind+' summary totals and purchase-before-actions order');
 }
 await root.locator('[data-action="language"]').click();assert.deepEqual((await root.locator('.summary > span').allTextContents()).map(s=>s.split(' ')[0]),['Purchase','Time','Mastery']);assert.deepEqual(await root.locator('#execution-plan .procurement-heading h3,#execution-plan > h3').allTextContents(),['Purchase materials','Execution actions']);checks.push('English summary and table headings');
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').getBoundingClientRect().right<=innerWidth+1);assert.equal(await root.locator('.summary > span').count(),3);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks.push('narrow layout retains three summary fields without page overflow');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}finally{await browser.close();}
