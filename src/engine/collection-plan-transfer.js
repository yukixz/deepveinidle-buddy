import {validateCollectionPlan} from './collection-plan.js';

const prefix='DVILAB-PLAN:';
export async function encodeCollectionPlan(plan){
 const json=JSON.stringify(validateCollectionPlan(plan));
 if(typeof CompressionStream==='undefined')return json;
 const stream=new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
 const bytes=new Uint8Array(await new Response(stream).arrayBuffer());
 let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
 const compressed=prefix+btoa(binary);
 return compressed.length<json.length?compressed:json;
}

export async function decodeCollectionPlan(value){
 let json=value.trim();
 if(json.startsWith(prefix)){
  if(typeof DecompressionStream==='undefined')throw Error('decompressionUnavailable');
  const binary=atob(json.slice(prefix.length));
  const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  json=await new Response(stream).text();
 }
 return validateCollectionPlan(JSON.parse(json));
}
