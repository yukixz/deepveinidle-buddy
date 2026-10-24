# 当前验证

日期：2026-10-24。开发版本0.1.0，未发布。本轮将界面更新统一为稳定节点与局部协调，移除输入法专用重绘路径；规则见[面板设计](../docs/panel.md)。

| 检查 | 本次结果 | 证据 |
| --- | --- | --- |
| 构建 | 通过，userscript 927798字节 | 本机构建 dist/manifest.json |
| stable-view | 7项通过 | [日志](validation/stable-view.log) |
| recipe-availability | 9项通过 | [日志](validation/recipe-availability.log) |
| debug-menu | 8项通过 | [日志](validation/debug-menu.log) |
| game-integration | 28项通过 | [日志](validation/game-integration.log) |
| browser | 45项通过 | [日志](validation/browser.log) |
| orders-tables-ime | 18项通过 | [日志](validation/orders-tables-ime.log) |
| fee-captions | 7项通过 | [日志](validation/fee-captions.log) |
| point-cost-filter | 5项通过 | [日志](validation/point-cost-filter.log) |
| bulk-pagination | 7项通过 | [日志](validation/bulk-pagination.log) |
| extra-sorting | 8项通过 | [日志](validation/extra-sorting.log) |
| action-materials | 9项通过 | [日志](validation/action-materials.log) |
| execution-summary | 9项通过 | [日志](validation/execution-summary.log) |
| order-row-toggle | 7项通过 | [日志](validation/order-row-toggle.log) |
| panel-geometry | 26项通过 | [日志](validation/panel-geometry.log) |
| table-scroll | 7项通过 | [日志](validation/table-scroll.log) |
| navigation | 11项通过 | [日志](validation/navigation.log) |
| 浏览器合计 | 16场景、211项通过 | [摘要](validation/summary.json) |
| 静态检查 | 修改脚本语法、文档引用、差异空白及构建摘要通过 | [日志](validation/static.log) |

新增stable-view场景检查无变化不修改DOM、滚动容器和控件节点持续连接、编辑草稿与选择范围、聚焦select的选项保持、活动控件祖先的结构延后、滚动／指针／文本选择期间合并更新。延后结构变化时，空提示区到错误文本、按钮禁用及其他数值仍即时更新；指针释放或交互结束后按最新状态复用及重排节点。

原生组合输入场景检查共享渲染器在组合期间更新语言、库存和任务高亮，输入节点保持连接，确认文本保存正确。Chromium确认时最后一个input仍可能带isComposing，随后compositionend直接交给普通输入函数；没有独立的组合状态、刷新分支或滚动位置重置。

其余面板场景覆盖筛选与批量加入、表格排序和条目操作、费用、采购与预填、窗口布局及导航。关闭改为隐藏并保留内容节点；已有测试同步这一行为。两处既有金额／工时说明断言和README公开说明已与当前规则统一。

本轮实施时运行全部16个浏览器场景，共211项通过。提交前清理统一协调器命名、滚动等待常量及测试夹具排版，移除订单条目未使用的行号属性，复用与操作共用稳定条目标识；重新构建并复验stable-view、orders-tables-ime和extra-sorting，3场景共33项通过，表内对应日志为清理后的结果，其余场景未重复运行。未重跑计算、来源摘要等单元测试。原始游戏资源与生成的upstream.js未修改。

安装脚本SHA-256：`bd1ba9a6f2a164e2ee7e98488ce7b3434f7dcde1db252dd63a06e194cb3d5362`。验证使用本地Chrome及隔离游戏／GM夹具；组合输入通过CDP触发。未手动验收真实系统输入法候选窗口、触控板惯性和脚本管理器环境，也未在真实游戏中安装／更新或部署。
