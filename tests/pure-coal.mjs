import assert from 'node:assert/strict';
import {filterDefaults} from '../src/workspace.js';
import {prepareDemo,seedDemoWorkspace} from './demo-helper.mjs';
import {launchBrowser,baseUrl,toggleGameLanguage} from './browser-helper.mjs';
const browser=await launchBrowser(),page=await browser.newPage({viewport:{width:1440,height:1080}}),checks=[];
try{
 await prepareDemo(page);await page.goto(baseUrl);await page.locator('[data-buddy-launcher]').click();
 const workspace=await page.evaluate(()=>window.__demoPanel.getWorkspace());
 workspace.character.config.levels.mining=100;workspace.character.counts={};workspace.filters.collectionGather=filterDefaults('collection');
 await seedDemoWorkspace(page,workspace);await page.reload();await page.locator('[data-buddy-launcher]').click();
 const root=page.locator('#deepveinidle-buddy');await root.locator('[data-action="mode-collection-gather"]').click();
 await root.locator('#search').fill('纯煤');await root.locator('#search').press('Tab');await page.waitForTimeout(300);
 const rows=root.locator('#recipe-candidates tbody tr[data-item-id]');assert.ok(await rows.count()>0);
 assert.ok((await rows.allTextContents()).every(text=>text.includes('纯煤')));
 assert.ok((await rows.evaluateAll(els=>els.map(el=>el.dataset.itemId))).every(id=>id==='5'));
 assert.equal(await root.locator('[data-action="add-collection"],[data-action="add-all"],#orders,#execution-plan').count(),0);
 checks.push('pure coal candidates identify the common-only source without gathering order controls');
 await root.locator('#tier').selectOption('1');await page.waitForTimeout(300);assert.equal(await rows.count(),0);
 await root.locator('#tier').selectOption('0');await toggleGameLanguage(page);await root.locator('#search').fill('Pure coal');await root.locator('#search').press('Tab');await page.waitForTimeout(300);
 assert.ok(await rows.count()>0);assert.ok((await rows.allTextContents()).every(text=>text.includes('Pure coal')));
 checks.push('rare coal excludes the pure route and English labels remain searchable');
 console.log(JSON.stringify({passed:checks.length,checks},null,2));
}finally{await browser.close();}
