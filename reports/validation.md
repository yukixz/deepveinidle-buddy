# 当前验证

日期：2026-10-23。开发版本0.1.0，未发布。本次提交包含工具栏避让、执行计划内的预填反馈、移除预填版本限制、默认模式与订单详情调整，以及购买搜索语言同步。规则见[面板设计](../docs/panel.md)。

## 实际执行结果

下表按场景汇总本次实施中最后一次通过结果，共8场景143项；这些验证分阶段执行，并非在最终构建上统一重跑。工具栏与预填阶段执行3场景58项；默认选项与订单详情阶段执行5场景84项及38项工作区单元；购买搜索语言阶段在最终构建上重跑game-integration，25项通过。

| 检查 | 结果 | 执行阶段 | 证据 |
| --- | --- | --- | --- |
| 构建 | 通过，userscript 919904字节 | 购买搜索语言 | dist/manifest.json |
| workspace 单元 | 38项通过 | 默认选项与订单详情 | [日志](validation/defaults-workspace-unit.log) |
| panel-geometry | 26项通过 | 工具栏与预填 | [日志](validation/panel-geometry.log) |
| debug-menu | 8项通过 | 工具栏与预填 | [日志](validation/debug-menu.log) |
| fee-captions | 7项通过 | 默认选项与订单详情 | [日志](validation/fee-captions.log) |
| orders-tables-ime | 18项通过 | 默认选项与订单详情 | [日志](validation/orders-tables-ime.log) |
| browser | 45项通过 | 默认选项与订单详情 | [日志](validation/browser.log) |
| bulk-pagination | 7项通过 | 默认选项与订单详情 | [日志](validation/bulk-pagination.log) |
| table-scroll | 7项通过 | 默认选项与订单详情 | [日志](validation/table-scroll.log) |
| game-integration | 25项通过 | 购买搜索语言 | [日志](validation/game-integration.log) |
| 静态检查 | 脚本语法、文档引用、差异空白与构建摘要通过 | 提交整理 | [日志](validation/static.log) |

浏览器结果汇总见[摘要](validation/summary.json)。保留各场景完整日志；已有历史日志不作为本次重跑结果。

## 覆盖范围

窗口覆盖拖动、四边／四角与键盘缩放、工具栏高度变化及新增／移除、短窄屏、旧布局越界恢复。已检查[桌面](screenshots/toolbar-desktop.png)和[窄屏](screenshots/toolbar-mobile.png)工具栏避让截图。

初始配方类型为收藏(制造)，自动移出默认关闭；已完成目标默认留在订单，用户开启后移出。已有存档保留用户设置。订单名称输入宽110px，无独立“加工费”分组文字，固定费用标为“固定加工费(M)”／“Fixed processing fee (M)”。费用换算、剪贴板往返、输入保护、表格、原生中文输入法、批量加入与滚动检查通过。已检查订单详情[桌面](screenshots/order-details-desktop.png)和[窄屏](screenshots/order-details-mobile.png)截图；窄屏表格继续使用内部横向滚动。

购买／执行成功和失败提示位于执行计划内。预填不要求登记主程序摘要且不请求主程序资源；保留角色、计划、控件及输入读回检查。中文界面购买时市场搜索“铜矿”，英文界面搜索“Copper”，均与采购表物品名一致。隔离夹具未记录购买、启动或排队提交。

## 验证边界

安装脚本SHA-256：`3d81a0c888376929c0501ce96d7600f28a47206be8e1dd3b2f4401dfe9317973`。最终构建仅重跑相关接入场景，提交整理仅执行静态检查，未重跑完整测试。验证来自本地隔离页面，未在真实游戏中安装／更新脚本，未进行本轮真实游戏验收或部署。
