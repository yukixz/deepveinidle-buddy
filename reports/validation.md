# 当前验证

## 发布配置验证

日期：2026-10-27。新增可复用CI、正式tag发布、草稿附件与摘要校验、Greasy Fork代码核对，构建记录来源提交。仓库原生Webhook处理通知，Actions不接触其Secret。

- 本地`npm test`：168项通过，见[日志](validation/release-config/unit.log)，包括14项发布逻辑／传输检查。覆盖版本、摘要、元数据权限、草稿恢复、已发布重跑、上传失败及同步超时；隔离客户端和HTTP响应，无真实远端写入。
- 带`BUILD_COMMIT`构建及`release.mjs validate`通过，见[本地构建清单](validation/release-config/local-build-manifest.json)。本地清单的来源提交是实施前HEAD，只作为工作区校验记录；真正发布以Actions检出的提交及验收产物为准。
- 官方actionlint 1.7.12校验工作流通过，YAML解析、JS语法与差异检查通过。Actions固定到已核对的官方提交摘要，验证只读，发布作业单独获得contents:write。
- 只读确认仓库公开、Actions启用、原生release Webhook活跃且ping HTTP 200；Greasy Fork管理页的同步URL已是目标Release附件。线上0.2.1，本地0.2.0，本次不改变版本或发布。
- Linux端完整CI与产物日志由GitHub Actions保留；首次正式Release及Greasy Fork端到端更新不能由本地模拟代替。本轮未创建tag、Release或更新站点代码。

## 用户存储拆分验证

日期：2026-10-27，Buddy开发版本0.2.0。本轮将用户数据持久化与游戏数据内存分离，未安装、发布或部署。

- 用户存档version=2仅保存订单、当前订单、定价方向、供应筛选、自动移除设置和筛选；角色、库存、收藏进度、时间／tick、实时任务及行情均不进入持久化结构。材料方向保存为materialPriceMode，运行时适配现有计算接口。演示使用相同用户存档格式，角色与行情测试夹具改为启动时内存注入。
- 用户保存不校验游戏快照；同步失败保留本页有效角色数据，仍可保存用户输入。游戏同步零写入，仅自动移除收藏实际改变订单时保存。重新载入不写回，重置须确认，两者统一恢复筛选与异步导入状态并保留角色、行情和任务。
- 首次成功读取前禁止写入，读取失败保持锁定；写前校验原值与待写值，检查revision及溢出，读写操作互斥；空值重载可恢复。存储错误独立持续显示，保留首次失败原因。沿用原存储键，旧混合存档明确拒绝并保护，不迁移、不静默覆盖。
- `npm test`：154项通过，0失败，见[单元日志](validation/user-storage/unit.log)。覆盖用户格式严格校验、游戏数据异常与持久化独立、保护与重载、失败写入、慢写合并和revision边界。
- 完整22个浏览器场景共280项检查通过，见[汇总及同目录日志](validation/user-storage/summary.json)。运行分批完成：完整场景列表执行至debug-menu时修正过时采购列断言，再续跑其余场景；本汇总收集各场景最终成功日志。新user-storage场景10项检查覆盖游戏同步零写入、无效快照后用户保存、重载／重置、删除后恢复、自动移除、旧格式与首次读取失败保护、重新挂载等待新角色数据；game-integration含实际打包脚本、角色切换和慢读取废弃挂载验证。
- 构建、`git diff --check`通过，见[构建清单](validation/user-storage/build-manifest.json)。未修改生成引擎或原始游戏资源。全部浏览器检查为本地夹具及GM注入，不代替真实脚本管理器读写、账号、移动真机或长期运行验收；未操作真实存档。
- 提交前清理未使用的演示导出、测试导入及保存结束时的冗余条件，精简排查报告并统一用户存档文案；重新运行154项单元及构建通过，日志和构建清单已更新。完整浏览器结果来自此前同一功能实现，清理后未重复整套UI。

## 前轮市场返回入口验证

日期：2026-10-26，Buddy开发版本0.2.0。该轮覆盖游戏市场返回入口更新，未安装、发布或部署。

- 当前公开程序已删除`data-sheet-back`，改用桌面／移动共用的`data-market-allitems`属性。助手选择唯一可见入口，等待详情关闭后继续筛选和预填；控件缺失、重复可见或返回失败明确中止。来源地址、摘要和实页观测见[来源记录](validation/market-update/source.json)、[市场截图](validation/market-update/live-market.png)。
- `npm run build`通过，见[构建清单](validation/market-update/build-manifest.json)。`npm run test:ui -- game-integration mobile`共2个场景、55项检查通过，见[汇总与同目录日志](validation/market-update/summary.json)。回归覆盖已有详情和交易草稿、桌面／移动返回按钮、返回无效／控件缺失／重复可见、角色与计划异步保护、价格读回、零交易／动作提交。
- 修改的JS／MJS语法及`git diff --check`通过。实页仅核对市场导航、搜索及铜矿详情ID，未运行新适配器、填写／提交交易、读取登录信息或聊天；移动为本地夹具，仍待真实设备验收。计算基线保持1.0.1199，未将菜单适配视为新版本计算一致性验证。

