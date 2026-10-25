import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {launchBrowser,baseUrl} from './browser-helper.mjs';
const browser=await launchBrowser(),checks=[],errors=[];
const page=await browser.newPage({viewport:{width:1440,height:1080},hasTouch:true});
page.on('pageerror',error=>errors.push(error.message));
await fs.mkdir('.test-artifacts/execution-borders',{recursive:true});
try{
 await page.goto(baseUrl);await page.locator('[data-buddy-launcher]').click();const root=page.locator('#deepveinidle-buddy'),table=root.locator('#execution-actions'),row=table.locator('tbody tr').first();
 // Exercise actual table paint using visual states only; no game actions or data are changed.
 await table.evaluate(n=>n.style.minWidth='1200px');
 for(const mobile of [false,true]){
  if(mobile){await page.setViewportSize({width:390,height:844});await page.evaluate(async()=>{const {installMobileFixture}=await import('/tests/mobile-fixture.js');installMobileFixture();});await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').hasAttribute('data-mobile'));}
  await row.scrollIntoViewIfNeeded();
  for(const [classes,color,background]of [['queued ready',[112,191,242],[40,76,59]],['running materials-shared',[189,152,232],[102,80,32]],['running queued ready',[189,152,232],[40,76,59]]]){
   await row.evaluate((n,classes)=>n.className=classes,classes);
   for(const scrolled of [false,true]){
    await table.evaluate((n,scrolled)=>n.parentElement.scrollLeft=scrolled?200:0,scrolled);if(scrolled)await row.locator('td').nth(1).hover();else await page.mouse.move(0,0);
    const geometry=await row.evaluate(n=>({cells:[...n.cells].slice(0,2).map(c=>{const r=c.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}),height:n.getBoundingClientRect().height}));
    const png=await page.screenshot();
    const pixels=await page.evaluate(async({data,cells})=>{
     const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const at=(x,y)=>[...ctx.getImageData(Math.floor(x),Math.floor(y),1,1).data].slice(0,3);
     return cells.map(c=>({top:at(c.x+10,c.y+1),bottom:at(c.x+10,c.y+c.h-1),left:at(c.x+1,c.y+c.h/2),fill:at(c.x+c.w-6,c.y+3)}));
    },{data:png.toString('base64'),cells:geometry.cells});
    for(const [index,pixel]of pixels.entries()){assert.deepEqual(pixel.top,color,`${mobile?'mobile':'desktop'} ${classes} scroll=${scrolled} cell=${index} top`);assert.deepEqual(pixel.bottom,color,`cell=${index} bottom`);assert.deepEqual(pixel.fill,background,`cell=${index} material fill`);}
    assert.deepEqual(pixels[0].left,color,'left task marker');
    const before=geometry.cells;await table.evaluate(n=>n.parentElement.scrollLeft+=10);const after=await row.locator('td').first().boundingBox();assert.ok(Math.abs(after.x-before[0].x)<1);assert.equal((await row.boundingBox()).height,geometry.height);
   }
   checks.push(`${mobile?'mobile':'desktop'} ${classes}: frozen cell top/bottom borders, left marker and material fill survive horizontal scrolling and hover without moving cells or changing row height`);
  }
  await row.locator('td').nth(1).hover();const style=await row.locator('td').first().evaluate(n=>getComputedStyle(n,'::after').pointerEvents);assert.equal(style,'none');await page.screenshot({path:`.test-artifacts/execution-borders/${mobile?'mobile':'desktop'}.png`});
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}catch(error){await page.screenshot({path:'.test-artifacts/execution-borders/failure.png'});console.error(JSON.stringify({checks,errors,error:error.stack},null,2));throw error;}finally{await browser.close();}
