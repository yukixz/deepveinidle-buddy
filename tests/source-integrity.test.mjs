import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
test('work engine and test references match recorded local adaptations and original provenance',async()=>{
 const source=JSON.parse(await fs.readFile(new URL('../vendor/lab-source.json',import.meta.url))),manifest=JSON.parse(await fs.readFile(new URL('../vendor/manifest.json',import.meta.url)));
 assert.ok(source.adaptation);assert.ok(source.sourceCommit);assert.equal(source.generatedUpstream.currentSha256,source.modules['upstream.js']);assert.equal(source.generatedUpstream.originalSourceHash,source.originalModules['upstream.js']);
 for(const [directory,modules]of [['src/engine',source.modules],['tests/reference',source.referenceModules]]){
  const files=(await fs.readdir(new URL('../'+directory+'/',import.meta.url))).filter(name=>name.endsWith('.js')).sort();assert.deepEqual(files,Object.keys(modules).sort());
  for(const [name,digest]of Object.entries(modules))assert.equal(hash(await fs.readFile(new URL('../'+directory+'/'+name,import.meta.url))),digest,directory+'/'+name);
 }
 for(const name of source.localModules)assert.ok(source.modules[name],name);
 assert.equal(hash(await fs.readFile(new URL('../vendor/game-original.js',import.meta.url))),manifest.sha256);
 assert.equal(hash(await fs.readFile(new URL('../scripts/extract.mjs',import.meta.url))),source.generatedUpstream.generatorSha256);
});
