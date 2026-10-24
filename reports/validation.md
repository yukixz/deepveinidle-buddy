# 当前验证

日期：2026-10-24。开发版本0.1.0，分支codex/mobile-adaptation，未发布。本轮完成目标次数同行、执行动作列顺序、三表冻结两列、标题精简、底部游戏版本、游戏语言跟随及移动标题长按菜单。规则见[面板设计](../docs/panel.md)。

| 检查 | 本次结果 | 证据 |
| --- | --- | --- |
| 构建 | 通过，userscript 950164字节 | 本机构建 dist/manifest.json |
| UI布局 | 4组通过，含小号次数同行、标题／底部版本、语言及导航重建、三表冻结、模拟触摸长按与取消 | [日志](validation/ui-layout/ui-layout.log)、[移动截图](screenshots/ui-layout-mobile.png)、[桌面截图](screenshots/ui-layout-desktop.png) |
| 移动与导航 | 移动16项、导航13项通过，默认隐藏、启动提醒及原预填显示策略保留 | [移动](validation/ui-layout/mobile.log)、[导航](validation/ui-layout/navigation.log) |
| 隐藏菜单 | 8项通过，桌面右键、偏好隔离及异常保护 | [日志](validation/ui-layout/debug-menu.log) |
| 游戏接入 | 30项通过，实时同步、任务边框、双语预填、正常成功不提示及零动作提交 | [日志](validation/ui-layout/game-integration.log) |
| 滚动、高亮、排序 | 分别7项、9项、8项通过，冻结列保留材料底色 | [滚动](validation/ui-layout/table-scroll.log)、[高亮](validation/ui-layout/action-materials.log)、[排序](validation/ui-layout/extra-sorting.log) |
| 布局与常规交互 | 布局26项、浏览器45项通过，标题仅保留关闭按钮，保存及正式构建夹具接入正常 | [布局](validation/ui-layout/panel-geometry.log)、[浏览器](validation/ui-layout/browser.log) |
| 输入法与存储 | 输入法18项、行情存储7项通过，语言变化保留编辑节点，不保存独立语言偏好，存档冲突保护保留 | [输入法](validation/ui-layout/orders-tables-ime.log)、[存储](validation/ui-layout/market-storage.log) |
| 单元测试 | workspace、storage、order-transfer共54项通过 | [执行摘要](validation/ui-layout/unit-summary.json) |
| 静态检查 | 脚本语法、文档引用、构建摘要及差异空白通过 | node --check、引用／摘要脚本、git diff --check |

本轮12个浏览器场景共191项、单元测试54项。仅运行影响范围内验证，未执行全量测试。其他UI场景同步将语言操作改为模拟游戏语言变化，未把未重跑场景的历史结果计入本轮。此前静默预填59项、入口提示145项及真实桌面Chrome等均为历史结果。

截图及长按证据来自本地Chrome、移动布局夹具和浏览器模拟触摸。本轮未操作真实游戏或安装新构建，未发布、未部署；移动真机、管理器权限及长期运行仍待验收。

当前构建脚本SHA-256：`28b2d62dad4ff76ed6f267401a0d7672c01ee0d1385bf34baa9f4597c45bc1b6`。
