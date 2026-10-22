import {chromium} from 'playwright-core';
export const baseUrl=process.env.BUDDY_URL??'http://127.0.0.1:4178';
export const launchBrowser=()=>chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
