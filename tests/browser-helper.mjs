import {chromium} from 'playwright-core';
import {readFile} from 'node:fs/promises';
export const gameVersion=JSON.parse(await readFile(new URL('../vendor/manifest.json',import.meta.url),'utf8')).changelogVersion;
export const appVersion=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
export const baseUrl=process.env.BUDDY_URL??'http://127.0.0.1:4178';
export const launchBrowser=()=>chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
export async function toggleGameLanguage(page){
 await page.evaluate(async()=>{
  const {gameLanguage}=await import('/src/game-language.js');
  const language=gameLanguage(document)==='zh'?'en':'zh';
  document.documentElement.lang=language;
  const nav=document.querySelector('nav[aria-label="Game navigation"],nav[aria-label="游戏导航"]');
  if(nav)nav.setAttribute('aria-label',language==='zh'?'游戏导航':'Game navigation');
 });
}
export async function longPressTitle(root){
 const title=root.locator('.titlebar h1');
 const r=await title.boundingBox();
 await title.dispatchEvent('pointerdown',{pointerType:'touch',isPrimary:true,pointerId:41,button:0,clientX:r.x+10,clientY:r.y+5});
 await root.getByRole('menu').waitFor();
 await title.dispatchEvent('pointerup',{pointerType:'touch',isPrimary:true,pointerId:41,button:0});
}
