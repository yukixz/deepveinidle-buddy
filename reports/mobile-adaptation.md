# 游戏移动端适配调研

历史调研日期：2026-10-24；对象为当时的bcf1279代码及游戏公开资源。本文保留静态资源、入口缺口和离线复现依据，以下方案属于调研时建议，后续需求已调整。现行入口、窗口边界、标题、长按菜单和预填反馈统一以[面板设计](../docs/panel.md)为准；当前状态与本次重跑见[当前状态](../docs/status.md)、[当前验证](validation.md)。

## 结论

调研支持沿用 userscript、Shadow DOM 和计算模块，双端共用UI。原分阶段实施建议已由现行面板设计取代，不在本文重复维护；以下仅保留调研依据和真机验收边界。

调研前390px窄屏验证只能说明合成页面中的布局可收缩，不能说明游戏移动模式、手机软键盘或脚本管理器已兼容。调研发现的入口不可见问题后来已修复；以下表格保留当时的问题分析依据。

## 已核验事实

### 游戏移动模式有独立界面

核对当日[公开主程序](https://deepveinidle.com/assets/index-t_ec2EGN.js)和[公开样式](https://deepveinidle.com/assets/index-vH25gT_y.css)，下载来源和摘要见[资源记录](validation/mobile-public-assets.json)。资源名已不同于此前接入验收，本文只核验移动界面结构，没有重新比较计算声明或更新计算基线。

- 移动模式条件是 `(max-width: 640px), (pointer: coarse) and (max-height: 640px)`。既包含手机竖屏，也包含宽度超过640px的触屏横屏。
- 游戏在根元素设置 `.m-on`，以 `.m-shell` 提供移动页面；`.m-on .nav-strip` 被设为 `display:none`。
- 底部 `[data-m-tabs]` 包含 play、bag、bank、market、more；“更多”内容位于 `.m-shell [data-view="more"] .m-more`，按钮采用 `.m-menu`。
- 游戏会把原有顶部栏、路线、技能、装备、背包等节点移到移动容器，不是所有页面都另建一份控件。
- `.m-shell` 层级5，`.m-sub` 层级25，`.m-tabs` 层级30；移动顶部基本高度46px、底部基本高度58px，另计算安全区域。实际边界应测量DOM，不能只写死这些数值。
- 市场底栏入口通过 `[data-m-tab="market"]` 打开；桌面 `[data-open="market"]` 在隐藏导航中。

上述为静态代码事实，不代表已在登录手机上完整执行过所有路径。

### 调研时助手的具体缺口

| 范围 | 调研时实现 | 移动端影响 |
| --- | --- | --- |
| 开启入口 | `navigation.js` 只向桌面 `nav[aria-label]` 注入图标 | 游戏移动模式下按钮随父导航隐藏，关闭后无法从此处重新打开 |
| 模式识别 | `theme.css` 只按680px窄屏设置样式 | 与游戏640px／触屏横屏条件不一致 |
| 面板几何 | `panel-geometry.js` 使用 `innerWidth/innerHeight`，避让 `header.top,.ui-toolbar` | 没有显式考虑底部移动导航、可视视口及软键盘；顶部已有部分复用，但仍需测量验证 |
| 触摸操作 | 标题拖动、6px边缘缩放；紧凑按钮、表格12px，窄屏正文更小 | 容易误触；窗口拖动和缩放未必适合手机 |
| 状态说明 | 材料、执行和队列说明依赖 `title` | 触屏缺少可靠悬停查看方式 |
| 调试入口 | 只有标题右键菜单 | 手机长按可能触发浏览器菜单，且标题已用于拖动，不能作为稳定入口 |
| 市场预填 | 查找可见 `[data-open="market"]` | 移动模式首次打开市场的路径不能直接复用桌面选择器 |
| 动作预填 | 调用现有 panels/routes 后验证可见控件 | 虽复用路线节点，目标可能仍处于未激活的移动页面；需显式验证页面切换和可见性 |
| 导入 | 通过 `navigator.clipboard.readText()` 读剪贴板 | HTTPS、用户授权及浏览器权限均可能影响；不应只提供自动读取 |
| 管理器 | 当前入口直接引用 `unsafeWindow` 和旧式 `GM_*` | 不能从“能安装扩展”推断当前脚本的页面访问与权限已正常 |

本次用当前公开CSS和调研时助手导航代码（bcf1279）运行最小离线DOM复现：390×844、844×390且粗指针时，桌面导航为none，助手按钮无可见面积；1024×768粗指针时移动条件不成立，按钮可见。见[探针结果](validation/mobile-layout-probe.json)。该实验没有运行游戏JS，也没有模拟完整游戏状态或真实手机。

## 浏览器与脚本管理器路线

建议先选择Android Firefox＋Tampermonkey作为真机基线，再单独核验iOS Safari＋Tampermonkey。Mozilla官方扩展页明确列出[Firefox Android可用](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)，Tampermonkey官网列出[iOS 15+版本](https://www.tampermonkey.net/)。这两点只确认安装候选，不是助手兼容结论；不推断任意系统浏览器或主屏幕PWA都能运行脚本。

每个平台分别验证document-start注入、`unsafeWindow`页面状态访问、五项GM权限、公开行情请求、保存、复制及用户粘贴。未验证前不宣称兼容，也不以localStorage替代正式GM存档。Safari Userscripts若作为后续候选，需要单独适配API及脚本上下文；其[项目文档](https://github.com/quoid/userscripts#api)区分content/page上下文和异步GM API，不能当作现有userscript的无改动替换。

软键盘可能改变可视视口而不改变布局视口，见[MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)。安全区域使用[CSS env](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env)。[剪贴板读取](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/readText)有权限与安全上下文约束。[WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)给出的最低目标通常为24×24 CSS px并有例外，44px是本方案为触摸提出的产品目标。

## 后续验收与边界

- 离线夹具应包含真实移动DOM层次、`.m-on`切换、隐藏桌面导航、底栏、更多页及路线节点搬移；不再只改变viewport宽度。
- 尺寸覆盖320、360、390、430px竖屏，触屏横屏、平板与桌面模式切换；明确640px及粗指针横屏条件，保留桌面导航回归。
- 真机覆盖中文／英文、键盘弹出收起、地址栏伸缩、安全区域、长名称、大字号、文本选择、表格滑动及状态详情；关闭后能重新打开，当前编辑不丢失。
- 订单及偏好保存失败明确显示；GM延迟读取、切角、恢复布局以及连续模式切换不串档、不覆盖桌面布局。
- 预填另验两种入口、已有草稿、重复tab点击、可见控件唯一性、输入读回和零动作提交。
- 性能继续采用现有250ms只读采样和稳定节点更新，记录真机输入、滚动和实时更新延迟；不先增加另一条轮询或重建整个面板。

本次实际执行：当前仓库代码阅读、游戏公开HTML／CSS／JS静态检查、官方浏览器资料核对、3种尺寸的离线入口可见性复现、文档引用与差异检查。未运行完整助手测试；未连接登录账号、未建立游戏WebSocket、未做真实手机或脚本管理器验收，未修改功能、未发布。
