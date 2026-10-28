import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {repository,scriptName,greasyForkCode,versionParts,compareVersions,releaseNotes,validateArtifact,codeIdentity} from './release.mjs';
import {startServer} from './serve.mjs';
import {scenarios} from './test-ui.mjs';

const assert=(condition,message)=>{if(!condition)throw Error(message);};
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function nextVersion(current,target){
 const parts=versionParts(current);
 if(target==='patch'){assert(parts[2]<Number.MAX_SAFE_INTEGER,'Patch version exceeds safe range');return `${parts[0]}.${parts[1]}.${parts[2]+1}`;}
 versionParts(target);assert(compareVersions(target,current)>=0,'Cannot prepare an older version');return target;
}
export function selectRuns(rows,commit,tag){
 assert(Array.isArray(rows),'Invalid workflow response');
 return ['CI','Release'].map(name=>{
  const candidates=rows.filter(row=>row.workflowName===name&&row.headSha===commit&&row.event==='push'&&row.headBranch===(name==='CI'?'main':tag));
  candidates.sort((a,b)=>b.databaseId-a.databaseId);
  const run=candidates[0];
  return run?{name,id:run.databaseId,status:run.status,conclusion:run.conclusion,url:run.url}:{name,status:'pending',conclusion:''};
 });
}
function executeCommand(command,args,{cwd,env}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe'],timeout:35*60*1000});let stdout='',stderr='';
  child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);
  child.on('error',reject);child.on('close',(code,signal)=>resolve({code,signal,stdout,stderr}));
 });
}
// Side effects are injected for isolated tests; real publishing remains in the existing workflow.
export async function runReleaseTask({mode,target,notesFile,cwd=process.cwd(),execute=executeCommand,serve=startServer,
 readOnline=async()=>{const response=await fetch(greasyForkCode,{cache:'no-store',signal:AbortSignal.timeout(20000)});assert(response.ok,`Greasy Fork HTTP ${response.status}`);return response.text();},
 sleep=pause,now=Date.now,report=value=>console.log(JSON.stringify(value)),timeoutMs=40*60*1000,pollMs=30000}={}){
 const directory=path.join(cwd,'.test-artifacts/release-task'),stateFile=path.join(directory,'state.json'),summaryFile=path.join(directory,'summary.json');
 await fs.mkdir(directory,{recursive:true});
 const lockFile=path.join(directory,'lock'),lock=await fs.open(lockFile,'wx');
 const logFile=path.join(directory,`${now()}-${mode}.log`);await fs.writeFile(logFile,'');
 let state={},summary={mode,status:'running',stage:'preflight',log:logFile,result:summaryFile},lastStage='';
 const persist=()=>fs.writeFile(summaryFile,JSON.stringify(summary,null,2)+'\n');
 const saveState=()=>fs.writeFile(stateFile,JSON.stringify(state,null,2)+'\n');
 async function stage(name,details={}){
  summary={...summary,stage:name,...details};await persist();
  const message=details.runs?{stage:name,workflows:details.runs.map(run=>`${run.name}:${run.status}${run.conclusion?'/'+run.conclusion:''}`)}:{stage:name,...details};
  const signature=JSON.stringify(message);if(signature!==lastStage){lastStage=signature;report(message);}
 }
 async function run(command,args=[],options={}){
  const result=await execute(command,args,{cwd,...options});
  await fs.appendFile(logFile,`\n$ ${JSON.stringify([command,...args])}\n${result.stdout}${result.stderr}\nexit=${result.code} signal=${result.signal??''}\n`);
  if(!options.allowFailure)assert(result.code===0,`Command failed: ${command} ${args.join(' ')} (exit ${result.code})`);
  return result;
 }
 const git=async(...args)=>(await run('git',args)).stdout.trim();
 const readJSON=async file=>JSON.parse(await fs.readFile(path.join(cwd,file),'utf8'));
 async function snapshot(){
  const tracked=(await run('git',['diff','--name-only','-z','HEAD'])).stdout.split('\0').filter(Boolean);
  const untracked=(await run('git',['ls-files','--others','--exclude-standard','-z'])).stdout.split('\0').filter(Boolean);
  const files=[...new Set([...tracked,...untracked])].sort(),digest=crypto.createHash('sha256');
  for(const file of files){
   digest.update(JSON.stringify(file));
   try{const name=path.join(cwd,file),stat=await fs.lstat(name);assert(stat.isFile()||stat.isSymbolicLink(),`Unsupported release path: ${file}`);digest.update(String(stat.mode));digest.update(stat.isSymbolicLink()?await fs.readlink(name):await fs.readFile(name));}
   catch(error){if(error.code!=='ENOENT')throw error;digest.update('deleted');}
  }
  return {files,digest:digest.digest('hex')};
 }
 async function loadState(){
  state=await readJSON('.test-artifacts/release-task/state.json');
  assert(state.schema===1&&state.version&&/^[a-f0-9]{40}$/.test(state.head),'Invalid prepared release state');versionParts(state.version);
  summary={...summary,version:state.version,commit:state.commit??state.head};
 }
 async function checkRepository(){
  assert(await git('branch','--show-current')==='main','Release preparation/publishing requires main');
  const remote=await git('remote','get-url','origin');
  assert([`git@github.com:${repository}.git`,`https://github.com/${repository}.git`,`https://github.com/${repository}`].includes(remote),'Unexpected origin repository');
 }
 async function prepare(){
  assert(target&&notesFile,'Use prepare patch|X.Y.Z --notes-file PATH');
  await checkRepository();
  const pkg=await readJSON('package.json'),lock=await readJSON('package-lock.json');
  assert(pkg.version===lock.version&&pkg.version===lock.packages?.['']?.version,'Package versions differ');
  const version=nextVersion(pkg.version,target),notes=(await fs.readFile(path.resolve(cwd,notesFile),'utf8')).trim();
  assert(notes&&!/^## /m.test(notes),'Notes must contain only this release’s entries, without version headings');
  const tagExists=await run('git',['show-ref','--verify','--quiet',`refs/tags/v${version}`],{allowFailure:true});
  assert(tagExists.code===1,'Release tag already exists or cannot be checked');
  const head=await git('rev-parse','HEAD');
  // Invalidate any previous receipt before changing files or running checks.
  state={schema:1,phase:'preparing',head,version};await saveState();
  pkg.version=lock.version=lock.packages[''].version=version;
  await fs.writeFile(path.join(cwd,'package.json'),JSON.stringify(pkg,null,2)+'\n');
  await fs.writeFile(path.join(cwd,'package-lock.json'),JSON.stringify(lock,null,2)+'\n');
  for(const [file,pattern,replacement]of [['README.md',/版本 \*\*\d+\.\d+\.\d+\*\*/,`版本 **${version}**`],['docs/status.md',/版本：\*\*\d+\.\d+\.\d+\*\*/,`版本：**${version}**`]]){
   const source=await fs.readFile(path.join(cwd,file),'utf8');assert(pattern.test(source),`Version label missing: ${file}`);await fs.writeFile(path.join(cwd,file),source.replace(pattern,replacement));
  }
  const changelogFile=path.join(cwd,'CHANGELOG.md'),changelog=await fs.readFile(changelogFile,'utf8'),heading=`## ${version}`;
  const lines=changelog.split('\n'),start=lines.indexOf(heading);
  if(start>=0){let end=lines.findIndex((line,index)=>index>start&&line.startsWith('## '));if(end<0)end=lines.length;lines.splice(start,end-start,heading,'',notes,'');}
  else{const index=lines.findIndex(line=>line.startsWith('## '));assert(index>=0,'Changelog version sections missing');lines.splice(index,0,heading,'',notes,'');}
  await fs.writeFile(changelogFile,lines.join('\n'));releaseNotes(lines.join('\n'),version);
  const expected=await snapshot();
  await stage('local-validation',{version});
  await run('npm',['ci']);await run('npm',['test']);await run('npm',['run','build']);
  const server=await serve({root:cwd,port:0});
  try{await run('npm',['run','test:ui'],{env:{BUDDY_URL:server.url}});}finally{await server.close();}
  const checks=await readJSON('.test-artifacts/verification/summary.json');
  assert(checks.complete===true&&checks.scenarios?.length===scenarios.length&&checks.scenarios.every((row,index)=>row.name===scenarios[index]&&row.code===0)&&Number.isSafeInteger(checks.totalChecks)&&checks.totalChecks>0,'Full browser verification is incomplete');
  await run('git',['diff','--check']);
  assert(await git('rev-parse','HEAD')===head&&(await snapshot()).digest===expected.digest,'Source changed during validation; prepare again');
  state={...state,phase:'prepared',...expected,checks:{unit:'passed',browserScenarios:checks.scenarios.length,browserChecks:checks.totalChecks}};await saveState();
  summary={...summary,status:'prepared',version,commit:head,files:state.files,checks:state.checks};
 }
 async function publish(){
  await loadState();await checkRepository();
  assert(['prepared','committed'].includes(state.phase),'Preparation did not pass');
  if(state.phase==='prepared'){
   assert(await git('rev-parse','HEAD')===state.head,'HEAD changed; prepare again');
   const current=await snapshot();assert(current.digest===state.digest,'Files changed after preparation; prepare again');
   assert(state.files.length>0,'No prepared changes to commit');
   await stage('commit',{version:state.version});
   await run('git',['add','--',...state.files]);await run('git',['commit','-m',`Release ${state.version}`]);
   state={...state,phase:'committed',commit:await git('rev-parse','HEAD')};await saveState();
  }
  assert(await git('rev-parse','HEAD')===state.commit,'HEAD differs from committed release');
  assert(!(await git('status','--porcelain')),'Working tree changed after release commit');
  summary.commit=state.commit;
  await stage('artifact-validation');
  await run('npm',['run','build'],{env:{BUILD_COMMIT:state.commit}});
  const manifest=await readJSON('dist/manifest.json'),code=await fs.readFile(path.join(cwd,'dist',scriptName),'utf8'),pkg=await readJSON('package.json');
  const artifact=validateArtifact({manifest,code,packageVersion:pkg.version,commit:state.commit,tag:`v${state.version}`});
  state.identity=artifact.identity;state.assets=artifact.assets.map(asset=>({name:asset.name,bytes:asset.bytes.length,sha256:hash(asset.bytes)}));await saveState();
  const tag=`v${state.version}`,existing=await run('git',['rev-parse','--verify',`refs/tags/${tag}^{commit}`],{allowFailure:true});
  if(existing.code===0)assert(existing.stdout.trim()===state.commit,'Existing tag points to another commit');
  else assert(existing.code===128,'Cannot check release tag');
  assert(await git('rev-parse','HEAD')===state.commit&&!(await git('status','--porcelain')),'Source changed during artifact validation');
  await stage('push');await run('git',['push','origin','main']);
  if(existing.code!==0)await run('git',['tag',tag,state.commit]);
  await run('git',['push','origin',tag]);
  await watch();
 }
 async function watch(){
  if(!state.commit)await loadState();
  assert(state.phase==='committed'&&/^[a-f0-9]{40}$/.test(state.commit)&&state.identity&&state.assets,'No committed, validated release to watch');
  const tag=`v${state.version}`,deadline=now()+timeoutMs;
  while(true){
   const response=await run('gh',['run','list','--repo',repository,'--commit',state.commit,'--event','push','--limit','100','--json','databaseId,workflowName,headSha,headBranch,event,status,conclusion,url']);
   const runs=selectRuns(JSON.parse(response.stdout),state.commit,tag);summary.runs=runs;
   await stage('remote-validation',{runs});
   const failed=runs.find(run=>run.status==='completed'&&run.conclusion!=='success');
   if(failed){
    await run('gh',['run','view',String(failed.id),'--repo',repository,'--log-failed'],{allowFailure:true});
    const result=await run('gh',['release','view',tag,'--repo',repository,'--json','tagName,url,isDraft'],{allowFailure:true});
    const release=result.code===0?JSON.parse(result.stdout):null;
    summary.release=release?{url:release.url,published:release.tagName===tag&&!release.isDraft}:{published:null};
    throw Error(`Workflow failed: ${failed.name} (${failed.conclusion}); ${failed.url}. No automatic rerun.`);
   }
   if(runs.every(run=>run.status==='completed'&&run.conclusion==='success'))break;
   assert(now()<deadline,'Workflow wait timed out; use watch to continue');await sleep(pollMs);
  }
  await stage('release-verification');
  const response=await run('gh',['release','view',tag,'--repo',repository,'--json','tagName,url,isDraft,assets']);
  const release=JSON.parse(response.stdout);assert(release.tagName===tag&&!release.isDraft,'Release is not published');
  summary.release={url:release.url,published:true};await persist();
  for(const expected of state.assets){const matches=release.assets.filter(asset=>asset.name===expected.name);assert(matches.length===1&&matches[0].size===expected.bytes&&matches[0].digest===`sha256:${expected.sha256}`,`Release asset differs: ${expected.name}`);}
  const online=codeIdentity(await readOnline());assert(online.version===state.identity.version&&online.bodyHash===state.identity.bodyHash,'GitHub is published, but Greasy Fork identity differs');
  summary={...summary,status:'released',version:state.version,commit:state.commit,greasyFork:'verified',checks:state.checks};
 }
 try{
  assert(['prepare','publish','watch'].includes(mode),'Use prepare patch|X.Y.Z --notes-file PATH, publish, or watch');
  if(mode==='prepare')await prepare();else if(mode==='publish')await publish();else await watch();
  summary.stage='complete';await persist();report(summary);return summary;
 }catch(error){
  summary={...summary,status:'failed',error:error.message};await persist();report(summary);throw error;
 }finally{
  await lock.close();await fs.unlink(lockFile);
 }
}

async function main(){
 const [mode,...args]=process.argv.slice(2);
 if(!mode||mode==='--help'){console.log('npm run release -- prepare patch|X.Y.Z --notes-file PATH\nnpm run release -- publish\nnpm run release -- watch');return;}
 assert(mode==='prepare'?args.length===3&&args[1]==='--notes-file':args.length===0,'Invalid release arguments');
 await runReleaseTask({mode,target:args[0],notesFile:args[2]});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
