# 构建与发布

代码仓库：https://github.com/yukixz/deepveinidle-buddy 。Greasy Fork脚本ID为601896。


## 发布边界

main提交和PR只执行验证；推送vX.Y.Z正式版本tag或手动选定已有tag才执行发布。版本必须为三个非负整数段，tag、package.json、脚本@version一致；tag提交须位于main历史中。发布不自动修改版本、创建tag或覆盖已发布附件，不将dist加入git。

完整验证包括npm ci、单元、构建和本地浏览器场景。CI使用Ubuntu runner预装的Chrome，配置CHROME_PATH并管理本地服务器；中文字体从Noto官方仓库的固定提交下载，校验SHA-256后载入，不依赖apt字体镜像。验证失败保留日志。构建记录来源提交，生成的userscript包含构建提交标记。浏览器夹具不能代替真实脚本管理器和账号验收。

发布流程为：检查本地构建与来源提交 → 检查线上版本及已有Release → 创建草稿Release → 上传脚本及manifest.json → 校验上传内容 → 发布正式Release → 有限次数核对Greasy Fork代码。只有发布作业获得contents:write；验证作业只读。发布串行执行，并拒绝较旧版本。

GitHub仓库Webhook订阅release事件，Greasy Fork负责签名验证和代码同步。Actions不发送通知、不读取Webhook Secret，也不需要额外PAT。Greasy Fork代码同步URL必须为：

```text
https://github.com/yukixz/deepveinidle-buddy/releases/latest/download/deepveinidle-buddy.user.js
```

附件名固定为deepveinidle-buddy.user.js及manifest.json；manifest保留完整构建摘要（包括未作为Release附件上传的演示产物）。发布前校验脚本大小、元数据、来源提交及摘要。Greasy Fork可能重写元数据，远端一致性比较使用@version与元数据块之后的脚本主体。

## 使用

1. 在main提交中更新package.json和package-lock.json的版本，完成适用范围的功能与数据验收，如实记录真实环境验证边界。
2. 推送main，再为该提交创建vX.Y.Z tag并推送该tag。明确推送发布tag就是启动该版本的自动发布，不需要再创建空Release。
3. 在Actions查看CI、Release及Greasy Fork核对结果。仓库Webhook必须启用且目标正确；Greasy Fork同步地址由条目所有者配置。

手动运行Release工作流时，输入已有tag，仅允许相同规则的正式版本。重跑时，草稿可补齐缺少的附件；已有附件内容不同则失败。已发布版本只核对，不替换附件或重复发布事件。若GitHub已发布但Greasy Fork未更新，先在Settings → Webhooks的Recent deliveries检查并重送对应release事件，再重跑工作流核对；不能靠重跑工作流伪造已完成同步。

验收产物按workflow run ID命名，重跑失败的发布作业可复用原产物；重跑全部作业会重新验收并替换同一次run的临时产物，不影响正式Release附件。临时产物保留14天，过期后需重跑全部作业。

本方案没有需要用户填写的Actions Secret。GitHub自动提供发布用GITHUB_TOKEN。Webhook自身的URL和Secret仅配置在仓库Webhook中。

## 失败与验证

任何测试、版本、摘要、上传或线上读取失败均明确报错。创建草稿前完成线上可达性与版本检查；正式发布后的同步失败明确区分“GitHub已发布”和“Greasy Fork未确认”，不自动删除Release或降低线上版本。

实现需覆盖版本与元数据校验、摘要不一致、上传顺序、草稿恢复、已发布重跑、旧版本阻止以及同步失败。发布脚本测试使用隔离客户端与HTTP响应夹具，禁止测试向真实GitHub或Greasy Fork发起写入；首次真实发布仍须单独验收。
