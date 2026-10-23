# 当前验证

日期：2026-10-23。开发版本0.1.0，未发布。本次订单列表按时间、成本、加工费、建议售价展示。成本按材料定价计算全部需求材料价值，不扣库存；建议售价为成本＋加工费，各单独立估算。规则见[面板设计](../docs/panel.md)。

| 检查 | 本次结果 | 证据 |
| --- | --- | --- |
| 构建 | 通过，userscript 919749字节 | dist/manifest.json |
| workspace 单元 | 38项通过 | [日志](validation/order-summary-unit.log) |
| orders-tables-ime | 18项通过 | [日志](validation/orders-tables-ime.log) |
| order-row-toggle | 7项通过 | [日志](validation/order-row-toggle.log) |
| 浏览器专项 | 2场景、25项通过 | [摘要](validation/summary.json) |
| 显示效果 | 已检查桌面列顺序与窄屏内部横向滚动 | [桌面](screenshots/order-summary-desktop.png)、[窄屏](screenshots/order-summary-mobile.png) |
| 静态检查 | 文档链接、脚本语法、构建元数据与摘要及差异空白通过 | [日志](validation/static.log) |

覆盖全材料成本、加工费合计、数学期望时间、库存不抵扣成本、缺价与未知需求、空单和已完成收藏，以及未勾选订单、明细展开跨度、输入法、剪贴板及行点击交互。修正已有采购表断言，使其符合默认隐藏调试操作列的现行设计。组合输入时新增只读指标沿用原费用单元格局部刷新机制。清理测试夹具后重跑上述两个浏览器场景；38项单元结果和截图来自本次实施阶段，未重复运行。

安装脚本SHA-256：`109a54138472b53f9fc19d0d96620dc2cf2bc938646375d50404f05fbe09516b`。截图与验证来自本地隔离页面，未在真实游戏中安装／更新脚本，未进行本轮真实游戏验收或部署。
