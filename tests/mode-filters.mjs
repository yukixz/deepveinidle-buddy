import assert from 'node:assert/strict';
import {prepareDemo,readDemoWorkspace} from './demo-helper.mjs';
import {launchBrowser,baseUrl} from './browser-helper.mjs';
const browser=await launchBrowser(),page=await browser.newPage({viewport:{width:1440,height:1080}});
await prepareDemo(page);const root=page.locator('#deepveinidle-buddy'),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const select=async mode=>root.locator(`[data-action="mode-${mode}"]`).click();
const open=async()=>{await page.goto(baseUrl);await page.locator('[data-buddy-launcher]').click();await root.locator('#skill').waitFor();};
const set=async(id,value)=>{await root.locator(id).fill(value);await root.locator(id).press('Tab');};
try{
 await open();
 await root.locator('#skill').selectOption('smithing');await root.locator('#tier').selectOption('0');
 await set('#min-points','1');await set('#max-hours-per-100-points','100');
 await root.locator('[data-sort="points"]').click();await root.locator('[data-action="next"]').click();
 const craftPage=await root.locator('.pagination > small').textContent();assert.match(craftPage,/2\//);
 await select('collection-gather');assert.equal(await root.locator('#skill').inputValue(),'all');assert.equal(await root.locator('#tier').inputValue(),'all');assert.equal(await root.locator('#min-points').inputValue(),'');
 await root.locator('#skill').selectOption('mining');await root.locator('#tier').selectOption('1');await set('#search','ore');await set('#min-points','2');await set('#max-hours-per-100-points','1.5');await set('#max-cost','2');
 await root.locator('[data-sort="time"]').click();
 await select('craft');await root.locator('#skill').selectOption('cooking');await root.locator('#tier').selectOption('2');await set('#search','fish');
 await select('collection-craft');assert.equal(await root.locator('#skill').inputValue(),'smithing');assert.equal(await root.locator('#tier').inputValue(),'0');assert.equal(await root.locator('#search').inputValue(),'');assert.equal(await root.locator('#min-points').inputValue(),'1');assert.equal(await root.locator('#max-hours-per-100-points').inputValue(),'100');assert.equal(await root.locator('#max-cost').inputValue(),'');assert.equal(await root.locator('.pagination > small').textContent(),craftPage);
 checks.push('mode switches restore filters, sorting and page independently');
 await page.waitForTimeout(250);await open();assert.equal(await root.locator('#skill').inputValue(),'smithing');assert.equal(await root.locator('.pagination > small').textContent(),craftPage);
 await select('collection-gather');assert.equal(await root.locator('#skill').inputValue(),'mining');assert.equal(await root.locator('#tier').inputValue(),'1');assert.equal(await root.locator('#search').inputValue(),'ore');assert.equal(await root.locator('#min-points').inputValue(),'2');assert.equal(await root.locator('#max-hours-per-100-points').inputValue(),'1.5');assert.equal(await root.locator('#max-cost').inputValue(),'2');assert.equal(await root.locator('[data-sort="time"]').evaluate(el=>el.parentElement.getAttribute('aria-sort')),'ascending');
 await select('craft');assert.equal(await root.locator('#skill').inputValue(),'cooking');assert.equal(await root.locator('#tier').inputValue(),'2');assert.equal(await root.locator('#search').inputValue(),'fish');
 const stored=await readDemoWorkspace(page);assert.equal(stored.filters.collection.maxSecondsPerPoint,'3600');assert.equal(stored.filters.collectionGather.maxSecondsPerPoint,'54');assert.deepEqual(errors,[]);
 checks.push('reload restores all three modes and preserves collection threshold units');
 console.log(JSON.stringify({passed:checks.length,checks},null,2));
}finally{await browser.close();}
