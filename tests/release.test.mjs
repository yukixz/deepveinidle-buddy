import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {compareVersions,versionParts,scriptName,validateArtifact,publishRelease,codeIdentity,githubClient} from '../scripts/release.mjs';
const commit='a'.repeat(40),digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function code(version='0.2.2',body=`/* Buddy build commit: ${commit} */\nconsole.log('buddy');`){return `// ==UserScript==
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
// @grant GM_setClipboard
// @connect deepveinidle.com
// ==/UserScript==
${body}\n`;}
function input(){const source=code();return {manifest:{version:'0.2.2',sourceCommit:commit,files:[{name:scriptName,bytes:Buffer.byteLength(source),sha256:digest(source)}]},code:source,packageVersion:'0.2.2',commit,tag:'v0.2.2'};}
function fixture({release=null,assets=[]}={}){
 const events=[],stored=new Map(assets.map((a,i)=>[i+1,a]));let current=release;
 return {events,client:{
  releases:async()=>current?[current]:[],
  assets:async()=>[...stored.entries()].map(([id,a])=>({id,name:a.name})),
  download:async id=>stored.get(id).bytes,
  create:async body=>{events.push('draft');current={...body,id:1};return current;},
  upload:async(_r,a)=>{events.push('upload:'+a.name);stored.set(stored.size+1,a);},
  publish:async()=>{events.push('published');current={...current,draft:false,html_url:'https://github.com/test/release'};return current;},
 }};
}
const old=()=>Promise.resolve(code('0.2.1','old code'));
const artifact=()=>validateArtifact(input());

test('release versions are strict stable triples and compare numerically',()=>{
 assert.equal(compareVersions('0.2.10','0.2.9'),1);assert.equal(compareVersions('1.0.0','1.0.0'),0);
 for(const v of ['v0.2.2','0.2','0.02.2','0.2.2-beta','0.2.2\n','9007199254740992.0.0'])assert.throws(()=>versionParts(v));
});
test('build validation binds tag, source commit, metadata, permissions and digest',()=>{
 assert.equal(artifact().version,'0.2.2');
 for(const mutate of [v=>v.tag='v0.2.3',v=>v.commit='b'.repeat(40),v=>v.manifest.files[0].sha256='bad',v=>v.code+='modified']){const v=input();mutate(v);assert.throws(()=>validateArtifact(v));}
 for(const replacement of [['@grant GM_setValue','@grant unsafeExtra'],['@namespace https://dvi-lab.pages.dev','@namespace changed'],[`Buddy build commit: ${commit}`,'missing marker']]){
  const v=input();v.code=v.code.replace(...replacement);v.manifest.files[0]={name:scriptName,bytes:Buffer.byteLength(v.code),sha256:digest(v.code)};assert.throws(()=>validateArtifact(v));
 }
});
test('Greasy Fork metadata rewriting does not hide body differences',()=>{
 const a=code(),b=a.replace('// @license MIT','// @license MIT\n// @downloadURL https://update.greasyfork.org/changed');
 assert.deepEqual(codeIdentity(a),codeIdentity(b));assert.notEqual(codeIdentity(a).bodyHash,codeIdentity(a+'different').bodyHash);
});
test('all uploads and digest checks finish before publication',async()=>{
 const f=fixture();let reads=0;const result=await publishRelease({artifact:artifact(),client:f.client,readOnline:async()=>++reads<3?old():code(),sleep:async()=>{}});
 assert.equal(result.verified,true);assert.deepEqual(f.events,['draft','upload:'+scriptName,'upload:manifest.json','published']);
});
test('preflight rejects unreadable, newer, and same-version different online code without writes',async()=>{
 for(const readOnline of [async()=>{throw Error('network');},async()=>code('0.3.0'),async()=>code('0.2.2','other')]){
  const f=fixture();await assert.rejects(publishRelease({artifact:artifact(),client:f.client,readOnline}));assert.deepEqual(f.events,[]);
 }
});
test('a newer GitHub release prevents downgrade before any writes',async()=>{
 const f=fixture({release:{tag_name:'v0.3.0',draft:false,prerelease:false}});await assert.rejects(publishRelease({artifact:artifact(),client:f.client,readOnline:old}),/newer GitHub/);assert.deepEqual(f.events,[]);
});
test('incomplete draft resumes without replacing verified assets',async()=>{
 const a=artifact(),f=fixture({release:{id:1,tag_name:'v0.2.2',draft:true},assets:[a.assets[0]]});let reads=0;
 await publishRelease({artifact:a,client:f.client,readOnline:async()=>++reads<3?old():code(),sleep:async()=>{}});assert.deepEqual(f.events,['upload:manifest.json','published']);
});
test('conflicting draft assets fail without overwriting or publishing',async()=>{
 const f=fixture({release:{id:1,tag_name:'v0.2.2',draft:true},assets:[{name:scriptName,bytes:Buffer.from('wrong')}]});await assert.rejects(publishRelease({artifact:artifact(),client:f.client,readOnline:old}),/Draft asset differs/);assert.deepEqual(f.events,[]);
});
test('a completed release is verified without another publication',async()=>{
 const a=artifact(),f=fixture({release:{id:1,tag_name:'v0.2.2',draft:false},assets:a.assets});
 await publishRelease({artifact:a,client:f.client,readOnline:async()=>code()});assert.deepEqual(f.events,[]);
});
test('Greasy Fork timeout distinguishes published release from failed sync',async()=>{
 const f=fixture();await assert.rejects(publishRelease({artifact:artifact(),client:f.client,readOnline:old,attempts:2,sleep:async()=>{}}),/is published, but Greasy Fork sync is not confirmed/);assert.equal(f.events.at(-1),'published');
});
test('an upload failure keeps release as a draft',async()=>{
 const f=fixture();f.client.upload=async()=>{throw Error('uploadFailed');};await assert.rejects(publishRelease({artifact:artifact(),client:f.client,readOnline:old}),/uploadFailed/);assert.deepEqual(f.events,['draft']);
});

