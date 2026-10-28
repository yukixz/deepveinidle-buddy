# 构建与发布

仓库：[yukixz/deepveinidle-buddy](https://github.com/yukixz/deepveinidle-buddy)。Greasy Fork脚本ID：601896。

## 日常入口

```sh
npm run release -- prepare patch --notes-file /绝对路径/更新说明.md
npm run release -- publish
npm run release -- watch
```

- `prepare`：更新package.json、package-lock.json、README、状态页版本和CHANGELOG，运行锁定依赖安装、单元、构建及完整浏览器验证。测试服务使用独立临时端口；说明文件只含本次更新条目，不含版本标题。
- `publish`：须有用户发布授权。核对准备时的HEAD和文件内容，提交摘要列出的改动，绑定最终提交重新构建并校验，推送main及版本tag，等待CI、Release和Greasy Fork核验。
- `watch`：继续等待与核验，不提交、推送或触发发布。

正常只读阶段变化和最终摘要。统一结果为 `.test-artifacts/release-task/summary.json`，失败时按其中的阶段、原因和日志路径读取对应诊断，无需重复查询每个run或展开完整工作流。入口保留原有验证和发布门禁，失败不自动重跑。

## 中断与失败

- 准备失败保留已更新的文件；修正后用明确版本替换 `patch` 重新prepare，避免再次递增。准备后源码变化也必须重新prepare。
- 已记录提交号，且HEAD和工作区仍匹配时，可再次publish继续；不重写提交或移动已有tag。
- 等待超时可用watch继续。任务被强制结束留下 `.test-artifacts/release-task/lock` 时，确认没有任务运行后才手动删除锁。
- GitHub已发布但Greasy Fork未确认时，检查仓库Settings → Webhooks → Recent deliveries，重送对应release事件，再重跑发布作业核验。不删除Release、不降级，也不把重跑当作已完成同步。

## 发布约束

main和PR只执行验证；推送 `vX.Y.Z` tag或手动选定已有tag才发布。版本须为三个非负整数段，tag、package版本及脚本@version一致，tag提交须位于main历史中。远程工作流不修改版本、不创建tag、不覆盖已发布附件；dist不加入git。

CI运行锁定依赖安装、单元、构建、元数据与摘要校验及全部浏览器场景。Chrome由runner提供，中文字体来源固定并校验摘要。验证作业只读；发布作业独占执行，使用GitHub提供的GITHUB_TOKEN和contents:write，不需要额外PAT或Actions Secret。

发布顺序：校验构建与来源提交 → 检查线上版本及已有Release → 创建草稿 → 上传并核验附件 → 正式发布 → 有限次数确认Greasy Fork代码。任何读取、测试、版本或摘要异常均明确失败，拒绝旧版本。

固定附件为 `deepveinidle-buddy.user.js` 和 `manifest.json`。manifest保留完整构建摘要，包括未上传的演示产物。已发布版本重跑只核对；草稿仅补齐缺失附件，已有附件内容不同即失败。

## 同步与维护

仓库Webhook订阅release事件，Greasy Fork验证签名并同步代码。Webhook的URL和Secret只配置在仓库；Actions不读取Secret或发送额外通知。Greasy Fork条目所有者须配置同步地址：

```text
https://github.com/yukixz/deepveinidle-buddy/releases/latest/download/deepveinidle-buddy.user.js
```

核验比较@version与元数据块之后的脚本主体，兼容Greasy Fork重写元数据。

验收产物按workflow run ID命名并保留14天。重跑失败的发布作业可复用同次run的产物；重跑全部作业会重新验证并替换临时产物，过期后也需重新验证，正式Release附件不受影响。

需要手动操作时，更新版本和说明并完成验证，提交推送main，再为该提交创建并推送正式tag；也可手动运行Release工作流并选择已有tag。无需另建空Release。

发布测试使用隔离命令、客户端与HTTP夹具，禁止测试向真实服务写入；真实环境验证边界见[当前状态](status.md#验证边界)。
