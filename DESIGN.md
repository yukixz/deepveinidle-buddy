# 工匠精通助手设计

游戏内运行的独立userscript，使用Shadow DOM提供制造／收藏订单、采购和执行计划。

用户模式、订单、筛选与定价选择持久化；角色、库存、收藏进度、任务及行情仅保留在当前角色会话内存。未知数据明确显示，错误不得覆盖有效存档。双端共用业务规则与界面，仅在布局和输入交互需要时适配。

- [面板与计算规则](docs/panel.md)
- [模块与上游来源](docs/technical.md)
- [版本状态与验证](docs/status.md)
- [构建与发布](docs/releasing.md)

角色接入只读；用户点击后可导航并预填草稿，不提交交易或角色动作。发布为Greasy Fork脚本和GitHub Release附件，不部署独立在线应用。

保留安装命名空间https://dvi-lab.pages.dev和作者Alice。用户存档结构保持version=2；数据格式变更需要明确评估，不通过重置消除错误。
