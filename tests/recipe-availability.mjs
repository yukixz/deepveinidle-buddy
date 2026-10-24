import {toggleGameLanguage,launchBrowser,baseUrl} from './browser-helper.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await launchBrowser(),checks=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1080}});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(baseUrl);await page.locator("[data-buddy-launcher]").click();
 const root=page.locator('#deepveinidle-buddy'),material=root.locator('#recipes-material-price-mode');
 const compactPricing=async()=>{const widths=await root.locator('.pricing-controls select').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().width));assert.deepEqual(widths,[64,64,64,64]);};
 const row=target=>root.locator(`[data-key="40:41:${target}"]`);
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-buddy-demo-v1')));
 await root.locator('[data-action="mode-collection-craft"]').click();
 await page.waitForFunction(()=>localStorage.getItem('dvi-buddy-demo-v1')!==null);
 const state=await saved();state.character.bank={1:1000000,2:1000000};
 state.filters.collection={...state.filters.collection,query:'青铜锭',tier:'0'};
 state.filters.craft={...state.filters.craft,query:'青铜锭',tier:'0'};
 const quote=quantity=>({ask:{value:2,quantity,capturedAt:Date.now()},bid:{value:1,quantity:9999,capturedAt:Date.now()}});
 state.prices.quotes={1:quote(90),2:quote(90)};
 async function load(value){await page.evaluate(value=>localStorage.setItem('dvi-buddy-demo-v1',JSON.stringify(value)),value);await page.reload();await page.locator("[data-buddy-launcher]").click();await material.waitFor();}
 async function select(value){await material.selectOption(value);await page.waitForTimeout(200);}
 await load(state);
 assert.equal(await material.locator('option[value="ask-stock"]').textContent(),'卖单（排除在售数量不足）');
 assert.equal(await root.locator('#recipes-product-price-mode option[value="ask-stock"]').count(),0);
 assert.equal(await root.locator('#execution-product-price-mode option[value="ask-stock"]').count(),0);
 const existing=structuredClone(state.orders);
 const plan=await root.locator('#execution-plan .summary').textContent();
 assert.equal(await row(100).count(),1);await select('ask-stock');
 assert.equal(await row(10).count(),1);assert.equal(await row(100).count(),0);
 assert.equal(await root.locator('#execution-material-price-mode').inputValue(),'ask-stock');
 assert.equal(await root.locator('#execution-plan .summary').textContent(),plan);
 assert.deepEqual((await saved()).orders,existing);
 checks.push('new material-only option synchronizes both controls and excludes insufficient collection targets without deducting inventory or deleting orders');
 await page.reload();await page.locator("[data-buddy-launcher]").click();await material.waitFor();assert.equal(await material.inputValue(),'ask-stock');assert.equal(await row(100).count(),0);
 checks.push('stock filtering survives reload');
 const enough=await saved();enough.prices.quotes={1:quote(91),2:quote(91)};await load(enough);
 assert.equal(await row(100).count(),1);assert.equal(await row(1000).count(),0);
 assert.equal(await row(100).locator('xpath=ancestor::tr').locator('td').nth(5).textContent(),'364.00');
 checks.push('updated quantities equal to expected total requirements are sufficient and keep ordinary ask valuation');
 for(const change of [q=>delete q.quantity,q=>{q.quantityInvalid=true;},q=>{q.value=null;}]){
  const invalid=structuredClone(enough);change(invalid.prices.quotes[2].ask);await load(invalid);assert.equal(await row(10).count(),0);
 }
 checks.push('missing or invalid quantity and absent ask price exclude candidates');
 await select('ask');assert.equal(await row(100).count(),1);assert.equal((await saved()).excludeInsufficientAsks,false);
 await root.locator('#execution-material-price-mode').selectOption('bid');await page.waitForTimeout(200);
 assert.equal(await material.inputValue(),'bid');assert.equal(await row(100).count(),1);
 checks.push('ordinary asks and bids restore candidates and selecting from either panel keeps controls synchronized');
 const craft=structuredClone(enough);craft.prices.quotes={1:quote(1),2:quote(1)};craft.orders[0].lines=[{kind:'craft',jobId:41,tier:0,count:500}];await load(craft);
 await root.locator('[data-action="mode-craft"]').click();assert.equal(await root.locator('[data-count="41:0"]').inputValue(),'500');
 await select('ask-stock');assert.equal(await root.locator('[data-count="41:0"]').inputValue(),'500');
 checks.push('manufacturing availability uses a single attempt rather than the existing order count');
 const batch=structuredClone(enough);batch.orders[0].lines=[];await load(batch);await root.locator('[data-action="add-all"]').click();await page.waitForTimeout(200);
 assert.deepEqual((await saved()).orders[0].lines,[{kind:'collection',itemId:40,jobId:41,target:100}]);
 checks.push('Add all includes only eligible targets and takes the highest eligible target');
 await root.locator('[data-action="mode-collection-gather"]').click();await root.locator('#search').fill('');await root.locator('#search').press('Tab');await page.waitForTimeout(200);
 assert.ok(await root.locator('[data-action="add-collection"]').count()>0);
 checks.push('gathering candidates without material requirements remain visible');
 await root.locator('[data-action="mode-collection-craft"]').click();await root.locator('#search').fill('青铜锭');await root.locator('#search').press('Tab');await page.waitForTimeout(200);
 await fs.mkdir('.test-artifacts/recipe-availability',{recursive:true});await compactPricing();await page.screenshot({path:'.test-artifacts/recipe-availability/desktop.png'});
 await toggleGameLanguage(page);assert.equal(await material.locator('option[value="ask-stock"]').textContent(),'Asks (exclude insufficient stock)');await root.locator('#search').fill('Bronze');await root.locator('#search').press('Tab');await page.waitForTimeout(200);assert.equal(await row(100).count(),1);
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').getBoundingClientRect().right<=innerWidth+1);
 assert.equal(await material.inputValue(),'ask-stock');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await compactPricing();await page.screenshot({path:'.test-artifacts/recipe-availability/mobile.png'});assert.deepEqual(errors,[]);
 checks.push('option translates and stays usable in the narrow layout without page overflow');
 console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}finally{await browser.close();}
