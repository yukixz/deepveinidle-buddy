# 技术方案

## 上游计算

原始游戏资源保存在vendor/game-original.js，来源URL、游戏版本、SHA-256及语义提取映射见vendor/manifest.json。src/engine/upstream.js由scripts/extract.mjs生成，保留原始声明，不手改或额外混淆。更新资源前审查来源与符号签名，再重新提取；来源测试校验原始摘要和确定性生成结果。

计算基线为1.0.1204。生产使用解析期望，不运行逐刻模拟或预测器；测试直接验证配方、材料、品质、烧毁／被抓概率、时间、预计产物和费用。原始资源公开不等同于获得再分发授权，构建保留来源与摘要说明。

纯煤配方（344）与普通煤配方（5）共用煤物品及收藏进度；`plain` 采集配方只产出普通品质，稀有品质收藏不列出该路线。采集期望按配方的 `plain` 标记处理，不受装备、药水、房屋、精通和世界稀有度加成影响；普通煤保留原有品质分布。收藏候选、订单行及执行计划中的纯煤路线显示来源名称，避免与普通煤混淆。角色接入与用户存档格式保持不变。

## 模块边界

| 模块 | 职责 |
| --- | --- |
| engine | 工作配置、收藏、库存、报价、原始概率与角色构造 |
| workspace、crafting-estimates、planned-products | 订单校验、解析计算、采购抵扣与费用 |
| game-sync、capture、execution-status | 只读客户端采样、已有连接旁听、实时任务高亮 |
| main、navigation、mobile-layout | 按角色挂载、入口和双端可视区域 |
| app、theme、stable-view、frozen-columns | 面板交互、稳定节点及冻结表格 |
| storage、panel-geometry、debug-menu | 独立用户存档、桌面布局和站点调试偏好 |
| game-prefill | 用户点击后的导航和草稿预填，不提交交易或动作 |
| plan-transfer、platform | 单订单gzip/Base64传输、GM／浏览器存储与剪贴板 |
| sorting、recipe-availability、fee-units | 排序、材料供应筛选和费用单位换算 |

工作区持久化格式为version=2，材料方向保存为materialPriceMode；运行时组合角色与行情供引擎计算。角色同步不写存档，自动移除完成收藏实际改变订单时例外。加载、保存和恢复规则见[面板设计](panel.md#存储与验收)。

来源角色身份未知时不读取或写入角色分桶。白名单采样每250ms进行，正常前台变化在1秒内更新；不读取登录凭据、聊天，不增加游戏连接。助手仅主动请求固定公开市场API，禁用凭据。

安装名为DeepVeinIdle-Buddy，namespace为https://dvi-lab.pages.dev，author为Alice。授权仅含unsafeWindow、GM_getValue、GM_setValue、GM_xmlhttpRequest、GM_setClipboard，匹配两个游戏站点。调试功能的公开说明边界见[面板设计](panel.md)。

## 开发与验证

npm test运行计算、数据边界、接入和发布单元检查。npm run build生成userscript、演示与摘要清单；npm start提供本地演示，npm run test:ui运行浏览器场景，支持传入场景名。测试截图和日志写入.test-artifacts，CI保留诊断artifact，不提交重复执行日志。

测试使用当前角色夹具，不连接真实账号；合成触摸、视口和GM存储不代替脚本管理器与移动真机。发布流程见[构建与发布](releasing.md)。
