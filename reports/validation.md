# 当前验证

日期：2026-10-23。开发版本0.1.0，未发布。本次提交范围为默认隐藏的调试预填入口、面板层级7和中英文名称；规则见[面板设计](../docs/panel.md)。以下均为清理后本轮实际运行结果。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 构建 | 通过，userscript 914135字节 | dist/manifest.json |
| debug-menu | 8项通过 | [日志](validation/debug-menu.log) |
| game-integration | 16项通过 | [日志](validation/game-integration.log) |
| browser | 44项通过 | [日志](validation/browser.log) |
| panel-geometry | 21项通过 | [日志](validation/panel-geometry.log) |
| navigation | 11项通过 | [日志](validation/navigation.log) |
| 专项合计 | 5场景、100项通过 | [摘要](validation/summary.json) |
| 静态检查 | 文档链接、源文件语法、安装名称、构建摘要及差异空白通过 | [日志](validation/static.log) |

覆盖默认隐藏整列、右键菜单开关、双语、刷新与跨标签同步、角色共用与站点／演示隔离、偏好读写失败及非法值保护；非法偏好不能被远端后续有效值自动重新启用。伪造按钮无法进入预填，异步等待时关闭再开启也会取消原请求。市场／制造／采集仅预填，无购买或角色动作提交，预填后助手保持显示。

面板计算层级为7，拖动、四边缩放与布局保存通过。中英文完整面板／导航名称、窄屏布局及安装名称前缀均通过检查。安装名称为“Deep Vein Idle · 工匠与精通助手”／“Deep Vein Idle · Crafting & Mastery Buddy”。

安装脚本SHA-256：`bea18f6ee2dfba857c83cacebab065725d3429a84e3f1036a7e1fc3587587ae9`。本次只运行上述受影响专项，没有重跑无关单元或完整UI套件。浏览器使用本地隔离夹具，未进行本轮真实游戏、脚本管理器或生产验收；未部署、未更新已安装脚本。

此前真实Chrome接入证据见[接入验收](game-integration-validation.md)，不作为本轮重跑结果。
