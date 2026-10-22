# 技术方案与上游更新

### 6.1 角色导入组件与 userscript 协议

战斗、采集、制造、强化、精通与收藏复用 characterImportPanel：统一 details/summary、import-body、安装链接、按钮与状态节点，参数控制节点标识、按钮及说明；状态为空隐藏，长文本换行。导入区域使用相同高亮容器、金色标题、边框、背景与展开间距，折叠遵循 语言、布局与持久化（原实验室：shared.md#22-语言布局与持久化）。

角色自动更新统一使用 `src/character-auto-import.js` 管理每页两个独立选项、进入／焦点调度、忙碌合并与响应代际；`src/import-controls.js` 负责共用开关、页面激活、输入保护及只读桥接。各页面只提供配置／库存应用适配器，手动导入也复用同一调度；库存解析仍独立于调度，由 `src/character-inventory.js` 供收藏与制造复用。具体规则见共用角色自动更新（原实验室：shared.md#导入游戏角色与自动更新）。

连接检测共用单次 probe 请求，各页分别保留状态，统一由 importStatusText 生成连接成功、读取中、捕获时间及缺失/旧版本/读取失败等双语提示。较晚 probe 不覆盖读取中或已有结果；读取期间禁用对应按钮，失败保留原配置。战斗额外保留字段警告。

战斗和强化导入区域均不展示刷新读取提示；战斗页不展示配置导入说明段落，对应英文同步移除。安装／更新角色 userscript 链接与导入按钮使用一致的字号、颜色、边框、背景、宽度、高度及交互样式，保持独立一行和新标签打开行为。验收检查两页双语文案移除及链接、导入按钮样式一致。配置导入及导出无需打开游戏战斗预测列表。

- 角色 userscript（版本见 当前状态（原实验室：status.md#已发布基线））提供安装入口、双语名称、document-start、现有游戏／线上／本机地址及共享 document 的 JSON CustomEvent 桥接；游戏捕获仅在 `https://deepveinidle.com/*` 与 `https://cn.deepveinidle.com/*` 启用，两站均只旁听各自同源 `/ws`。`https://*.dvi-lab.pages.dev/*` 匹配该项目的预览分支与部署地址，不扩大到其他 Pages 项目。角色桥接版本仍为 2.4，角色数据协议仍为 2，存储键 `dvi-character-snapshot-v2` 保持兼容；不再提供市场桥接或存储。验收覆盖两游戏域名的脚本匹配、角色捕获保存及非同源连接不捕获。
- 角色脚本旁听 own-role welcome/snapshot、公会与世界窗口，仅保存支持配置映射的字段；不安装 JSON 解析或预测字段读取钩子，不捕获预测输入。不发送游戏命令、不开额外游戏连接、不读取认证或聊天消息。
- 安装／更新脚本后刷新游戏和实验室。配置导入使用最近角色数据，显示其读取时间；跨连接／角色清空本连接状态，串行存储避免旧异步写入覆盖新数据。捕获失败、存储失败、旧协议及缺数据明确提示。
- 不维护调试专用 userscript、`dvi-debug-request/response` 桥接或 `dvi-debug-snapshot-v2` 存储读写。旧脚本管理器数据不自动读取或迁移；原有安装脚本由用户在脚本管理器自行移除。
- 协议验收：配置捕获、普通角色桥接、市场捕获移除、缺失／旧版／读取失败提示、预览路径、跨连接隔离及异步写入顺序继续回归；所有页面无完整快照操作，普通角色请求不接受调试来源，旧快照模拟格式明确拒绝。页面行为分别按 战斗验收（原实验室：pages/combat.md#37-验收与已知限制） 与 强化验收（原实验室：pages/enhancement.md#46-验收与验证边界）。

角色 userscript 仅处理角色、公会与世界窗口配置，不主动触发战斗预测。游戏页等待提示持续显示；角色配置在本连接首次成功保存后显示“角色配置已读取 / Character captured”，5 秒后隐藏，后续更新继续保存但不重显或延长提示。新连接重置提示，旧连接延迟完成不得覆盖新状态。市场消息不触发保存或提示。

