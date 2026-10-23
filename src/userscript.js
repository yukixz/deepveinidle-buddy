import {startUserscript} from './main.js';
startUserscript(unsafeWindow,{get:GM_getValue,set:GM_setValue,request:GM_xmlhttpRequest,copy:GM_setClipboard});
