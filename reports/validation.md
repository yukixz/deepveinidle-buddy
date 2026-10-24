# 当前验证

日期：2026-10-24。开发版本0.1.0，未发布。本轮覆盖执行计划产物抵扣、采购表列调整及相关依赖；规则见[面板设计](../docs/panel.md)。

| 检查 | 本次结果 | 证据 |
| --- | --- | --- |
| 构建 | 通过，userscript 924876字节 | 本机构建 dist/manifest.json |
| workspace及planned-products单元测试 | 49项通过 | [日志](validation/production-offset-unit.log) |
| execution-summary | 9项通过 | [日志](validation/execution-summary.log) |
| extra-sorting | 8项通过 | [日志](validation/extra-sorting.log) |
| action-materials | 9项通过 | [日志](validation/action-materials.log) |
| orders-tables-ime | 18项通过 | [日志](validation/orders-tables-ime.log) |
| game-integration | 28项通过 | [日志](validation/game-integration.log) |
| browser | 45项通过 | [日志](validation/browser.log) |
| 浏览器专项合计 | 6场景、117项通过 | [摘要](validation/summary.json) |
| 静态检查 | 修改脚本语法、文档引用、差异空白及构建摘要通过 | [日志](validation/static.log) |

单元测试覆盖制造、烧毁产物、升级结果、采集品质和被抓、跨订单抵扣、不同品质隔离、产物过剩、抵扣后缺价行归零、未知产出及溢出。收藏产出使用向上取整后的计划次数，采购只在减去库存和预计产物后向上取整；订单成本、费用及实际库存高亮保持原口径。

浏览器覆盖“需求 / 库存 / 产物”列与采购金额、总需求排序、输入法期间的实时更新、勾选计划及购买草稿的净缺口数量。接入夹具增加制造需求，确保加入采集预计产物后仍有待采购缺口；旧库存列位置断言已同步更新。

提交前整理仅拆分表达式、段落和补充夹具注释，未改变计算口径；重新执行构建、49项相关单元测试和静态检查。浏览器结果为本次功能实施阶段实际执行的117项检查，整理后未重复运行。未重跑完整测试。原始游戏资源及生成的upstream.js未修改。产物为主产物期望，不保证实际产量，也不校验动作先后可执行性；宠物等额外随机奖励不计入。

安装脚本SHA-256：`5f90274c3ca4b99c792e784b2d3bbd5dc52f3f1ab4ff984d3d6f9d8d9571bf40`。验证使用本地Chrome隔离夹具，未在真实游戏中安装／更新脚本，未进行真实账号、脚本管理器或生产验收，未部署。
