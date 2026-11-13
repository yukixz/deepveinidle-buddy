import test from 'node:test';import assert from 'node:assert/strict';
import * as game from '../src/engine/upstream.js';
import {defaults,createOrder,putLine,validateWorkspace,workspaceForStorage,validateOrders,estimateOrders,removeCompleted,collectionActions} from '../src/workspace.js';
import {collectionRoutes,collectionRows,collectionPlayers} from '../src/engine/collection-model.js';
import {createPriceSnapshot} from '../src/engine/price-protocol.js';
import {priceDefaults} from '../src/engine/item-prices.js';
import {estimateCraftRecipe} from '../src/crafting-estimates.js';
import {craftingJobs,craftingTiers,craftingMaterials} from '../src/engine/crafting-model.js';
const bronze=craftingJobs.find(j=>j.output.itemId===40&&!j.upgrade),craft=(count=1)=>({kind:'craft',jobId:bronze.id,tier:0,count}),collection=(target=100)=>({kind:'collection',itemId:40,jobId:collectionRoutes(40)[0].id,target});
function setup(){const w=defaults();w.character.initialized=true;w.character.worldTick=1000000;w.character.bank={};w.character.pack={};for(const k in w.character.config.levels)w.character.config.levels[k]=100;return w;}
const quote=(state,id,value)=>({...state,quotes:{...state.quotes,[id]:{ask:{value,capturedAt:Date.now()}}}});
const evaluate=w=>estimateOrders(w,createPriceSnapshot(w.prices));
const evaluateCollection=w=>evaluate({...w,orders:[w.collectionOrder]});
function setAsks(workspace,values){
 for(const [id,price] of Object.entries(values))workspace.prices=quote(workspace.prices,id,price);
}
test('mixed intent survives strict workspace roundtrip; invalid entries reject atomically',()=>{const w=setup();putLine(w.orders[0],craft(10));putLine(w.orders[0],collection());assert.deepEqual(validateWorkspace(w),w);assert.throws(()=>validateWorkspace({...w,orders:[{...w.orders[0],lines:[{...craft(),count:1.2}]}]}),/invalidLine/);});
test('craft counts replace, zero removes; collection keeps highest target',()=>{const o=createOrder();putLine(o,craft(5));putLine(o,craft(7));assert.equal(o.lines[0].count,7);putLine(o,collection(10));putLine(o,collection(100));putLine(o,collection(10));assert.equal(o.lines.length,2);assert.equal(o.lines[1].target,100);putLine(o,craft(0));assert.equal(o.lines.length,1);});
test('duplicate keys and order IDs are rejected',()=>{const o=createOrder();o.lines=[craft(),craft()];assert.throws(()=>validateOrders([o]),/duplicateLine/);o.lines=[];assert.throws(()=>validateOrders([o,o]),/invalidOrders/);});
test('collection progress 9 to 100 gives 91 missing units, four points; plans do not imply stock',()=>{const w=setup();w.character.counts[40]=9;putLine(w.orders[0],collection(100));const p=evaluate(w);assert.equal(p.entries[0].remaining,91);assert.equal(p.entries[0].attempts,91);assert.equal(p.points,4);assert.equal(p.rows.find(r=>r.id===1).required,91);});
test('craft and collection inputs combine before one inventory deduction',()=>{const w=setup();w.character.counts[40]=9;w.character.bank={1:80,2:80};w.character.pack={1:15,2:15};putLine(w.orders[0],craft(10));putLine(w.orders[0],collection(100));const p=evaluate(w);assert.equal(p.rows.find(r=>r.id===1).required,101);assert.equal(p.rows.find(r=>r.id===1).owned,95);assert.equal(p.rows.find(r=>r.id===1).purchase,6);});
test('unknown stock differs from an initialized empty bank',()=>{const w=setup();putLine(w.orders[0],craft());w.character.bank=null;const p=evaluate(w);assert.equal(p.rows[0].purchase,null);assert.equal(p.total,null);w.character.bank={};assert.equal(evaluate(w).rows[0].purchase,1);});
test('shared materials across selected orders are not allocated twice',()=>{const w=setup();putLine(w.orders[0],craft(3));const o=createOrder();putLine(o,craft(4));w.orders.push(o);w.character.bank={1:5,2:5};const p=evaluate(w);assert.equal(p.rows.find(r=>r.id===1).purchase,2);assert.ok(p.actions.every(action=>action.materialStatus===null));});
test('collection duplicates across selected orders block totals; unselected orders do not conflict',()=>{const w=setup();putLine(w.orders[0],collection());const o=createOrder();putLine(o,collection(1000));w.orders.push(o);assert.deepEqual(evaluate(w).conflicts,[40]);assert.equal(evaluate(w).total,null);o.enabled=false;assert.equal(evaluate(w).conflicts.length,0);});
test('valid completed targets auto remove without touching fixed counts',()=>{const w=setup();assert.equal(w.autoRemove,false);putLine(w.orders[0],craft(10));putLine(w.orders[0],collection(10));w.character.counts[40]=10;removeCompleted(w);assert.equal(w.orders[0].lines.length,2);w.autoRemove=true;removeCompleted(w);assert.deepEqual(w.orders[0].lines,[craft(10)]);w.autoRemove=false;putLine(w.orders[0],collection(10));removeCompleted(w);assert.equal(w.orders[0].lines.length,2);});
test('uninitialized progress cannot remove targets',()=>{const w=setup();w.character.initialized=false;w.character.counts[40]=100;putLine(w.orders[0],collection());removeCompleted(w);assert.equal(w.orders[0].lines.length,1);assert.ok(evaluate(w).blocked>0);});
test('no price needed when stock covers purchase; missing purchase price keeps unknown subtotal',()=>{const w=setup();putLine(w.orders[0],craft());assert.equal(evaluate(w).total,null);w.character.bank={1:1,2:1};assert.equal(evaluate(w).total,0);});
test('fees charge fixed once, percent on consumed inputs, time on mixed expected actions',()=>{const w=setup();w.character.prices=undefined;w.prices=quote(quote(priceDefaults(),1,2),2,3);w.character.bank={1:1000,2:1000};w.orders[0].fees={fixed:10,percent:10,minute:2};putLine(w.orders[0],craft(10));const a=evaluate(w).orders[0];assert.equal(a.fees.fixed,10);assert.equal(a.fees.percent,5);assert.ok(a.fees.minute>0);putLine(w.orders[0],collection(100));const b=evaluate(w).orders[0];const p=evaluate(w);assert.equal(b.fees.minute,(p.craftSeconds+p.collectionSeconds)/60*2);assert.equal(b.fees.total,10+55+b.fees.minute);assert.equal(b.fees.percent,55);});
test('collection materials use whole attempts before purchase aggregation',()=>{const w=setup();const candidates=collectionRows(w.character).filter(r=>r.status==='ok'&&Object.values(r.materials).some(q=>q!==Math.ceil(q)));assert.ok(candidates.length>0);const candidate=candidates[0];putLine(w.orders[0],{kind:'collection',itemId:candidate.id,jobId:candidate.jobId,target:candidate.target});const p=evaluate(w);for(const input of game.recipeInputs(game.recipes.find(j=>j.id===candidate.jobId),game.itemTier(candidate.id)))assert.equal(p.rows.find(r=>r.id===input.itemId).required,Math.ceil(input.qty*Math.ceil(candidate.attempts)));});
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
test('timed upgrades incur a work fee, while empty or completed-only orders do not',()=>{
 const w=setup(),job=craftingJobs.find(j=>j.upgrade);w.orders[0].fees.minute=5;
 putLine(w.orders[0],{kind:'craft',jobId:job.id,tier:0,count:3});assert.equal(evaluate(w).craftSeconds,3*4.8);assert.ok(Math.abs(evaluate(w).orders[0].fees.minute-1.2)<1e-12);
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
 const p=evaluate(w);const seconds=candidate.seconds/candidate.attempts*Math.ceil(candidate.attempts);assert.equal(p.collectionSeconds,seconds);assert.equal(p.orders[0].fees.minute,seconds/60*7);
});
test('large finite time fees survive missing material prices',()=>{
 const w=setup();putLine(w.orders[0],craft(100));w.orders[0].fees={fixed:0,percent:1,minute:Number.MAX_SAFE_INTEGER};const result=evaluate(w).orders[0];assert.ok(result.fees.minute>Number.MAX_SAFE_INTEGER);assert.equal(result.fees.minute,result.seconds/60*Number.MAX_SAFE_INTEGER);assert.equal(result.fees.total,null);assert.equal(result.fees.minuteError,undefined);
});

