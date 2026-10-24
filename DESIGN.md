# 工匠精通助手 · Crafting & Mastery Buddy 设计

独立 userscript，在游戏内使用 Shadow DOM 提供只读同步的制造／收藏混合订单助手。

项目处于开发阶段，仅支持当前数据结构和 DVILAB-PLAN 单订单格式；不保留旧存档、旧筛选、旧定价或实验室计划的兼容与迁移分支。

- [面板与计算规则](docs/panel.md)
- [技术方案与原始资源](docs/technical.md)
- [当前状态与验证](docs/status.md)
- [架构调研](reports/research.md)
- [当前验证](reports/validation.md)

角色数据只读，前台客户端相关字段变化后1秒内同步；允许用户点击后导航和预填市场／普通制造／采集草稿，禁止提交购买或角色动作。不部署独立在线应用。接入边界见[面板设计](docs/panel.md#游戏同步与草稿预填)。
