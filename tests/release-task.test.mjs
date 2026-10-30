import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {nextVersion,selectRuns,runReleaseTask} from '../scripts/release-task.mjs';
import {scriptName} from '../scripts/release.mjs';
import {scenarios} from '../scripts/test-ui.mjs';

const exec=promisify(execFile),digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const ok=stdout=>({code:0,stdout:stdout??'',stderr:''});
const broken={code:1,stdout:'full command output retained in log',stderr:'fixture failure'};
function source(version,commit){return `// ==UserScript==
// @name DeepVeinIdle-Buddy
// @namespace https://dvi-lab.pages.dev
// @version ${version}
// @license MIT
// @description Buddy
// @run-at document-start
// @noframes
// @match https://deepveinidle.com/*
// @match https://cn.deepveinidle.com/*
// @grant unsafeWindow
// @grant GM_getValue
// @grant GM_setValue
// @grant GM_xmlhttpRequest
// @connect deepveinidle.com
// ==/UserScript==
/* Buddy build commit: ${commit} */
console.log('fixture');
`;}
async function fixture(t){
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'buddy-release-task-')),cwd=path.join(base,'repo');
 t.after(()=>fs.rm(base,{recursive:true,force:true}));await fs.mkdir(path.join(cwd,'docs'),{recursive:true});
 const git=async(...args)=>(await exec('git',args,{cwd})).stdout.trim();
 await git('init','-b','main');await git('config','user.name','Release fixture');await git('config','user.email','fixture@example.invalid');await git('config','commit.gpgsign','false');await git('config','core.hooksPath','/dev/null');
 await git('remote','add','origin','git@github.com:yukixz/deepveinidle-buddy.git');
 const write=(file,data)=>fs.writeFile(path.join(cwd,file),data);
 const json=async file=>JSON.parse(await fs.readFile(path.join(cwd,file),'utf8'));
 await write('.gitignore','.test-artifacts/\ndist/\n');await write('package.json',JSON.stringify({version:'0.3.3'}));
 await write('package-lock.json',JSON.stringify({version:'0.3.3',packages:{'':{version:'0.3.3'}}}));
 await write('README.md','版本 **0.3.3**\n');await write('docs/status.md','版本：**0.3.3**\n');await write('CHANGELOG.md','# Changes\n\n## 0.3.3\n\n- Existing notes\n');await write('app.js','old\n');
 await git('add','.');await git('commit','-m','initial');await write('app.js','new\n');
 const notesFile=path.join(base,'notes.md');await fs.writeFile(notesFile,'- New release\n');
 const calls=[],reports=[],f={cwd,git,write,json,calls,reports,notesFile,closed:0,queries:0,pending:0,clock:0};
 const runs=async()=>{const commit=await git('rev-parse','HEAD');return ['CI','Release'].map((workflowName,index)=>({workflowName,headSha:commit,event:'push',headBranch:index?'v0.3.4':'main',databaseId:index+1,url:`https://github.com/fixture/run/${index+1}`,status:'completed',conclusion:'success'}));};
 const execute=async(command,args,options)=>{
  calls.push([command,...args]);
  if(command==='git'){
   if(args[0]==='push')return f.pushFailure?broken:ok(); // Never connect to a real remote.
   try{return ok((await exec(command,args,{cwd})).stdout);}catch(error){return {code:error.code,stdout:error.stdout??'',stderr:error.stderr??''};}
  }
  if(command==='npm'){
   if(f.failNpm===args.join(' '))return broken;
   if(args.join(' ')==='run build'){
    await fs.mkdir(path.join(cwd,'dist'),{recursive:true});const version=(await json('package.json')).version,commit=options.env?.BUILD_COMMIT??await git('rev-parse','HEAD'),code=source(version,commit);
    await write('dist/'+scriptName,code);await write('dist/manifest.json',JSON.stringify({version,sourceCommit:commit,files:[{name:scriptName,bytes:Buffer.byteLength(code),sha256:digest(code)}]},null,2)+'\n');
    if(f.editDuringBuild)await write('app.js','changed while building\n');
   }
   if(args.join(' ')==='run test:ui'){
    await fs.mkdir(path.join(cwd,'.test-artifacts/verification'),{recursive:true});
    await write('.test-artifacts/verification/summary.json',JSON.stringify({complete:true,totalChecks:288,scenarios:scenarios.map(name=>({name,code:0}))}));
    if(f.editDuringValidation)await write('app.js','changed while testing\n');
   }
   return ok('verbose npm output');
  }
  assert.equal(command,'gh','Unexpected external command');
  if(args[0]==='run'&&args[1]==='list'){
   f.queries++;const rows=await runs();
   if(f.queries<=f.pending)for(const row of rows){row.status='in_progress';row.conclusion='';}
   if(f.workflowFailure)rows[1].conclusion='failure';return ok(JSON.stringify(rows));
  }
  if(args[0]==='run'&&args[1]==='view')return ok('Failed step details');
  if(args[0]==='release'&&args[1]==='view'){
   const state=await json('.test-artifacts/release-task/state.json');
   return ok(JSON.stringify({tagName:'v0.3.4',url:'https://github.com/fixture/v0.3.4',isDraft:false,assets:state.assets.map(asset=>({name:asset.name,size:asset.bytes,digest:'sha256:'+(f.badAsset?'wrong':asset.sha256)}))}));
  }
  throw Error('Unexpected command');
 };
 f.run=(mode,extra={})=>runReleaseTask({cwd,mode,target:'patch',notesFile,execute,serve:async()=>({url:'http://fixture.invalid',close:async()=>{f.closed++;}}),report:value=>reports.push(structuredClone(value)),readOnline:async()=>source(f.wrongOnline?'0.3.5':'0.3.4',await git('rev-parse','HEAD')),now:()=>f.clock,sleep:async ms=>{f.clock+=ms;},pollMs:1,timeoutMs:10,...extra});
 return f;
}

