# 当前验证

日期：2026-10-24。开发版本0.1.0，未发布。本次仅调整userscript元数据：默认name为纯ASCII的“Deep Vein Idle - Buddy”，新增license MIT；规则见[面板设计](../docs/panel.md)。

| 检查 | 本次结果 | 证据 |
| --- | --- | --- |
| 构建 | 通过，userscript 928631字节 | 本机构建 dist/manifest.json |
| 元数据断言 | 通过 | [日志](validation/metadata.log) |
| 静态检查 | 修改脚本语法、文档引用、差异空白及构建摘要通过 | [日志](validation/static.log) |

单独执行debug-menu测试中的构建元数据断言，覆盖默认名称及ASCII字符约束、中文与英文名称、MIT许可、中英文description、namespace、author、grant和公开描述约束。本次未重跑浏览器场景或计算、存储等单元测试。

此前行情内存存储调整的50项单元测试和2场景36项浏览器检查为历史结果，见[单元日志](validation/market-storage-unit.log)、[行情专项](validation/market-storage.log)、[游戏接入专项](validation/game-integration.log)及[摘要](validation/summary.json)，不计入本次重跑结果。未在真实脚本管理器或游戏环境验收，未部署。

安装脚本SHA-256：`ea4ed9da558b96b4b437acdbd45a356b2b9a43d2d50df092807803c6e67f1d6b`。