test('new workspace defaults to market asks',()=>{assert.equal(defaults().character.buyMode,'ask');});
test('filter thresholds are required and validated',()=>{const w=defaults();w.filters.collection.maxSecondsPerPoint='5';assert.equal(validateWorkspace(w).filters.collection.maxSecondsPerPoint,'5');delete w.filters.collection.maxSecondsPerPoint;assert.throws(()=>validateWorkspace(w),/invalidFilters/);w.filters.collection.maxSecondsPerPoint='-1';assert.throws(()=>validateWorkspace(w),/invalidFilters/);});

test('both price sides are required market ask/bid values',()=>{const w=defaults();assert.equal(w.productPriceMode,'bid');w.productPriceMode='ask';assert.equal(validateWorkspace(w).productPriceMode,'ask');delete w.productPriceMode;assert.throws(()=>validateWorkspace(w),/invalidWorkspace/);w.productPriceMode='bid';w.character.buyMode='global';assert.throws(()=>validateWorkspace(w),/invalidPriceMode/);});

test('material pricing governs mixed requirements, purchase values and percentage fees independently of product pricing',()=>{const w=setup();w.character.buyMode='ask';putLine(w.orders[0],craft(10));putLine(w.orders[0],collection(100));w.orders[0].fees.percent=10;for(const [id,ask,bid]of [[1,2,1],[2,3,2]])w.prices.quotes[id]={ask:{value:ask,capturedAt:Date.now()},bid:{value:bid,capturedAt:Date.now()}};const a=evaluate(w);assert.equal(a.total,550);assert.equal(a.orders[0].fees.percent,55);w.productPriceMode='ask';assert.deepEqual(evaluate(w),a);w.character.buyMode='bid';const b=evaluate(w);assert.equal(b.total,330);assert.equal(b.orders[0].fees.percent,33);assert.deepEqual(a.rows.map(r=>r.required),b.rows.map(r=>r.required));assert.equal(a.craftSeconds,b.craftSeconds);assert.equal(a.collectionSeconds,b.collectionSeconds);});

test('collection defaults to cost ascending and validates explicit sorting',()=>{const w=defaults();assert.equal(w.filters.collection.sort,'cost');assert.equal(w.filters.collection.sortDirection,'asc');w.filters.collection.sort='duration';w.filters.collection.sortDirection='desc';assert.equal(validateWorkspace(w).filters.collection.sortDirection,'desc');w.filters.collection.sortDirection='up';assert.throws(()=>validateWorkspace(w),/invalidFilters/);});

