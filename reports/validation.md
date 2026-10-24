# 当前验证

日期：2026-10-24。开发版本0.1.0，未发布。面板、游戏导航入口、安装元数据及演示页统一中文名称“工匠精通助手”，英文名称“Crafting & Mastery Buddy”；导航随游戏语言切换，面板随助手语言切换。默认安装name继续使用无空格ASCII标识“DeepVeinIdle-Buddy”。

| 检查 | 本次结果 | 证据 |
| --- | --- | --- |
| 构建 | 通过，userscript 928611字节 | 本机构建 dist/manifest.json |
| 导航专项 | 11项通过，覆盖中文名称、悬停提示、英文切换与重开 | [日志](validation/navigation.log) |
| 面板专项 | 45项通过，覆盖中英文标题及原有面板交互 | [日志](validation/browser.log) |
| 调试与元数据专项 | 8项通过，包含中英文安装名称断言 | [日志](validation/debug-menu.log) |
| 静态检查 | 当前代码、测试及文档无旧名称；差异空白检查通过 | rg、git diff --check |

本次仅运行相关专项共64项，未运行全量测试，未在真实游戏或脚本管理器验收，未发布。

当前安装脚本SHA-256：`50ca0d0d012dbbc739721f54d502d9a04b6519ec09f5b15615a766a81db94016`。

## 执行动作高亮验证（此前结果）

日期：2026-10-24。开发版本0.1.0，未发布。本次调整执行动作表高亮：材料满足使用深绿／琥珀底色，执行中／队列中使用紫／蓝边框，同时命中时紫色优先；规则见[面板设计](../docs/panel.md)。

| 检查 | 本次结果 | 证据 |
| --- | --- | --- |
| 构建 | 通过，userscript 928615字节 | 本机构建 dist/manifest.json |
| 材料高亮专项 | 9项通过，覆盖底色、库存状态、提示、双语及窄屏 | [日志](validation/action-materials.log) |
| 游戏接入专项 | 29项通过，覆盖实时匹配、边框优先级、材料底色叠加及原有只读预填流程 | [日志](validation/game-integration.log) |
| 视觉核对 | 桌面、窄屏及材料与实时状态叠加截图已核对 | [材料桌面](screenshots/action-materials-desktop.png)、[材料窄屏](screenshots/action-materials-mobile.png)、[实时状态叠加](screenshots/execution-status.png) |
| 静态检查 | 差异空白检查通过 | git diff --check |

本次仅运行上述影响范围内验证，未重跑全量测试。浏览器验证使用本地合成场景，未在真实脚本管理器或游戏环境验收，未部署。

此前元数据与行情内存存储验证为历史结果，不计入本次重跑结果。

当时安装脚本SHA-256：`f401351055a3e03bd3061fe9bd54f9c44c53422558f44d697ab0cf47d10da61f`。
