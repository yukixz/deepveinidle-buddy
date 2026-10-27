import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {parse} from 'acorn';
import {defaults,validateWorkspace,importOrder,exportOrder} from '../src/workspace.js';
import {encodePlanPayload} from '../src/plan-transfer.js';
import {normalizePriceState,priceDefaults} from '../src/engine/item-prices.js';
import {createStore} from '../src/storage.js';

test('runtime calculation shapes reject missing and obsolete fields at every workspace boundary',async()=>{
 const mutations=[w=>delete w.character.inventoryCapturedAt,w=>delete w.excludeInsufficientAsks,w=>delete w.character.bank,w=>delete w.character.pack,
  w=>w.language='en',w=>w.character.sellMode='vendor',w=>w.character.config.plans={'343:0':7},w=>w.character.config.upgradeMigration=true,
  w=>w.character.config.hotForecast=true,w=>w.character.edited=false,w=>w.character.config.guildXp=0,w=>w.character.config.hotSetting='game',w=>w.character.config.homeBank=0,w=>w.character.config.ironman=false,w=>w.character.config.weeklyXp=0,w=>w.character.config.simulationHours=24,w=>w.filters.collection.recovery=true,
  w=>w.orders[0].fees.oldFee=1,w=>w.orders[0].oldPlan=[],w=>w.character.config.gear.hammer.oldTier=1];
 for(const mutate of mutations){
  const w=defaults();mutate(w);assert.throws(()=>validateWorkspace(w));
  let writes=0;const original=structuredClone(w),store=createStore({get:async()=>w,set:async()=>writes++},'test',validateWorkspace);
  await assert.rejects(store.load());await assert.rejects(store.save(defaults()),/storageBlocked/);assert.equal(writes,0);assert.deepEqual(w,original);
 }
});
test('old effective-price structures reject without migration',()=>{
 for(const raw of [{version:4,prices:{},quotes:{},preferences:{}},{...priceDefaults(),prices:{}},{...priceDefaults(),preferences:{}}])assert.throws(()=>normalizePriceState(raw));
});
test('single-order transfer rejects obsolete fields and retired recipe plans atomically',async()=>{
 const order=defaults().orders[0];
 for(const altered of [{...order,oldPlan:[]},{...order,lines:[{kind:'craft',jobId:343,tier:0,count:7}]},{...order,lines:[{kind:'collection',itemId:40,jobId:41,target:10,oldTarget:100}]}]){
  await assert.rejects(importOrder(await encodePlanPayload({format:'deepveinidle-buddy-order',version:1,order:altered})));
 }
 assert.deepEqual(exportOrder(order).order,order);
});
test('production modules cannot depend on test simulations or invoke the native predictor',async()=>{
 const root=new URL('../',import.meta.url),files=(await fs.readdir(new URL('src/',root),{recursive:true})).filter(name=>name.endsWith('.js')&&!name.endsWith('upstream.js'));
 const nativeActions=new Set(['tick','offline','predict','createContext']);
 for(const name of files){
  const source=await fs.readFile(new URL('src/'+name,root),'utf8');assert.doesNotMatch(source,/MAX_SIMULATION_MINUTES|simulationHours|upgradeMigration|bidVendor|predictionStartTick|vendorFallback|autoImport|hotSetting|guildXp|weeklyXp/,name);
  const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
  function visit(node){if(!node||typeof node!=='object')return;
   if(node.type==='ImportDeclaration'){const target=path.normalize(path.join('src',path.dirname(name),node.source.value));assert.ok(!target.startsWith('tests/'),target);assert.doesNotMatch(target,/simulation|combat-hot|manual-settings|forecast-filters/);}
   if(node.type==='CallExpression'&&node.callee.type==='MemberExpression'&&node.callee.object.name==='game')assert.ok(!nativeActions.has(node.callee.property.name),name+': '+node.callee.property.name);
   for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
  }visit(ast);
 }
});
