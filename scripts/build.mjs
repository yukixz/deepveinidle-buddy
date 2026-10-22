import {build} from 'esbuild';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const version=JSON.parse(await fs.readFile('package.json','utf8')).version;
await fs.mkdir('dist',{recursive:true});
const header=`// ==UserScript==
// @name         Deep Vein Idle · Buddy 制造与收藏助手
// @namespace    deepveinidle-buddy
// @version      ${version}
// @description  游戏内制造与收藏混合订单；只读角色快照，不发送游戏命令。
// @match        https://deepveinidle.com/*
// @match        https://cn.deepveinidle.com/*
// @run-at       document-start
// @noframes
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      deepveinidle.com
// ==/UserScript==\n`;
for(const [entry,outfile] of [['src/userscript.js','dist/deepveinidle-buddy.user.js'],['src/demo.js','dist/demo.js']]){
 await build({entryPoints:[entry],outfile,bundle:true,format:'iife',target:'es2022',minify:false,loader:{'.css':'text'},banner:{js:entry.includes('userscript')?header:''}});
}
const files=await Promise.all(['deepveinidle-buddy.user.js','demo.js'].map(async name=>{const bytes=await fs.readFile('dist/'+name);return {name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};}));
await fs.writeFile('dist/manifest.json',JSON.stringify({version,engine:'1.0.1199',files},null,2)+'\n');
console.log(JSON.stringify({version,files}));
