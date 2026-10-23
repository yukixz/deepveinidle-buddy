# 当前验证

日期：2026-10-23。开发版本0.1.0，未发布。本次按各动作涉及材料的计划总需求判定备齐状态，排除无关材料缺口影响；材料状态使用绿／黄边框，当前执行／已入队使用紫／蓝底色。两类样式独立共存，同时执行和排队时紫色底色优先；任务匹配规则不变，见[面板设计](../docs/panel.md)。

| 检查 | 本次结果 | 证据 |
| --- | --- | --- |
| 构建 | 通过，userscript 919137字节 | dist/manifest.json |
| workspace 单元 | 36项通过 | [日志](validation/action-materials-unit.log) |
| action-materials | 9项通过 | [日志](validation/action-materials.log) |
| game-integration | 23项通过 | [日志](validation/game-integration.log) |
| 浏览器专项 | 2场景、32项通过 | [摘要](validation/summary.json) |
| 显示效果 | 已检查黄色材料边框及紫／蓝底色与绿色材料边框叠加 | [材料截图](screenshots/materials-shared.png)、[任务截图](screenshots/execution-status.png) |
| 静态检查 | 文档链接、脚本语法、构建元数据与摘要及差异空白通过 | [日志](validation/static.log) |

浏览器回归绿／黄边框、无高亮、超额库存、无关材料缺口、双语提示、窄屏滚动，以及运行／队列底色优先级、材料边框共存与实时状态更新。提交前重跑36项订单计算单元检查，覆盖相关材料总需求、超额库存、多材料竞争及库存不足；浏览器检查与截图沿用本次实现后的实际验证结果。

安装脚本SHA-256：`7686d4f40464dfe590b4b29eb52fedbffbb87fa544a66c8a327c335abc318b42`。截图与验证来自本地隔离页面，未在真实游戏中安装／更新脚本，未进行本轮真实游戏验收或部署。
