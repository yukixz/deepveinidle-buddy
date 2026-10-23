import {encodePlanPayload} from '../src/plan-transfer.js';
import test from 'node:test';import assert from 'node:assert/strict';
import * as game from '../src/engine/upstream.js';
import {defaults,createOrder,putLine,validateWorkspace,validateOrders,estimateOrders,removeCompleted,importOrder,exportOrder,exportOrderText} from '../src/workspace.js';
import {collectionRoutes,collectionRows,collectionPlayers} from '../src/engine/collection-model.js';
import {createPriceSnapshot} from '../src/engine/price-protocol.js';
import {priceDefaults} from '../src/engine/item-prices.js';
import {craftingJobs,craftingTiers,craftingMaterials} from '../src/engine/crafting-model.js';
const bronze=craftingJobs.find(j=>j.output.itemId===40&&!j.upgrade),craft=(count=1)=>({kind:'craft',jobId:bronze.id,tier:0,count}),collection=(target=100)=>({kind:'collection',itemId:40,jobId:collectionRoutes(40)[0].id,target});
function setup(){const w=defaults();w.character.initialized=true;w.character.bank={};w.character.pack={};for(const k in w.character.config.levels)w.character.config.levels[k]=100;return w;}
const quote=(state,id,value)=>({...state,quotes:{...state.quotes,[id]:{ask:{value,capturedAt:Date.now()}}}});
const evaluate=w=>estimateOrders(w,createPriceSnapshot(w.prices));
test('mixed intent survives strict workspace roundtrip; invalid entries reject atomically',()=>{const w=setup();putLine(w.orders[0],craft(10));putLine(w.orders[0],collection());assert.deepEqual(validateWorkspace(w),w);assert.throws(()=>validateWorkspace({...w,orders:[{...w.orders[0],lines:[{...craft(),count:1.2}]}]}),/invalidLine/);});
test('craft counts replace, zero removes; collection keeps highest target',()=>{const o=createOrder();putLine(o,craft(5));putLine(o,craft(7));assert.equal(o.lines[0].count,7);putLine(o,collection(10));putLine(o,collection(100));putLine(o,collection(10));assert.equal(o.lines.length,2);assert.equal(o.lines[1].target,100);putLine(o,craft(0));assert.equal(o.lines.length,1);});
test('duplicate keys and order IDs are rejected',()=>{const o=createOrder();o.lines=[craft(),craft()];assert.throws(()=>validateOrders([o]),/duplicateLine/);o.lines=[];assert.throws(()=>validateOrders([o,o]),/invalidOrders/);});
test('collection progress 9 to 100 gives 91 missing units, four points; plans do not imply stock',()=>{const w=setup();w.character.counts[40]=9;putLine(w.orders[0],collection(100));const p=evaluate(w);assert.equal(p.entries[0].remaining,91);assert.equal(p.entries[0].attempts,91);assert.equal(p.points,4);assert.equal(p.rows.find(r=>r.id===1).required,91);});
test('craft and collection inputs combine before one inventory deduction',()=>{const w=setup();w.character.counts[40]=9;w.character.bank={1:80,2:80};w.character.pack={1:15,2:15};putLine(w.orders[0],craft(10));putLine(w.orders[0],collection(100));const p=evaluate(w);assert.equal(p.rows.find(r=>r.id===1).required,101);assert.equal(p.rows.find(r=>r.id===1).owned,95);assert.equal(p.rows.find(r=>r.id===1).purchase,6);});
test('unknown stock differs from an initialized empty bank',()=>{const w=setup();putLine(w.orders[0],craft());w.character.bank=null;const p=evaluate(w);assert.equal(p.rows[0].purchase,null);assert.equal(p.total,null);w.character.bank={};assert.equal(evaluate(w).rows[0].purchase,1);});
test('shared materials across selected orders are not allocated twice',()=>{const w=setup();putLine(w.orders[0],craft(3));const o=createOrder();putLine(o,craft(4));w.orders.push(o);w.character.bank={1:5,2:5};const p=evaluate(w);assert.equal(p.rows.find(r=>r.id===1).purchase,2);assert.ok(p.actions.every(action=>action.materialStatus===null));});
test('collection duplicates across selected orders block totals; unselected orders do not conflict',()=>{const w=setup();putLine(w.orders[0],collection());const o=createOrder();putLine(o,collection(1000));w.orders.push(o);assert.deepEqual(evaluate(w).conflicts,[40]);assert.equal(evaluate(w).total,null);o.enabled=false;assert.equal(evaluate(w).conflicts.length,0);});
test('valid completed targets auto remove without touching fixed counts',()=>{const w=setup();putLine(w.orders[0],craft(10));putLine(w.orders[0],collection(10));w.character.counts[40]=10;removeCompleted(w);assert.deepEqual(w.orders[0].lines,[craft(10)]);w.autoRemove=false;putLine(w.orders[0],collection(10));removeCompleted(w);assert.equal(w.orders[0].lines.length,2);});
test('uninitialized progress cannot remove targets',()=>{const w=setup();w.character.initialized=false;w.character.counts[40]=100;putLine(w.orders[0],collection());removeCompleted(w);assert.equal(w.orders[0].lines.length,1);assert.ok(evaluate(w).blocked>0);});
test('no price needed when stock covers purchase; missing purchase price keeps unknown subtotal',()=>{const w=setup();putLine(w.orders[0],craft());assert.equal(evaluate(w).total,null);w.character.bank={1:1,2:1};assert.equal(evaluate(w).total,0);});
test('fees charge fixed once, percent on consumed inputs, time on mixed expected actions',()=>{const w=setup();w.character.prices=undefined;w.prices=quote(quote(priceDefaults(),1,2),2,3);w.character.bank={1:1000,2:1000};w.orders[0].fees={fixed:10,percent:10,minute:2};putLine(w.orders[0],craft(10));const a=evaluate(w).orders[0];assert.equal(a.fees.fixed,10);assert.equal(a.fees.percent,5);assert.ok(a.fees.minute>0);putLine(w.orders[0],collection(100));const b=evaluate(w).orders[0];const p=evaluate(w);assert.equal(b.fees.minute,(p.craftSeconds+p.collectionSeconds)/60*2);assert.equal(b.fees.total,10+55+b.fees.minute);assert.equal(b.fees.percent,55);});
test('full precision collection inputs round once after aggregation',()=>{const w=setup();const candidates=collectionRows(w.character).filter(r=>r.status==='ok'&&Object.values(r.materials).some(q=>q!==Math.ceil(q)));assert.ok(candidates.length>0);const candidate=candidates[0];putLine(w.orders[0],{kind:'collection',itemId:candidate.id,jobId:candidate.jobId,target:candidate.target});const p=evaluate(w);for(const [id,q]of Object.entries(candidate.materials))assert.equal(p.rows.find(r=>r.id===Number(id)).required,Math.ceil(q));});
test('quantity overflow fails explicitly',()=>{const w=setup();putLine(w.orders[0],craft(Number.MAX_SAFE_INTEGER));const o=createOrder();putLine(o,craft(Number.MAX_SAFE_INTEGER));w.orders.push(o);const p=estimateOrders(w,createPriceSnapshot(w.prices));assert.ok(p.entries.some(e=>e.status==='quantityOverflow'));assert.equal(p.total,null);});
test('fixed attempts use original work probability without burn adjustment and scale linearly',()=>{
 const w=setup();w.character.config.levels.cooking=1;
 const job=craftingJobs.find(j=>!j.upgrade&&j.skill==='cooking'&&j.levelReq===1);
 assert.ok(game.burnChance(job,collectionPlayers(w.character).craft)>0);
 putLine(w.orders[0],{kind:'craft',jobId:job.id,tier:0,count:100});
 const chance=game.workChance(job,collectionPlayers(w.character).craft),p=evaluate(w);
 assert.equal(p.craftSeconds,100*(game.tickMs/1000)/chance);
 assert.equal(p.entries[0].count,100);assert.equal(p.entries[0].result,undefined);
 w.orders[0].lines[0].count=7;assert.equal(evaluate(w).craftSeconds,7*(game.tickMs/1000)/chance);
});
test('instant upgrades and empty or completed-only orders have zero action fee',()=>{
 const w=setup(),job=craftingJobs.find(j=>j.upgrade);w.orders[0].fees.minute=5;
 putLine(w.orders[0],{kind:'craft',jobId:job.id,tier:0,count:3});assert.equal(evaluate(w).craftSeconds,0);assert.equal(evaluate(w).orders[0].fees.minute,0);
 w.orders[0].lines=[];assert.equal(evaluate(w).orders[0].fees.total,0);
 putLine(w.orders[0],collection(100));w.character.counts[40]=100;assert.equal(evaluate(w).orders[0].fees.minute,0);
});
test('time fee is independent of missing prices and inventory; invalid tasks block it',()=>{
 const w=setup();putLine(w.orders[0],craft(10));w.orders[0].fees={fixed:0,percent:10,minute:3};
 w.character.bank=null;const a=evaluate(w);assert.equal(a.orders[0].fees.percent,null);assert.ok(a.orders[0].fees.minute>0);
 w.character.bank={};assert.equal(evaluate(w).orders[0].fees.minute,a.orders[0].fees.minute);
 w.character.initialized=false;const b=evaluate(w);assert.equal(b.orders[0].fees.minute,null);assert.equal(b.craftSeconds,null);assert.equal(b.orders[0].fees.total,null);
 w.orders[0].fees.minute=0;assert.equal(evaluate(w).orders[0].fees.minute,0);
});
test('collection time fee retains burn, rarity and caught-stop analytical expectations',()=>{
 const w=setup();const candidate=collectionRows(w.character).find(r=>r.status==='ok'&&(r.burn>0||r.caught>0||r.quality<1));assert.ok(candidate);
 putLine(w.orders[0],{kind:'collection',itemId:candidate.id,jobId:candidate.jobId,target:candidate.target});w.orders[0].fees.minute=7;
 const p=evaluate(w);assert.equal(p.collectionSeconds,candidate.seconds);assert.equal(p.orders[0].fees.minute,candidate.seconds/60*7);
});
test('time fee overflow fails explicitly even if missing material prices hide other fees',()=>{
 const w=setup();putLine(w.orders[0],craft(100));w.orders[0].fees={fixed:0,percent:1,minute:Number.MAX_SAFE_INTEGER};assert.throws(()=>evaluate(w),/quantityOverflow/);
});