所属公会隐藏配置：角色脚本沿用普通角色配置桥接，旁听 `welcome.guild` 与 `guild.info`，只保存名称 `name`、标签 `tag`，不保存成员、聊天、公告或仓库。捕获对象顶层增加 `guild`；无公会为 null，新连接及 welcome 重置，后续角色配置捕获保留本连接最近公会。战斗与强化配置导入将其写入隐藏字段 `guild` 并随各自配置持久化，不新增控件、不参与计算。旧文件缺少该字段时清空所属公会，避免沿用其他角色信息；战斗配置导入时公会字段格式错误清空并提示，强化导入仍明确拒绝并保留已有配置。验收覆盖首次捕获、公会更新/退出、跨连接隔离、两页导入与保存往返、旧文件及异常数据。已实现，角色数据协议仍为 2。


#### 官方市场价格

页面统一使用 `src/price-service.js` 的公开读写协议，纯数据快照由 `src/price-protocol.js` 定义；协议、六项数据及页面选价见物品价格模块（原实验室：modules/item-prices.md）。内部存储与行情解析不作为页面访问协议。

实验室 `src/market-import.js` 直接 GET 官方公开 API，将完整物品 ID、最低卖价、最高买价和生成时间适配为现有行情模型；不发送凭据，不使用代理或 userscript 桥接。`src/item-price-store.js`统一执行行情验证与防倒退，收藏角色导入仅更新官方报价缓存，价格面板及打开或聚焦网站时按 5 分钟间隔判断的后台自动导入按最新锁定状态应用有效价格；各入口共享并发网络请求，自动导入由 `src/price-auto-import.js` 展示完成通知，启用选项、时间戳去重与存档保护由价格存储模块负责；双语市场错误文案由市场适配模块共用。接口校验、缓存兼容、分类导入和失败规则见 全局物品价格（原实验室：shared.md#24-全局物品价格）。2.7.0 删除 `marketBook`／`marketBooks`／`marketDepth` 专用解析、`dvi-market-request/response` 桥接、`dvi-market-quotes-v1` GM 存储读写及市场提示。旧角色脚本的角色桥接仍兼容，但移除游戏侧市场捕获须更新脚本并刷新游戏。

#### 角色捕获与保存

- 在 userscript 内直接解析同源 `/ws` 的字符串消息、裁剪必要字段并维护本连接的角色、公会及世界窗口状态；不使用捕获 Worker、Blob URL、消息 ACK、积压队列或启动超时，不额外下载代码、不发送游戏指令。非法 JSON 和无关消息忽略；角色结构不兼容时停止捕获并明确提示刷新。
- 角色保留所有导入消费者所需字段，包括强化的 bank/pack/overflow、收藏计划库存的 bank/pack 和精通的 collections/forgeLog；世界窗口保留 rarityMult，快照保留 `worldBuffsVersion: 1` 完整捕获能力标记。同帧最多更新一次角色状态。战斗与采集按捕获时点汇总全部有效窗口的经验与稀有度，全程用于模拟，共用世界窗口校验和汇总；旧快照缺能力标记时清零两项并明确提示更新脚本及重新捕获。制造共用完整世界窗口校验与经验汇总，不导入无效的世界稀有度；旧捕获经验清零并明确提示。角色桥接 2.4、数据协议 2 与存储键保持兼容。
- 仅维护一份待保存的最新快照，空闲后合并 100ms 再保存；持续更新不延长已安排的等待。最多一个 GM 写入进行中，慢存储期间替换待保存快照，不排队保存中间状态。新连接清空捕获状态及待保存快照，等待已开始的旧写入完成后再保存新连接数据，旧写入结果不改变新连接提示；当前连接保存失败停止捕获并显示错误。
- 成功提示仅在每连接首次保存成功后显示 5 秒；隐藏时停止全 DOM 观察。页面退出清理计时器与观察器并停止捕获，不保证关闭前最后一次异步保存完成。
- 验收覆盖全部导入字段、同帧聚合、市场消息不触发保存／提示和市场桥接缺失、持续更新及慢存储合并、跨连接隔离、解析／保存失败与退出清理，以及不提供 Worker 时仍正常捕获。浏览器专项使用合成消息和模拟 GM 存储；实际脚本管理器安装、真实游戏及长时性能需单独验证，不由专项测试推断。

