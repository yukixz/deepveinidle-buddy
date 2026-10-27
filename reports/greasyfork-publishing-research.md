# Greasy Fork 发布方案

更新日期：2026-10-27。实现规则见[构建与发布](../docs/releasing.md)。

采用GitHub Actions验证／构建／发布Release，由GitHub仓库原生release Webhook通知Greasy Fork；Actions不处理Webhook Secret，不自行发送签名通知。

仓库为yukixz/deepveinidle-buddy，脚本条目为601896。已只读核对：仓库公开、Actions已启用，原生Webhook启用并订阅release，ping投递HTTP 200；Greasy Fork管理页保存的同步地址为固定Release附件URL。线上版本为0.2.1，本地仍为0.2.0，本次不发布新版本。

正式版本使用vX.Y.Z tag。先验证、上传完整草稿附件并核对摘要，再发布Release，最后核对Greasy Fork的版本与脚本主体。只读API不能代替发布接口；相同tag重跑只校验或补齐草稿，不能覆盖已发布附件。首次真实发布需独立验收。

依据：

- [Greasy Fork API](https://greasyfork.org/zh-CN/help/api)：JSON API只读，支持仓库Webhook同步。
- [官方Webhook配置模板](https://github.com/greasyfork-org/greasyfork/blob/main/app/views/users/webhook_info.html.erb)：支持Release附件同步地址。
- [事件与签名处理](https://github.com/greasyfork-org/greasyfork/blob/main/app/controllers/concerns/webhooks.rb)：release仅处理published动作，返回更新成功与失败列表。
- [附件匹配实现](https://github.com/greasyfork-org/greasyfork/blob/main/lib/github.rb)：按附件文件名读取browser_download_url。
- [发布规则](https://greasyfork.org/zh-CN/help/code-rules)：非压缩、可读性、大小及上游授权要求。来源注释和MIT元数据不能代替上游授权核实。