test('new workspace defaults to market asks',()=>{assert.equal(defaults().character.buyMode,'ask');});
test('single-order transfer contains only validated order intent',async()=>{
 const w=setup();putLine(w.orders[0],craft(4));putLine(w.orders[0],collection());const raw=exportOrder(w.orders[0]);assert.deepEqual(Object.keys(raw).sort(),['format','order','version']);assert.deepEqual(await importOrder(await exportOrderText(w.orders[0])),w.orders[0]);assert.throws(()=>exportOrder({...w.orders[0],lines:[{...craft(),count:-1}]}),/invalidLine/);await assert.rejects(async()=>importOrder(await encodePlanPayload({...raw,version:2})),/invalidOrders/);
});
test('filter thresholds are required and validated',()=>{const w=defaults();w.filters.collection.maxSecondsPerPoint='5';assert.equal(validateWorkspace(w).filters.collection.maxSecondsPerPoint,'5');delete w.filters.collection.maxSecondsPerPoint;assert.throws(()=>validateWorkspace(w),/invalidFilters/);w.filters.collection.maxSecondsPerPoint='-1';assert.throws(()=>validateWorkspace(w),/invalidFilters/);});

test('both price sides are required market ask/bid values',()=>{const w=defaults();assert.equal(w.productPriceMode,'bid');w.productPriceMode='ask';assert.equal(validateWorkspace(w).productPriceMode,'ask');delete w.productPriceMode;assert.throws(()=>validateWorkspace(w),/invalidPriceMode/);w.productPriceMode='bid';w.character.buyMode='global';assert.throws(()=>validateWorkspace(w),/invalidPriceMode/);});

