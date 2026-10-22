import {launchBrowser,baseUrl} from './browser-helper.mjs';
import assert from 'node:assert/strict';
import {estimateOrders} from '../src/workspace.js';
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
 for(const kind of ['mixed','craft','collection','empty','conflict']){
  const saved=structuredClone(base);
  if(kind==='craft'||kind==='collection')saved.orders[0].lines=saved.orders[0].lines.filter(l=>l.kind===kind);
  if(kind==='empty')saved.orders[0].lines=[];
  if(kind==='conflict')saved.orders.push({...structuredClone(saved.orders[0]),id:'second-order'});
  await page.evaluate(value=>localStorage.setItem('dvi-buddy-demo-v1',JSON.stringify(value)),saved);await page.reload();await root.locator('.summary').waitFor();
  const plan=estimateOrders(saved,createPriceSnapshot(saved.prices)),seconds=plan.craftSeconds===null||plan.collectionSeconds===null?null:plan.craftSeconds+plan.collectionSeconds;
  assert.deepEqual(await root.locator('.summary > span').allTextContents(),['采购 '+number(plan.total),'时间 '+duration(seconds),'精通点 '+number(plan.points)]);
  assert.deepEqual(await root.locator('#execution-plan .procurement-heading h3,#execution-plan > h3').allTextContents(),['采购材料','执行动作']);assert.equal(await root.locator('#execution-plan details,[id^="execute-"]').count(),0);assert.equal(await root.locator('#orders [data-action="edit-order"]').count(),saved.orders.length);
  assert.ok(await root.locator('#execution-actions').evaluate(el=>Boolean(el.closest('.scroll').previousElementSibling?.textContent.includes('执行动作'))));
  checks.push(kind+' summary totals and purchase-before-actions order');
 }
 await root.locator('[data-action="language"]').click();assert.deepEqual((await root.locator('.summary > span').allTextContents()).map(s=>s.split(' ')[0]),['Purchase','Time','Mastery']);assert.deepEqual(await root.locator('#execution-plan .procurement-heading h3,#execution-plan > h3').allTextContents(),['Purchase materials','Execution actions']);checks.push('English summary and table headings');
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').getBoundingClientRect().right<=innerWidth+1);assert.equal(await root.locator('.summary > span').count(),3);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks.push('narrow layout retains three summary fields without page overflow');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}finally{await browser.close();}