## 前轮UI优化验证

日期：2026-10-26，Buddy开发版本0.2.0。本轮仅调整采购材料列及收藏候选加入／移出订单交互，未发布、未部署。

- `npm run build`通过。
- `npm run test:ui -- browser extra-sorting execution-summary mobile-tables`：4个场景、72项检查通过，见[本轮汇总](validation/ui-optimization/summary.json)及同目录日志。覆盖制造／采集收藏加入与移出、高目标覆盖低目标、中英文按钮与采购表头、采购数量和金额排序／计算、空表跨列数及移动表格布局。
- `git diff --check`及修改后的应用、浏览器与汇总测试脚本语法检查通过。仅执行相关UI验证，未重跑单元全套，未操作真实游戏或安装脚本。

## 前轮裁剪与清理验证

日期：2026-10-25，Buddy开发版本0.2.0。本轮覆盖来源时钟与稀有度热门修正、世界数据失败保护（含null等非法窗口行和恢复提示清除）、行情状态及角色白名单收缩、旧产品／测试接口删除和上游提取根收缩；未发布、未部署。

### 验证结果

- `npm test`：143项通过，0失败，见[单元日志](validation/lab-cleanup/unit.log)。覆盖source worldTick决定热门、同一tick不受本机日期影响、非法世界数据原子拒绝、干净来源恢复、无用角色字段不触发事件、报价新旧保护、旧结构拒绝与存档保护；保留所有受支持普通制造配方／品质的原始tick／offline对照，以及材料、产物、费用和单订单测试。暂存检查修正纯空行格式后，来源摘要检查再次通过，见[最终来源检查](validation/lab-cleanup/source-final.log)，构建哈希不变。已删除旧估价／输入框／合并库存接口专用测试，不能用测试数量直接比较覆盖范围。
- 最终构建运行21个相关UI场景，267项全部通过，见[汇总](validation/lab-cleanup/summary.json)、[运行日志](validation/lab-cleanup/ui.log)及同目录各场景完整输出。新增game-integration两项覆盖来源tick进入稀有度热门后更新收藏结果且不写GM，以及非法世界数据保留有效角色、禁用预填和干净来源恢复并清除同步错误提示；其他场景覆盖行情存储、双端表格／边框、排序、输入法、稳定节点、导航及实际打包脚本零交易／动作提交。
- `npm run build`通过，正式脚本822,695字节，演示800,763字节。相较本轮开始的833,615字节正式脚本减少10,920字节；相较最初951,916字节减少约13.6%。字节数和SHA-256见[构建清单](validation/lab-cleanup/build-manifest.json)、[构建日志](validation/lab-cleanup/build.log)。
- 生产依赖图44个输入，无tests/reference、模拟、手动设置、旧热门预测或公会模块，见[依赖图](validation/lab-cleanup/production-graph.json)。生产只保留稀有度热门的原始计算，不计算经验热门或未来跨期收益。

### 提取与来源

审查公开入口后143个根减为67个、778项声明减为752项。运行[提取器](../scripts/extract.mjs)重新生成upstream.js及manifest，并重复运行确认生成幂等；原始游戏资源摘要不变，所有保留声明与清理前的原文摘要一致。见[入口清单](validation/lab-cleanup/extraction-roots.json)、[提取日志](validation/lab-cleanup/extract.log)、[重复提取日志](validation/lab-cleanup/reextract.log)、[声明与幂等校验](validation/lab-cleanup/generation-check.json)。

vendor/lab-source.json分别记录原始模块、当前本地适配、测试对照及生成物／提取器摘要，来源检查已纳入上述单元测试。历史1.0.1200的778项比较仍是当时证据，本轮没有下载新游戏资源或声称重新验证当前线上版本。

### 静态与截图

本轮94个JS／MJS文件语法、15份Markdown本地引用、构建字节／摘要及git diff --check均通过，见[静态摘要](validation/lab-cleanup/static-summary.json)。保留本轮实际生成的[移动截图](validation/lab-cleanup/mobile.png)与[桌面截图](validation/lab-cleanup/desktop.png)，冻结边框场景读取实际像素验收。旧重复离线证据已整理；独有实页与资源观测继续保留日期和边界。

### 限制

本次已完成提交前本地验收；未操作真实游戏、安装脚本、发布或部署；本地夹具、触摸、视口及截图不能替代移动真机、安全区域、系统键盘和脚本管理器权限验收。稀有度热门按来源当前游戏tick估算，不预测整个计划未来跨越的热门时段。旧工作区或行情格式明确拒绝并保护原数据，不迁移；用户需显式重置或重新载入有效当前结构。

[适配结果](lab-copy-audit.md)说明已处理范围；[清理前复现](validation/lab-copy-audit/reproductions.json)和前轮[计算一致性摘要](validation/cleanup/computation-parity.json)仅作历史问题说明，不计入本轮测试或正确性结论。