test('release task accepts patch and explicit retry versions without downgrades',()=>{
 assert.equal(nextVersion('0.3.3','patch'),'0.3.4');assert.equal(nextVersion('0.3.4','0.3.4'),'0.3.4');
 for(const value of ['0.3.2','v0.3.4','0.3.04'])assert.throws(()=>nextVersion('0.3.3',value));
});
test('workflow matching requires the same commit, push event, branch/tag and workflow',()=>{
 const row={databaseId:1,workflowName:'CI',headSha:'a',event:'push',headBranch:'main',status:'completed',conclusion:'success'};
 for(const change of [{headSha:'b'},{event:'pull_request'},{headBranch:'other'},{workflowName:'Other'}])assert.equal(selectRuns([{...row,...change}],'a','v0.3.4')[0].status,'pending');
 assert.equal(selectRuns([row,{...row,databaseId:2,status:'in_progress'}],'a','v0.3.4')[0].id,2);
});
test('prepare updates release files, runs all local gates and reports a compact receipt without publishing',async t=>{
 const f=await fixture(t),result=await f.run('prepare');
 assert.equal(result.status,'prepared');assert.equal((await f.json('package.json')).version,'0.3.4');assert.equal((await f.json('package-lock.json')).packages[''].version,'0.3.4');
 assert.equal(result.checks.browserChecks,288);assert.equal(f.closed,1);assert.equal(f.reports.length,2);
 assert.deepEqual(f.calls.filter(([command])=>command==='npm').map(row=>row.slice(1).join(' ')),['ci','test','run build','run test:ui']);
 assert.equal(f.calls.some(([command,action])=>command==='gh'||action==='push'||action==='commit'),false);
});
test('local verification failure invalidates the old receipt and retains full diagnostics',async t=>{
 const f=await fixture(t);await f.run('prepare');f.failNpm='test';
 await assert.rejects(f.run('prepare',{target:'0.3.4'}),/Command failed/);
 assert.equal((await f.json('.test-artifacts/release-task/state.json')).phase,'preparing');
 const result=await f.json('.test-artifacts/release-task/summary.json');assert.equal(result.status,'failed');assert.match(await fs.readFile(result.log,'utf8'),/full command output/);
 await assert.rejects(f.run('publish'),/Preparation did not pass/);
});
test('validation cannot certify a source tree edited while checks run',async t=>{
 const f=await fixture(t);f.editDuringValidation=true;await assert.rejects(f.run('prepare'),/Source changed/);assert.equal(f.closed,1);
});
test('publishing refuses file changes after preparation before staging or pushing',async t=>{
 const f=await fixture(t);await f.run('prepare');await f.write('app.js','later\n');
 await assert.rejects(f.run('publish'),/Files changed/);assert.equal(f.calls.some(row=>row[0]==='git'&&['push','tag','add','commit'].includes(row[1])),false);
});
test('publish commits the reviewed files, binds build to commit, pushes in order and verifies both services',async t=>{
 const f=await fixture(t);await f.run('prepare');f.pending=3;const result=await f.run('publish');
 assert.equal(result.status,'released');assert.equal(result.greasyFork,'verified');assert.equal(result.commit,await f.git('rev-parse','HEAD'));
 assert.deepEqual(f.calls.filter(row=>row[0]==='git'&&row[1]==='push').map(row=>row.slice(2)),[['origin','main'],['origin','v0.3.4']]);
 assert.equal(f.queries,4);assert.equal(f.reports.filter(row=>row.stage==='remote-validation').length,2,'unchanged polls must stay silent');
 assert.equal(await f.git('status','--porcelain'),'');
});
test('an interrupted push resumes without creating another commit or moving the existing tag',async t=>{
 const f=await fixture(t);await f.run('prepare');f.pushFailure=true;await assert.rejects(f.run('publish'),/Command failed/);
 const commit=await f.git('rev-parse','HEAD');f.pushFailure=false;await f.run('publish');assert.equal(await f.git('rev-parse','HEAD'),commit);
 assert.equal(f.calls.filter(row=>row[0]==='git'&&row[1]==='commit').length,1);
});
test('workflow failure records published state and failed-step logs without automatic retry',async t=>{
 const f=await fixture(t);await f.run('prepare');f.workflowFailure=true;await assert.rejects(f.run('publish'),/Workflow failed/);
 const result=await f.json('.test-artifacts/release-task/summary.json');assert.equal(result.release.published,true);assert.equal(result.status,'failed');
 assert.match(await fs.readFile(result.log,'utf8'),/Failed step details/);assert.equal(f.calls.some(row=>row.includes('rerun')),false);
});
test('watch timeout is explicit and can resume read-only after workflows complete',async t=>{
 const f=await fixture(t);await f.run('prepare');f.pending=100;await assert.rejects(f.run('publish'),/timed out/);
 f.pending=0;f.calls.length=0;const result=await f.run('watch');assert.equal(result.status,'released');assert.ok(f.calls.every(row=>row[0]==='gh'));
});
test('release asset or Greasy Fork mismatches cannot produce a successful result',async t=>{
 for(const flag of ['badAsset','wrongOnline']){
  const f=await fixture(t);await f.run('prepare');f[flag]=true;await assert.rejects(f.run('publish'),flag==='badAsset'?/asset differs/:/identity differs/);
  const result=await f.json('.test-artifacts/release-task/summary.json');assert.equal(result.status,'failed');assert.equal(result.release.published,true);
 }
});
test('a tag pointing elsewhere cannot be moved or pushed',async t=>{
 const f=await fixture(t);await f.run('prepare');await f.git('tag','v0.3.4');
 await assert.rejects(f.run('publish'),/Existing tag points/);assert.equal(f.calls.some(row=>row[0]==='git'&&row[1]==='push'),false);
});
test('publishing refuses edits during the final build before any push',async t=>{
 const f=await fixture(t);await f.run('prepare');f.editDuringBuild=true;
 await assert.rejects(f.run('publish'),/Source changed during artifact/);assert.equal(f.calls.some(row=>row[0]==='git'&&row[1]==='push'),false);
});
test('concurrent invocations cannot overwrite another task’s receipt or summary',async t=>{
 const f=await fixture(t);await f.run('prepare');const original=await f.json('.test-artifacts/release-task/summary.json');
 await f.write('.test-artifacts/release-task/lock','held');await assert.rejects(f.run('publish'),{code:'EEXIST'});
 assert.deepEqual(await f.json('.test-artifacts/release-task/summary.json'),original);
});
