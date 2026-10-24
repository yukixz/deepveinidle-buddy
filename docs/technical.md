# 技术方案

## 来源与边界

`src/engine` 保留应用和解析计算测试使用的实验室模块，源提交及逐文件摘要见 `vendor/lab-source.json`。原始游戏资源与语义提取映射见 `vendor/manifest.json`；`src/engine/upstream.js` 为生成文件，禁止手改。更新原始资源后先审查来源、版本、符号签名及摘要，再执行 `npm run extract`。来源一致性由单元测试校验。公开资源不代表开源许可。

构建时在userscript和演示产物的上游代码段保留来源注释，说明短标识符／混淆形式来自游戏发布代码，本项目未额外混淆；来源URL、游戏版本和SHA-256直接取自 `vendor/manifest.json`。注释由构建注入，不修改生成的upstream.js，不改为外部加载。

当前计算基线为1.0.1199；接入验收时与1.0.1200公开主程序比较了提取器使用的778项声明，源码均相同。菜单适配不按主程序版本或摘要限制预填，依靠运行时控件及输入读回校验。原始模拟模块作为角色构造和计算对照依赖保留，面板不启动模拟或 Worker。

## 模块

- `execution-status.js`：规范化只读任务状态，按配方／稀有度匹配执行动作；仅用于实时高亮，不进入角色存档或计划计算。
- `game-sync.js`：250ms读取客户端白名单，与capture共享角色／任务字段裁剪，独立保留服务器回退；不代理游戏内部方法。
- `debug-menu.js`：标题栏空白处右键菜单，按站点保存默认关闭的调试开关，在本页应用且挂载时读取；控制预填操作列和事件入口，开关变更使正在等待的预填失效。
- `game-prefill.js`：用户点击触发的市场／普通动作草稿适配；禁止购买或动作提交。
- `capture.js`：只读旁听已有同源 WebSocket，捕获器先于面板初始化，不额外连接，不发送游戏消息。
- `main.js`、`navigation.js`：按角色挂载／卸载面板及导航入口，清理监听与定时器。
- `app.js`、`theme.css`：Shadow DOM 内订单、筛选与共享定价；`stable-view.js`统一复用界面及控件节点，局部更新属性和文字，交互期间延后结构变化。输入确认共用普通处理函数，不保留输入法专用重绘分支。不代理全局 document 或修改原游戏代码。
- `workspace.js`、`crafting-estimates.js`：严格当前模型、解析动作／费用、合并采购与高亮。`planned-products.js`复用原始产出与品质规则，按计划整数次数汇总预计产物，仅用于采购抵扣。
- `collection-sorting.js`、`table-sorting.js`：全精度稳定排序，未知值置末。
- `recipe-availability.js`：按候选的完整物品ID和材料总需求检查卖单供应，仅影响配方候选及批量加入，不修改提取的计算模块或已有订单。
- `fee-units.js`：界面 M／M/h 与金币／金币每分钟基础单位换算。
- `plan-transfer.js`：固定 DVILAB-PLAN 的 gzip／Base64 封装，应用层校验当前单订单结构。
- `storage.js`、`panel-geometry.js`：GM revision 保护、独立布局存储、拖动与四边缩放。
- `platform.js`：浏览器／GM 存储及剪贴板适配；写入使用 GM_setClipboard，读取由点击触发 navigator.clipboard.readText。

助手网络用于固定公开市场 API，禁用凭据；用户点击导航产生的游戏市场只读查询允许。不读取登录信息或聊天。按游戏单页面范围，不使用GM存储变更监听或替代轮询；仅保留写入前revision检查，不能作为原子比较交换。真实管理器权限、注入时机与长期性能需独立验证。

userscript仅声明 `unsafeWindow`、`GM_getValue`、`GM_setValue`、`GM_xmlhttpRequest` 和 `GM_setClipboard` 五项grant；无存储监听权限。

userscript安装元数据使用 `@namespace https://dvi-lab.pages.dev` 和 `@author Alice`；默认名称与中英文名称按面板设计分别声明，默认安装描述使用中文并提供英文description:en；安装描述仅介绍常规用户功能。

## 开发验证

`npm test` 运行当前单元、计算对照、来源摘要及存储校验。启动演示服务后执行 `npm run test:ui`；统一入口为 `scripts/test-ui.mjs`，各场景共用浏览器配置，完整输出在 `.test-artifacts/verification/`。`stable-view`覆盖节点持续连接、无变化不修改DOM、编辑草稿与选择范围、原生select选项保留、滚动／指针／文本选择期间延后结构变化及即时禁用状态；`debug-menu`覆盖安装名称、公开描述无调试介绍、默认面板无预填说明、隐藏操作列、调试开关及存储保护；`game-integration`覆盖真实打包入口、客户端切角及慢GM读取竞态、原生IME期间只读更新、预填拒绝和无动作提交；其游戏控件与GM为隔离夹具，真实Chrome验证另记。可单独传入场景名复验。`npm run build` 将应用直接打包进 userscript，不远程加载助手代码。

项目处于开发阶段，仅接受当前数据结构，不维护历史兼容和迁移。发布授权与真实环境验证完成前不部署。
