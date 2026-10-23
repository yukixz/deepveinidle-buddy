# 当前验证

日期：2026-10-23。开发版本0.1.0，未发布。本次范围为按游戏单页面运行移除跨页面存储监听及两项对应grant，保留写入前revision检查、串行保存和坏存档保护；规则见[面板设计](../docs/panel.md)。以下均为本次实施及提交清理范围实际执行的结果；测试整理后重跑storage与debug-menu，其他浏览器场景沿用本次实施阶段结果，未声称再次运行。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 构建 | 通过，userscript 912820字节 | dist/manifest.json |
| storage | 5项通过 | [日志](validation/storage.log) |
| debug-menu | 8项通过 | [日志](validation/debug-menu.log) |
| game-integration | 16项通过 | [日志](validation/game-integration.log) |
| browser | 44项通过 | [日志](validation/browser.log) |
| panel-geometry | 21项通过 | [日志](validation/panel-geometry.log) |
| 浏览器专项合计 | 4场景、89项通过 | [摘要](validation/summary.json) |
| 静态检查 | 文档链接、源文件语法、五项grant、无监听残留、构建摘要及差异空白通过 | [日志](validation/static.log) |

脚本仅声明unsafeWindow、GM_getValue、GM_setValue、GM_xmlhttpRequest和GM_setClipboard；实际打包入口在没有GM存储监听API的夹具中正常启动、切换角色及保存。已清除平台订阅、存档watch、writer标记、调试开关远端订阅及相关测试，不增加替代轮询。

存储专项覆盖坏存档保护、revision不一致拒绝覆盖与重新载入恢复、意外删除保护、串行合并和卸载前等待保存。浏览器覆盖本页调试开关、启用与关闭状态的刷新恢复、角色／站点隔离、存储异常、预填异步取消、实时同步、订单、双语、窄屏与布局保存。市场／制造／采集仅预填，无购买或角色动作提交。

安装脚本SHA-256：`c6c295ae227ab9707da29c07a2a1fcb3bc5b85c5577a479c3c341b880666f914`。本次只运行受影响专项，没有重跑无关单元或完整UI套件。浏览器使用本地隔离夹具，未进行本轮真实游戏、脚本管理器或生产验收；未部署、未更新已安装脚本。

此前真实Chrome接入证据见[接入验收](game-integration-validation.md)，不作为本轮重跑结果。