test('material pricing governs mixed requirements, purchase values and percentage fees independently of product pricing',()=>{const w=setup();w.character.buyMode='ask';putLine(w.orders[0],craft(10));putLine(w.orders[0],collection(100));w.orders[0].fees.percent=10;for(const [id,ask,bid]of [[1,2,1],[2,3,2]])w.prices.quotes[id]={ask:{value:ask,capturedAt:Date.now()},bid:{value:bid,capturedAt:Date.now()}};const a=evaluate(w);assert.equal(a.total,550);assert.equal(a.orders[0].fees.percent,55);w.productPriceMode='ask';assert.deepEqual(evaluate(w),a);w.character.buyMode='bid';const b=evaluate(w);assert.equal(b.total,330);assert.equal(b.orders[0].fees.percent,33);assert.deepEqual(a.rows.map(r=>r.required),b.rows.map(r=>r.required));assert.equal(a.craftSeconds,b.craftSeconds);assert.equal(a.collectionSeconds,b.collectionSeconds);});

test('collection defaults to cost ascending and validates explicit sorting',()=>{const w=defaults();assert.equal(w.filters.collection.sort,'cost');assert.equal(w.filters.collection.sortDirection,'asc');w.filters.collection.sort='duration';w.filters.collection.sortDirection='desc';assert.equal(validateWorkspace(w).filters.collection.sortDirection,'desc');w.filters.collection.sortDirection='up';assert.throws(()=>validateWorkspace(w),/invalidFilters/);});

