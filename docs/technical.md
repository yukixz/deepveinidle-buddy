# 技术方案

src/engine 复用 deepveinidle-lab main 的 1199 计算模块，源码来源和摘要见 vendor/manifest.json。原始资源归游戏作者，公开资源不代表开源许可。使用 scripts/extract.mjs 校验完整来源后生成 src/engine/upstream.js，不手改生成代码。原始计算不依赖账号。

新增模块使用依赖注入和 root 内查询；不代理全局 document，不修改原游戏资源。构建使用固定版本 esbuild，将应用和无外部 import 的 Worker 装入 userscript。捕获器先于 UI 初始化，元数据仅匹配两个游戏域名且 noframes。GM 只存订单／偏好／价格及必要配置，角色 ID 分桶；本地演示的 storage 独立。

网络仅用于固定公开市场 API，禁用凭据；只旁听既有同源 WebSocket，不发送任何消息。Blob Worker 失败明确提示，不退回主线程执行逐刻模拟。UI 卸载终止 Worker、释放 URL 并清理监听。

旧实验室参考设计快照位于 docs/reference；其中指向实验室的文档链接属于原仓库语境，不作为本项目当前规则。新项目入口以 DESIGN.md 为准。
