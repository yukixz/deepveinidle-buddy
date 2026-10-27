import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export const repository='yukixz/deepveinidle-buddy';
export const scriptName='deepveinidle-buddy.user.js';
export const greasyForkCode='https://update.greasyfork.org/scripts/601896/DeepVeinIdle-Buddy.user.js';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const assert=(condition,message)=>{if(!condition)throw Error(message);};
export function versionParts(value){
 assert(typeof value==='string'&&value.trim()===value&&/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value),'Version must be X.Y.Z');
 const parts=value.split('.').map(Number);assert(parts.every(Number.isSafeInteger),'Version exceeds safe range');return parts;
}
export function compareVersions(a,b){const left=versionParts(a),right=versionParts(b);for(let i=0;i<3;i++)if(left[i]!==right[i])return Math.sign(left[i]-right[i]);return 0;}
function metadata(code){
 const normalized=code.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n'),match=normalized.match(/^\/\/ ==UserScript==\n([\s\S]*?)^\/\/ ==\/UserScript==\s*$/m);
 assert(match,'Userscript metadata is missing');
 const fields=new Map();for(const line of match[1].split('\n')){const entry=line.match(/^\/\/\s*@([^\s]+)(?:\s+(.+?))?\s*$/);if(entry){const values=fields.get(entry[1])??[];values.push(entry[2]??'');fields.set(entry[1],values);}}
 return {fields,body:normalized.slice(match.index+match[0].length).trim()};
}
function field(fields,name){const values=fields.get(name);assert(values?.length===1,`Expected one @${name}`);return values[0];}
export function codeIdentity(code){const {fields,body}=metadata(code);const version=field(fields,'version');versionParts(version);return {version,bodyHash:hash(body)};}
export function validateArtifact({manifest,code,packageVersion,commit,tag}){
 assert(typeof commit==='string'&&/^[a-f0-9]{40}$/.test(commit),'Expected full source commit');
 versionParts(packageVersion);if(tag)assert(tag===`v${packageVersion}`,'Tag and package version differ');
 assert(manifest.version===packageVersion&&manifest.sourceCommit===commit,'Manifest version/source commit mismatch');
 assert(Array.isArray(manifest.files),'Manifest files are missing');
 const entries=manifest.files.filter(file=>file.name===scriptName);assert(entries.length===1,'Manifest must contain exactly one userscript');
 const bytes=Buffer.from(code),entry=entries[0];assert(bytes.length>0&&bytes.length<2_000_000,'Userscript exceeds size limit');
 assert(entry.bytes===bytes.length&&entry.sha256===hash(bytes),'Userscript digest/size mismatch');
 const {fields,body}=metadata(code);
 for(const [key,value]of Object.entries({name:'DeepVeinIdle-Buddy',namespace:'https://github.com/yukixz/deepveinidle-buddy',version:packageVersion,license:'MIT','run-at':'document-start',noframes:''}))assert(field(fields,key)===value,`Unexpected @${key}`);
 assert(field(fields,'description').length>0,'Description is missing');
 for(const [key,expected]of Object.entries({match:['https://deepveinidle.com/*','https://cn.deepveinidle.com/*'],grant:['unsafeWindow','GM_getValue','GM_setValue','GM_xmlhttpRequest','GM_setClipboard'],connect:['deepveinidle.com']}))assert(JSON.stringify([...(fields.get(key)??[])].sort())===JSON.stringify([...expected].sort()),`Unexpected @${key} permissions`);
 assert(!fields.has('require')&&!fields.has('resource')&&!fields.has('include'),'Unexpected external code/resources');
 assert(body.includes(`/* Buddy build commit: ${commit} */`),'Build commit marker is missing');
 return {version:packageVersion,commit,identity:codeIdentity(code),assets:[{name:scriptName,bytes},{name:'manifest.json',bytes:Buffer.from(JSON.stringify(manifest,null,2)+'\n')}]};
}
export function releaseNotes(changelog,version){
 versionParts(version);const lines=changelog.replace(/\r\n/g,'\n').split('\n'),start=lines.indexOf(`## ${version}`);
 assert(start>=0,'Changelog entry is missing for release version');
 let end=lines.findIndex((line,index)=>index>start&&line.startsWith('## '));if(end<0)end=lines.length;
 const notes=lines.slice(start+1,end).join('\n').trim();assert(notes,'Release notes are empty');return notes;
}
function checkOnline(code,artifact){
 const identity=codeIdentity(code),order=compareVersions(identity.version,artifact.version);
 assert(order<=0,`Greasy Fork ${identity.version} is newer than ${artifact.version}`);
 assert(order!==0||identity.bodyHash===artifact.identity.bodyHash,'Greasy Fork has different code at this version; increment package version');
 return order===0;
}
async function verifyAssets(client,release,artifact){
 const assets=await client.assets(release.id);
 for(const expected of artifact.assets){
  const matches=assets.filter(asset=>asset.name===expected.name);assert(matches.length===1,`Expected one release asset: ${expected.name}`);
  const actual=await client.download(matches[0].id);assert(hash(actual)===hash(expected.bytes),`Release asset differs: ${expected.name}`);
 }
}
export async function publishRelease({artifact,client,readOnline,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),attempts=12}){
 assert(Number.isSafeInteger(attempts)&&attempts>0,'Invalid verification attempts');
 const tag=`v${artifact.version}`,releases=await client.releases();
 for(const release of releases.filter(r=>!r.draft&&!r.prerelease)){
  assert(/^v/.test(release.tag_name),'Unexpected stable release tag');
  assert(compareVersions(release.tag_name.slice(1),artifact.version)<=0,'A newer GitHub release already exists');
 }
 checkOnline(await readOnline(),artifact);
 const sameTag=releases.filter(release=>release.tag_name===tag);assert(sameTag.length<=1,'Duplicate release tag');
 let release=sameTag[0];
 if(release){
  assert(!release.prerelease,'Tag belongs to a prerelease');
  if(!release.draft)await verifyAssets(client,release,artifact);
 }else release=await client.create({tag_name:tag,target_commitish:artifact.commit,name:tag,draft:true,prerelease:false,body:`Source commit: ${artifact.commit}\n\n${artifact.notes??'Validated userscript build. Greasy Fork script: 601896.'}`});
 if(release.draft){
  const existing=await client.assets(release.id);
  for(const expected of artifact.assets){
   const matches=existing.filter(asset=>asset.name===expected.name);assert(matches.length<=1,`Duplicate draft asset: ${expected.name}`);
   if(matches.length){assert(hash(await client.download(matches[0].id))===hash(expected.bytes),`Draft asset differs: ${expected.name}`);}
   else await client.upload(release,expected);
  }
  await verifyAssets(client,release,artifact);
  // Recheck immediately before publication; uploads can take time.
  const current=await client.releases();
  for(const item of current.filter(r=>!r.draft&&!r.prerelease))assert(compareVersions(item.tag_name.replace(/^v/,''),artifact.version)<=0,'Newer GitHub release appeared during upload');
  checkOnline(await readOnline(),artifact);
  release=await client.publish(release.id);
 }
 assert(!release.draft,'GitHub did not publish the release');
 let lastError;
 for(let attempt=0;attempt<attempts;attempt++){
  try{if(checkOnline(await readOnline(),artifact))return {release,verified:true};lastError=Error('Greasy Fork still has the previous version');}
  catch(error){lastError=error;}
  if(attempt+1<attempts)await sleep(10000);
 }
 throw Error(`GitHub ${tag} is published, but Greasy Fork sync is not confirmed: ${lastError.message}. Check repository webhook deliveries and redeliver the release event.`);
}
async function readResponse(response,context){assert(response.ok,`${context}: HTTP ${response.status}`);return response;}
export function githubClient(token){
 assert(token,'GITHUB_TOKEN is missing');
 const base=`https://api.github.com/repos/${repository}`;
 async function request(method,path,{body,binary=false,accept='application/vnd.github+json'}={}){
  const url=path.startsWith('https:')?new URL(path):new URL(base+path);
  assert(['api.github.com','uploads.github.com'].includes(url.hostname)&&url.protocol==='https:','Unexpected GitHub endpoint');
  const response=await readResponse(await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,Accept:accept,'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':binary?'application/octet-stream':'application/json'}:{})},body:body?(binary?body:JSON.stringify(body)):undefined,signal:AbortSignal.timeout(30000)}),'GitHub request');
  return accept==='application/octet-stream'?Buffer.from(await response.arrayBuffer()):response.json();
 }
 async function pages(path){const values=[];for(let page=1;;page++){const rows=await request('GET',`${path}?per_page=100&page=${page}`);assert(Array.isArray(rows),'Unexpected GitHub list response');values.push(...rows);if(rows.length<100)return values;}}
 return {
  releases:()=>pages('/releases'),assets:id=>pages(`/releases/${id}/assets`),
  download:id=>request('GET',`/releases/assets/${id}`,{accept:'application/octet-stream'}),
  create:body=>request('POST','/releases',{body}),
  upload:(release,asset)=>request('POST',`${release.upload_url.replace(/\{.*$/,'')}?name=${encodeURIComponent(asset.name)}`,{body:asset.bytes,binary:true}),
  publish:id=>request('PATCH',`/releases/${id}`,{body:{draft:false,make_latest:'true'}}),
 };
}
async function main(){
 const [mode,tag]=process.argv.slice(2);assert(['validate','publish'].includes(mode),'Use release.mjs validate|publish [tag]');
 if(tag){assert(/^v/.test(tag),'Expected vX.Y.Z tag');versionParts(tag.slice(1));}
 const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 if(mode==='publish'){
  assert(process.env.GITHUB_REPOSITORY===repository,'Publishing is restricted to the configured repository');
  assert(tag,'Publishing requires a tag');
  const tagged=execFileSync('git',['rev-parse',`${tag}^{commit}`],{encoding:'utf8'}).trim();assert(tagged===commit,'Checked out commit differs from release tag');
  execFileSync('git',['merge-base','--is-ancestor',commit,'origin/main']);
 }
 const manifest=JSON.parse(await fs.readFile('dist/manifest.json','utf8')),code=await fs.readFile(`dist/${scriptName}`,'utf8'),pkg=JSON.parse(await fs.readFile('package.json','utf8'));
 const artifact=validateArtifact({manifest,code,packageVersion:pkg.version,commit,tag});
 if(mode==='validate'){console.log(`Validated ${artifact.version} from ${commit}`);return;}
 artifact.notes=releaseNotes(await fs.readFile('CHANGELOG.md','utf8'),artifact.version);
 const result=await publishRelease({artifact,client:githubClient(process.env.GITHUB_TOKEN),readOnline:async()=>{
  const response=await readResponse(await fetch(greasyForkCode,{cache:'no-store',signal:AbortSignal.timeout(20000)}),'Greasy Fork code');return response.text();
 }});
 console.log(`Published ${result.release.html_url}; Greasy Fork 601896 verified at ${artifact.version}`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