test('execution actions merge recipe and rarity across selected orders without inventory deduction',()=>{const w=setup();w.character.counts[40]=9;w.character.bank={1:999,2:999};putLine(w.orders[0],craft(10));putLine(w.orders[0],collection(100));const second=createOrder();putLine(second,craft(4));w.orders.push(second);const excluded=createOrder();excluded.enabled=false;putLine(excluded,craft(1000));w.orders.push(excluded);const p=evaluate(w);assert.equal(p.actions.length,1);const a=p.actions[0];assert.equal(a.craftCount,14);assert.equal(a.collectionAttempts,91);assert.equal(a.count,105);assert.equal(a.seconds,p.craftSeconds+p.collectionSeconds);assert.deepEqual(a.issues,[]);});
test('execution action collection attempts round up and scale dependent time',()=>{const w=setup();const candidate=collectionRows(w.character).find(r=>r.status==='ok'&&!Number.isInteger(r.attempts));assert.ok(candidate);putLine(w.orders[0],{kind:'collection',itemId:candidate.id,jobId:candidate.jobId,target:candidate.target});const p=evaluate(w);assert.equal(p.actions[0].count,p.entries[0].attempts);assert.equal(p.actions[0].count,Math.ceil(candidate.attempts));assert.equal(p.actions[0].seconds,candidate.seconds/candidate.attempts*Math.ceil(candidate.attempts));assert.equal(p.points,candidate.points);assert.equal(p.actions[0].seconds,p.entries[0].seconds);});
test('execution actions keep unknown or conflicting collection counts explicit',()=>{const w=setup();putLine(w.orders[0],craft(10));putLine(w.orders[0],collection(100));w.character.initialized=false;let a=evaluate(w).actions[0];assert.equal(a.craftCount,10);assert.equal(a.collectionAttempts,null);assert.equal(a.count,null);assert.equal(a.seconds,null);assert.ok(a.issues.includes('uninitialized'));w.character.initialized=true;w.character.worldTick=1000000;const second=createOrder();putLine(second,collection(100));w.orders.push(second);a=evaluate(w).actions[0];assert.equal(a.count,null);assert.ok(a.issues.includes('collectionConflict'));});
test('completed collections and empty orders do not add execution actions',()=>{const w=setup();assert.deepEqual(evaluate(w).actions,[]);w.autoRemove=false;w.character.counts[40]=100;putLine(w.orders[0],collection(100));assert.deepEqual(evaluate(w).actions,[]);putLine(w.orders[0],craft(2));assert.equal(evaluate(w).actions[0].count,2);});
test('execution actions separate rarities and include gathering collection routes',()=>{const w=setup(),job=craftingJobs.find(j=>craftingTiers(j).includes(1)&&j.levelReq<=100);assert.ok(job);putLine(w.orders[0],{kind:'craft',jobId:job.id,tier:0,count:2});putLine(w.orders[0],{kind:'craft',jobId:job.id,tier:1,count:3});let actions=evaluate(w).actions;assert.equal(actions.length,2);assert.deepEqual(actions.map(a=>[a.tier,a.count]),[[0,2],[1,3]]);w.orders[0].lines=[];const candidate=collectionRows(w.character).find(r=>r.status==='ok'&&game.recipes.find(j=>j.id===r.jobId).skill==='mining');assert.ok(candidate);putLine(w.orders[0],{kind:'collection',itemId:candidate.id,jobId:candidate.jobId,target:candidate.target});actions=evaluate(w).actions;assert.equal(actions[0].craftCount,0);assert.equal(actions[0].count,Math.ceil(candidate.attempts));});

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
test('whole collection attempts merge with fixed crafts for material readiness',()=>{
 const w=setup(),candidate=collectionRows(w.character).find(r=>r.status==='ok'&&Object.values(r.materials).some(q=>q!==Math.ceil(q))&&craftingJobs.some(j=>j.id===r.jobId&&craftingTiers(j).includes(game.itemTier(r.id))));assert.ok(candidate);putLine(w.orders[0],{kind:'craft',jobId:candidate.jobId,tier:game.itemTier(candidate.id),count:2});putLine(w.orders[0],{kind:'collection',itemId:candidate.id,jobId:candidate.jobId,target:candidate.target});const p=evaluate(w);assert.equal(p.actions.length,1);w.character.bank=Object.fromEntries(p.rows.map(r=>[r.id,r.required]));assert.equal(evaluate(w).actions[0].materialStatus,'ready');w.character.bank[p.rows[0].id]--;assert.equal(evaluate(w).actions[0].materialStatus,null);
});
test('uninitialized or conflicting actions and material-free gathering never claim readiness',()=>{
 const w=setup();putLine(w.orders[0],craft(2));putLine(w.orders[0],collection(100));w.character.bank={1:9999,2:9999};w.character.initialized=false;assert.ok(evaluate(w).actions.every(a=>a.materialStatus===null));w.character.initialized=true;w.character.worldTick=1000000;const second=createOrder();putLine(second,collection(100));w.orders.push(second);assert.ok(evaluate(w).actions.every(a=>a.materialStatus===null));
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

test('order summary uses full material cost plus fees and expected time independently of stock',()=>{
 const w=setup();w.prices=quote(quote(priceDefaults(),1,2),2,3);w.character.bank={1:9999,2:9999};w.orders[0].fees={fixed:10,percent:10,minute:2};putLine(w.orders[0],craft(10));putLine(w.orders[0],collection(100));
 const plan=evaluate(w),order=plan.orders[0];assert.equal(plan.total,0);assert.equal(order.materialValue,550);assert.equal(order.seconds,plan.craftSeconds+plan.collectionSeconds);assert.equal(order.suggestedPrice,550+order.fees.total);
 w.orders[0].lines=[];const empty=evaluate(w).orders[0];assert.equal(empty.seconds,0);assert.equal(empty.materialValue,0);assert.equal(empty.suggestedPrice,0);
 putLine(w.orders[0],collection(100));w.character.counts[40]=100;const complete=evaluate(w).orders[0];assert.equal(complete.seconds,0);assert.equal(complete.materialValue,0);assert.equal(complete.suggestedPrice,0);
});
test('order summary keeps unknown material cost and time explicit',()=>{
 const w=setup();putLine(w.orders[0],craft(10));let order=evaluate(w).orders[0];assert.equal(order.materialValue,null);assert.equal(order.suggestedPrice,null);assert.ok(order.seconds>0);
 w.prices=quote(quote(priceDefaults(),1,2),2,3);w.character.initialized=false;order=evaluate(w).orders[0];assert.equal(order.seconds,null);assert.equal(order.materialValue,50);assert.equal(order.suggestedPrice,50);
 putLine(w.orders[0],collection(100));order=evaluate(w).orders[0];assert.equal(order.materialValue,null);assert.equal(order.suggestedPrice,null);
});

test('burning collections use whole attempts for mixed materials, procurement, fees and readiness',()=>{
 const w=setup();w.character.config.levels.cooking=1;
 const candidate=collectionRows(w.character).find(r=>r.status==='ok'&&r.burn>0&&!Number.isInteger(r.attempts));assert.ok(candidate);
 const job=game.recipes.find(j=>j.id===candidate.jobId),tier=game.itemTier(candidate.id),attempts=Math.ceil(candidate.attempts),fixed=3;
 putLine(w.orders[0],{kind:'collection',itemId:candidate.id,jobId:job.id,target:candidate.target});
 const other=createOrder();putLine(other,{kind:'craft',jobId:job.id,tier,count:fixed});w.orders.push(other);
 w.orders[0].fees={fixed:10,percent:10,minute:2};
 const inputs=game.recipeInputs(job,tier);for(const input of inputs)w.prices=quote(w.prices,input.itemId,5);
 const plan=evaluate(w),action=plan.actions[0];assert.equal(plan.actions.length,1);assert.equal(action.count,attempts+fixed);assert.equal(action.collectionAttempts,attempts);
 const seconds=candidate.seconds/candidate.attempts*attempts;
 assert.equal(plan.collectionSeconds,seconds);assert.equal(action.seconds,seconds+plan.craftSeconds);
 let materialValue=0;
 for(const input of inputs){
  const row=plan.rows.find(r=>r.id===input.itemId),required=input.qty*(attempts+fixed);
  assert.equal(row.required,required);assert.equal(row.purchase,required);assert.equal(row.cost,required*5);
  materialValue+=input.qty*attempts*5;
 }
 assert.equal(plan.total,plan.rows.reduce((sum,r)=>sum+r.cost,0));
 assert.equal(plan.orders[0].materialValue,materialValue);assert.equal(plan.orders[0].fees.percent,materialValue*.1);
 assert.equal(plan.orders[0].fees.minute,seconds/60*2);assert.equal(plan.orders[0].suggestedPrice,materialValue+10+materialValue*.1+seconds/60*2);
 assert.equal(plan.points,candidate.points);
 w.character.bank=Object.fromEntries(plan.rows.map(r=>[r.id,r.required]));assert.equal(evaluate(w).actions[0].materialStatus,'ready');
 w.character.bank[inputs[0].itemId]--;assert.equal(evaluate(w).actions[0].materialStatus,null);
});

test('selected outputs offset matching material rows once across orders without changing gross fees or time',()=>{
 const w=setup(),consumer=craftingJobs.find(j=>j.id===51);
 putLine(w.orders[0],craft(4));
 const other=createOrder();other.fees={fixed:10,percent:10,minute:2};putLine(other,{kind:'craft',jobId:consumer.id,tier:0,count:5});w.orders.push(other);
 w.character.bank={40:3};w.prices=quote(w.prices,40,5);
 const plan=evaluate(w),row=plan.rows.find(r=>r.id===40);
 assert.deepEqual([row.required,row.owned,row.produced,row.purchase,row.cost],[10,3,4,3,15]);
 assert.equal(plan.orders[1].materialValue,50);assert.equal(plan.orders[1].fees.percent,5);
 assert.equal(plan.actions.find(a=>a.jobId===consumer.id).materialStatus,null);
 const before=plan.orders[1];w.orders[0].enabled=false;
 const excluded=evaluate(w);assert.deepEqual(excluded.orders[0],before);assert.equal(excluded.rows.find(r=>r.id===40).produced,0);assert.equal(excluded.rows.find(r=>r.id===40).purchase,7);
});

test('locked material cannot be offset by a planned output',()=>{
 const w=setup();
 putLine(w.orders[0],craft(4));
 putLine(w.orders[0],{kind:'craft',jobId:51,tier:0,count:5});
 w.character.bankLocked=[40];w.character.bank={40:10};
 const plan=evaluate(w),row=plan.rows.find(r=>r.id===40);
 assert.deepEqual([row.required,row.owned,row.produced,row.purchase],[10,0,0,10]);
 assert.equal(plan.actions.find(action=>action.jobId===51).materialStatus,null);
});

test('surplus outputs never create negative purchases or require prices for covered rows',()=>{
 const w=setup();putLine(w.orders[0],craft(10));putLine(w.orders[0],{kind:'craft',jobId:51,tier:0,count:1});
 w.character.bank={1:10,2:10};
 const plan=evaluate(w),row=plan.rows.find(r=>r.id===40);
 assert.deepEqual([row.required,row.owned,row.produced,row.purchase,row.price,row.cost],[2,0,10,0,null,0]);
 assert.equal(plan.total,0);assert.equal(plan.missingPrices,0);
 assert.equal(plan.rows.some(r=>r.id===80),false);
});

test('different output rarities cannot offset each other',()=>{
 const w=setup();putLine(w.orders[0],{kind:'craft',jobId:bronze.id,tier:1,count:100});putLine(w.orders[0],{kind:'craft',jobId:51,tier:0,count:2});
 const row=evaluate(w).rows.find(r=>r.id===40);assert.equal(row.produced,0);assert.equal(row.purchase,4);
});

test('collection outputs use rounded attempts and all gathered qualities before rounding the net purchase',()=>{
 const w=setup();w.character.config.levels.thieving=1;w.character.bank={300:1};
 putLine(w.orders[0],{kind:'collection',itemId:300,jobId:244,target:10});putLine(w.orders[0],{kind:'craft',jobId:248,tier:0,count:6});
 const plan=evaluate(w),entry=plan.entries[0],row=plan.rows.find(r=>r.id===300);
 assert.equal(entry.attempts,Math.ceil(collectionRows(w.character).find(r=>r.id===300&&r.jobId===244&&r.target===10).attempts));
 assert.equal(row.produced,entry.products[300]);assert.ok(row.produced>10&&row.produced<11);
 assert.equal(row.purchase,Math.ceil(12-1-row.produced));
 assert.ok(Object.keys(entry.products).some(id=>game.itemTier(Number(id))>0));
 w.character.counts[300]=10;const completed=evaluate(w).rows.find(r=>r.id===300);
 assert.equal(completed.produced,0);assert.equal(completed.purchase,11);
});

test('unknown or conflicting outputs remain unknown instead of reducing procurement',()=>{
 const w=setup();putLine(w.orders[0],craft(4));putLine(w.orders[0],{kind:'craft',jobId:51,tier:0,count:5});
 w.character.initialized=false;let plan=evaluate(w);assert.equal(plan.total,null);
 assert.equal(plan.rows.find(r=>r.id===40).produced,null);assert.equal(plan.rows.find(r=>r.id===40).purchase,null);
 w.character.initialized=true;w.character.worldTick=1000000;putLine(w.orders[0],collection());const other=createOrder();putLine(other,collection());w.orders.push(other);
 plan=evaluate(w);assert.equal(plan.total,null);assert.equal(plan.rows.find(r=>r.id===40).produced,null);
});

test('user storage excludes game observations while retaining orders and pricing direction',()=>{
 const w=setup(),now=Date.now();w.prices.quotes={1:{ask:{value:112,quantity:500,capturedAt:now}}};w.productPriceMode='ask';w.excludeInsufficientAsks=true;
 const stored=workspaceForStorage(w);assert.equal(Object.hasOwn(stored,'prices'),false);assert.equal(Object.hasOwn(stored,'character'),false);assert.equal(stored.version,2);assert.equal(stored.materialPriceMode,w.character.buyMode);assert.deepEqual(stored.orders,w.orders);assert.equal(stored.productPriceMode,'ask');assert.equal(stored.excludeInsufficientAsks,true);assert.equal(w.prices.quotes[1].ask.quantity,500);
});

test('material cost sums selected full requirements before stock, output offsets and fees',()=>{
 const w=setup(),consumer=craftingJobs.find(j=>j.id===51);putLine(w.orders[0],craft(4));
 const other=createOrder();other.fees.fixed=99;putLine(other,{kind:'craft',jobId:consumer.id,tier:0,count:5});w.orders.push(other);
 w.character.bank={1:4,2:4,40:3};w.prices=quote(quote(quote(priceDefaults(),1,2),2,3),40,5);
 let p=evaluate(w);assert.equal(p.materialCost,70);assert.equal(p.total,15);assert.equal(p.orders.reduce((sum,row)=>sum+row.materialValue,0),70);
 w.character.bank[40]=100;p=evaluate(w);assert.equal(p.materialCost,70);assert.equal(p.total,0);
 other.enabled=false;p=evaluate(w);assert.equal(p.materialCost,20);assert.equal(p.total,0);
});
test('material cost is independent of unknown inventory but missing prices remain unknown even with no purchase',()=>{
 const w=setup();putLine(w.orders[0],craft(10));w.prices=quote(quote(priceDefaults(),1,2),2,3);w.character.bank=null;
 assert.equal(evaluate(w).materialCost,50);assert.equal(evaluate(w).total,null);
 w.character.bank={1:100,2:100};w.prices=priceDefaults();assert.equal(evaluate(w).materialCost,null);assert.equal(evaluate(w).total,0);
 w.orders[0].lines=[];assert.equal(evaluate(w).materialCost,0);
 putLine(w.orders[0],collection(100));w.character.initialized=false;assert.equal(evaluate(w).materialCost,null);
});
test('aggregate full material cost accepts large estimates even if stock covers procurement',()=>{
 const w=setup();w.character.bank={1:100000000,2:100000000};w.prices=quote(quote(priceDefaults(),1,1e9),2,1);
 putLine(w.orders[0],craft(4000000));const second=createOrder();putLine(second,craft(4000000));const third=createOrder();putLine(third,craft(4000000));w.orders.push(second,third);const result=evaluate(w);assert.equal(result.materialCost,12000000*(1e9+1));assert.equal(result.total,0);assert.equal(result.materialCostError,undefined);
});

test('manufacturing estimates ignore the collection bar preference, including legacy mixed orders and fees',()=>{
 const w=setup();w.character.bank={40:4};
 putLine(w.orders[0],craft(3));putLine(w.orders[0],{kind:'craft',jobId:51,tier:0,count:5});
 putLine(w.orders[0],{kind:'collection',jobId:308,itemId:360,target:100});
 w.orders[0].fees={fixed:7,percent:10,minute:2};
 for(const [id,price]of [[40,10],[1,2],[2,3]])w.prices=quote(w.prices,id,price);
 const second=createOrder();putLine(second,{kind:'craft',jobId:51,tier:1,count:2});w.orders.push(second);
 for(const bank of [{40:4},null]){
  w.character.bank=bank;w.expandMetalBars=false;
  const baseline=evaluate(w);
  w.expandMetalBars=true;
  assert.deepEqual(evaluate(w),baseline);
  for(const order of w.orders)assert.deepEqual(evaluate({...w,orders:[order]}),evaluate({...w,expandMetalBars:false,orders:[order]}));
 }
 assert.equal(evaluate(w).actions.some(row=>row.prerequisite),false);
});

test('collection bar expansion values raw materials without changing the preview or stored intent',()=>{
 const w=setup(),job=craftingJobs.find(j=>j.id===51),tier=1;
 const itemId=game.recipeOutput(job,tier),bar=game.recipeOutput(bronze,tier),ore=craftingMaterials(bronze,tier,4);
 w.character.counts[itemId]=98;
 putLine(w.collectionOrder,{kind:'collection',jobId:job.id,itemId,target:100});
 const off=evaluateCollection(w);
 assert.equal(off.rows[0].id,bar);
 w.expandMetalBars=true;w.character.bank={...ore};
 for(const id of Object.keys(ore))w.prices=quote(w.prices,id,3);
 const stored=workspaceForStorage(w),on=evaluateCollection(w),barStep=on.actions.find(action=>action.prerequisite),product=on.actions.find(action=>!action.prerequisite);
 assert.equal(barStep.count,4);assert.equal(barStep.tier,tier);
 assert.equal(barStep.materialStatus,'ready');assert.equal(product.materialStatus,null);
 assert.deepEqual(Object.fromEntries(on.rows.filter(row=>row.id!==bar).map(row=>[row.id,row.required])),ore);
 assert.deepEqual(on.rows.find(row=>row.id===bar),{id:bar,required:4,owned:0,produced:4,purchase:0,price:null,cost:0});
 assert.equal(on.materialCost,24);assert.equal(on.total,0);
 assert.equal(on.collectionSeconds,off.collectionSeconds+barStep.seconds);
 assert.equal(on.orders[0].seconds,on.collectionSeconds);
 assert.equal(on.entries[0].products[bar],undefined);
 const preview=estimateCraftRecipe(w.character,job,tier,createPriceSnapshot(w.prices),undefined,'bid');
 assert.deepEqual(preview.materials,craftingMaterials(job,tier,1));assert.equal(preview.cost,null);
 assert.equal(preview.seconds,off.collectionSeconds/2);
 assert.deepEqual(workspaceForStorage(w),stored);
 assert.equal(stored.expandMetalBars,true);
 w.expandMetalBars=false;
 assert.equal(Object.hasOwn(workspaceForStorage(w),'expandMetalBars'),false);
 assert.throws(()=>validateWorkspace({...w,expandMetalBars:'true'}),/invalidWorkspace/);
});

test('a price reversal or tie removes smelting, alternative purchases and ore demand',()=>{
 const w=setup();w.expandMetalBars=true;w.character.counts[80]=90;w.character.bank={40:8};
 putLine(w.collectionOrder,{kind:'collection',jobId:51,itemId:80,target:100});
 setAsks(w,{1:20,2:25,40:60});
 const crafted=evaluateCollection(w);
 const bar=crafted.rows.find(row=>row.id===40);
 assert.equal(crafted.materialCost,1020);assert.equal(bar.directPurchase,12);assert.equal(bar.selfCrafted,true);
 for(const price of [45,25,0]){
  setAsks(w,{40:price});
  const bought=evaluateCollection(w);
  assert.deepEqual(bought.rows,[{id:40,required:20,owned:8,produced:0,purchase:12,price,cost:12*price}]);
  assert.equal(bought.materialCost,20*price);assert.equal(bought.collectionSeconds,bought.entries[0].seconds);
  assert.equal(bought.actions.some(row=>row.prerequisite),false);
 }
});

test('a partially quoted recipe falls back to purchase; losing the buy quote leaves demand pending',()=>{
 const w=setup();w.expandMetalBars=true;w.character.counts[80]=99;
 putLine(w.collectionOrder,{kind:'collection',jobId:51,itemId:80,target:100});
 setAsks(w,{1:2,40:10});
 assert.equal(evaluateCollection(w).rows[0].purchase,2);
 delete w.prices.quotes[40];
 const pending=evaluateCollection(w);
 assert.equal(pending.rows.find(row=>row.id===40).required,2);
 assert.equal(pending.materialCost,null);assert.equal(pending.collectionSeconds,null);
 assert.equal(pending.actions.some(row=>row.prerequisite),false);
 setAsks(w,{2:3});
 const recovered=evaluateCollection(w);
 assert.equal(recovered.materialCost,10);
 assert.equal(recovered.entries[0].barSteps[0].count,2);
 assert.equal(recovered.rows.find(row=>row.id===40).selfCrafted,undefined);
});

test('collection bar stock covers demand before only the shortage is smelted and valued',()=>{
 const w=setup();w.expandMetalBars=true;w.character.counts[80]=95;
 putLine(w.collectionOrder,{kind:'collection',jobId:51,itemId:80,target:100});
 w.character.bank={40:3};w.character.pack={40:1};
 for(const [id,price]of [[40,10],[1,2],[2,3]])w.prices=quote(w.prices,id,price);
 const plan=evaluateCollection(w),bar=plan.rows.find(row=>row.id===40),step=plan.entries[0].barSteps[0];
 assert.deepEqual([bar.required,bar.owned,bar.produced,bar.purchase,bar.cost],[10,4,6,0,0]);
 assert.deepEqual(plan.rows.filter(row=>row.id!==40).map(row=>[row.id,row.required,row.purchase]),[[1,6,6],[2,6,6]]);
 assert.equal(step.count,6);assert.equal(plan.materialCost,70);assert.equal(plan.total,30);
 assert.equal(plan.orders[0].fees.total,0);
 assert.equal(plan.collectionSeconds,plan.entries[0].seconds+step.seconds);
 w.character.bank={40:12};w.character.pack={40:1};
 const covered=evaluateCollection(w);
 assert.equal(covered.entries[0].barSteps,undefined);assert.equal(covered.actions.length,1);
 assert.equal(covered.collectionSeconds,covered.entries[0].seconds);
 assert.deepEqual(covered.rows.map(row=>[row.id,row.required,row.owned,row.produced,row.purchase]),[[40,10,13,0,0]]);
 assert.equal(covered.materialCost,100);assert.equal(covered.total,0);
 w.character.counts[80]=100;
 assert.deepEqual(evaluateCollection(w).actions,[]);
});

test('collection bar stock is shared once across saved entries without changing inventory or intent',()=>{
 const w=setup();w.expandMetalBars=true;w.character.bank={40:5};w.character.counts={80:98,360:94};
 setAsks(w,{1:2,2:3,40:10});
 for(const [jobId,itemId]of [[51,80],[308,360]])putLine(w.collectionOrder,{kind:'collection',jobId,itemId,target:100});
 const before=workspaceForStorage(w),plan=evaluateCollection(w);
 assert.equal(plan.entries[0].barSteps,undefined);assert.equal(plan.entries[1].barSteps[0].count,5);
 assert.equal(plan.actions.find(row=>row.prerequisite).count,5);
 assert.equal(plan.rows.find(row=>row.id===40).produced,5);
 assert.deepEqual(workspaceForStorage(w),before);assert.deepEqual(w.character.bank,{40:5});
 w.character.counts[80]=100;
 assert.equal(evaluateCollection(w).entries[1].barSteps[0].count,1);
});

test('collection bar sourcing respects quality, purchases locked output and propagates unknown inventory',()=>{
 const w=setup();w.expandMetalBars=true;w.character.counts[1080]=98;
 setAsks(w,{1001:2,1002:3,1040:10});
 putLine(w.collectionOrder,{kind:'collection',jobId:51,itemId:1080,target:100});
 w.character.bank={40:100,1040:1};
 const matched=evaluateCollection(w);
 assert.equal(matched.entries[0].barSteps[0].count,3);
 assert.deepEqual(matched.rows.map(row=>row.id),[1001,1002,1040]);
 w.character.bankLocked=[1040];
 const locked=evaluateCollection(w);
 assert.equal(locked.rows.find(row=>row.id===1040).owned,0);
 assert.equal(locked.entries[0].barSteps,undefined);
 assert.equal(locked.total,40);assert.equal(locked.collectionSeconds,locked.entries[0].seconds);
 w.character.bankLocked=[];w.character.bank=null;
 const unknown=evaluateCollection(w),bar=unknown.rows.find(row=>row.id===1040);
 assert.deepEqual([bar.required,bar.owned,bar.produced,bar.purchase],[4,null,null,null]);
 assert.equal(bar.selfCrafted,undefined);
 assert.equal(unknown.materialCost,null);assert.equal(unknown.collectionSeconds,null);
 assert.equal(unknown.orders[0].seconds,null);assert.equal(unknown.unknownInventory,true);
});

test('explicit bar collection retains its output alongside prerequisite smelting',()=>{
 const w=setup();w.expandMetalBars=true;w.character.bank={40:4};w.character.counts={40:97,80:95};
 setAsks(w,{1:2,2:3,40:10});
 putLine(w.collectionOrder,{kind:'collection',jobId:41,itemId:40,target:100});
 putLine(w.collectionOrder,{kind:'collection',jobId:51,itemId:80,target:100});
 const plan=evaluateCollection(w),bar=plan.rows.find(row=>row.id===40);
 assert.deepEqual([bar.required,bar.owned,bar.produced,bar.purchase],[10,4,9,0]);
 assert.equal(bar.selfCrafted,true);assert.equal(bar.directPurchase,3);
 assert.equal(plan.entries[0].attempts,3);assert.equal(plan.entries[1].barSteps[0].count,6);
 assert.equal(plan.rows.find(row=>row.id===1).required,9);assert.equal(plan.rows.find(row=>row.id===2).required,9);
 w.character.counts[40]=94;
 assert.equal(evaluateCollection(w).rows.find(row=>row.id===40).directPurchase,0);
});

test('collection exposes merged prerequisites by metal and quality while retaining editable targets',()=>{
 const w=setup();w.expandMetalBars=true;w.character.bank={1:5,2:5};
 setAsks(w,{1:2,2:3,40:10,1001:2,1002:3,1040:10});
 w.character.counts={80:98,360:97,1080:99};
 for(const [jobId,itemId]of [[51,80],[308,360],[51,1080]])putLine(w.collectionOrder,{kind:'collection',jobId,itemId,target:100});
 const plan=evaluateCollection(w),rows=collectionActions(plan),steps=rows.filter(row=>row.prerequisite);
 assert.deepEqual(rows.map(row=>row.key),['bar:41:0','bar:41:1','collection:80','collection:360','collection:1080']);
 assert.deepEqual(steps.map(row=>row.count),[7,2]);assert.equal(steps[0].materialStatus,null);
 assert.equal(steps[0].seconds,plan.entries[0].barSteps[0].seconds+plan.entries[1].barSteps[0].seconds);
 assert.equal(steps[0].target,undefined);assert.deepEqual(rows.slice(2).map(row=>row.target),[100,100,100]);
 assert.ok(Math.abs(plan.collectionSeconds-plan.actions.reduce((sum,row)=>sum+row.seconds,0))<1e-10);
 w.character.bank={1:7,2:7,1001:2,1002:2};
 assert.equal(evaluateCollection(w).actions.find(row=>row.key==='bar:41:0').materialStatus,'ready');
 w.character.counts[80]=100;
 const updated=collectionActions(evaluateCollection(w));
 assert.equal(updated[0].count,plan.entries[1].barSteps[0].count);
});

test('gem shortages share stock once, merge cutting steps and preserve costs, time and intent',()=>{
 const w=setup();w.expandMetalBars=true;w.character.bank={180:2,100:3,4:10};w.character.pack={180:1};
 w.character.counts={181:95,184:96};
 for(const [jobId,itemId]of [[231,181],[234,184]])putLine(w.collectionOrder,{kind:'collection',jobId,itemId,target:100});
 for(const [id,price]of [[180,10],[100,2],[4,5]])w.prices=quote(w.prices,id,price);
 const before=workspaceForStorage(w),plan=evaluateCollection(w);
 assert.deepEqual(plan.entries.map(entry=>entry.barSteps[0].count),[2,4]);
 assert.deepEqual(plan.rows.map(row=>[row.id,row.required,row.owned,row.produced,row.purchase]),[[4,9,10,0,0],[100,6,3,0,3],[180,9,3,6,0]]);
 const steps=collectionActions(plan).filter(row=>row.prerequisite);
 assert.equal(steps.length,1);assert.equal(steps[0].jobId,230);assert.equal(steps[0].count,6);
 assert.equal(plan.materialCost,87);assert.equal(plan.total,6);
 assert.equal(plan.collectionSeconds,plan.entries.reduce((sum,entry)=>sum+entry.seconds,0)+steps[0].seconds);
 assert.deepEqual(workspaceForStorage(w),before);assert.deepEqual(w.character.bank,{180:2,100:3,4:10});
 w.expandMetalBars=false;
 const off=evaluateCollection(w);
 assert.equal(off.actions.some(row=>row.prerequisite),false);assert.equal(off.rows.some(row=>row.id===100),false);
 assert.equal(off.rows.find(row=>row.id===180).purchase,6);assert.equal(off.points,plan.points);
});

test('gem sourcing matches quality, purchases locked output and propagates unknown stock',()=>{
 const w=setup();w.expandMetalBars=true;w.character.counts[1181]=95;
 setAsks(w,{1180:10,1100:2,1004:1});
 putLine(w.collectionOrder,{kind:'collection',jobId:231,itemId:1181,target:100});
 w.character.bank={180:100,1180:2,1100:3,1004:5};
 const plan=evaluateCollection(w),step=plan.entries[0].barSteps[0];
 assert.equal(step.tier,1);assert.equal(step.count,3);assert.deepEqual(step.materials,{1100:3});
 assert.equal(step.status,'ok');assert.equal(plan.total,0);
 w.character.bank={1180:5,1004:5};assert.equal(evaluateCollection(w).entries[0].barSteps,undefined);
 w.character.bankLocked=[1180];
 const locked=evaluateCollection(w);assert.equal(locked.entries[0].barSteps,undefined);assert.equal(locked.total,50);
 w.character.bankLocked=[];w.character.bank=null;
 const unknown=evaluateCollection(w);assert.equal(unknown.rows.find(row=>row.id===1180).purchase,null);
 assert.equal(unknown.unknownInventory,true);assert.equal(unknown.materialCost,null);assert.equal(unknown.collectionSeconds,null);
});

test('only the six allowlisted material recipes are eligible for crafting',async()=>{
 const {intermediateJob}=await import('../src/metal-bars.js');
 const allowed=new Set([41,42,43,44,45,230]);
 for(const job of craftingJobs.filter(job=>!job.upgrade))for(const tier of craftingTiers(job)){
  const itemId=game.recipeOutput(job,tier);
  assert.equal(intermediateJob(itemId)?.id,allowed.has(job.id)?job.id:undefined,job.name);
 }
});
