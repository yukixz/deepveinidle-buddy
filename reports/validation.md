# 当前验证

日期：2026-10-24。开发版本0.1.0，分支codex/mobile-adaptation，未发布。本轮实现移动端入口、触摸布局、可视视口避让、状态／设置点按、手动计划文本及移动菜单预填。规则见[面板设计](../docs/panel.md)，调研与公开资源依据见[移动适配调研](mobile-adaptation.md)。

| 检查 | 本次结果 | 证据 |
| --- | --- | --- |
| 构建 | 通过，userscript 942592字节 | 本机构建 dist/manifest.json |
| 移动专项 | 15项通过 | [日志](validation/mobile.log) |
| 导航及布局回归 | 11＋26项通过 | [导航](validation/navigation.log)、[布局](validation/panel-geometry.log) |
| 调试、面板与游戏接入 | 8＋45＋29项通过 | [调试](validation/debug-menu.log)、[面板](validation/browser.log)、[接入](validation/game-integration.log) |
| 稳定节点、订单输入与材料高亮 | 7＋18＋9项通过 | [稳定节点](validation/stable-view.log)、[订单](validation/orders-tables-ime.log)、[高亮](validation/action-materials.log) |
| 计划传输及存储单元 | 9项通过 | [日志](validation/mobile-transfer-storage-unit.log) |
| 视觉核对 | 移动入口、面板及预填失败保持／成功关闭截图已核对 | [入口](screenshots/mobile-launcher.png)、[面板](screenshots/mobile-portrait.png)、[失败](screenshots/mobile-prefill-failure.png)、[成功](screenshots/mobile-prefill.png) |

9场景共168项浏览器检查，另9项单元检查；摘要见[数据](validation/mobile-summary.json)。导航观察范围收窄后重跑mobile与navigation，其他专项为本轮实施中的实际运行结果。未执行全量测试。

移动夹具包含隐藏桌面导航、聊天锚点及同列按钮、底栏、移动模式切换和路线节点搬移；覆盖320／360／390／430px竖屏与844×390触屏横屏。键盘通过VisualViewport变化模拟；剪贴板拒绝通过抛错夹具验证。预填测试使用隔离角色、菜单与提交记录，不访问真实账号，购买／开始／排队提交记录为零。

Android Firefox＋Tampermonkey、iOS Safari＋Tampermonkey、真实软键盘、地址栏伸缩、安全区域、页面注入及五项GM权限尚未验收。模拟视口与窄屏截图不能代替真机。未发布、未部署。

此前名称统一及高亮等记录为历史结果，不计入本次重跑。当前安装脚本SHA-256：`5734a50c5900c8c265e6d8734d9064030098a3ceca8dafc9726d5eb0c8c9cd0f`。
