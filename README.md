# Deep Vein Idle · Buddy

游戏内制造与收藏混合订单工具，userscript + Shadow DOM，只读同步游戏快照。

```sh
npm ci
npm test
npm run build
npm start
```

打开终端打印的本地地址体验演示；安装 dist/deepveinidle-buddy.user.js 后刷新游戏，等待角色快照。演示不读取真实账号，不与游戏 GM 存档共享。脚本同时支持国际站与中文站。

[设计](DESIGN.md) · [状态](docs/status.md) · [调研](reports/research.md) · [来源](docs/technical.md)

## 安装与操作

构建后在脚本管理器安装 `dist/deepveinidle-buddy.user.js`，刷新国际站或中文站。首次必须等待新连接的角色快照；没有稳定角色 ID 时显示错误并保护存档，不开新连接。当前候选未完成真实管理器验收。

面板中选“制造”填写次数，或选“收藏”加入目标档；它们加入同一个当前订单。订单列表的勾选决定执行汇总，点击名称只切换编辑。执行计划使用共享库存。关闭“跟随游戏配置”可试配，收藏进度和库存仍随快照更新。旧实验室的计划须显式导出后通过文本或文件导入，不跨站读取存储。

`npm run test:browser` 需先启动演示服务并安装 Chrome；可用 `CHROME_PATH`、`BUDDY_URL` 覆盖默认路径和地址。截图及日志写入 `.test-artifacts/`，交付证据从[实施报告](reports/implementation.md)查阅。

当前引擎为 **1.0.1199**；游戏页面已提示 1.0.1200，本次未核验该更新。工具不会自动识别并同步新游戏计算代码。
