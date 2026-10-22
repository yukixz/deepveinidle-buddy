# 技术方案

## 来源与边界

`src/engine` 保留应用和解析计算测试使用的实验室模块，源提交及逐文件摘要见 `vendor/lab-source.json`。原始游戏资源与语义提取映射见 `vendor/manifest.json`；`src/engine/upstream.js` 为生成文件，禁止手改。更新原始资源后先审查来源、版本、符号签名及摘要，再执行 `npm run extract`。来源一致性由单元测试校验。公开资源不代表开源许可。

当前计算基线为1.0.1199；本次与1.0.1200公开主程序比较了提取器使用的778项声明，源码均相同。菜单适配仅启用已核验的1.0.1200资源摘要；其他游戏资源需重新核验。原始模拟模块作为角色构造和计算对照依赖保留，面板不启动模拟或 Worker。

## 模块

- `game-sync.js`：250ms读取客户端白名单，独立保留服务器回退；不代理游戏内部方法。
- `game-prefill.js`：核验当前游戏资源摘要后，用户点击触发的市场／普通动作草稿适配；禁止购买或动作提交。
- `capture.js`：只读旁听已有同源 WebSocket，捕获器先于面板初始化，不额外连接，不发送游戏消息。
- `main.js`、`navigation.js`：按角色挂载／卸载面板及导航入口，清理监听与定时器。
- `app.js`、`theme.css`：Shadow DOM 内订单、筛选、共享定价和中文输入保护；不代理全局 document 或修改原游戏代码。
- `workspace.js`、`crafting-estimates.js`：严格当前模型、解析动作／费用、合并采购与高亮。
- `collection-sorting.js`、`table-sorting.js`：全精度稳定排序，未知值置末。
- `fee-units.js`：界面 M／M/h 与金币／金币每分钟基础单位换算。
- `plan-transfer.js`：固定 DVILAB-PLAN 的 gzip／Base64 封装，应用层校验当前单订单结构。
- `storage.js`、`panel-geometry.js`：GM revision 保护、独立布局存储、拖动与四边缩放。
- `platform.js`：浏览器／GM 存储及剪贴板适配；写入使用 GM_setClipboard，读取由点击触发 navigator.clipboard.readText。

助手网络用于固定公开市场 API及核验已加载同源主程序摘要，禁用凭据；用户点击导航产生的游戏市场只读查询允许。不读取登录信息或聊天。GM 无原子比较交换，跨标签版本检查为尽力检测。真实管理器权限、注入时机与长期性能需独立验证。

## 开发验证

`npm test` 运行当前单元、计算对照、来源摘要及存储校验。启动演示服务后执行 `npm run test:ui`；统一入口为 `scripts/test-ui.mjs`，各场景共用浏览器配置，完整输出在 `.test-artifacts/verification/`。`game-integration`覆盖真实打包入口、客户端切角及慢GM读取竞态、原生IME期间只读更新、预填拒绝和无动作提交；其游戏控件与GM为隔离夹具，真实Chrome验证另记。可单独传入场景名复验。`npm run build` 将应用直接打包进 userscript，不远程加载助手代码；游戏主程序只下载用于摘要校验，不执行下载内容。

项目处于开发阶段，仅接受当前数据结构，不维护历史兼容和迁移。发布授权与真实环境验证完成前不部署。
