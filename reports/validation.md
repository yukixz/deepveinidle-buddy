# 当前验证

日期：2026-10-22。开发版本0.1.0，未发布。行为规则见[面板设计](../docs/panel.md)。本记录只包含本次实际执行结果。

## 检查

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 构建 | 通过，userscript 886220字节 | dist/manifest.json |
| 单元与来源 | 113项通过，0失败 | [日志](validation/unit.log) |
| UI 场景 | 12场景、145项通过，0未捕获错误 | [摘要](validation/summary.json) |
| 页面与合成接入 | 44项通过 | [日志](validation/browser.log) |
| 订单与组合输入 | 16项通过 | [日志](validation/orders-tables-ime.log) |
| 费用单位 | 6项通过 | [日志](validation/fee-captions.log) |
| 成本单位与筛选 | 4项通过 | [日志](validation/point-cost-filter.log) |
| 分页与批量加入 | 7项通过 | [日志](validation/bulk-pagination.log) |
| 新增排序与传输保护 | 8项通过 | [日志](validation/extra-sorting.log) |
| 材料高亮 | 7项通过 | [日志](validation/action-materials.log) |
| 执行汇总 | 7项通过 | [日志](validation/execution-summary.log) |
| 订单整行展开 | 7项通过 | [日志](validation/order-row-toggle.log) |
| 布局与贴边缩放 | 21项通过 | [日志](validation/panel-geometry.log) |
| 表格滚动 | 7项通过 | [日志](validation/table-scroll.log) |
| 导航入口 | 11项通过 | [日志](validation/navigation.log) |

安装脚本 SHA-256：`97786c974ebec8a38c681e48e96ed4c54f06557c3f28bc74620df771d3c2a167`。

本次清理后全套 UI 场景共用浏览器配置与统一运行入口。文档链接和空白检查见[静态检查](validation/static.log)。

## 截图

[桌面概览](screenshots/overview-desktop.png)、[窄屏订单](screenshots/orders-mobile.png)、[窄屏执行计划](screenshots/execution-mobile.png)、[窄屏分页](screenshots/pagination-mobile.png)。

## 边界

本次为本地隔离验证，不读取真实账号或系统剪贴板，不连接真实游戏 socket；复制／读取异常通过合成接口验证。Chromium 原生组合输入不替代真实操作系统输入法与脚本管理器验收。真实挂载、权限、行情网络及长期性能未验证，未部署。
