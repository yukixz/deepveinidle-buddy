import {launchBrowser,baseUrl} from './browser-helper.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const browser=await launchBrowser();
const page=await browser.newPage({viewport:{width:1440,height:1080}}),checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
const root=page.locator('#deepveinidle-buddy'),box=()=>root.boundingBox();
const near=(a,b)=>assert.ok(Math.abs(a-b)<2,`${a} != ${b}`);
async function drag(locator,dx,dy){const r=await locator.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+dx,r.y+r.height/2+dy,{steps:8});await page.mouse.up();}
async function visible(){await page.waitForFunction(()=>{const r=document.querySelector('#deepveinidle-buddy').getBoundingClientRect();return r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;});const r=await box(),v=page.viewportSize();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=v.width+1&&r.y+r.height<=v.height+1);return r;}
await fs.mkdir('.test-artifacts/panel-geometry',{recursive:true});
try{
 await page.goto(baseUrl);await root.locator('.resize-right').waitFor();
 assert.deepEqual(await root.locator('.titlebar .controls button').evaluateAll(els=>els.map(e=>e.dataset.action)),['language','close']);checks.push('titlebar has only language and close buttons');
 const initial=await box();await drag(root.locator('.resize-right'),-300,-300);const small=await visible();assert.ok(small.width<initial.width-250&&small.height<initial.height-250);checks.push('pointer handle resizes both width and height');
 const beforeLeft=await box();await drag(root.locator('.resize-left'),80,-60);const afterLeft=await visible();near(afterLeft.x,beforeLeft.x+80);near(afterLeft.width,beforeLeft.width-80);near(afterLeft.height,beforeLeft.height-60);near(afterLeft.x+afterLeft.width,beforeLeft.x+beforeLeft.width);checks.push('left bottom handle resizes both axes while anchoring the opposite corner');
 await drag(root.locator('.resize-left'),-80,60);
 for(const [side,dx,dy] of [['west',24,0],['east',-24,0],['top',0,24],['bottom',0,-24],['top-left',24,24],['top-right',-24,24]]){
  const before=await box();await drag(root.locator('.resize-'+side),dx,dy);const after=await visible();
  const west=side==='west'||side==='top-left',east=side==='east'||side==='top-right',north=side.startsWith('top'),south=side==='bottom';
  near(after.x,before.x+(west?dx:0));near(after.y,before.y+(north?dy:0));near(after.width,before.width+(west?-dx:east?dx:0));near(after.height,before.height+(north?-dy:south?dy:0));
  await drag(root.locator('.resize-'+side),-dx,-dy);checks.push(side+' resizes the intended axes with opposite edges anchored');
 }
 const persisted=await box();await page.waitForFunction(()=>localStorage.getItem('dvi-buddy-demo-geometry-v1')!==null);await page.reload();await root.locator('.resize-top').waitFor();const restored=await visible();for(const key of ['x','y','width','height'])near(restored[key],persisted[key]);checks.push('refresh restores saved position and size');
 await root.locator('[data-action="language"]').click();const redraw=await box();near(redraw.width,small.width);near(redraw.height,small.height);checks.push('language redraw preserves geometry');
 const header=await root.locator('.titlebar h1').boundingBox();await page.mouse.move(header.x+20,header.y+8);await page.mouse.down();await page.mouse.move(header.x-230,header.y+108,{steps:8});await page.mouse.up();const moved=await visible();assert.ok(moved.x<small.x-200&&moved.y>small.y+90);checks.push('dragging titlebar moves panel');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('dvi-buddy-demo-geometry-v1')).left===parseFloat(document.querySelector('#deepveinidle-buddy').style.left));await page.reload();await root.locator('.resize-right').waitFor();const movedRestored=await box();for(const key of ['x','y','width','height'])near(movedRestored[key],moved[key]);checks.push('refresh restores titlebar movement as well as size');
 await root.locator('[data-action="language"]').click();const afterButton=await box();near(moved.x,afterButton.x);near(moved.y,afterButton.y);checks.push('titlebar buttons do not initiate dragging');
 await drag(root.locator('.titlebar h1'),-1500,-1500);const edge=await visible();near(edge.x,0);near(edge.y,0);checks.push('dragging is clamped to viewport');
 await drag(root.locator('.resize-right'),1600,1600);const full=await visible();near(full.width,1440);near(full.height,1080);assert.equal(await root.locator('.resize-handle svg').count(),0);checks.push('resize reaches all viewport edges with no corner grip artwork');
 await root.locator('.resize-right').focus();const beforeKey=await box();await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowUp');const afterKey=await box();near(afterKey.width,beforeKey.width-20);near(afterKey.height,beforeKey.height-20);checks.push('focused handle supports keyboard resizing');
 await root.locator('[data-action="close"]').click();assert.equal(await root.isVisible(),false);assert.equal(await page.locator('[data-buddy-launcher]').isVisible(),true);assert.equal(await root.locator('.resize-right').isVisible(),false);await page.locator('[data-buddy-launcher]').click();const reopened=await box();for(const key of ['x','y','width','height'])near(reopened[key],afterKey[key]);checks.push('close hides panel and navigation reopens at preserved position and size');
 await page.setViewportSize({width:390,height:844});await visible();assert.equal(await root.locator('.titlebar .controls button').count(),2);await root.locator('.resize-right').focus();await page.keyboard.press('ArrowLeft');await visible();checks.push('viewport shrink and narrow layout keep controls and resize grip visible');
 await page.screenshot({path:'.test-artifacts/panel-geometry/mobile.png'});
 await page.setViewportSize({width:1440,height:1080});await root.locator('[data-action="language"]').click();await drag(root.locator('.resize-right'),500,0);await visible();await page.screenshot({path:'.test-artifacts/panel-geometry/desktop.png'});
 await page.evaluate(()=>localStorage.setItem('dvi-buddy-demo-geometry-v1',JSON.stringify({width:-1})));await page.reload();await root.locator('.resize-right').waitFor();await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').shadowRoot.querySelector('[role="alert"]').textContent.includes('Invalid saved panel geometry'));await drag(root.locator('.resize-right'),-30,-30);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('dvi-buddy-demo-geometry-v1'))),{width:-1});checks.push('invalid layout storage shows an error and remains protected from overwrite');
 assert.deepEqual(errors,[]);checks.push('no uncaught browser errors');
 await fs.writeFile('.test-artifacts/panel-geometry/summary.json',JSON.stringify({checks,errors},null,2)+'\n');console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}catch(error){await page.screenshot({path:'.test-artifacts/panel-geometry/failure.png'});console.error(JSON.stringify({checks,errors,error:error.stack},null,2));throw error;}finally{await browser.close();}
