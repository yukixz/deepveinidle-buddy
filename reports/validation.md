# 当前验证

日期：2026-10-22。开发版本0.1.0，未发布。本记录只包含本轮实际执行结果；规则见[面板设计](../docs/panel.md)。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 构建 | 通过，userscript 908880字节 | dist/manifest.json |
| 单元与来源 | 119项通过，0失败 | [日志](validation/unit.log) |
| 浏览器 | 13场景、159项通过 | [摘要](validation/summary.json) |
| game-integration | 14项通过 | [日志](validation/game-integration.log) |
| browser | 44项通过 | [日志](validation/browser.log) |
| orders-tables-ime | 16项通过 | [日志](validation/orders-tables-ime.log) |
| fee-captions | 6项通过 | [日志](validation/fee-captions.log) |
| point-cost-filter | 4项通过 | [日志](validation/point-cost-filter.log) |
| bulk-pagination | 7项通过 | [日志](validation/bulk-pagination.log) |
| extra-sorting | 8项通过 | [日志](validation/extra-sorting.log) |
| action-materials | 7项通过 | [日志](validation/action-materials.log) |
| execution-summary | 7项通过 | [日志](validation/execution-summary.log) |
| order-row-toggle | 7项通过 | [日志](validation/order-row-toggle.log) |
| panel-geometry | 21项通过 | [日志](validation/panel-geometry.log) |
| table-scroll | 7项通过 | [日志](validation/table-scroll.log) |
| navigation | 11项通过 | [日志](validation/navigation.log) |

安装脚本SHA-256：`3072b0cf14a0b85be05c7e4672342f74f0792d3017524e7811a04641820439df`。文档链接与空白检查见[静态检查](validation/static.log)。

## 接入与截图

实时同步及预填的[专项验收](game-integration-validation.md)区分隔离浏览器测试与真实Chrome核验，包含延迟、消息类型和未验证范围。

[桌面概览](screenshots/overview-desktop.png)、[窄屏订单](screenshots/orders-mobile.png)、[窄屏执行计划](screenshots/execution-mobile.png)、[窄屏分页](screenshots/pagination-mobile.png)、[真实市场预填](screenshots/game-market-prefill.png)。本轮更新了截图并复核。

没有安装或更新真实脚本管理器中的脚本，不代替权限与沙箱验收；未验证系统输入法、移动游戏UI、中文服及长期运行。未发布、未部署。
