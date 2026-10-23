import test from 'node:test';import assert from 'node:assert/strict';
import {createCapture,installCapture} from '../src/capture.js';
const you=()=>({id:42,lastTick:100,skills:{smithing:0},equipment:{hammer:null},bank:{20:4},pack:[],collections:{40:9},token:'never-copy',chat:['private']});
const frame=(m,tick=100)=>JSON.stringify({tick,m});
test('frame aggregation emits once, crops fields, preserves player freshness on world changes',()=>{const out=[];let now=10000;const c=createCapture(e=>out.push(e),{now:()=>now});const token=c.connect();c.receive(frame([{t:'welcome',you:you(),guild:null,windows:[]},{t:'windows',windows:[]}]),token);assert.equal(out.length,2);assert.equal(out[1].role,'42');assert.equal(out[1].snapshot.player.token,undefined);assert.equal(out[1].snapshot.player.chat,undefined);now=20000;c.receive(frame([{t:'windows',windows:[]}],101),token);assert.equal(out[2].playerCapturedAt,10000);assert.equal(out[2].worldCapturedAt,20000);});
test('old frames and connections cannot replace newer state; disconnect is explicit',()=>{const out=[],c=createCapture(e=>out.push(e));const first=c.connect();c.receive(frame([{t:'welcome',you:you(),windows:[]}]),first);const second=c.connect();c.receive(frame([{t:'snapshot',you:you()}]),first);assert.equal(out.at(-1).status,'waiting');c.receive(frame([{t:'welcome',you:you(),windows:[]}],200),second);const n=out.length;c.receive(frame([{t:'snapshot',you:you()}],199),second);assert.equal(out.length,n);c.disconnect(second);assert.equal(out.at(-1).status,'disconnected');});
test('malformed JSON is ignored, incompatible character halts capture',()=>{const out=[],c=createCapture(e=>out.push(e));const token=c.connect();c.receive('x',token);assert.equal(out.length,1);c.receive(frame([{t:'welcome',you:{}}]),token);assert.equal(out.at(-1).status,'error');c.receive(frame([{t:'welcome',you:you()}]),token);assert.equal(out.at(-1).status,'error');});
test('only same-origin ws path is listened to and no command is sent',()=>{class Socket extends EventTarget{constructor(url){super();this.url=url;}send(){throw Error('must not send');}}
 const page={WebSocket:Socket,location:{href:'https://deepveinidle.com/',host:'deepveinidle.com'}},out=[],dispose=installCapture(page,e=>out.push(e));
 const external=new page.WebSocket('wss://example.com/ws');external.dispatchEvent(Object.assign(new Event('message'),{data:frame([{t:'welcome',you:you()}])}));assert.equal(out.length,0);
 const socket=new page.WebSocket('wss://deepveinidle.com/ws');socket.dispatchEvent(Object.assign(new Event('message'),{data:frame([{t:'welcome',you:you(),windows:[]}])}));assert.equal(out.at(-1).status,'live');dispose();assert.equal(page.WebSocket,Socket);
});

test('server snapshots keep only approved route and queue task fields',()=>{
 const out=[],capture=createCapture(value=>out.push(value)),token=capture.connect(),player=you();
 Object.assign(player,{route:{zoneId:null,jobId:41,after:{token:'private'}},queue:[{kind:'job',jobId:41,rarity:0,secret:'private'}],queueSlots:3,workJobId:null,workRarity:0,held:false,raidHeld:false});
 capture.receive(frame([{t:'welcome',you:player,windows:[]}]),token);
 const snapshot=out.at(-1).snapshot.player;
 assert.deepEqual(snapshot.route,{zoneId:null,jobId:41});assert.deepEqual(snapshot.queue,[{kind:'job',jobId:41,rarity:0}]);assert.equal(snapshot.queueSlots,3);
});
