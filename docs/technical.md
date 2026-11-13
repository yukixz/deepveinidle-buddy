# 技术方案

## 上游计算

原始游戏资源保存在vendor/game-original.js，来源URL、游戏版本、SHA-256及语义提取映射见vendor/manifest.json。src/engine/upstream.js由scripts/extract.mjs生成，保留原始声明，不手改或额外混淆。更新资源前审查来源与符号签名，再重新提取；来源测试校验原始摘要和确定性生成结果。

计算基线见[当前状态](status.md)。1.0.1214 的工具升级、技能副手和装备槽位直接采用上游声明；105 级工具升级保留原强化等级。制造与采集共用副手读取，副手仅对对应技能的普通工作速度生效，装备升级单次耗时直接使用上游站点耗时函数。生产使用解析期望，不运行逐刻模拟或预测器；测试直接验证配方、材料、品质、烧毁／被抓概率、时间、预计产物和费用。原始资源公开不等同于获得再分发授权，构建保留来源与摘要说明。

## 模块边界

| 模块 | 职责 |
| --- | --- |
| engine | 工作配置、收藏、库存、报价、原始概率与角色构造 |
| workspace、crafting-estimates、metal-bars、planned-products | 订单校验、解析计算、收藏制造的半成品比价、库存分配与采购草稿数量计算（金属锭、切割宝石）、采购抵扣与费用 |
| game-sync、capture、execution-status | 只读客户端采样、已有连接旁听、实时任务高亮 |
| main、navigation、mobile-layout | 按角色挂载、入口和双端可视区域 |
| app、theme、stable-view、frozen-columns | 面板交互、稳定节点及冻结表格 |
| storage、panel-geometry、debug-menu | 独立用户存档、桌面布局和站点调试偏好 |
| game-prefill | 用户点击后的导航和草稿预填，不提交交易或动作 |
| platform | GM／浏览器存储与行情读取 |
| amounts | 预估金额的有限非负浮点运算与错误隔离，不放宽数量、输入或存档校验 |
| table-sorting、collection-sorting、recipe-availability、fee-units | 排序、材料供应筛选和费用单位换算 |

app 每次渲染创建工作区、只读行情快照和角色计算参数的共享上下文，传给候选、订单汇总和执行计划；收藏候选缓存按计算输入失效。预填按一次点击构造请求，后续刷新角色：购买比较最新目标购买请求，执行比较完整输入签名，详见[草稿预填规则](panel.md#草稿预填)。

制造与收藏（制造）共用 `craftingJobs` 作为完整配方来源，统一包含普通制造与升级声明；收藏另合并采集来源，再按收藏物品和未完成目标生成候选。升级沿用 `upgrade-<ID>` 标识，材料、产物及固定单次耗时与制造模式一致，存档校验按物品的有效来源匹配。

`capture` 从客户端和服务器角色快照中投影受支持技能的绑定、当前页与其他已拥有页。`engine/skill-masteries` 校验分页输入并生成逐技能的有效等级，`collectionPlayers` 为各工作技能提供对应的计算角色。收藏候选缓存和执行草稿签名使用同一有效配置，换页但有效等级相同时保留待填请求。旧快照仍可只含当前等级表。

`amounts` 校验金额乘加与除法结果；估值返回值继续使用数值或缺价的 null，另以对应的 `*Error` 字段表示金额不可计算。候选、订单、费用与采购按依赖关系传递该状态，金额列排序允许超过安全整数上限，数量列保留原校验。

收藏（制造）的候选与固定单共用本次角色及行情快照的半成品比价缓存。`metal-bars` 处理五种金属锭和切割宝石的同品质库存及一层原料需求。`workspace` 分开累计独立预计产物和配套产物，供采购汇总与自制行替代购买预填使用。开关沿用 `expandMetalBars` 存档字段。

工作区以 `version=2` 持久化用户数据，运行时按模式选择订单范围并组合角色与行情供引擎计算。角色同步仅在自动移除完成收藏实际改变订单时触发保存；字段与恢复规则见[存储与恢复](panel.md#存储与恢复)。

## 运行接入

来源角色身份未知时不读取或写入角色分桶。同步时序见[游戏同步](panel.md#游戏同步)；不读取登录凭据、聊天，不增加游戏连接。助手仅主动请求固定公开市场API，禁用凭据。

安装名为DeepVeinIdle-Buddy，namespace为https://dvi-lab.pages.dev，author为Alice。授权仅含unsafeWindow、GM_getValue、GM_setValue、GM_xmlhttpRequest，匹配两个游戏站点。调试开关及预填功能边界见[面板设计](panel.md)。

入口在 `document-start` 优先使用 `unsafeWindow`，该变量未定义时使用 `window`。回退要求脚本运行在页面主世界，并由脚本管理器提供上述三个 GM API。隔离世界中的 `window` 无法读取页面的 `deepvein` 或监听游戏创建的 WebSocket。游戏可能在脚本启动后才设置 `deepvein`，因此入口不以它是否存在来选择窗口。

## 开发与验证

开发入口见 [README](../README.md#本地开发)。`npm test` 检查计算、数据边界、接入和发布逻辑；`npm run build` 生成 userscript、演示与摘要清单。浏览器验证需先启动本地服务，`npm run test:ui` 运行全部场景，`npm run test:ui -- 场景名` 运行指定场景（列表见 `scripts/test-ui.mjs`）。测试截图和日志写入.test-artifacts，CI保留诊断artifact，不提交重复执行日志。

测试使用合成角色夹具，不连接真实账号；验证边界见[当前状态](status.md#验证与边界)，发布门禁见[构建与发布](releasing.md)。
