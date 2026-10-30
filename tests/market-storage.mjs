import {gameSnapshot} from './game-snapshot.mjs';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {launchBrowser,baseUrl} from './browser-helper.mjs';
import {defaults,workspaceForStorage} from '../src/workspace.js';
import {craftingJobs} from '../src/engine/crafting-model.js';
await fs.mkdir('.test-artifacts/market-storage',{recursive:true});
await build({stdin:{contents:`
 import {mountPanel} from './src/app.js';
 import css from './src/theme.css';
 window.mountMarketPanel=()=>{
  const host=document.createElement('div');host.id='deepveinidle-buddy';document.body.append(host);
  return mountPanel(host.attachShadow({mode:'open'}),{css,initial:window.initialRuntime,storageKey:'market-test',platform:{
   get:async(key,fallback)=>structuredClone(window.savedValues[key]??fallback),
   set:async(key,value)=>{window.savedValues[key]=structuredClone(value);window.savedWrites.push({key,value:structuredClone(value)});},
   market:async()=>{if(window.failMarket)throw Error('marketNetworkFailed');return structuredClone(window.marketResponse);},
  }});
 };`,resolveDir:process.cwd()},outfile:'.test-artifacts/market-storage/harness.js',bundle:true,format:'iife',target:'es2022',loader:{'.css':'text'}});
const browser=await launchBrowser(),checks=[],errors=[];
let page;
try{
 page=await browser.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
 await page.goto(baseUrl+'/tests/game-integration-fixture.html');
 await page.evaluate(()=>{
  window.savedValues={};window.savedWrites=[];
  const interval=window.setInterval.bind(window);
  window.setInterval=(callback,ms,...args)=>{if(ms===10000){window.marketTick=callback;return interval(()=>{},600000);}return interval(callback,ms,...args);};
 });
 await page.addScriptTag({url:baseUrl+'/.test-artifacts/market-storage/harness.js'});
 const initial=defaults(),job=craftingJobs.find(job=>job.output.itemId===40&&!job.upgrade);
 initial.character.initialized=true;initial.character.worldTick=1000000;initial.character.bank={};initial.character.pack={};
 for(const skill in initial.character.config.levels)initial.character.config.levels[skill]=70;
 initial.orders[0].lines=[{kind:'craft',jobId:job.id,tier:0,count:100}];
 // Game observations are supplied by the session, never by persisted user data.

 await page.evaluate(async ({initial,user,snapshot})=>{window.initialRuntime=initial;window.savedValues['market-test']=user;window.panel=await window.mountMarketPanel();window.panel.open();window.panel.receive({role:42,status:'live',source:'client',snapshot});},{initial,user:workspaceForStorage(initial),snapshot:gameSnapshot({bank:{1:99,2:99}})});
 const root=page.locator('#deepveinidle-buddy');const unitPrice=root.locator('[data-material="1"] td').nth(4);
 assert.equal(await unitPrice.textContent(),'—');checks.push('mount starts from memory-only character data and shows unknown prices before the first market read');
 const quote=()=>({version:1,quotes:{1:{ask:{value:112,quantity:500,capturedAt:Date.now()}},2:{ask:{value:80,quantity:600,capturedAt:Date.now()}}},invalid:0});
 await page.evaluate(response=>{window.marketResponse=response;window.marketTick();},quote());
 await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').shadowRoot.querySelector('[data-material="1"] td:nth-child(5)')?.textContent==='112');
 assert.equal(await page.evaluate(()=>window.savedWrites.length),0);checks.push('market refresh updates rendered estimates without a GM write');
 await root.locator('#orders > summary').click();await root.locator('#auto-remove').check();await page.waitForFunction(()=>window.savedWrites.length>0);
 const saved=await page.evaluate(()=>window.savedValues['market-test']);assert.equal(Object.hasOwn(saved,'prices'),false);assert.equal(Object.hasOwn(saved,'character'),false);assert.equal(saved.version,2);assert.equal(saved.autoRemove,true);assert.equal(Object.hasOwn(saved,'language'),false);assert.deepEqual(saved.orders,initial.orders);
 assert.equal(await unitPrice.textContent(),'112');checks.push('saving user settings keeps orders and pricing directions while excluding market observations');
 await page.evaluate(()=>{window.savedValues['market-test'].revision++;});
 await root.locator('#auto-remove').uncheck();await root.evaluate(el=>el.shadowRoot.activeElement?.blur());await root.locator('[data-action="reload"]').waitFor();await root.locator('[data-action="reload"]').click();
 await page.waitForFunction(()=>!document.querySelector('#deepveinidle-buddy').shadowRoot.querySelector('[data-action="reload"]'));
 assert.equal(await unitPrice.textContent(),'112');checks.push('explicit storage reload recovers user data while retaining current in-memory market prices');
 const beforeFailure=await page.evaluate(()=>window.savedWrites.length);
 await page.evaluate(()=>{const now=Date.now.bind(Date);Date.now=()=>now()+300001;window.failMarket=true;window.marketTick();});
 await page.waitForFunction(()=>document.querySelector('#deepveinidle-buddy').shadowRoot.querySelector('#procurement .alert')?.textContent.length>0);
 assert.equal(await unitPrice.textContent(),'112');assert.equal(await page.evaluate(()=>window.savedWrites.length),beforeFailure);checks.push('failed refresh keeps current market estimates without writing storage');
 await page.evaluate(async()=>{window.panel.dispose();document.querySelector('#deepveinidle-buddy').remove();window.initialRuntime=null;window.panel=await window.mountMarketPanel();window.panel.open();});await root.locator('[data-action="mode-craft"]').click();
 assert.equal(await unitPrice.textContent(),'—');checks.push('remounting from the same saved bucket starts without cached market prices');
 assert.deepEqual(errors,[]);checks.push('no browser errors');
 console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}catch(error){console.error(JSON.stringify({checks,errors,error:error.stack,diagnostic:await page?.evaluate(()=>({status:document.querySelector('#deepveinidle-buddy')?.shadowRoot.querySelector('.status')?.textContent,price:document.querySelector('#deepveinidle-buddy')?.shadowRoot.querySelector('[data-material="1"]')?.textContent,writes:window.savedWrites?.length}))},null,2));throw error;}finally{await browser.close();}
