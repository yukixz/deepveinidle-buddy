import {build} from 'esbuild';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const version=JSON.parse(await fs.readFile('package.json','utf8')).version;
const upstream=JSON.parse(await fs.readFile('vendor/manifest.json','utf8'));
const upstreamProvenance={name:'upstream-provenance',setup(builder){
 builder.onLoad({filter:/[/\\]src[/\\]engine[/\\]upstream\.js$/},async({path})=>({
  loader:'js',
  contents:`/*!
 * 上游游戏代码：本段计算规则及数据提取自 Deep Vein Idle 发布资源。
 * 本段混淆形式及缩短的标识符来自上游游戏代码，本项目未额外混淆。
 * Upstream game code; shortened identifiers originate from the game's published bundle.
 * Source URL: ${upstream.sourceUrl}
 * Game version: ${upstream.changelogVersion}
 * Source SHA-256: ${upstream.sha256}
 */\n${await fs.readFile(path,'utf8')}`,
 }));
}};
await fs.mkdir('dist',{recursive:true});
const header=`// ==UserScript==
// @name         Deep Vein Idle · 工匠与精通助手
// @name:en      Deep Vein Idle · Crafting & Mastery Buddy
// @namespace    https://dvi-lab.pages.dev
// @author       Alice
// @version      ${version}
// @description  游戏内制造与收藏混合订单助手；实时同步角色数据，汇总采购材料与执行计划。
// @match        https://deepveinidle.com/*
// @match        https://cn.deepveinidle.com/*
// @run-at       document-start
// @noframes
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      deepveinidle.com
// ==/UserScript==\n`;
for(const [entry,outfile] of [['src/userscript.js','dist/deepveinidle-buddy.user.js'],['src/demo.js','dist/demo.js']]){
 await build({entryPoints:[entry],outfile,bundle:true,format:'iife',target:'es2022',minify:false,legalComments:'inline',plugins:[upstreamProvenance],loader:{'.css':'text'},banner:{js:entry.includes('userscript')?header:''}});
}
const files=await Promise.all(['deepveinidle-buddy.user.js','demo.js'].map(async name=>{const bytes=await fs.readFile('dist/'+name);return {name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};}));
await fs.writeFile('dist/manifest.json',JSON.stringify({version,engine:'1.0.1199',files},null,2)+'\n');
console.log(JSON.stringify({version,files}));