test('execution actions merge recipe and rarity across selected orders without inventory deduction',()=>{const w=setup();w.character.counts[40]=9;w.character.bank={1:999,2:999};putLine(w.orders[0],craft(10));putLine(w.orders[0],collection(100));const second=createOrder();putLine(second,craft(4));w.orders.push(second);const excluded=createOrder();excluded.enabled=false;putLine(excluded,craft(1000));w.orders.push(excluded);const p=evaluate(w);assert.equal(p.actions.length,1);const a=p.actions[0];assert.equal(a.craftCount,14);assert.equal(a.collectionAttempts,91);assert.equal(a.count,105);assert.equal(a.seconds,p.craftSeconds+p.collectionSeconds);assert.deepEqual(a.issues,[]);});
test('execution action collection attempts retain full fractional expectation',()=>{const w=setup();const candidate=collectionRows(w.character).find(r=>r.status==='ok'&&!Number.isInteger(r.attempts));assert.ok(candidate);putLine(w.orders[0],{kind:'collection',itemId:candidate.id,jobId:candidate.jobId,target:candidate.target});const p=evaluate(w);assert.equal(p.actions[0].count,p.entries[0].attempts);assert.notEqual(p.actions[0].count,Math.ceil(p.actions[0].count));assert.equal(p.actions[0].seconds,p.entries[0].seconds);});
test('execution actions keep unknown or conflicting collection counts explicit',()=>{const w=setup();putLine(w.orders[0],craft(10));putLine(w.orders[0],collection(100));w.character.initialized=false;let a=evaluate(w).actions[0];assert.equal(a.craftCount,10);assert.equal(a.collectionAttempts,null);assert.equal(a.count,null);assert.equal(a.seconds,null);assert.ok(a.issues.includes('uninitialized'));w.character.initialized=true;const second=createOrder();putLine(second,collection(100));w.orders.push(second);a=evaluate(w).actions[0];assert.equal(a.count,null);assert.ok(a.issues.includes('collectionConflict'));});
test('completed collections and empty orders do not add execution actions',()=>{const w=setup();assert.deepEqual(evaluate(w).actions,[]);w.autoRemove=false;w.character.counts[40]=100;putLine(w.orders[0],collection(100));assert.deepEqual(evaluate(w).actions,[]);putLine(w.orders[0],craft(2));assert.equal(evaluate(w).actions[0].count,2);});
test('execution actions separate rarities and include gathering collection routes',()=>{const w=setup(),job=craftingJobs.find(j=>craftingTiers(j).includes(1)&&j.levelReq<=100);assert.ok(job);putLine(w.orders[0],{kind:'craft',jobId:job.id,tier:0,count:2});putLine(w.orders[0],{kind:'craft',jobId:job.id,tier:1,count:3});let actions=evaluate(w).actions;assert.equal(actions.length,2);assert.deepEqual(actions.map(a=>[a.tier,a.count]),[[0,2],[1,3]]);w.orders[0].lines=[];const candidate=collectionRows(w.character).find(r=>r.status==='ok'&&game.recipes.find(j=>j.id===r.jobId).skill==='mining');assert.ok(candidate);putLine(w.orders[0],{kind:'collection',itemId:candidate.id,jobId:candidate.jobId,target:candidate.target});actions=evaluate(w).actions;assert.equal(actions[0].craftCount,0);assert.equal(actions[0].count,candidate.attempts);});

