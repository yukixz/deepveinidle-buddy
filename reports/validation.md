# 当前验证

日期：2026-10-24。开发版本0.1.0，分支codex/mobile-adaptation，未发布。本轮调整移动窗口为顶部及左右贴合可视区域、仅避开底部操作栏，标题栏跟随游戏顶部功能栏实际高度；移动入口仅在主画面显示。规则见[面板设计](../docs/panel.md)。

| 检查 | 本次结果 | 证据 |
| --- | --- | --- |
| 构建 | 通过，userscript 950815字节 | 本机构建 dist/manifest.json |
| 移动专项 | 19项通过：三边贴合、标题动态等高／节点替换／无栏回退、关闭按钮约束、底栏隐藏与恢复、可视区域偏移、键盘、320–430px及触屏横屏、桌面布局保护、主画面与各页面入口显隐、正常预填不提示及失败反馈 | [日志](validation/mobile-window/mobile.log)、[窗口截图](screenshots/mobile-window.png)、[失败反馈截图](screenshots/mobile-window-failure.png) |
| UI交互 | 4组通过：冻结列、语言跟随及浏览器模拟触摸长按菜单 | [日志](validation/mobile-window/ui-layout.log) |
| 桌面布局 | 26项通过，拖动／缩放／存档恢复与顶部工具栏避让保留 | [日志](validation/mobile-window/panel-geometry.log) |
| 导航 | 13项通过，入口重建、双语启动提示、5秒计时与清理 | [日志](validation/mobile-window/navigation.log) |
| 静态检查 | 语法、文档引用、构建摘要及差异空白通过 | node --check、引用／摘要脚本、git diff --check |

本轮4个浏览器场景共62项。未运行无关单元测试或全量测试；此前UI优化191项／单元54项及其他真实游戏验收均为历史结果，不计入本轮。

入口同时校验根元素与移动容器的world状态，并排除可见原生弹窗和聊天子页；根元素可单独标为market／bank而移动容器仍停留world，因此不能只检查移动容器。状态语义通过已存原始游戏代码的foldToWorld、onTab、markTab核对，离线夹具覆盖各路径。本轮未读取聊天内容、未执行游戏命令。

截图及交互证据来自本地Chrome、移动布局夹具、模拟可视区域及模拟触摸。本轮未操作真实游戏或安装新构建，未发布、未部署；移动真机、安全区域及管理器仍待验收。

当前构建脚本SHA-256：`01577d8fc3338791e0b7310d869eb8fa345930046096f18e7e72794a9ac5ddaf`。
