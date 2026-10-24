import {chromium} from 'playwright-core';
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
 await title.dispatchEvent('pointerdown',{pointerType:'touch',isPrimary:true,pointerId:41,button:0,clientX:20,clientY:60});
 await root.getByRole('menu').waitFor();
 await title.dispatchEvent('pointerup',{pointerType:'touch',isPrimary:true,pointerId:41,button:0});
}