test('execution material highlights distinguish sufficient total shared stock from competing actions',()=>{
 const w=setup(),jobs=craftingJobs.filter(j=>!j.upgrade&&j.levelReq<=100&&Object.keys(craftingMaterials(j,0,1)).length===1&&craftingMaterials(j,0,1)[40]>0),first=jobs[0],second=jobs.find(j=>j.id!==first.id);assert.ok(second);
 for(const job of [first,second])putLine(w.orders[0],{kind:'craft',jobId:job.id,tier:0,count:1});
 const quantities=[first,second].map(j=>craftingMaterials(j,0,1)[40]);w.character.bank={40:Math.max(...quantities)};
 let p=evaluate(w);assert.ok(p.rows.some(r=>r.purchase>0));assert.deepEqual(p.actions.map(a=>a.materialStatus),['shared','shared']);
 w.character.pack={40:Math.min(...quantities)};p=evaluate(w);assert.ok(p.rows.every(r=>r.purchase===0));assert.deepEqual(p.actions.map(a=>a.materialStatus),['ready','ready']);
 w.character.bank={};w.character.pack={};assert.ok(evaluate(w).actions.every(a=>a.materialStatus===null));
 w.character.bank=null;assert.ok(evaluate(w).actions.every(a=>a.materialStatus===null));
});
test('readiness checks merged actions rather than individual orders and ignores missing market quotes',()=>{
 const w=setup();putLine(w.orders[0],craft(3));const second=createOrder();putLine(second,craft(4));w.orders.push(second);w.character.bank={1:5,2:5};assert.equal(evaluate(w).actions[0].materialStatus,null);
 w.character.pack={1:2,2:2};assert.equal(evaluate(w).actions[0].materialStatus,'ready');
});
test('fractional collection material requirements are rounded after merged action aggregation',()=>{
 const w=setup(),candidate=collectionRows(w.character).find(r=>r.status==='ok'&&Object.values(r.materials).some(q=>q!==Math.ceil(q))&&craftingJobs.some(j=>j.id===r.jobId&&craftingTiers(j).includes(game.itemTier(r.id))));assert.ok(candidate);putLine(w.orders[0],{kind:'craft',jobId:candidate.jobId,tier:game.itemTier(candidate.id),count:2});putLine(w.orders[0],{kind:'collection',itemId:candidate.id,jobId:candidate.jobId,target:candidate.target});const p=evaluate(w);assert.equal(p.actions.length,1);w.character.bank=Object.fromEntries(p.rows.map(r=>[r.id,r.required]));assert.equal(evaluate(w).actions[0].materialStatus,'ready');w.character.bank[p.rows[0].id]--;assert.equal(evaluate(w).actions[0].materialStatus,null);
});
test('uninitialized or conflicting actions and material-free gathering never claim readiness',()=>{
 const w=setup();putLine(w.orders[0],craft(2));putLine(w.orders[0],collection(100));w.character.bank={1:9999,2:9999};w.character.initialized=false;assert.ok(evaluate(w).actions.every(a=>a.materialStatus===null));w.character.initialized=true;const second=createOrder();putLine(second,collection(100));w.orders.push(second);assert.ok(evaluate(w).actions.every(a=>a.materialStatus===null));
 const gather=setup(),candidate=collectionRows(gather.character).find(r=>r.status==='ok'&&Object.keys(r.materials).length===0);assert.ok(candidate);putLine(gather.orders[0],{kind:'collection',itemId:candidate.id,jobId:candidate.jobId,target:candidate.target});assert.equal(evaluate(gather).actions[0].materialStatus,null);
});

test('unrelated material shortages do not block green for this action, including surplus stock',()=>{
 const w=setup(),first=craftingJobs.find(job=>job.id===43),second=craftingJobs.find(job=>job.id===44);
 putLine(w.orders[0],{kind:'craft',jobId:first.id,tier:0,count:2});
 putLine(w.orders[0],{kind:'craft',jobId:second.id,tier:0,count:1});
 const materials=craftingMaterials(first,0,2),requirements=evaluate(w).rows;
 w.character.bank=Object.fromEntries(Object.keys(materials).map(id=>[id,requirements.find(row=>row.id===Number(id)).required]));
 let plan=evaluate(w);
 assert.ok(plan.rows.some(row=>row.purchase>0));
 assert.equal(plan.actions.find(row=>row.jobId===first.id).materialStatus,'ready');
 assert.equal(plan.actions.find(row=>row.jobId===second.id).materialStatus,null);
 for(const id of Object.keys(materials))w.character.bank[id]++;
 plan=evaluate(w);
 assert.equal(plan.actions.find(row=>row.jobId===first.id).materialStatus,'ready');
 assert.ok(plan.rows.some(row=>row.purchase>0));
});
test('multiple inputs mark partial readiness when one shared input is below total demand but enough for this action',()=>{
 const w=setup(),first=craftingJobs.find(job=>job.id===43),second=craftingJobs.find(job=>job.id===44);
 putLine(w.orders[0],{kind:'craft',jobId:first.id,tier:0,count:2});
 putLine(w.orders[0],{kind:'craft',jobId:second.id,tier:0,count:1});
 const own=craftingMaterials(first,0,2),other=craftingMaterials(second,0,1),shared=Object.keys(own).find(id=>other[id]);
 w.character.bank=Object.fromEntries(evaluate(w).rows.map(row=>[row.id,row.required]));
 w.character.bank[shared]--;
 assert.equal(evaluate(w).actions.find(row=>row.jobId===first.id).materialStatus,'shared');
 w.character.bank[shared]=Math.ceil(own[shared]);
 assert.equal(evaluate(w).actions.find(row=>row.jobId===first.id).materialStatus,'shared');
 w.character.bank[shared]--;
 assert.equal(evaluate(w).actions.find(row=>row.jobId===first.id).materialStatus,null);
});
