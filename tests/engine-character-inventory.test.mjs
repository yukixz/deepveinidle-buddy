import test from 'node:test';import assert from 'node:assert/strict';
import {readInventoryParts} from '../src/engine/character-inventory.js';
const player=()=>({bank:{1:2,1001:7},pack:[{itemId:1,qty:3},{itemId:1,qty:4},{itemId:2,qty:6}],overflow:{1:100}});
test('stock preserves bank and merged backpack stacks independently, excluding overflow',()=>{
 const p=player(),before=structuredClone(p);assert.deepEqual(readInventoryParts(p),{bank:{1:2,1001:7},pack:{1:7,2:6}});assert.deepEqual(p,before);
});
test('missing or overflowing real inventory data rejects without mutating input',()=>{
 for(const edit of [p=>delete p.bank,p=>delete p.pack,p=>p.pack={},p=>p.bank={1:-1},p=>p.bank={1:1.5},p=>p.bank={bad:1},p=>p.bank={999999999:1},p=>p.pack=[{itemId:1,qty:0}],p=>p.pack=[{itemId:1,qty:Number.MAX_SAFE_INTEGER},{itemId:1,qty:1}],p=>p.bank={1:Number.MAX_SAFE_INTEGER}]){const p=player();edit(p);const before=structuredClone(p);assert.throws(()=>readInventoryParts(p));assert.deepEqual(p,before);}
});