### 6.2 原始代码复用

- 游戏地址：<https://deepveinidle.com/>。
- 当前工作树已完整同步公开资源 <https://deepveinidle.com/assets/index-CsTNPJ8i.js>，2026-10-22 获取并核验，SHA-256 `f7fb9a6b608d353de6a107c68ed99c990642f99260d41676073385285c9489a6`。资源最新更新条目为 1.0.1199（2026-10-22）；文件名和摘要作为快照标识。
- 当前生成模块完整提取 778 个原始声明，manifest 无 overrides，不混合旧声明或局部替换。此前战斗局部补充保留为历史证据；适配验证与发布状态见 当前状态（原实验室：status.md），此前发布证据不作为 1.0.1199 验证。
- 保存完整公开资源；`.gitattributes` 仅对 `vendor/game-original.js` 关闭行尾空格检查，保留上游模板字符串中的原始空格及完整摘要，其余空白检查保持。原样提取计算函数及数据依赖，不加载整个游戏应用，也不依赖游戏账号。函数体及数据字面量保持原样，每个提取声明可追溯并校验摘要；原始计算模块不依赖 DOM、网络或账号。压缩符号只是当前快照定位信息，不是稳定接口。
- 1.0.1190 引入的物品 397 为满月礼盒（Moon box），定义价值 25，原始商人售价函数返回 10，归贵重物品分类；仅补齐物品定义、翻译、分类与价格导入，不增加现实活动利润模拟。新版活动 `box` 事件已携带实际 `itemId`，统计优先读取该字段，不把其他活动礼盒计成旧礼盒。
- 新版制造任务按初始仓库重选最近制造点；采集任务无输入材料时保留指定点。当前制造适配先从所选仓库初始化，需继续核验每配方／品质及两个仓库的选点一致性。
- 新版制造／强化订单、增强契约、后备任务及农场杂务进入原始依赖闭包，但不新增手动配置功能；手动玩家保持这些状态为空。当前不提供完整角色快照输入。
- 旧局部同步与版本核验见历史兼容性报告（原实验室：../reports/upstream-compatibility-audit-2026-10-11.md），不作为正式版已同步范围的说明。

### 6.3 模块职责

