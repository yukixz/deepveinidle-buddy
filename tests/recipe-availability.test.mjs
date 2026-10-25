import test from 'node:test';
import assert from 'node:assert/strict';
import {hasAvailableAsks} from '../src/recipe-availability.js';
import {createPriceSnapshot} from '../src/engine/price-protocol.js';
import {defaults,validateWorkspace} from '../src/workspace.js';
const snapshot=quotes=>createPriceSnapshot({prices:{},quotes});
const ask=(quantity,value=2)=>({ask:{value,quantity,capturedAt:Date.now()}});
test('every material must have enough asks for its rounded total requirement',()=>{
 const prices=snapshot({1:ask(10),2:ask(3)});
 assert.equal(hasAvailableAsks({1:9.1,2:3},prices),true);
 assert.equal(hasAvailableAsks({1:10.01,2:3},prices),false);
 assert.equal(hasAvailableAsks({1:10,2:3.01},prices),false);
});
test('unknown, invalid or zero stock and missing ask prices cannot supply a material',()=>{
 for(const quote of [undefined,ask(undefined),ask(0),{ask:{value:2,quantityInvalid:true,capturedAt:Date.now()}},ask(10,null),{ask:{invalid:true,quantity:10,capturedAt:Date.now()}}]){
  assert.equal(hasAvailableAsks({1:1},snapshot(quote?{1:quote}:{})),false);
 }
});
test('full item IDs are independent and candidates do not consume the snapshot',()=>{
 const prices=snapshot({1:ask(10),1001:ask(1)});
 assert.equal(hasAvailableAsks({1001:2},prices),false);
 assert.equal(hasAvailableAsks({1:10},prices),true);
 assert.equal(hasAvailableAsks({1:10},prices),true);
});
test('no positive requirements need no market data; invalid requirements fail explicitly',()=>{
 assert.equal(hasAvailableAsks({},snapshot({})),true);
 assert.equal(hasAvailableAsks({1:0},snapshot({})),true);
 for(const qty of [-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>hasAvailableAsks({1:qty},snapshot({})),/quantityOverflow/);
});
test('required stock filter preference defaults off, roundtrips and rejects invalid values',()=>{
 const state=defaults();assert.equal(state.excludeInsufficientAsks,false);
 state.excludeInsufficientAsks=true;assert.equal(validateWorkspace(state).excludeInsufficientAsks,true);
 delete state.excludeInsufficientAsks;assert.throws(()=>validateWorkspace(state),/invalidWorkspace/);
 state.excludeInsufficientAsks='true';assert.throws(()=>validateWorkspace(state),/invalidPriceMode/);
});
