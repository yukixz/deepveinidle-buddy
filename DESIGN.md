# 工匠精通助手设计

游戏内运行的独立 userscript，使用 Shadow DOM 提供制造订单、收藏规划、采购和执行计划。

用户模式、订单、筛选与定价选择持久化；角色、库存、收藏进度、任务及行情仅保留在当前角色会话内存。未知数据明确显示，错误不得覆盖有效存档。双端共用业务规则与界面，仅在布局和输入交互需要时适配。

- [面板与计算规则](docs/panel.md)
- [按技能绑定的精通页估算](docs/superpowers/specs/2026-11-12-skill-mastery-pages-design.md)
- [收藏（制造）考虑自制半成品](docs/superpowers/specs/2026-11-12-consider-crafting-intermediates-design.md)
- [大额预估金额与异常隔离](docs/superpowers/specs/2026-11-13-large-amount-estimates-design.md)
- [模块与上游来源](docs/technical.md)
- [版本状态与验证](docs/status.md)
- [构建与发布](docs/releasing.md)

角色接入只读；用户点击后可导航并预填草稿，不提交交易或角色动作。发布为Greasy Fork脚本和GitHub Release附件，不部署独立在线应用。

用户存档保持 `version=2`；兼容与恢复规则见[存储与恢复](docs/panel.md#存储与恢复)，安装元数据见[技术方案](docs/technical.md#运行接入)。
