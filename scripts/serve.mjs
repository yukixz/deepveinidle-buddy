import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';
import {pathToFileURL} from 'node:url';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css'};
export async function startServer({root=process.cwd(),port=4178}={}){
 const server=http.createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(file!==root&&!file.startsWith(root+path.sep))throw Error('forbidden');const body=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]??'text/plain','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return {url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)startServer({port:Number(process.env.PORT??4178)}).then(server=>console.log(`Buddy demo: ${server.url}`)).catch(error=>{console.error(error.message);process.exitCode=1;});
