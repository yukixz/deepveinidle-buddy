import {startDemo} from './main.js';
startDemo().catch(error=>{document.getElementById('demo-status').textContent=error.message;console.error(error);});
