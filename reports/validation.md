# 当前验证

日期：2026-10-23。开发版本0.1.0，未发布。本次仅通过构建插件为上游游戏代码段增加来源注释，未修改生成的upstream.js，也未改为外部加载。规则见[技术方案](../docs/technical.md)。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 构建 | 通过，userscript 913297字节 | dist/manifest.json |
| 来源注释 | userscript及demo均位于上游代码段内，URL／版本／SHA-256与vendor/manifest.json一致 | [日志](validation/build-provenance.log) |
| 代码一致性 | 两个产物与未注入来源注释的对照构建的可执行AST相同，仅忽略源位置字段；解析不包含注释 | [日志](validation/build-provenance.log) |
| 静态检查 | 文档链接、构建脚本语法、五项grant、构建摘要及差异空白通过 | [日志](validation/static.log) |

注释说明短标识符／混淆形式来自上游游戏发布代码，本项目未额外混淆；来源为[已核验的游戏发布资源](https://deepveinidle.com/assets/index-CsTNPJ8i.js)。

安装脚本SHA-256：`19120a4e45f3e6fe1334ba16abe38e75fa4e01e4ff2ccf7f44ac4a2d408db36d`。本次为注释变更，未重跑运行逻辑、浏览器或真实游戏验收；未部署、未更新已安装脚本。此前真实Chrome接入证据见[接入验收](game-integration-validation.md)，不作为本轮重跑结果。
