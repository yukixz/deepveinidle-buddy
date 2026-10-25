# 当前验证

日期：2026-10-25，Buddy开发版本0.2.0。本轮覆盖来源时钟与稀有度热门修正、世界数据失败保护（含null等非法窗口行和恢复提示清除）、行情状态及角色白名单收缩、旧产品／测试接口删除和上游提取根收缩；未发布、未部署。

## 本轮结果

- `npm test`：143项通过，0失败，见[单元日志](validation/lab-cleanup/unit.log)。覆盖source worldTick决定热门、同一tick不受本机日期影响、非法世界数据原子拒绝、干净来源恢复、无用角色字段不触发事件、报价新旧保护、旧结构拒绝与存档保护；保留所有受支持普通制造配方／品质的原始tick／offline对照，以及材料、产物、费用和单订单测试。暂存检查修正纯空行格式后，来源摘要检查再次通过，见[最终来源检查](validation/lab-cleanup/source-final.log)，构建哈希不变。已删除旧估价／输入框／合并库存接口专用测试，不能用测试数量直接比较覆盖范围。
- 最终构建运行21个相关UI场景，267项全部通过，见[汇总](validation/lab-cleanup/summary.json)、[运行日志](validation/lab-cleanup/ui.log)及同目录各场景完整输出。新增game-integration两项覆盖来源tick进入稀有度热门后更新收藏结果且不写GM，以及非法世界数据保留有效角色、禁用预填和干净来源恢复并清除同步错误提示；其他场景覆盖行情存储、双端表格／边框、排序、输入法、稳定节点、导航及实际打包脚本零交易／动作提交。
- `npm run build`通过，正式脚本822,695字节，演示800,763字节。相较本轮开始的833,615字节正式脚本减少10,920字节；相较最初951,916字节减少约13.6%。字节数和SHA-256见[构建清单](validation/lab-cleanup/build-manifest.json)、[构建日志](validation/lab-cleanup/build.log)。
- 生产依赖图44个输入，无tests/reference、模拟、手动设置、旧热门预测或公会模块，见[依赖图](validation/lab-cleanup/production-graph.json)。生产只保留稀有度热门的原始计算，不计算经验热门或未来跨期收益。

## 提取与来源

审查公开入口后143个根减为67个、778项声明减为752项。运行[提取器](../scripts/extract.mjs)重新生成upstream.js及manifest，并重复运行确认生成幂等；原始游戏资源摘要不变，所有保留声明与清理前的原文摘要一致。见[入口清单](validation/lab-cleanup/extraction-roots.json)、[提取日志](validation/lab-cleanup/extract.log)、[重复提取日志](validation/lab-cleanup/reextract.log)、[声明与幂等校验](validation/lab-cleanup/generation-check.json)。

vendor/lab-source.json分别记录原始模块、当前本地适配、测试对照及生成物／提取器摘要，来源检查已纳入上述单元测试。历史1.0.1200的778项比较仍是当时证据，本轮没有下载新游戏资源或声称重新验证当前线上版本。

## 静态与截图

本轮94个JS／MJS文件语法、15份Markdown本地引用、构建字节／摘要及git diff --check均通过，见[静态摘要](validation/lab-cleanup/static-summary.json)。保留本轮实际生成的[移动截图](validation/lab-cleanup/mobile.png)与[桌面截图](validation/lab-cleanup/desktop.png)，冻结边框场景读取实际像素验收。旧重复离线证据已整理；独有实页与资源观测继续保留日期和边界。

## 限制

本次已完成提交前本地验收；未操作真实游戏、安装脚本、发布或部署；本地夹具、触摸、视口及截图不能替代移动真机、安全区域、系统键盘和脚本管理器权限验收。稀有度热门按来源当前游戏tick估算，不预测整个计划未来跨越的热门时段。旧工作区或行情格式明确拒绝并保护原数据，不迁移；用户需显式重置或重新载入有效当前结构。

[适配结果](lab-copy-audit.md)说明已处理范围；[清理前复现](validation/lab-copy-audit/reproductions.json)和前轮[计算一致性摘要](validation/cleanup/computation-parity.json)仅作历史问题说明，不计入本轮测试或正确性结论。
