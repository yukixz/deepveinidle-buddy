import {appVersion} from './version.js';
import {gameLanguage,observeGameLanguage} from './game-language.js';
import {installFrozenColumns} from './frozen-columns.js';
import {mobileMode} from './mobile-layout.js';
import {createStableView} from './stable-view.js';
import {readExecutionState,executionStatus} from './execution-status.js';
import {installDebugMenu} from './debug-menu.js';
import {feeInputMax,feeToInput,feeFromInput} from './fee-units.js';
import {sortItemRows,sortNumericRows,itemLevel} from './table-sorting.js';
import {sortCollectionRows} from './collection-sorting.js';
import {hasAvailableAsks} from './recipe-availability.js';
import {estimateCraftRecipe} from './crafting-estimates.js';
import {installPanelGeometry} from './panel-geometry.js';
import * as game from './engine/upstream.js';
import {craftingJobs,craftingTiers,craftingSkills,craftingMaterials} from './engine/crafting-model.js';
import {gatheringSkills} from './engine/gathering-model.js';
import {collectionRows,collectionPlayers,collectionDefaults,validateCollection,importCollection,collectionPrice} from './engine/collection-model.js';
import {translatedName,translatedItemName} from './engine/i18n.js';
import {createPriceSnapshot} from './engine/price-protocol.js';
import {mergeMarketSnapshot} from './engine/item-prices.js';
import {add,defaults,validateWorkspace,userDefaults,validateUserWorkspace,applyUserWorkspace,workspaceForStorage,createOrder,putLine,lineKey,estimateOrders,ordersForMode,collectionActions,removeCompleted} from './workspace.js';
import {createStore} from './storage.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const skillNames={mining:'Mining',fishing:'Fishing',woodcutting:'Woodcutting',thieving:'Thieving',cooking:'Cooking',smithing:'Smithing',fletching:'Fletching',herblore:'Herblore',crafting:'Crafting'};
export async function mountPanel(root,{platform,css,storageKey='dvi-buddy-demo-v1',initial=null,demo=false,gameIntegration=null,readCharacter=null,onVisibilityChange=()=>{},onPrefillFeedback=()=>{}}){
 // Measure the initial desktop layout without flashing an open panel.
 root.host.style.visibility='hidden';let mounting=true;
 const doc=root.ownerDocument,style=doc.createElement('style');style.textContent=css;root.append(style);const container=doc.createElement('div');container.className='panel-mount';root.append(container);
 let workspace=defaults(),skill='all',tier='all',query='',page=1,sort='item',sortDirection='asc',minPoints='',maxSecondsPerPoint='',maxCost='',closed=false,error='',storageError='',status=demo?'demo':'waiting',loaded=false,disposed=false,marketBusy=false,marketPrices=null,lastMarket=0,latestEnvelope=null,appliedPlayerAt=0,appliedSource=null,renderTimer=null,marketError='',live=false;
 let executionState=null,executionError='',syncError='',debug=null,debugGeneration=0,prefillBusy=false,modeGeneration=0,ordersExpanded=false;const expandedOrders=new Set(),tableSorts=new Map();
 let collectionCache=null,collectionCacheKey='',savedFilter={craft:null,collection:null,collectionGather:null};
 const store=createStore(platform,storageKey,validateUserWorkspace);
 const stableView=createStableView(container,()=>queueRender());
 let language=gameLanguage(doc);const frozen=installFrozenColumns(root);
 const zh=()=>language==='zh',text=(a,b)=>zh()?a:b;
 const statusText=()=>text({demo:'演示模式',waiting:'等待角色快照',live:'',disconnected:'连接已断开 · 旧数据仅供参考',error:'捕获失败'}[status]??status,{demo:'Demo',waiting:'Waiting for character snapshot',live:'',disconnected:'Disconnected · stale data',error:'Capture failed'}[status]??status);
 const name=s=>translatedName(s,language),item=id=>translatedItemName(id,language),skillName=s=>name(skillNames[s]);
 const tiers=()=>text(['普通','罕见','稀有','史诗','传说'],['Normal','Uncommon','Rare','Epic','Legendary']);
 const number=(v,d=2)=>v===null||v===undefined?'—':v.toLocaleString(zh()?'zh-CN':'en',{maximumFractionDigits:d});
 function coins(value){
  if(value===null||value===undefined)return '—';
  const suffixes=['','K','M','B','T','Q'];let amount=value,unit=0;
  while(Math.abs(Number(amount.toFixed(2)))>=1000&&unit<suffixes.length-1){amount/=1000;unit++;}
  return amount.toFixed(2)+suffixes[unit];
 }
 const duration=seconds=>seconds===null||seconds===undefined?'—':seconds>=3600?number(seconds/3600,1)+text(' 小时',' h'):seconds>=60?number(seconds/60,1)+text(' 分钟',' min'):number(seconds,1)+text(' 秒',' s');
 const errors={uninitialized:['等待数据','Waiting for data'],levelTooLow:['等级不足','Level too low'],unreachable:['动作不可达','Action unreachable'],collectionConflict:['收藏目标在执行订单间重复','Duplicate collection target in selected orders'],complete:['已完成','Completed'],storageBlocked:['存档已保护，请重新载入或明确重置','Storage protected; reload or reset explicitly'],storageConflict:['存档版本已变化，请重新载入','Saved data version changed; reload'],invalidWorkspace:['用户存档无效，原数据保留','Invalid user storage; original preserved'],unsupportedWorkspaceVersion:['用户存档格式不支持，原数据保留；备份后可明确重置','Unsupported user storage format; original preserved. Back up before resetting'],storageBusy:['存档正在读写，请稍后重试','Storage is busy; retry shortly'],storageRevisionOverflow:['存档写入计数超出安全范围，原数据保留','Storage revision exceeded the safe range; original preserved'],invalidConfiguration:['角色数据无效，保留有效数据','Invalid character data; valid data kept'],invalidWorldBuffs:['游戏时间或世界稀有度数据无效，保留有效数据','Invalid game clock or world rarity; valid data kept'],invalidPriceStorage:['行情结构无效，保留原数据','Invalid market state; original preserved'],invalidOrders:['订单格式无效','Invalid order format'],invalidPriceMode:['请选择卖单或买单','Choose asks or bids'],invalidLine:['订单项格式无效','Invalid line'],quantityOverflow:['数量或金额超出安全计算范围','Quantity or amount overflow'],invalidNumber:['请输入有效非负数','Enter a valid nonnegative number'],incompatibleCharacter:['角色结构不兼容，请刷新／更新脚本','Character incompatible; refresh or update'],marketStale:['行情早于当前缓存，已保留原报价','Older market response; prices preserved']};
 Object.assign(errors,Object.fromEntries([
 ['realtimeUnavailable','实时读取不可用，无法预填','Live reading unavailable; cannot prefill'],['invalidPrefill','缺口、价格或次数无效，无法预填','Invalid quantity, price or attempts'],['gameRoleChanged','游戏角色已变化，预填已停止','Game character changed; prefill stopped'],['planChanged','订单、库存或行情已变化，请重试','Plan, stock or prices changed; retry'],['gameControlMissing','未找到对应游戏控件，预填已停止','Game control not found; prefill stopped'],['gameRarityUnavailable','游戏暂未提供此品质选项，请先备齐至少一次制作所需材料','This rarity is not available in the game; prepare enough materials for at least one craft'],['gameControlAmbiguous','游戏控件不唯一，预填已停止','Ambiguous game controls; prefill stopped'],['gameControlUnavailable','游戏当前不支持此配方或选项','Recipe or option is unavailable'],['gameItemMismatch','游戏物品不匹配，预填已停止','Game item mismatch; prefill stopped'],['gamePrefillMismatch','游戏调整或拒绝了输入，请核对草稿','Game changed or rejected the values; check the draft'],['prefillBusy','正在预填，请稍候','Prefill in progress'],['debugDisabled','调试功能未启用，无法预填','Debug features are disabled; cannot prefill'],['invalidExecutionState','游戏任务状态无效，已清除任务高亮','Invalid game task state; task highlights cleared'],['invalidDebugPreference','调试设置无效，原值已保留，请修正后重新载入','Invalid debug preference; original preserved. Correct it and reload']
 ].map(([code,cn,en])=>[code,[cn,en]])));
 const message=code=>errors[code]?.[zh()?0:1]??code;
 const gathering=()=>workspace.selectedMode==='collectionGather';
 const collecting=()=>workspace.selectedMode==='collection';
 const manufacturing=()=>workspace.selectedMode==='craft';
 const current=()=>collecting()?workspace.collectionOrder:manufacturing()?workspace.orders.find(o=>o.id===workspace.currentOrderId):null;
 const modePlan=()=>estimateOrders({...workspace,orders:ordersForMode(workspace,filterKey())},prices());
 const planActions=plan=>collecting()?collectionActions(plan):plan.actions;
 const priceState=()=>marketPrices??workspace.prices;
 const prices=()=>createPriceSnapshot(priceState());
 const option=(values,value)=>values.map(([v,label])=>`<option value="${esc(v)}" ${String(value)===String(v)?'selected':''}>${esc(label)}</option>`).join('');
 const outputId=(job,tier)=>job.upgrade?game.upgradeResult(job.upgrade,game.withRarity(job.upgrade.from[0],tier)):game.recipeOutput(job,tier);
 const lineItem=line=>line.kind==='collection'?line.itemId:outputId(craftingJobs.find(j=>j.id===line.jobId),line.tier);
 const tablePreference=table=>table==='recipes'?{column:sort,direction:sortDirection}:tableSorts.get(table)??{column:'item',direction:'asc'};
 function sortHeader(table,column,label){const pref=tablePreference(table),active=pref.column===column;return `<th aria-sort="${active?(pref.direction==='asc'?'ascending':'descending'):'none'}">${button('sort-table',label+`<span class="sort-arrow" aria-hidden="true">${active?(pref.direction==='asc'?'▲':'▼'):''}</span>`,`class="sort-header" data-table="${esc(table)}" data-column="${column}"`)}</th>`;}
 const sortableColumns=table=>table==='recipes'?['item','rarity']:table.startsWith('order-')?['item','rarity','type','count']:table==='procurement'?['item','rarity','purchase','required','cost']:table==='actions'?['item','rarity','skill','count','seconds']:[];
 function sortedItems(rows,table,getId){const pref=tablePreference(table);if(['item','rarity'].includes(pref.column))return sortItemRows(rows,pref.column,pref.direction,getId);if(!sortableColumns(table).includes(pref.column))throw Error('invalidSort');return sortNumericRows(rows,row=>table.startsWith('order-')?pref.column==='type'?(row.kind==='craft'?0:1):row.kind==='craft'?row.count:row.target:table==='actions'&&pref.column==='skill'?game.allSkills.indexOf((craftingJobs.find(j=>j.id===row.jobId)??game.recipes.find(j=>j.id===row.jobId)).skill):row[pref.column],pref.direction,getId);}
 const button=(action,label,extra='')=>`<button type="button" data-action="${action}" ${extra}>${label}</button>`;
 function pricingControls(){
  const modes=[['ask',text('卖单','Asks')],['bid',text('买单','Bids')]];
  return `<div class="pricing-controls">${[['material',text('材料','Material'),workspace.excludeInsufficientAsks&&workspace.character.buyMode==='ask'?'ask-stock':workspace.character.buyMode],['product',text('产物','Product'),workspace.productPriceMode]].map(([kind,label,value])=>`<label>${label}<select id="global-${kind}-price-mode" data-pricing="${kind}">${option(kind==='material'?[modes[0],['ask-stock',text('卖单（排除在售数量不足）','Asks (exclude insufficient stock)')],modes[1]]:modes,value)}</select></label>`).join('')}</div>`;
 }


 function queueRender(){if(disposed)return;if(renderTimer!==null)return;renderTimer=setTimeout(()=>{renderTimer=null;render();},100);}
 async function save(){if(!loaded||disposed||storageError)return;try{await store.save(workspaceForStorage(workspace));}catch(e){if(!storageError)storageError=message(e.message);queueRender();}}
 function changed(defer=false){if(live&&appliedPlayerAt&&!syncError)removeCompleted(workspace);void save();if(defer)queueRender();else render();}
 function ensureOrder(){if(!workspace.orders.length){const o=createOrder();workspace.orders.push(o);workspace.currentOrderId=o.id;}if(!workspace.orders.some(o=>o.id===workspace.currentOrderId))workspace.currentOrderId=workspace.orders[0].id;}
 const filterKey=()=>workspace.selectedMode;
 function restoreFilters(){
  ({skill,tier,query,sort,sortDirection,page,minPoints,maxSecondsPerPoint,maxCost}=savedFilter[filterKey()]);
  if(gathering()&&['cost','coins'].includes(sort))sort='time';
  if(!(gathering()?gatheringSkills:craftingSkills).includes(skill))skill='all';
 }
 function applyUserData(raw){
  workspace=applyUserWorkspace(workspace,raw);savedFilter=workspace.filters;
  restoreFilters();
  modeGeneration++;ordersExpanded=false;expandedOrders.clear();collectionCache=null;
 }
 if(initial)workspace=validateWorkspace(initial);
 try{const saved=await store.load();if(saved)applyUserData(saved);}catch(e){storageError=message(e.message);}
 loaded=true;savedFilter=workspace.filters;restoreFilters();ensureOrder();
 function collectionCandidates(){
  const c=workspace.character;const key=JSON.stringify({initialized:c.initialized,config:c.config,counts:c.counts,rarityHot:hotKey(c)});if(collectionCache&&collectionCacheKey===key)return collectionCache;
  collectionCache=collectionRows(workspace.character).map(row=>({...row,job:game.recipes.find(j=>j.id===row.jobId)}));collectionCacheKey=key;return collectionCache;
 }
 function candidates(all=false){
  const ps=prices(),s=workspace.character;
  let values=manufacturing()?craftingJobs.flatMap(job=>craftingTiers(job).map(t=>({job,tier:t,jobId:job.id,kind:'craft',key:`${job.id}:${t}`}))):collectionCandidates().filter(r=>r.status==='ok').map(r=>({...r,tier:game.itemTier(r.id),itemId:r.id,kind:'collection',key:`${r.id}:${r.jobId}:${r.target}`}));
  values=values.filter(r=>(skill==='all'||r.job.skill===skill)&&(tier==='all'||r.tier===Number(tier))&&(manufacturing()||(gatheringSkills.includes(r.job.skill)?gathering():collecting()))&&`${r.job.name} ${name(r.job.name)}`.toLowerCase().includes(query.toLowerCase()));
  if(workspace.excludeInsufficientAsks&&s.buyMode==='ask')values=values.filter(r=>hasAvailableAsks(manufacturing()?craftingMaterials(r.job,r.tier,1):r.materials,ps));
  if(!manufacturing())values=values.map(r=>{const q=Object.entries(r.materials).map(([id,qty])=>[qty,collectionPrice(Number(id),ps,s.buyMode).price]);const cost=q.some(([qty,p])=>qty>0&&p===null)?null:q.reduce((v,[qty,p])=>v+qty*(p??0),0);return {...r,cost,costPerPoint:cost===null?null:cost/r.points};}).filter(r=>(minPoints===''||r.points>=Number(minPoints))&&(maxSecondsPerPoint===''||r.secondsPerPoint<=Number(maxSecondsPerPoint))&&(maxCost===''||r.costPerPoint!==null&&r.costPerPoint<=Number(maxCost)));
  if(!manufacturing())values=sortCollectionRows(values,sort,sortDirection);else values=sortedItems(values,'recipes',r=>outputId(r.job,r.tier));
  const total=values.length,pages=Math.max(1,Math.ceil(total/10));page=Math.min(Math.max(1,page),pages);const visible=all?values:values.slice((page-1)*10,page*10);if(manufacturing()){const players=collectionPlayers(s);return {values:visible.map(r=>({...r,estimate:estimateCraftRecipe(s,r.job,r.tier,ps,players,workspace.productPriceMode)})),total,pages};}return {values:visible,total,pages};
 }
 const routeLabel=job=>job?.plain?`<small class="route-label">${esc(name(job.name))}</small>`:'';
 function tableItemName(id){const value=esc(item(id));return `<span class="item-name" tabindex="0" title="${value}">${value}</span>`;}
 function recipeTable(data){
  if(manufacturing())return `<table id="recipe-candidates" class="frozen-table"><thead><tr>${sortHeader('recipes','item',text('物品','Item'))}${sortHeader('recipes','rarity',text('稀有度','Rarity'))}${[text('材料/次','Inputs/craft'),text('材料成本','Material cost'),text('产物价值','Product value'),text('时间','Time'),text('当前订单次数','Order count')].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${data.values.map(r=>{
   const line={kind:'craft',jobId:r.jobId,tier:r.tier,count:1},count=current().lines.find(l=>lineKey(l)===lineKey(line))?.count??0;
   const materials=Object.entries(r.estimate.materials).map(([id,qty])=>`<span class="material-amount">${esc(item(Number(id)))} × ${number(qty,0)}</span>`).join(' · ');
   return `<tr data-view-key="craft:${esc(r.key)}" data-item-id="${outputId(r.job,r.tier)}"><td class="text-cell" title="${esc(name(r.job.name))} · Lv ${itemLevel(outputId(r.job,r.tier))??'—'}">${tableItemName(outputId(r.job,r.tier))}</td><td>${tiers()[game.itemTier(outputId(r.job,r.tier))]}</td><td class="text-cell materials-cell">${materials}</td><td>${number(r.estimate.cost)}</td><td>${number(r.estimate.productValue)}</td><td>${r.estimate.status==='ok'?duration(r.estimate.seconds):esc(message(r.estimate.status))}</td><td><input id="count-${esc(r.key)}" type="number" inputmode="decimal" min="0" max="${Number.MAX_SAFE_INTEGER}" step="1" value="${count}" data-count="${esc(r.key)}" aria-label="${esc(name(r.job.name)+' '+tiers()[r.tier]+' '+text('次数','count'))}"></td></tr>`;
  }).join('')}</tbody></table>`;
  return `<table id="recipe-candidates" class="frozen-table"><thead><tr>${sortHeader('recipes','item',text('物品','Item'))}${sortHeader('recipes','rarity',text('稀有度','Rarity'))}${[[text('当前→目标','Current → target'),null],[text('精通点','Points'),'points'],[text('时间','Time'),'duration'],...(!gathering()?[[text('金币','Coins'),'coins']]:[]),[text('秒/点','sec/pt'),'time'],...(!gathering()?[[text('金币/点','Coins/pt'),'cost']]:[[text('执行次数','Attempts'),null]]),...(!gathering()?[[text('加入当前订单','Add to order'),null]]:debug?.enabled?[[text('操作','Actions'),null]]:[])].map(([label,column])=>column?`<th aria-sort="${sort===column?(sortDirection==='asc'?'ascending':'descending'):'none'}">${button('sort-collection',label+`<span class="sort-arrow" aria-hidden="true">${sort===column?(sortDirection==='asc'?'▲':'▼'):''}</span>`,`class="sort-header" data-sort="${column}"`)}</th>`:`<th>${label}</th>`).join('')}</tr></thead><tbody>${data.values.map(r=>{const selected=current()?.lines.find(l=>l.kind==='collection'&&l.itemId===r.id);return `<tr data-view-key="collection:${esc(r.key)}" data-item-id="${r.id}"><td class="text-cell">${tableItemName(r.id)}${routeLabel(r.job)}</td><td>${tiers()[r.tier]}</td><td>${number(r.current,0)} → ${number(r.target,0)}</td><td>${number(r.points,0)}</td><td>${duration(r.seconds)}</td>${!gathering()?`<td>${coins(r.cost)}</td>`:''}<td>${number(r.secondsPerPoint)}</td>${gathering()?`<td data-collection-attempts>${number(r.attempts)}</td>`:`<td>${coins(r.costPerPoint)}</td>`}${gathering()?(debug?.enabled?`<td>${button('prefill-gather',text('执行','Execute'),`class="compact" data-key="${r.key}" ${!prefillEnabled()?'disabled':''} title="${text('仅预填，不启动；期望次数向上取整','Prefill only; does not start. Expected attempts are rounded up.')}"`)}</td>`:''):`<td>${button('add-collection',selected?.jobId===r.jobId&&selected.target>=r.target?text('移出订单','Remove from order'):selected&&selected.jobId!==r.jobId?text('替换来源','Replace source'):text('加入订单','Add to order'),`class="compact" data-key="${r.key}"`)}</td>`}</tr>`;}).join('')}</tbody></table>`;
 }
 function orderMetrics(order){
  let values;
  try{const result=estimateOrders({...workspace,orders:[{...order,enabled:true}]},prices()).orders[0];values=[duration(result.seconds),number(result.materialValue),number(result.fees.total),number(result.suggestedPrice)];}
  catch(e){values=Array(4).fill(esc(message(e.message)));}
  return ['time','cost','fee','price'].map((key,i)=>`<td data-order-metric="${esc(order.id)}:${key}"${key==='fee'?` data-order-fee="${esc(order.id)}"`:''}>${values[i]}</td>`).join('');
 }
 function orderDetails(order){const id=esc(order.id);return `<div class="order-details"><div class="toolbar"><label>${text('名称','Name')}<input id="order-name-${id}" data-order-name="${id}" maxlength="120" value="${esc(order.name)}" class="order-name"></label><label>${text('批量设置次数','Bulk set counts')}<input id="batch-count-${id}" type="number" inputmode="decimal" min="0" max="${Number.MAX_SAFE_INTEGER}" value="1"></label>${button('batch',text('应用到制造行','Apply to craft lines'),`class="compact" data-id="${id}"`)}</div><div class="fees">${['fixed','percent','minute'].map((key,i)=>`<label title="${esc([text('1M = 100万金币；每张有未完成任务的订单收取一次。','1M = 1,000,000 coins; charged once per order with unfinished tasks.'),text('按全部需求材料价值加收，包含已有库存材料。','Percentage of all required material value, including stocked materials.'),text('每小时收取的 M 金币数，按计划整数次数的预计动作时间计费，不含移动与回仓。','Millions of coins per hour of planned action time, excluding travel and banking.')][i])}">${[text('固定加工费(M)','Fixed processing fee (M)'),text('材料费率(%)','Material rate (%)'),text('工时单价(M/h)','Time rate (M/h)')][i]}<input id="fee-${key}-${id}" data-fee="${key}" data-order="${id}" type="number" inputmode="decimal" step="any" min="0" max="${feeInputMax(key)}" value="${feeToInput(key,order.fees[key])}"></label>`).join('')}</div>${lineTable(order.lines,order.id)}</div>`;}
 function orderPanel(){return `<details class="section" id="orders" ${ordersExpanded?'open':''}><summary>${text('订单管理','Orders')}</summary><div class="heading">${button('new-order',text('新建','New'))}<label><input id="auto-remove" type="checkbox" ${workspace.autoRemove?'checked':''}>${text('自动移出已完成的收藏目标','Automatically remove completed collection targets')}</label></div><div class="scroll"><table id="order-list"><thead><tr>${[text('执行','Run'),text('订单','Order'),text('制造 / 收藏','Craft / Collection'),text('时间','Time'),text('成本','Cost'),text('加工费','Fees'),text('建议售价','Suggested price'),text('操作','Actions')].map(label=>`<th>${label}</th>`).join('')}</tr></thead><tbody>${workspace.orders.map(order=>`<tr class="${order.id===workspace.currentOrderId?'current':''}" data-order-row="${esc(order.id)}"><td><input type="checkbox" data-enabled="${esc(order.id)}" aria-label="${esc(text('执行 ','Run ')+order.name)}" ${order.enabled?'checked':''}></td><td class="text-cell">${button('edit-order',esc(order.name),`class="compact" data-id="${esc(order.id)}" aria-pressed="${order.id===workspace.currentOrderId}" aria-expanded="${expandedOrders.has(order.id)}" aria-controls="order-detail-${esc(order.id)}"`)}</td><td>${order.lines.filter(l=>l.kind==='craft').length} / ${order.lines.filter(l=>l.kind==='collection').length}</td>${orderMetrics(order)}<td class="actions">${button('copy-order',text('复制','Copy'),`class="compact" data-id="${esc(order.id)}"`)}${button('delete-order',text('删除','Delete'),`class="compact" data-id="${esc(order.id)}"`)}</td></tr><tr id="order-detail-${esc(order.id)}" class="order-detail-row" ${expandedOrders.has(order.id)?'':'hidden'}><td colspan="8">${orderDetails(order)}</td></tr>`).join('')}</tbody></table></div></details>`;}
 function lineTable(lines,orderId){const table='order-'+orderId;return `<div class="order-lines"><table data-order-lines="${esc(orderId)}"><thead><tr>${sortHeader(table,'type',text('类型','Type'))}${sortHeader(table,'item',text('物品','Item'))}${sortHeader(table,'rarity',text('稀有度','Rarity'))}${sortHeader(table,'count',text('次数 / 目标','Count / Target'))}<th>${text('进度','Progress')}</th><th>${text('操作','Actions')}</th></tr></thead><tbody>${sortedItems(lines,table,lineItem).map(line=>{const id=lineItem(line);return `<tr data-line-key="${esc(lineKey(line))}" data-item-id="${id}" data-order-line><td>${line.kind==='craft'?text('制造','Craft'):text('收藏','Collection')}</td><td class="text-cell">${esc(item(id))}${routeLabel(game.recipes.find(j=>j.id===line.jobId))}</td><td>${tiers()[game.itemTier(id)]}</td><td>${number(line.kind==='craft'?line.count:line.target,0)}</td><td>${line.kind==='collection'?`${number(workspace.character.counts[line.itemId]??null,0)} / ${number(line.target,0)}`:'—'}</td><td class="actions">${line.kind==='collection'?button('target-down','−',`class="compact" data-order="${esc(orderId)}" aria-label="${text('降低目标','Lower target')}"`)+button('target-up','+',`class="compact" data-order="${esc(orderId)}" aria-label="${text('提高目标','Raise target')}"`):''}${button('remove-line',text('移除','Remove'),`class="compact" data-order="${esc(orderId)}"`)}</td></tr>`;}).join('')||`<tr><td colspan="6" class="muted">${text('在上方选择配方或收藏目标加入此订单。','Add recipes or collection targets above.')}</td></tr>`}</tbody></table></div>`;}
 function targetControls(line,orderId){
  const targets=game.collectionThresholds(game.baseItemId(line.itemId)),at=targets.indexOf(line.target),extra=`class="compact" data-order="${esc(orderId)}"`;
  return button('target-up','+',`${extra} ${at>=targets.length-1?'disabled':''} aria-label="${text('提高目标','Raise target')}"`)+button('target-down','−',`${extra} ${at<=0?'disabled':''} aria-label="${text('降低目标','Lower target')}"`)+button('remove-line','×',`${extra} aria-label="${text('移除','Remove')}" title="${text('移除','Remove')}"`);
 }
 function prefillSignature(request){
  // Capture intent and relevant observations, not sampling timestamps or ordinary clock ticks.
  const {counts,bank,pack,config}=workspace.character;
  return JSON.stringify({request,orders:ordersForMode(workspace,filterKey()),counts,bank,pack,config,hot:hotKey(workspace.character),prices:priceState()});
 }
 function gatherRequest(key){
  if(!gathering())throw Error('invalidPrefill');
  const candidate=collectionCandidates().find(row=>`${row.id}:${row.jobId}:${row.target}`===key);
  if(!candidate||candidate.status!=='ok')throw Error('invalidPrefill');
  const order=createOrder('gather-draft');
  putLine(order,{kind:'collection',itemId:candidate.id,jobId:candidate.jobId,target:candidate.target});
  const row=estimateOrders({...workspace,orders:[order]},prices()).entries[0],quantity=row.attempts;
  if(row.status!=='ok'||!Number.isSafeInteger(quantity)||quantity<=0)throw Error('invalidPrefill');
  return {role:latestEnvelope?.role,jobId:row.jobId,skill:candidate.job.skill,tier:game.itemTier(candidate.id),quantity,manufacturing:false};
 }
 function prefillEnabled(){return debug?.enabled&&!!gameIntegration&&latestEnvelope?.source==='client'&&live&&!prefillBusy;}
 function refreshForPrefill(){if(!readCharacter)return;const sample=readCharacter();if(!sample||sample.role!==latestEnvelope?.role)throw Error('gameRoleChanged');if(!applySnapshot({...latestEnvelope,snapshot:sample.snapshot}))throw Error('incompatibleCharacter');}
 function purchaseRequest(id){const row=modePlan().rows.find(r=>r.id===id);if(!row||row.owned===null||!Number.isSafeInteger(row.purchase)||row.purchase<1||!Number.isSafeInteger(row.price)||row.price<1)throw Error('invalidPrefill');return {role:latestEnvelope?.role,itemId:id,baseId:game.baseItemId(id),tier:game.itemTier(id),quantity:row.purchase,price:row.price,search:item(id)};}
 function actionRequest(key){const row=planActions(modePlan()).find(r=>r.key===key),job=craftingJobs.find(j=>j.id===row?.jobId)??game.recipes.find(j=>j.id===row?.jobId);if(!row||!job||job.upgrade||row.issues.length||!Number.isFinite(row.count)||row.count<=0||!Number.isSafeInteger(row.count))throw Error('invalidPrefill');return {role:latestEnvelope?.role,jobId:job.id,skill:job.skill,tier:row.tier,quantity:row.count,manufacturing:job.inputs.length>0};}
 function actionLabels(row,job){
 const progress=executionStatus(executionState,job,row.tier),labels=[];
 if(progress.running)labels.push(text('正在执行（含移动、回仓阶段）','Running (including travel and banking)'));
 if(progress.queued)labels.push(text('已加入队列','Queued')+(progress.best?text('（优先高品质，不锁定稀有度）',' (best first; rarity is not fixed)'):'')+(progress.held?text('（队列已暂停）',' (queue paused)'):''));
 if(row.materialStatus)labels.push(row.materialStatus==='ready'?text('材料已备齐','Materials ready'):text('当前动作材料已满足；相关材料未达到计划总需求，可能导致其他动作材料不足','Materials available for this action; shared inputs are below total plan requirements and other actions may run short'));
 return labels;
 }
 function actionTable(actions){
  return `<div class="scroll"><table id="execution-actions" class="frozen-table"><thead><tr>${sortHeader('actions','item',text('物品','Item'))}${sortHeader('actions','rarity',text('稀有度','Rarity'))}${sortHeader('actions','skill',text('技能','Skill'))}${sortHeader('actions','count',text('执行次数','Attempts'))}${sortHeader('actions','seconds',text('预计时间','Expected time'))}${collecting()?`<th>${text('当前→目标','Current → target')}</th>`:''}${debug?.enabled||collecting()?`<th>${text('操作','Actions')}</th>`:''}</tr></thead><tbody>${sortedItems(actions,'actions',row=>outputId(craftingJobs.find(j=>j.id===row.jobId)??game.recipes.find(j=>j.id===row.jobId),row.tier)).map(row=>{const job=craftingJobs.find(j=>j.id===row.jobId)??game.recipes.find(j=>j.id===row.jobId),output=job.upgrade?game.upgradeResult(job.upgrade,game.withRarity(job.upgrade.from[0],row.tier)):game.recipeOutput(job,row.tier);const progress=executionStatus(executionState,job,row.tier),labels=actionLabels(row,job);
 return `<tr data-item-id="${output}" data-execution-action="${esc(row.key)}" ${collecting()?`data-line-key="${esc(row.key)}"`:""} class="${[row.materialStatus==='ready'?'ready':row.materialStatus==='shared'?'materials-shared':'',progress.running?'running':'',progress.queued?'queued':''].filter(Boolean).join(' ')}"${labels.length?` title="${esc(labels.join(' · '))}"`:''}><td class="text-cell">${tableItemName(game.baseItemId(output))}${routeLabel(job)}${row.issues.length?`<small class="alert">${esc(row.issues.map(message).join(' · '))}</small>`:''}</td><td>${tiers()[row.tier]}</td><td>${esc(skillName(job.skill))}</td><td>${number(row.count)}</td><td>${duration(row.seconds)}</td>${collecting()?`<td>${number(workspace.character.initialized?(workspace.character.counts[row.itemId]??0):null,0)} → ${number(row.target,0)}${row.status==='complete'?`<small>${text('已完成','Completed')}</small>`:''}</td>`:''}${debug?.enabled||collecting()?`<td class="actions">${collecting()?targetControls(row,workspace.collectionOrder.id):''}${debug?.enabled?button('prefill-action',text('执行','Execute'),`class="compact" data-key="${esc(row.key)}" ${!prefillEnabled()||job.upgrade||row.issues.length||row.count===null||row.count<=0?'disabled':''} title="${esc(job.upgrade?text('升级配方暂不支持预填','Upgrade prefill is not supported'):text('仅预填，不启动；收藏次数为期望向上取整','Prefill only; does not start. Collection attempts are rounded up.'))}"`):''}</td>`:''}</tr>`;}).join('')||`<tr><td colspan="${collecting()?7:debug?.enabled?6:5}" class="muted">${text('暂无执行动作','No planned actions')}</td></tr>`}</tbody></table></div>`;
 }

 function execution(){
  let plan,seconds;try{plan=modePlan();seconds=plan.craftSeconds===null||plan.collectionSeconds===null?null:add(plan.craftSeconds,plan.collectionSeconds);}catch(e){return `<section class="section" id="execution-plan"><h2>${text('执行计划','Execution plan')}</h2><p class="alert">${esc(message(e.message))}</p></section>`;}
  return `<section class="section" id="procurement"><div class="heading procurement-heading"><h2>${text('采购材料','Purchase materials')}</h2><div class="procurement-costs"><span data-plan-cost="material" title="${text('完整需求材料成本，不扣库存或预计产物，不含加工费','Full material cost before stock and expected outputs; excludes fees')}">${text('材料成本','Material cost')} ${number(plan.materialCost)}</span><span data-plan-cost="purchase">${text('采购成本','Purchase cost')} ${number(plan.total)}</span></div><small>${text('产物按期望估算','Outputs are expected amounts')}</small></div>${plan.blocked||plan.unknownInventory?`<p class="alert">${text('未完整计算','Incomplete calculation')} · ${plan.blocked?text('等待／冲突／不可计算项 ','Pending/conflicting/unavailable lines ')+plan.blocked:''} ${plan.unknownInventory?text('库存未知','Stock unknown'):''}</p>`:''}${plan.missingPrices?`<p class="note">${text('缺价','Missing prices')} ${plan.missingPrices} · ${text('已知价格小计','Known subtotal')} ${number(plan.subtotal)}</p>`:''}<div class="scroll"><table id="purchase-materials" class="frozen-table"><thead><tr>${sortHeader('procurement','item',text('物品','Item'))}${sortHeader('procurement','rarity',text('稀有度','Rarity'))}${[['purchase',text('数量','Quantity')],['required',text('需求 / 库存 / 产物','Required / Stock / Outputs')],['cost',text('金额','Amount')]].map(([column,label])=>sortHeader('procurement',column,label)).join('')}${debug?.enabled?`<th>${text('操作','Actions')}</th>`:''}</tr></thead><tbody>${sortedItems(plan.rows,'procurement',r=>r.id).map(r=>`<tr data-item-id="${r.id}" data-material="${r.id}"><td class="text-cell">${tableItemName(r.id)}</td><td>${tiers()[game.itemTier(r.id)]}</td><td>${number(r.purchase,0)}</td><td>${number(r.required,0)} / ${number(r.owned,0)} / ${number(r.produced)}</td><td>${number(r.cost)}</td>${debug?.enabled?`<td>${button('prefill-purchase',text('购买','Buy'),`class="compact" data-item="${r.id}" ${!prefillEnabled()||r.owned===null||!Number.isSafeInteger(r.purchase)||r.purchase<=0||!Number.isSafeInteger(r.price)||r.price<1?'disabled':''} title="${text('仅打开求购草稿并预填，不购买','Open and fill a buy-order draft only; does not buy')}"`)}</td>`:''}</tr>`).join('')||`<tr><td colspan="${debug?.enabled?6:5}" class="muted">${text('暂无材料需求','No material requirements')}</td></tr>`}</tbody></table></div><p class="alert">${esc(marketError)}</p></section><section class="section" id="execution-plan"><div class="heading execution-heading"><h2>${text('执行计划','Execution plan')}</h2>${collecting()?`<label><input id="auto-remove" type="checkbox" ${workspace.autoRemove?'checked':''}>${text('自动移出已完成的收藏目标','Automatically remove completed collection targets')}</label>`:''}</div><div class="summary"><span>${text('时间','Time')} ${duration(seconds)}</span><span>${text('精通点','Mastery points')} ${number(plan.points,0)}</span></div>${actionTable(planActions(plan))}</section>`;
 }
 function render(){
  if(disposed)return;root.host.toggleAttribute('data-closed',closed);if(!mounting)onVisibilityChange(!closed);if(closed){debug?.close();return;}
  let data={values:[],total:0,pages:1};try{data=candidates();}catch(e){error=message(e.message);}
  const template=doc.createElement('template');template.innerHTML=`<div class="shell"><header class="titlebar"><div class="title-info"><h1>${text('工匠精通助手','Crafting & Mastery Buddy')}</h1><small class="version"> v${appVersion}</small><span class="status" role="status">${statusText()?' · '+esc(statusText()):''}${latestEnvelope?.realtimeError?' · '+text('实时读取不可用','Live reading unavailable'):''} · ${latestEnvelope?.source==='client'?text('角色 ','Character '):text('角色快照 ','Character snapshot ')}${workspace.character.capturedAt?new Date(workspace.character.capturedAt).toLocaleTimeString():status==='error'?text('捕获失败','Capture failed'):status==='disconnected'?text('连接已断开','Disconnected'):text('等待数据','Waiting for data')} · ${text('市场 ','Market ')}${lastMarket?new Date(lastMarket).toLocaleTimeString():marketBusy?text('读取中…','Loading…'):marketError?text('读取失败','Read failed'):text('未读取','Not read')}</span></div><div class="controls">${button('close','×',`aria-label="${text('关闭','Close')}"`)}</div></header><div class="content"><p class="alert" role="alert">${esc(error||executionError||syncError)}</p><p id="storage-error" class="alert storage-alert" ${storageError?'role="alert"':'hidden'}>${storageError?esc(storageError)+' · '+text('当前修改尚未保存','Current changes are not saved'):''}</p>${workspace.character.importWarnings.length?`<p class="note">${text('导入警告：','Import warnings: ')}${esc(workspace.character.importWarnings.join(' · '))}</p>`:''}${storageError?`<div class="toolbar">${button('reload',text('重新载入存档','Reload saved data'))}${button('reset-storage',text('重置本角色助手存档','Reset this character’s buddy storage'))}</div>`:''}<section class="section" id="global-settings"><div class="heading"><div class="tabs">${button('mode-craft',text('制造','Craft'),`aria-pressed="${manufacturing()}"`)}${button('mode-collection-craft',text('收藏(制造)','Collection (Craft)'),`aria-pressed="${collecting()}"`)}${button('mode-collection-gather',text('收藏(采集)','Collection (Gather)'),`aria-pressed="${gathering()}"`)}</div>${pricingControls()}</div></section><section class="section" id="recipes"><div class="heading recipe-heading"><div class="recipe-title"><h2>${text('配方选择','Recipe selection')}</h2>${manufacturing()?`<small>${esc(current().name)}</small>`:''}</div></div><div class="toolbar recipe-filters">${!manufacturing()?'<div class="primary-filters">':''}<label>${text('技能','Skill')}<select id="skill">${option([['all',text('全部','All')],...(gathering()?gatheringSkills:craftingSkills).map(k=>[k,skillName(k)])],skill)}</select></label><label>${text('品质','Rarity')}<select id="tier">${option([['all',text('全部','All')],...tiers().map((t,i)=>[i,t])],tier)}</select></label><label>${text('搜索','Search')}<input id="search" type="search" value="${esc(query)}" placeholder="${text('配方名称','Recipe name')}"></label>${!manufacturing()?`</div><div class="threshold-filters"><label>${text('精通点 ≥','Points ≥')}<input id="min-points" type="number" inputmode="decimal" min="0" step="any" value="${minPoints}"></label><label>${text('小时/100点 ≤','Hours/100 points ≤')}<input id="max-hours-per-100-points" type="number" inputmode="decimal" min="0" max="${Number.MAX_SAFE_INTEGER/36}" step="any" value="${maxSecondsPerPoint===''?'':Number(maxSecondsPerPoint)/36}"></label><label>${text('金币/点(M/100) ≤','Coins/pt(M/100) ≤')}<input id="max-cost" type="number" inputmode="decimal" min="0" max="${Number.MAX_SAFE_INTEGER/10000}" step="any" value="${maxCost===''?'':Number(maxCost)/10000}"></label></div>`:''}</div><div class="scroll">${recipeTable(data)}</div>${!data.total?`<p class="muted">${workspace.character.initialized?text('无匹配配方','No matching recipes'):text('等待游戏角色快照。','Waiting for a game character snapshot.')}</p>`:''}<div class="pagination"><small>${data.total} ${text('项','rows')} · ${page}/${data.pages}</small>${button('previous',text('上一页','Previous'),page===1?'disabled':'')}${button('next',text('下一页','Next'),page>=data.pages?'disabled':'')}${!gathering()?`${button('add-all',text('全部加入订单','Add all to order'),`class="add-all" ${data.total?'':'disabled'} title="${text('加入当前筛选的全部页；制造未填写次数按 1 次，收藏同物品取最高目标。','Add all filtered pages; unfilled craft counts use 1, collection uses each item’s highest target.')}"`)}`:''}</div><p class="note">${manufacturing()?text('制造次数为执行次数（含烧毁）。材料成本、产物价值和时间均按单次执行。时间不含移动、回仓。','Craft counts include burns. Material cost, product value and time are per attempt. Time excludes travel and banking.'):text('收藏次数为达到目标的期望估计，不保证实际完成目标。','Collection attempts are expected values; completion is not guaranteed.')}</p></section>${manufacturing()?orderPanel():''}${!gathering()?execution():''}</div></div>`;
  for(const control of template.content.querySelectorAll('[data-action],input,select,[data-order-row]'))control.dataset.modeGeneration=String(modeGeneration);
  stableView.update(template.content);
  for(const control of container.querySelectorAll('button,input,select'))if(control.dataset.modeGeneration!==String(modeGeneration))control.disabled=true;
  frozen.refresh();
 }
 async function refreshMarket(){
  if(marketBusy)return;marketBusy=true;render();try{const response=await platform.market();const currentPrices=priceState();const latest=Math.max(0,...Object.values(currentPrices.quotes).flatMap(q=>Object.values(q).map(s=>s.capturedAt)));const next=Math.max(0,...Object.values(response.quotes).flatMap(q=>Object.values(q).map(s=>s.capturedAt)));if(next<latest)throw Error('marketStale');marketPrices=mergeMarketSnapshot(currentPrices,response);lastMarket=Date.now();marketError='';}catch(e){marketError=message(e.message);}finally{marketBusy=false;render();}
 }
 async function click(event){
  const target=event.target;let el=target.closest?.('[data-action]');
  if(!el){if(target.closest?.('button,input,select,a,label'))return;el=target.closest?.('[data-order-row]');}
  if(!el||!root.contains(el)||el.disabled||el.dataset.modeGeneration!==String(modeGeneration))return;
  const action=el.dataset.action??'edit-order';error='';
  const isPrefill=action==='prefill-purchase'||action==='prefill-action'||action==='prefill-gather';
  try{
   if(['new-order','edit-order','copy-order','delete-order','batch'].includes(action)&&!manufacturing())throw Error('invalidOrders');
   if(isPrefill){
    if((action==='prefill-gather')!==gathering())throw Error('invalidPrefill');
    if(!debug?.enabled)throw Error('debugDisabled');
    if(!prefillEnabled())throw Error('realtimeUnavailable');
    refreshForPrefill();
    const make=()=>action==='prefill-purchase'?purchaseRequest(Number(el.dataset.item)):action==='prefill-gather'?gatherRequest(el.dataset.key):actionRequest(el.dataset.key),request=make(),signature=prefillSignature(request),generation=debugGeneration,operationMode=modeGeneration;
    const guard=()=>{try{refreshForPrefill();return debug.enabled&&debugGeneration===generation&&modeGeneration===operationMode&&live&&latestEnvelope?.source==='client'&&prefillSignature(make())===signature;}catch{return false;}};
    prefillBusy=true;onPrefillFeedback(text('正在预填，请稍候','Prefill in progress'));render();
    try{await gameIntegration[action==='prefill-purchase'?'purchase':'action'](request,guard);if(!guard())throw Error('planChanged');if(mobileMode(doc))closed=true;if(!disposed)onPrefillFeedback('');}
    finally{prefillBusy=false;render();}return;
   }
   if(action==='close'){closed=true;render();return;}
   if(action==='sort-table'){const table=el.dataset.table,column=el.dataset.column;if(!sortableColumns(table).includes(column))throw Error('invalidSort');const pref=tablePreference(table),direction=pref.column===column&&pref.direction==='asc'?'desc':'asc';if(table==='recipes'){sort=column;sortDirection=direction;page=1;rememberFilters();}else tableSorts.set(table,{column,direction});render();container.querySelector(`[data-table="${CSS.escape(table)}"][data-column="${column}"]`)?.focus({preventScroll:true});return;}
   if(action==='sort-collection'){if(manufacturing()||!(gathering()?['points','duration','time']:['points','duration','time','cost','coins']).includes(el.dataset.sort))throw Error('invalidSort');sortDirection=sort===el.dataset.sort?(sortDirection==='asc'?'desc':'asc'):'asc';sort=el.dataset.sort;page=1;rememberFilters();render();container.querySelector('[data-sort="'+sort+'"]')?.focus({preventScroll:true});return;}
   if(action.startsWith('mode-')){ordersExpanded=root.getElementById('orders')?.open??ordersExpanded;rememberFilters(false);modeGeneration++;workspace.selectedMode=action==='mode-craft'?'craft':action==='mode-collection-gather'?'collectionGather':'collection';restoreFilters();rememberFilters();render();return;}
   if(action==='reload'){try{const saved=await store.load();applyUserData(saved??userDefaults());storageError='';}catch(e){storageError=message(e.message);}render();return;}
   if(action==='reset-storage'){if(!confirm(text('删除当前角色助手存档并恢复默认订单？','Delete this character’s buddy storage and reset orders?')))return;await store.reset();applyUserData(userDefaults());storageError='';await save();render();return;}
   if(action==='next'||action==='previous'){page+=action==='next'?1:-1;rememberFilters();render();return;}
   if(action==='new-order'){const o=createOrder(crypto.randomUUID(),text('订单 ','Order ')+(workspace.orders.length+1));workspace.orders.push(o);workspace.currentOrderId=o.id;expandedOrders.add(o.id);changed();return;}
   if(action==='edit-order'){const id=el.dataset.id??el.dataset.orderRow;if(!workspace.orders.some(order=>order.id===id))throw Error('invalidOrders');if(expandedOrders.has(id))expandedOrders.delete(id);else expandedOrders.add(id);workspace.currentOrderId=id;changed();return;}
   if(action==='copy-order'){const source=workspace.orders.find(o=>o.id===el.dataset.id);if(!source)throw Error('invalidOrders');const o=structuredClone(source);o.id=crypto.randomUUID();o.name=(o.name+text(' 副本',' copy')).slice(0,120);o.enabled=true;workspace.orders.push(o);workspace.currentOrderId=o.id;expandedOrders.add(o.id);changed();return;}
   if(action==='delete-order'){const o=workspace.orders.find(o=>o.id===el.dataset.id);if(!o)throw Error('invalidOrders');if(!confirm(text('删除订单：','Delete order: ')+o.name))return;workspace.orders=workspace.orders.filter(entry=>entry!==o);expandedOrders.delete(o.id);ensureOrder();changed();return;}
   if(action==='batch'){const order=workspace.orders.find(o=>o.id===el.dataset.id),input=root.getElementById('batch-count-'+order.id);if(!input.checkValidity()||!Number.isSafeInteger(input.valueAsNumber)||input.valueAsNumber<0)throw Error('invalidNumber');for(const line of [...order.lines].filter(l=>l.kind==='craft'))putLine(order,{...line,count:input.valueAsNumber});changed();return;}
   if(action==='add-all'){
    if(gathering())throw Error('invalidOrders');
    const rows=candidates(true).values,order=structuredClone(current());let replacements=0;
    if(manufacturing()){for(const row of rows){const line={kind:'craft',jobId:row.jobId,tier:row.tier,count:1};if(!order.lines.some(existing=>lineKey(existing)===lineKey(line)))putLine(order,line);}}
    else {
     const targets=new Map();for(const row of rows){const selected=targets.get(row.id),existing=order.lines.find(line=>line.kind==='collection'&&line.itemId===row.id);if(!selected||row.target>selected.target||row.target===selected.target&&row.jobId===existing?.jobId)targets.set(row.id,row);}
     for(const row of targets.values()){const existing=order.lines.find(line=>line.kind==='collection'&&line.itemId===row.id);if(existing&&existing.jobId!==row.jobId)replacements++;putLine(order,{kind:'collection',itemId:row.id,jobId:row.jobId,target:row.target});}
    }
    const next=collecting()?{...workspace,collectionOrder:order}:{...workspace,orders:workspace.orders.map(existing=>existing.id===order.id?order:existing)};validateWorkspace(next);
    if(replacements&&!confirm(text('将替换已有收藏来源，共 ','Replace existing collection routes for ')+replacements+text(' 项，继续？',' items. Continue?')))return;
    workspace=next;changed();return;
   }
   if(action==='add-collection'){if(!collecting())throw Error('invalidOrders');const row=candidates().values.find(r=>r.key===el.dataset.key);if(!row)throw Error('invalidLine');const previous=current().lines.find(l=>l.kind==='collection'&&l.itemId===row.id);if(previous?.jobId===row.jobId&&previous.target>=row.target){current().lines.splice(current().lines.indexOf(previous),1);changed();return;}if(previous&&previous.jobId!==row.jobId&&!confirm(text('用此来源替换已有收藏来源？','Replace the selected collection route?')))return;putLine(current(),{kind:'collection',itemId:row.id,jobId:row.jobId,target:row.target});changed();return;}
   if(['remove-line','target-up','target-down'].includes(action)){
    const order=ordersForMode(workspace,filterKey()).find(o=>o.id===el.dataset.order),key=el.closest('[data-line-key]')?.dataset.lineKey,index=order?.lines.findIndex(line=>lineKey(line)===key),line=order?.lines[index];
    if(!line)throw Error('invalidLine');
    if(action==='remove-line')order.lines.splice(index,1);else {const targets=game.collectionThresholds(game.baseItemId(line.itemId)),at=targets.indexOf(line.target),next=at+(action==='target-up'?1:-1);if(targets[next]!==undefined)line.target=targets[next];}changed();return;
   }
  }catch(e){if(isPrefill){if(!disposed)onPrefillFeedback(message(e.message));}else error=message(e.message);render();}
 }
 function change(event){const el=event.target;if(!el||!root.contains(el)||el.disabled||el.dataset.modeGeneration!==String(modeGeneration)||event.isComposing)return;error='';const previous=structuredClone(workspace);
  try{
   if(el.dataset.count){if(!manufacturing())throw Error('invalidOrders');if(!el.checkValidity()||!Number.isSafeInteger(el.valueAsNumber)||el.valueAsNumber<0)throw Error('invalidNumber');const index=el.dataset.count.lastIndexOf(':'),id=el.dataset.count.slice(0,index);putLine(current(),{kind:'craft',jobId:id.startsWith('upgrade-')?id:Number(id),tier:Number(el.dataset.count.slice(index+1)),count:el.valueAsNumber});
   }else if(el.dataset.fee){if(!manufacturing())throw Error('invalidOrders');if(!el.checkValidity()||!Number.isFinite(el.valueAsNumber))throw Error('invalidNumber');workspace.orders.find(o=>o.id===el.dataset.order).fees[el.dataset.fee]=feeFromInput(el.dataset.fee,el.valueAsNumber);
   }else if(el.dataset.enabled){if(!manufacturing())throw Error('invalidOrders');workspace.orders.find(o=>o.id===el.dataset.enabled).enabled=el.checked;
   }else if(el.dataset.pricing){if(el.dataset.pricing==='material'){if(!['ask','ask-stock','bid'].includes(el.value))throw Error('invalidPriceMode');workspace.character.buyMode=el.value==='ask-stock'?'ask':el.value;workspace.excludeInsufficientAsks=el.value==='ask-stock';}else if(el.dataset.pricing==='product'){if(!['ask','bid'].includes(el.value))throw Error('invalidPriceMode');workspace.productPriceMode=el.value;}else throw Error('invalidPriceMode');
   }else if(el.id==='auto-remove')workspace.autoRemove=el.checked;
   else if(el.dataset.orderName){if(!manufacturing())throw Error('invalidOrders');workspace.orders.find(o=>o.id===el.dataset.orderName).name=el.value;}
   else if(el.id==='max-cost'){if(!el.checkValidity())throw Error('invalidNumber');el.removeAttribute('aria-invalid');queueRender();return;}

   else {if(el.id==='skill')skill=el.value;else if(el.id==='tier')tier=el.value;else return;page=1;rememberFilters();render();return;}
   el.removeAttribute('aria-invalid');changed(true);
  }catch(e){workspace=previous;savedFilter=workspace.filters;el.setAttribute('aria-invalid','true');error=message(e.message);queueRender();}
 }
 function rememberFilters(persist=true){workspace.filters[filterKey()]={skill,tier,query,route:gathering()?'gather':collecting()?'craft':'all',sort,sortDirection,page,minPoints,maxSecondsPerPoint,maxCost};savedFilter=workspace.filters;if(persist)void save();}
 function typed(event){
  if(event.isComposing)return;
  const el=event.target;
  if(el.disabled||el.dataset.modeGeneration!==String(modeGeneration))return;
  if(el.id==='search'){query=el.value;page=1;rememberFilters();queueRender();return;}
  if(!['min-points','max-hours-per-100-points','max-cost'].includes(el.id)||!el.checkValidity())return;
  if(el.id==='min-points')minPoints=el.value;
  else{
   // Stored thresholds use seconds/point and coins/point respectively.
   const factor=el.id==='max-hours-per-100-points'?36:10000;
   const value=el.value===''?'':el.valueAsNumber*factor;
   if(value!==''&&(!Number.isFinite(value)||value>Number.MAX_SAFE_INTEGER)){el.setAttribute('aria-invalid','true');error=message('invalidNumber');queueRender();return;}
   const stored=value===''?'':String(value);
   if(el.id==='max-hours-per-100-points')maxSecondsPerPoint=stored;else maxCost=stored;
  }
  page=1;rememberFilters();queueRender();
 }
 function keydown(event){
  const el=event.target;
  if(el.matches?.('input,select')&&(event.isComposing||event.key!=='Escape'))event.stopPropagation();
  if(event.defaultPrevented||event.key!=='Tab'||event.isComposing||event.ctrlKey||event.altKey||event.metaKey||!manufacturing())return;
  if(!el.matches?.('#recipe-candidates input[data-count]')||el.disabled||el.dataset.modeGeneration!==String(modeGeneration))return;
  const inputs=[...el.closest('table').querySelectorAll('input[data-count]:enabled')].filter(input=>input.getClientRects().length);
  const index=inputs.indexOf(el),next=inputs[index+(event.shiftKey?-1:1)];
  if(index<0||!next)return;
  event.preventDefault();next.focus();
 }
 root.addEventListener('click',click);root.addEventListener('change',change);root.addEventListener('input',typed);root.addEventListener('compositionend',typed);root.addEventListener('keydown',keydown);
 function hotKey(value){return value.initialized?JSON.stringify(gatheringSkills.map(skill=>game.hotRarityMultiplier(value.worldTick,skill))):'';}
 function meaningfulCharacter(value){const {capturedAt,inventoryCapturedAt,worldTick,...rest}=value;return JSON.stringify(rest);}
 function applySnapshot(envelope){
  if(!envelope.snapshot||disposed)return;const snapshot=envelope.snapshot;
  if(envelope.source===appliedSource&&snapshot.capturedAt<appliedPlayerAt)return false;
  try{
   const source=structuredClone(snapshot);
   const previous=envelope.source!==appliedSource?{...workspace.character,inventoryCapturedAt:null}:workspace.character;
   const next=importCollection(previous,source);
   const updated=next;
   const previousExecution=JSON.stringify(executionState),previousExecutionError=executionError,previousSyncError=syncError;
   executionState=null;executionError='';
   if(envelope.source==='client'&&envelope.status==='live')try{executionState=readExecutionState(snapshot.player);}catch(e){executionError=message(e.message);}
   const previousHot=hotKey(workspace.character),before=meaningfulCharacter(workspace.character);workspace.character=validateCollection(updated);syncError='';appliedPlayerAt=snapshot.capturedAt;appliedSource=envelope.source;
   const ordersChanged=removeCompleted(workspace);if(ordersChanged)void save();
   if(ordersChanged||before!==meaningfulCharacter(workspace.character)){render();}else if(previousSyncError||previousHot!==hotKey(updated)||previousExecution!==JSON.stringify(executionState)||previousExecutionError!==executionError)render();return true;
  }catch(e){executionState=null;syncError=text('同步失败，保留有效数据：','Sync failed; valid data kept: ')+message(e.message);render();return false;}
 }
 debug=await installDebugMenu(root,{platform,key:demo?'dvi-buddy-demo-debug-v1':'dvi-buddy-debug-v1:'+doc.location.host,label:()=>text('启用调试功能','Enable debug features'),onChange:()=>{debugGeneration++;render();},onError:e=>{error=text('调试设置存储失败：','Debug preference storage failed: ')+message(e.message);queueRender();}});
 language=gameLanguage(doc);
 const disposeLanguage=observeGameLanguage(doc,next=>{language=next;render();});
 const interval=setInterval(()=>{if(latestEnvelope&&live)applySnapshot(latestEnvelope);if(!demo&&live&&Date.now()-lastMarket>=300000&&!marketBusy)void refreshMarket();if(!closed&&live)queueRender();},10000);
 render();
 const disposeGeometry=await installPanelGeometry(root,{platform,key:demo?'dvi-buddy-demo-geometry-v1':'dvi-buddy-geometry-v1:'+doc.location.host,onError:e=>{error=text('面板布局保存失败：','Panel layout storage failed: ')+e.message;queueRender();}});
 mounting=false;closed=true;render();root.host.style.removeProperty('visibility');
 return {
  receive(envelope){
   if(latestEnvelope&&(envelope.connection<latestEnvelope.connection||envelope.connection===latestEnvelope.connection&&envelope.sequence<=latestEnvelope.sequence))return;
   const newConnection=!latestEnvelope||envelope.role!==latestEnvelope.role;const sourceChanged=!latestEnvelope||latestEnvelope.source!==envelope.source||latestEnvelope.status!==envelope.status||latestEnvelope.realtimeError!==envelope.realtimeError;latestEnvelope=envelope;
   if(newConnection){modeGeneration++;executionState=null;executionError='';syncError='';appliedPlayerAt=0;workspace.character={...collectionDefaults(),buyMode:workspace.character.buyMode};}
   live=envelope.status==='live';status=envelope.status;if(!live||envelope.source!=='client'){executionState=null;executionError='';}
   if(envelope.error)syncError=message(envelope.error);if(live)applySnapshot(envelope);if(sourceChanged)render();
  },
  open(){if(!disposed){closed=false;render();}},
  close(){if(!disposed&&!closed){closed=true;render();}},
  getWorkspace:()=>structuredClone(workspace),
  dispose(){void store.flush().then(()=>store.dispose());disposed=true;disposeLanguage();frozen.dispose();debug.dispose();disposeGeometry();clearInterval(interval);clearTimeout(renderTimer);root.removeEventListener('click',click);root.removeEventListener('change',change);root.removeEventListener('input',typed);root.removeEventListener('compositionend',typed);root.removeEventListener('keydown',keydown);stableView.dispose();container.remove();style.remove();},
 };
}