| 文件 | 职责 |
| --- | --- |
| `vendor/game-original.js`、`vendor/game-combat-update.js` | 当前完整公开资源与历史战斗更新快照 |
| `vendor/manifest.json` | 来源、摘要、导出映射、原始声明位置与摘要 |
| `scripts/extract.mjs` | AST 与作用域依赖分析、已审阅摘要及映射校验、生成原始代码子集 |
| `src/upstream.js` | 生成的原始声明与语义导出，禁止手工修改 |
| `src/model.js` | 输入规范化、玩家状态适配、配置过滤、结果组合与排序 |
| `src/simulation.js`、`src/simulation-worker.js` | 原始战斗函数状态适配、可配置时长统计及异步计算 |
| `src/gathering-model.js`、`src/gathering-simulation.js`、`src/gathering-worker.js`、`src/gathering-controls.js` | 独立采集配置与导入、原始工作逐刻适配、逐点平均、异步进度及页面交互 |
| `src/crafting-model.js`、`src/crafting-orders.js`、`src/crafting-simulation.js`、`src/crafting-worker.js`、`src/crafting-controls.js` | 制造角色与多配方订单、独立加工费、执行计划与材料预算、原始限次模拟及页面交互 |
| `src/work-expectation.js` | 采集／制造共用机会期望账本、品质、烧焦及奖励容量门槛；不改原始过程 |
| `src/character-inventory.js` | 收藏与制造共用仓库／背包校验、重复堆叠合并与完整物品 ID 库存快照；制造另校验捕获时间 |
| `src/world-buffs.js` | 战斗、采集与制造共用世界增益窗口校验、捕获时汇总与旧捕获提示 |
| `src/work-import.js` | 采集与制造共用角色导入校验及字段映射 |
| `tests/crafting.test.mjs` | 有效配方／品质原始离线对照、烧焦／升级／限次、材料预算、窗口速率与导入回归 |
| `tests/gathering.test.mjs` | 全点平均人工算例、四技能全部任务／点位原始离线对照、配置与导入回归 |
| `src/enhancement.js`、`src/enhancement-controls.js` | 强化专用校验、导入、解析期望与独立页面交互 |
| `src/hot-forecast.js`、`src/forecast-filters.js`、`src/forecast-controls.js` | 热门日程计算、多选筛选规范化与独立本地存储、预报页面交互 |
| `src/appreciation-controls.js`、`src/assets/appreciation.jpg` | 共用赞赏弹窗及原始赞赏图片；复用物品价格弹窗样式与交互约定 |
| `src/formulas-controls.js`、`src/formulas-markdown.js`、`src/content/formulas/` | 中文公式正文、按需加载、Markdown 渲染、章节目录与独立阅读布局 |
| `scripts/vendor-markdown.mjs`、`vendor/markdown-it/` | 从固定开发依赖同步浏览器发行文件与许可证，校验版本、内容摘要和来源 |
| `src/combat-hot.js` | 战斗热门加成时钟映射，采集和制造复用带技能参数的日程和窗口换算 |
| `src/search-select.js` | 可搜索选择框与键盘交互 |
| `src/i18n.js` | 上游翻译整合与缺失名称补充 |
| `src/character-import.user.js` | 角色配置读取与脚本管理器本地存储桥接 |
| `src/character-import.js`、`src/import-controls.js`、`src/character-auto-import.js` | 全部支持字段校验与转换、共用角色导入面板、独立配置／库存选项、手动／自动读取调度、页面／输入保护及跨页面请求 |
| `tests/character-import.test.mjs`、`tests/character-auto-import.test.mjs`、`tests/character-inventory.test.mjs`、`tests/character-auto-import-browser.mjs` | 字段映射、角色脚本桥接、共用配置／库存自动更新、独立库存解析、页面生命周期与输入保护回归 |
| `src/debug-controls.js`、`tests/debug-controls.test.mjs` | 隐藏调试页、角色配置 JSON 文件下载与战斗／强化两个共用导入入口、文件往返及失败状态验证 |
| `src/collection-model.js`、`src/collection-controls.js`、`src/collection-simulation.js` | 隐藏收藏页、独立最小进度与角色导入、原始里程碑／奖励、动作期望与全局／API／商人材料采购估值、类型独立筛选保存、材料明细及离线目标事件回归（产出和药剂数量只在离线事件验证中保留） |
| `src/collection-plan.js`、`src/collection-plan-controls.js`、`src/collection-plan-transfer.js` | 独立计划存储、最高目标去重、材料归并、导入仓库与背包抵扣、采购成本展示、计划 JSON／gzip+Base64 剪贴板交换，以及计划数据维护 |
| `tests/collection.test.mjs`、`tests/collection-browser.mjs` | 收藏边界、品质／烧焦／被捕、价格缺失与零价、独立目标事件对照、DOM 桥接、类型独立筛选与存储异常恢复、材料采购展开区与窄屏专项 |
| `tests/collection-plan.test.mjs`、`tests/collection-plan-transfer.test.mjs`、`tests/collection-plan-browser.mjs` | 计划去重、数量和金额边界、焦点调度、压缩往返、导入并发与存档保留、双语窄屏交互 |
| `src/mastery.js`、`src/mastery-controls.js` | 独立精通预算、升级成本、配置校验与双语交互 |
| `src/price-protocol.js`、`src/price-service.js` | 物品价格六项数据的只读快照、固定公开协议、统一设价命令及分类变更通知 |
| `src/item-prices.js`、`src/item-price-store.js`、`src/market-import.js`、`src/item-price-controls.js`、`src/price-auto-import.js` | 价格模块内部规则、存储、官方价格及挂单总量解析、管理弹窗与自动导入通知 |
| `src/app.js`、`src/style.css` | 双语交互、呈现、本地保存和响应式布局 |
| `scripts/release.mjs`、`scripts/release-*.mjs` | 发布三阶段编排、证据摘要、隔离提取、HTTP／浏览器验收与完整日志 |
| `scripts/native-audit.mjs` | 全部页面独立原始计算对照，常规发布唯一完整对照入口 |
| `scripts/serve.mjs` | 仅监听本机的静态预览服务 |
| `tests/model.test.mjs` | 计算、配置、完整性及源码一致性回归测试 |

