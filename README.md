# 工匠精通助手 · Crafting & Mastery Buddy

在Deep Vein Idle游戏内运行的userscript，提供制造／收藏混合订单、材料采购与执行计划。版本 **0.3.2**，计算基线 **1.0.1204**。

[安装与更新](https://greasyfork.org/zh-CN/scripts/601896-deepveinidle-buddy) · [GitHub Releases](https://github.com/yukixz/deepveinidle-buddy/releases)

## 使用

从游戏导航打开助手，选择配方或收藏目标加入订单。制造填写执行次数，收藏按已有进度估算期望执行量；勾选参与计划的订单，即可查看合并采购、预计时间和费用。

材料与产物可分别选择市场卖单／买单估值，材料支持排除供应不足的候选。银行、背包及预计产物共同抵扣采购；缺少库存或行情时显示未知。订单、筛选和定价选择按角色保存，角色与行情刷新后重新读取。

桌面可拖动、缩放并保存布局；移动使用紧凑表格和横向滚动，冻结物品／品质列。关闭后重开保留本页输入与滚动，刷新默认关闭。语言跟随游戏。

订单支持DVI-BUDDY-PLAN文本及剪贴板导入导出。单订单文本不包含角色快照，也不是完整工作区备份。错误会保留原存档，不自动覆盖。

## 从开发版更新

0.3.0保留原安装命名空间和作者，订单文本标识改为DVI-BUDDY-PLAN。更新前请在脚本管理器备份脚本数据并导出重要订单。开发版导出的gzip/Base64订单可将冒号前的标识改为DVI-BUDDY-PLAN后，在计划文本中导入并核对内容。

若角色存档报格式错误，先备份管理器中的原值，再选择恢复或明确重置；不要把回退显示的默认订单当作已恢复的数据。

## 本地开发

```sh
npm ci
npm test
npm run build
npm start
```

演示使用合成角色和独立存储，不连接游戏账号。启动本地服务后执行npm run test:ui验证浏览器场景。GitHub Actions执行相同检查；发布步骤见[构建与发布](docs/releasing.md)。

[设计](DESIGN.md) · [面板规则](docs/panel.md) · [技术方案](docs/technical.md) · [状态与验证边界](docs/status.md) · [更新说明](CHANGELOG.md)