test('different published attachments are never replaced during a rerun',async()=>{
 const a=artifact(),f=fixture({release:{id:1,tag_name:'v0.2.2',draft:false},assets:[{name:scriptName,bytes:Buffer.from('wrong')},a.assets[1]]});
 await assert.rejects(publishRelease({artifact:a,client:f.client,readOnline:old}),/Release asset differs/);assert.deepEqual(f.events,[]);
});
test('version advances during upload prevent publishing an outdated draft',async()=>{
 const f=fixture();let reads=0;
 await assert.rejects(publishRelease({artifact:artifact(),client:f.client,readOnline:async()=>++reads===1?old():code('0.3.0')}),/is newer/);
 assert.equal(f.events.includes('published'),false);
});

test('GitHub transport uses verified hosts, binary assets and explicit HTTP failures',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async(url,options)=>{
  calls.push({url:String(url),options});
  if(String(url).includes('/releases/assets/9'))return new Response('asset bytes');
  if(String(url).includes('fail'))return new Response('denied',{status:403});
  return new Response('[]',{headers:{'Content-Type':'application/json'}});
 });
 const client=githubClient('fixture-token');assert.deepEqual(await client.releases(),[]);assert.equal(calls[0].options.headers.Authorization,'Bearer fixture-token');
 assert.equal((await client.download(9)).toString(),'asset bytes');
 const bytes=Buffer.from('upload');await client.upload({upload_url:'https://uploads.github.com/repos/fixture/releases/1/assets{?name,label}'},{name:scriptName,bytes});
 assert.equal(calls[2].options.body,bytes);assert.equal(calls[2].options.headers['Content-Type'],'application/octet-stream');
 await assert.rejects(client.upload({upload_url:'https://untrusted.example/assets'},{name:scriptName,bytes}),/Unexpected GitHub endpoint/);assert.equal(calls.length,3);
 await assert.rejects(client.assets('fail'),/HTTP 403/);
});
