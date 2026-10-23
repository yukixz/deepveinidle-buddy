# 当前验证

日期：2026-10-23。开发版本0.1.0，未发布。本次范围为读取角色路线／队列并在执行动作表标记当前任务和排队任务；规则见[面板设计](../docs/panel.md)。

| 检查 | 本次结果 | 证据 |
| --- | --- | --- |
| 构建 | 通过，userscript 919067字节 | dist/manifest.json |
| capture / game-sync / execution-status / storage | 26项通过 | [日志](validation/execution-status-unit.log) |
| game-integration | 23项通过 | [日志](validation/game-integration.log) |
| action-materials | 7项通过 | [日志](validation/action-materials.log) |
| browser | 44项通过 | [日志](validation/browser.log) |
| 浏览器专项合计 | 3场景、74项通过 | [摘要](validation/summary.json) |
| 静态检查 | 文档链接、源文件语法、构建元数据与摘要、无生成引擎修改、差异空白通过 | [日志](validation/static.log) |

覆盖服务端／客户端任务字段裁剪、无敏感附加字段或可变游戏对象引用、固定稀有度制造匹配、采集按配方匹配、优先高品质队列、紫色当前任务优先、队列暂停、任务清空、非法结构及恢复。队列与路线变化不依赖角色其他数据变动即可在1秒内更新，游戏任务不进入角色存档，也不改变计划数量／金额／时间；输入法期间保持输入节点并刷新任务标记，旧服务器快照回退清除实时高亮。

材料高亮与执行状态共存截图见[执行动作表](screenshots/execution-status.png)，来自隔离客户端夹具，已检查紫色正在执行／蓝色已排队边框和绿色材料底色同时显示。悬停中英文状态及材料提示通过检查。最终颜色调整后重跑game-integration并更新截图，代码整理后重跑上述单元；action-materials与browser为本次实施阶段实际检查，没有声称重复运行。

安装脚本SHA-256：`d6ef2eb0951f048963107aac19c5ecc702c9781ef4a8b17172c000b75d047c12`。本次未重跑无关单元或完整UI套件；没有在真实游戏中安装／更新新脚本，没有进行本轮真实游戏高亮验收。未部署。

此前真实Chrome接入证据见[接入验收](game-integration-validation.md)，不作为本轮重跑结果。