运行网页不需要安装开发依赖，启动方式见 本地开发（原实验室：../docs/development.md）。原游戏代码和数据归原作者，保存来源不代表获得开源许可。

### 预测与手动角色适配

使用原始有效物品／配方导出 `items`／`recipes`（当前快照 `cs`／`xo`），不导出未开放烹饪总表；烟花品质与产物分别复用 `recipeRarity`／`recipeOutput`，收藏排除复用 `collectionExcluded`。具体行为与验收分别见制造（原实验室：pages/crafting.md）和收藏（原实验室：pages/collection.md）。

新版预测负责清背包、平移药剂剩余时间并初始化空日／周任务。合成角色每刻同步日／周编号并保持空任务；订单、农场为空。hypothetical 上下文禁用内置热门，实验室用正向窗口表达三个热门模式（原实验室：pages/combat.md#336-模拟配置），工作品质期望传递相同标志，防止重复计入。

首领自动参战、有限保护卷库存执行、农耕、玩家制造订单及原生角色文件输入不在当前范围。角色脚本 2.9.0、桥接 2.4、数据协议 2 保持兼容。来源核验、实施与验证见1.0.1199 回退适配报告（原实验室：../reports/upstream-rollback-2026-10-22.md），生产基线见当前状态（原实验室：status.md）。

### 游戏回退适配

1.0.1199 回退 1198 的强化平衡调整，保留 30 秒尝试及相应宠物机会。优先通过 revert 恢复原适配及书台配置，再同步完整已核验的 1199 公开资源；不直接把旧 1196 快照当作当前版本。1198 缺少书台字段的配置补 0，其他字段和校验保持；详细规则及验收统一见强化页面（原实验室：pages/enhancement.md）。历史发布报告保留原语境。

### 6.4 上游更新流程

1. 保存新公开资源快照，并更新来源信息。
2. 复核并更新提取器的来源、日期、版本、SHA-256、导出映射、数据和函数签名；快照摘要不匹配、未知依赖或签名不匹配时在生成前停止提取，不能猜测替代公式。
3. 重新生成原始代码子集与摘要清单，审阅差异。仅同步已核验的局部行为时，可保留基础快照并保存补充版本完整资源，按声明原样提取、显式绑定已审阅的原依赖；manifest 分别记录两份来源、摘要、声明范围和绑定关系，不把混合提取标记为全量升级。
4. 同步 设计索引（原实验室：../DESIGN.md） 所指向的受影响规则、清单和边界，再调整适配层。
5. 核验角色消息格式、全部导入消费者与角色捕获逻辑，保持桥接和数据协议兼容；协议变化时明确迁移或拒绝规则。通过源码一致性、计算回归、数据完整性和浏览器检查后，更新来源、版本与验证状态。角色脚本只旁听同源 WebSocket，不维护已移除的预测字段钩子或资源源码位置表。
