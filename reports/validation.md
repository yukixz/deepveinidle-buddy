# 当前验证

日期：2026-10-24。开发版本0.1.0，分支codex/mobile-adaptation，未发布。本轮调整双端默认隐藏、入口5秒文字提示及购买／执行反馈位置，规则见[面板设计](../docs/panel.md)。

| 检查 | 本次结果 | 证据 |
| --- | --- | --- |
| 构建 | 通过，userscript 945600字节 | 本机构建 dist/manifest.json |
| 导航提示 | 13项通过：默认隐藏、中英文启动提醒、5秒关闭、替换重计时、入口修复及清理 | [日志](validation/launcher-hints/navigation.log) |
| 移动专项 | 16项通过：英文启动提醒及可视区域、5秒关闭、成功隐藏后仍显示提示、失败保留面板、零提交 | [日志](validation/launcher-hints/mobile.log)、[失败提示截图](screenshots/launcher-hints-mobile-failure.png) |
| 游戏接入专项 | 30项通过：处理中／成功／失败／收藏期望及双语品质限制均使用入口提示，异步取消守卫保留 | [日志](validation/launcher-hints/game-integration.log) |
| 正式脚本与常规交互 | 45项通过，夹具验证正式构建接入及刷新后重开、存档恢复 | [日志](validation/launcher-hints/browser.log) |
| 行情存储 | 7项通过，关闭／重开和重挂载保留现有数据边界 | [日志](validation/launcher-hints/market-storage.log) |
| 面板布局 | 26项通过，默认隐藏不改变初始尺寸、已保存位置或移动布局保护 | [日志](validation/launcher-hints/panel-geometry.log) |
| 调试设置 | 8项通过，默认隐藏及错误保护保留 | [日志](validation/launcher-hints/debug-menu.log) |
| 静态检查 | 修改脚本语法、文档引用、构建摘要及差异空白通过 | node --check、引用／摘要脚本、git diff --check |

本地7场景共145项，本轮未执行全量测试或另跑单元测试。最后调整提示宽度后专项重跑导航与移动；其他场景验证本轮相同的默认隐藏及反馈流程。已有其他UI场景同步改为点击入口后测试，未将其历史通过结果计入本轮。

本轮未操作真实游戏或安装新构建，未发布、未部署。此前品质控件排查、真实桌面Chrome与回退等结果均为历史证据，见[购买与执行排查](prefill-controls-validation.md)，不代替本轮新增提示的实页验收。移动端真机、管理器完整权限及长期运行仍待验收。

当前构建脚本SHA-256：`c8f4ec2039afff1daabc57f23958383275902639c60f5481d2afd01afd6ff7d3`。
