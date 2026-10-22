// Same gzip/Base64 envelope as the lab's collection-plan-transfer.js.
const prefix='DVILAB-PLAN:';
export async function encodePlanPayload(value){
 if(typeof CompressionStream==='undefined')throw Error('compressionUnavailable');
 const stream=new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream('gzip'));
 const bytes=new Uint8Array(await new Response(stream).arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
 return prefix+btoa(binary);
}
export async function decodePlanPayload(value){
 if(typeof value!=='string'||!value.trim().startsWith(prefix))throw Error('invalidPlan');
 if(typeof DecompressionStream==='undefined')throw Error('decompressionUnavailable');
 try{
  const bytes=Uint8Array.from(atob(value.trim().slice(prefix.length)),char=>char.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
 }catch{throw Error('invalidPlan');}
}
