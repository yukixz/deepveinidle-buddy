import {startUserscript} from './main.js';
startUserscript(unsafeWindow,{get:GM_getValue,set:GM_setValue,listen:GM_addValueChangeListener,unlisten:GM_removeValueChangeListener,request:GM_xmlhttpRequest,copy:GM_setClipboard});
