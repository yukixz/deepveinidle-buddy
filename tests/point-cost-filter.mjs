import {prepareDemo,readDemoWorkspace,seedDemoWorkspace} from './demo-helper.mjs';
import {toggleGameLanguage,launchBrowser,baseUrl} from './browser-helper.mjs';
import assert from 'node:assert/strict';

const browser=await launchBrowser(),checks=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1080}});await prepareDemo(page);
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(baseUrl);await page.locator("[data-buddy-launcher]").click();
 const root=page.locator('#deepveinidle-buddy');
 const row=root.locator('[data-key="40:41:100"]').locator('xpath=ancestor::tr');
 const caption=async()=>(await root.locator('[data-sort="cost"]').textContent()).replace(/[▲▼]/g,'').trim();
 const stored=()=>readDemoWorkspace(page);
 async function load(saved){
  await seedDemoWorkspace(page,saved);
  await page.reload();await page.locator("[data-buddy-launcher]").click();
  await root.locator('[data-action="mode-collection-craft"]').click();
 }
 async function setLimit(value){
  await root.locator('#max-cost').fill(value);
  await root.locator('#max-cost').press('Tab');
  await page.waitForTimeout(200);
 }

 await root.locator('[data-action="mode-collection-craft"]').click();
 await page.waitForFunction(()=>localStorage.getItem('dvi-buddy-demo-v1')!==null);
 const saved=await stored();

 saved.filters.collection={...saved.filters.collection,maxCost:'100',query:'青铜锭',tier:'0'};
 saved.prices.quotes={
  1:{ask:{value:2,capturedAt:Date.now()},bid:{value:1,capturedAt:Date.now()}},
  2:{ask:{value:3,capturedAt:Date.now()},bid:{value:2,capturedAt:Date.now()}},
 };
 await load(saved);
 assert.equal(await root.locator('#max-cost').inputValue(),'0.01');
 assert.equal(await caption(),'金币/点');
 assert.ok((await root.locator('#max-cost').evaluate(el=>el.parentElement.textContent)).includes('金币/点(M/100) ≤'));
 assert.equal(await row.count(),0);
 checks.push('short table caption preserves the filter unit and 100 coins/point displays 0.01 M/100');

 await setLimit('0.02');
 assert.equal((await stored()).filters.collection.maxCost,'200');
 assert.equal(await row.locator('td').nth(7).textContent(),'113.75');
 await setLimit('0.01');
 await root.locator('#recipes-material-price-mode').selectOption('bid');
 assert.equal(await row.locator('td').nth(7).textContent(),'68.25');
 checks.push('table shows actual coins per point for ask and bid pricing while filter conversion preserves internal units');

 await toggleGameLanguage(page);
 assert.equal(await caption(),'Coins/pt');
 assert.ok((await root.locator('#max-cost').evaluate(el=>el.parentElement.textContent)).includes('Coins/pt(M/100)'));
 await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').getBoundingClientRect().right<=innerWidth+1);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const tops=await root.locator('.threshold-filters label').evaluateAll(els=>els.map(el=>Math.round(el.getBoundingClientRect().top)));
 assert.equal(new Set(tops).size,1);
 checks.push('translated unit caption keeps all three thresholds together on narrow screens');

 await setLimit('');
 const tiny=await stored();
 tiny.character.buyMode='ask';
 tiny.prices.quotes={1:{ask:{value:.000001,capturedAt:Date.now()}},2:{ask:{value:.000001,capturedAt:Date.now()}}};
 await load(tiny);
 assert.equal(await row.locator('td').nth(7).textContent(),'0.00');
 checks.push('tiny costs round to two decimal places');

 for(const [factor,expected] of [[100,'11.38K'],[10000,'1.14M'],[10000000,'1.14B']]){
  const scaled=structuredClone(tiny);
  // The original recipe name matches in both interface languages.
  scaled.filters.collection.query='Bronze bar';
  scaled.prices.quotes={1:{ask:{value:2*factor,capturedAt:Date.now()}},2:{ask:{value:3*factor,capturedAt:Date.now()}}};
  await load(scaled);
  assert.equal(await row.locator('td').nth(7).textContent(),expected);
  assert.match(await row.locator('td').nth(5).textContent(),/^\d+\.\d{2}[KMBTQ]?$/);
  await toggleGameLanguage(page);
  assert.equal(await row.locator('td').nth(7).textContent(),expected);
 }
 checks.push('K/M/B costs use two decimals in both languages; total coins use the same compact format');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}finally{await browser.close();}
