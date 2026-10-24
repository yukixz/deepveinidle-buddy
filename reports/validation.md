# 当前验证

日期：2026-10-24。开发版本0.1.0，未发布。本轮覆盖收藏成本显示、执行次数取整及相关文档和测试整理；行为规则见[面板设计](../docs/panel.md)。

| 检查 | 本次结果 | 证据 |
| --- | --- | --- |
| 构建 | 通过，userscript 922602字节 | 本机构建 dist/manifest.json |
| workspace单元测试 | 39项通过 | [日志](validation/workspace-unit.log) |
| point-cost-filter | 5项通过 | [日志](validation/point-cost-filter.log) |
| bulk-pagination | 7项通过 | [日志](validation/bulk-pagination.log) |
| extra-sorting | 8项通过 | [日志](validation/extra-sorting.log) |
| execution-summary | 8项通过 | [日志](validation/execution-summary.log) |
| action-materials | 9项通过 | [日志](validation/action-materials.log) |
| game-integration | 28项通过 | [日志](validation/game-integration.log) |
| browser | 45项通过 | [日志](validation/browser.log) |
| 浏览器专项合计 | 7场景、110项通过 | [摘要](validation/summary.json) |
| 静态检查 | 语法、文档引用、差异空白及构建摘要通过 | [日志](validation/static.log) |

金额场景覆盖实际金币/点、两位小数及中英文K/M/B后缀、微额舍入、原有M/100筛选换算、排序与窄屏布局。执行计划覆盖烧毁后的整数次数、混合订单材料和采购金额、预计时间、费用、材料高亮、未知值及游戏预填；候选配方估算保留原始期望。

通用浏览器场景清除了过时的定价选项及金额单位断言；本轮最终结果如上。仅执行上述相关测试，未运行完整测试。原始游戏资源与生成的upstream.js未修改。

安装脚本SHA-256：`e33daf0e030265f2c2c245fd27be7898e658485a84c48eb4346466e75a55cd36`。验证使用本地Chrome隔离夹具，未在真实游戏中安装／更新脚本，未进行真实账号、脚本管理器或生产验收，未部署。
