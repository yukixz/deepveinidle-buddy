# 当前验证

日期：2026-10-24。开发版本0.1.0，分支codex/mobile-adaptation，未发布。基线提交4d59f49。本轮统一桌面／移动购买与执行的临时隐藏及入口反馈；规则见[面板设计](../docs/panel.md#购买执行期间的显示与恢复)。

| 检查 | 本次结果 | 证据 |
| --- | --- | --- |
| 构建 | 通过，userscript 944862字节 | 本机构建 dist/manifest.json |
| 预填显示专项 | 12项通过，分别覆盖两端提前隐藏、本地失败保持显示、忙碌锁定、成功／失败不弹回、手动恢复及零提交 | [日志](validation/prefill-visibility.log) |
| 游戏接入 | 29项通过，菜单草稿与异步守卫回归 | [日志](validation/game-integration.log) |
| 移动端 | 15项通过，接入失败通过入口返回查看 | [日志](validation/mobile.log) |
| 导航、调试、稳定节点 | 11＋8＋7项通过 | [导航](validation/navigation.log)、[调试](validation/debug-menu.log)、[稳定节点](validation/stable-view.log) |
| 静态检查 | 脚本语法、文档引用、构建摘要及差异空白通过 | node --check、文档／摘要脚本、git diff --check |

6场景共82项浏览器检查，见[摘要](validation/prefill-visibility-summary.json)。入口避免重复属性写入的最后调整后，已复验预填显示与导航；其他场景为本轮实施中实际运行结果。未执行全量测试或另跑单元测试。

视觉核对：[桌面成功](screenshots/prefill-desktop-success.png)、[桌面失败](screenshots/prefill-desktop-failure.png)、[移动成功](screenshots/prefill-mobile-success.png)、[移动失败](screenshots/prefill-mobile-failure.png)。截图来自隔离游戏控件夹具，不代表实际游戏外观或真机效果。新专项保留并核对原节点、窗口位置尺寸、滚动位置、筛选值及计划文本草稿；处理期间入口禁用，完成后显示标记，用户返回时确认并清除标记，结果正文仍保留。

预填测试使用隔离角色、菜单及命令记录；没有连接真实账号，也未提交购买／开始／排队。Android Firefox＋Tampermonkey、iOS Safari＋Tampermonkey、真实键盘与管理器权限仍待验收。未发布、未部署。

此前移动适配168项浏览器／9项单元等记录为历史结果，不计入本次重跑。当前安装脚本SHA-256：`e0c487bad55b081bbc68c61eaf90f08dca508566c0b31d0073bac522b5a6fa2c`。
