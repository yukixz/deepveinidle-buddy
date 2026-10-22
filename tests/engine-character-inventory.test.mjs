import test from 'node:test';
import assert from 'node:assert/strict';
import {readCharacterInventory,readInventoryParts} from '../src/engine/character-inventory.js';
const snapshot=()=>({version:2,capturedAt:Date.now(),player:{bank:{1:2,1001:7},pack:[{itemId:1,qty:3},{itemId:1,qty:4},{itemId:2,qty:6}],overflow:{1:100},equipment:{weapon:1}}});
test('game stock merges warehouse and repeated backpack stacks by full id, excluding overflow and equipment',()=>{
 const raw=snapshot(),before=structuredClone(raw),stock=readCharacterInventory(raw);assert.deepEqual(stock,{capturedAt:raw.capturedAt,items:{1:9,2:6,1001:7}});assert.deepEqual(raw,before);
 assert.deepEqual(readInventoryParts({bank:{},pack:[]}),{bank:{},pack:{},items:{}});
});
test('inventory rejects missing, malformed, unknown, fractional, future and overflowing data atomically',()=>{
 for(const edit of [s=>delete s.player.bank,s=>delete s.player.pack,s=>s.player.pack={},s=>s.player.bank={1:-1},s=>s.player.bank={1:1.5},s=>s.player.bank={bad:1},s=>s.player.bank={999999999:1},s=>s.player.pack=[{itemId:1,qty:0}],s=>s.player.pack=[{itemId:1,qty:Number.MAX_SAFE_INTEGER},{itemId:1,qty:1}],s=>s.player.bank={1:Number.MAX_SAFE_INTEGER},s=>s.capturedAt=Date.now()+120000,s=>s.version=1]){
  const raw=snapshot();edit(raw);assert.throws(()=>readCharacterInventory(raw),/invalidSnapshot|incompleteSnapshot/);
 }
});
