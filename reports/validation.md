# 当前验证

日期：2026-10-24。开发版本0.1.0，分支codex/mobile-adaptation，未发布。本轮修复游戏因材料不足不生成目标品质选项时的通用控件缺失误报；在填写次数前明确拒绝。规则见[面板设计](../docs/panel.md)，根因与实页流程见[购买与执行排查](prefill-controls-validation.md)。

| 检查 | 本次结果 | 证据 |
| --- | --- | --- |
| 构建 | 通过，userscript 943315字节 | 本机构建 dist/manifest.json |
| 游戏接入专项 | 30项通过，新增双语品质不可用及次数／模式不改写检查 | [日志](validation/game-integration.log) |
| 移动专项 | 15项通过 | [日志](validation/mobile.log) |
| 桌面实页 | 两按钮及当前适配层成功路径、不可用品质提前拒绝通过 | [数据](validation/prefill-controls-live.json)、[市场](screenshots/prefill-live-market.png)、[动作](screenshots/prefill-live-action.png) |
| 静态检查 | 修改脚本语法、文档引用、构建摘要及差异空白通过 | node --check、引用／摘要脚本、git diff --check |

本地2场景共45项，本轮未执行全量测试或另跑单元测试。此前55项回退检查等为历史结果，不计入本次重跑。实页未提交购买／开始／排队／停止，未改变当前任务或队列，原动作草稿已恢复。当前适配层在局部闭包临时执行，未安装新构建或保留页面测试全局。

新构建仍需更新到游戏脚本后生效；移动端真机、管理器完整权限及长期运行尚未验收。未发布、未部署。

当前安装脚本SHA-256：`65613584a9989a5651b09ac668f684773c412b2b7691149831e29ee47a952597`。
