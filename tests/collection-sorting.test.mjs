import test from 'node:test';import assert from 'node:assert/strict';
import {sortCollectionRows} from '../src/collection-sorting.js';
const row=(key,points,seconds,secondsPerPoint,costPerPoint,level=1)=>({key,points,seconds,secondsPerPoint,costPerPoint,job:{levelReq:level}});
const rows=[row('a',3,30,10,5),row('b',2,10,5,null),row('c',1,20,20,0)];
const keys=(column,direction)=>sortCollectionRows(rows,column,direction).map(r=>r.key);
test('all four columns support numeric ascending and descending order',()=>{assert.deepEqual(keys('points','asc'),['c','b','a']);assert.deepEqual(keys('points','desc'),['a','b','c']);assert.deepEqual(keys('duration','asc'),['b','c','a']);assert.deepEqual(keys('duration','desc'),['a','c','b']);assert.deepEqual(keys('time','asc'),['b','a','c']);assert.deepEqual(keys('time','desc'),['c','a','b']);});
test('default cost order is ascending; unknown prices stay last in both directions',()=>{assert.deepEqual(sortCollectionRows(rows).map(r=>r.key),['c','a','b']);assert.deepEqual(keys('cost','desc'),['a','c','b']);assert.equal(rows[0].key,'a');});
test('sort uses full precision and stable level/key ties',()=>{const values=[row('b',1,1,1,1.002),row('z',1,1,1,1.001,2),row('a',1,1,1,1.001)];assert.deepEqual(sortCollectionRows(values).map(r=>r.key),['a','z','b']);});
test('invalid sort preferences and invalid numeric results fail explicitly',()=>{assert.throws(()=>sortCollectionRows(rows,'level'),/invalidSort/);assert.throws(()=>sortCollectionRows(rows,'cost','up'),/invalidSort/);assert.throws(()=>sortCollectionRows([row('x',1,1,1,NaN)]),/invalidSortValue/);});
