import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {parse} from 'acorn';
const root=new URL('../',import.meta.url);

test('reviewed game snapshot regenerates the engine and manifest deterministically',async()=>{
 const manifest=JSON.parse(await fs.readFile(new URL('vendor/manifest.json',root)));
 const source=await fs.readFile(new URL('vendor/game-original.js',root));
 assert.equal(crypto.createHash('sha256').update(source).digest('hex'),manifest.sha256);
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'buddy-extract-'));
 try{
  await fs.mkdir(path.join(directory,'vendor'));await fs.mkdir(path.join(directory,'src/engine'),{recursive:true});
  await fs.writeFile(path.join(directory,'vendor/game-original.js'),source);
  execFileSync(process.execPath,[new URL('scripts/extract.mjs',root).pathname],{cwd:directory});
  for(const name of ['src/engine/upstream.js','vendor/manifest.json'])assert.deepEqual(await fs.readFile(path.join(directory,name)),await fs.readFile(new URL(name,root)),name);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
test('production modules do not import test fixtures',async()=>{
 const files=(await fs.readdir(new URL('src/',root),{recursive:true})).filter(name=>name.endsWith('.js')&&!name.endsWith('upstream.js'));
 for(const name of files){
  const ast=parse(await fs.readFile(new URL('src/'+name,root),'utf8'),{ecmaVersion:'latest',sourceType:'module'});
  for(const node of ast.body)if(node.type==='ImportDeclaration')assert.ok(!path.normalize(path.join('src',path.dirname(name),node.source.value)).startsWith('tests/'),name);
 }
});
