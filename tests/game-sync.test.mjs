import test from 'node:test';import assert from 'node:assert/strict';
import {createGameSync,readClient,characterRole} from '../src/game-sync.js';
const fixture=()=>({deepvein:{session:{state:{id:42,lastTick:100,skills:{smithing:0},equipment:{hammer:null},bank:{1:20},pack:[],collections:{40:9},brews:{},brewTier:{},perks:{},masteries:{},token:'secret',chat:'private'},context:{windows:[]},tick:100,guildInfo:{name:'Guild',tag:'G',private:'no'}}}});
test('client snapshot crops sensitive fields and never retains mutable game objects',()=>{const page=fixture(),result=readClient(page,10000);assert.equal(result.role,'42');assert.equal(result.snapshot.player.token,undefined);assert.equal(result.snapshot.player.chat,undefined);assert.equal(result.snapshot.guild,undefined);page.deepvein.session.state.bank[1]=99;assert.equal(result.snapshot.player.bank[1],20);});
test('client changes are delivered without a new server snapshot; unchanged reads do not emit',()=>{const page=fixture(),out=[],sync=createGameSync(page,e=>out.push(e),{now:()=>10000});sync.sample();sync.sample();assert.equal(out.length,1);assert.equal(out[0].source,'client');for(const field of ['skills','equipment','bank','pack','collections']){const state=page.deepvein.session.state;if(field==='pack')state.pack.push({itemId:1,qty:1});else state[field][field==='skills'?'smithing':field==='equipment'?'hammer':1]=123;sync.sample();assert.equal(out.at(-1).snapshot.player[field][field==='skills'?'smithing':field==='equipment'?'hammer':1]??out.at(-1).snapshot.player.pack.length,field==='pack'?1:123);}assert.equal(out.length,6);});
test('server data never overrides the client; fallback is explicit and role isolated',()=>{const page=fixture(),out=[],sync=createGameSync(page,e=>out.push(e));sync.sample();const server={role:'42',status:'live',snapshot:{...readClient(page).snapshot,player:{...readClient(page).snapshot.player,bank:{1:2}}}};sync.receive(server);assert.equal(out.at(-1).source,'client');page.deepvein.session.state.bank=null;sync.sample();assert.equal(out.at(-1).source,'server');assert.equal(out.at(-1).realtimeError,'incompatibleCharacter');page.deepvein.session.state.id=43;sync.sample();assert.equal(out.at(-1).role,null);page.deepvein.session.state.bank={};sync.sample();assert.equal(out.at(-1).role,'43');assert.equal(out.at(-1).source,'client');sync.dispose();const n=out.length;sync.sample();assert.equal(out.length,n);});
test('session replacement cannot reuse previous server data, including logout and loading',()=>{const page=fixture(),out=[],sync=createGameSync(page,e=>out.push(e));sync.sample();sync.receive({role:'42',status:'live',snapshot:readClient(page).snapshot});page.deepvein.session={state:null};sync.sample();assert.equal(out.at(-1).role,null);assert.equal(out.at(-1).snapshot,null);});
test('invalid identities or missing world state fail without guessing defaults',()=>{for(const value of [0,-1,1.2,'bad id',''])assert.equal(characterRole(value),null);const p=fixture();delete p.deepvein.session.context;assert.throws(()=>readClient(p),/invalidWorldBuffs/);p.deepvein.session.state.id=0;assert.throws(()=>readClient(p),/incompatibleCharacter/);});

test('route and queue projection crops nested extras and emits queue-only changes',()=>{
 const page=fixture(),player=page.deepvein.session.state,out=[];
 Object.assign(player,{route:{zoneId:null,jobId:41,phase:'toWork',after:{token:'private'},extra:'no'},queue:[{kind:'job',jobId:41,rarity:1,best:false,token:'private'}],queueSlots:3,workJobId:null,workRarity:0,held:false,raidHeld:false});
 const sync=createGameSync(page,value=>out.push(value),{now:()=>10000});sync.sample();
 const snapshot=out.at(-1).snapshot.player;
 assert.equal(snapshot.route.after,undefined);assert.equal(snapshot.route.extra,undefined);assert.equal(snapshot.queue[0].token,undefined);
 player.queue[0].rarity=2;player.route.jobId=42;sync.sample();
 assert.equal(out.length,2);assert.equal(snapshot.queue[0].rarity,1);assert.equal(snapshot.route.jobId,41);
 assert.equal(out.at(-1).snapshot.player.queue[0].rarity,2);assert.equal(out.at(-1).snapshot.player.queueSlots,3);
 sync.sample();assert.equal(out.length,2);sync.dispose();
});

test('malformed nested task values are rejected without traversing or copying their objects',()=>{
 const page=fixture(),player=page.deepvein.session.state;
 const secret={get token(){throw Error('must not traverse');}};
 Object.assign(player,{route:{zoneId:null,jobId:41,phase:secret},queue:[{kind:'job',jobId:41,limit:secret}],held:false});
 const snapshot=readClient(page).snapshot.player;
 assert.equal(snapshot.route,false);assert.deepEqual(snapshot.queue,[false]);
 player.queue=secret;assert.equal(readClient(page).snapshot.player.queue,false);
});

test('unused food, guild and depot fields do not cause deliveries or affect projection',()=>{
 const page=fixture(),out=[],sync=createGameSync(page,e=>out.push(e));sync.sample();Object.assign(page.deepvein.session.state,{foodItemId:1,eatAt:50,foodMaxTier:4,foodPerTrip:5,guildBonus:1,homeBank:99,ironman:true});page.deepvein.session.guildInfo={name:'Other',tag:'O'};Object.assign(page.deepvein.session.state,{brews:{elixir:99999},brewTier:{elixir:4},perks:{meals:5,pockets:3},masteries:{xp:20,move:10}});sync.sample();assert.equal(out.length,1);for(const field of ['foodItemId','eatAt','guildBonus','homeBank','ironman'])assert.equal(Object.hasOwn(out[0].snapshot.player,field),false);
});
test('invalid world data retains the known role and explicitly suspends live calculation',()=>{
 const page=fixture(),out=[],sync=createGameSync(page,e=>out.push(e));sync.sample();page.deepvein.session.context.windows=[{fromTick:0,toTick:200,rarityMult:'invalid'}];sync.sample();assert.equal(out.at(-1).role,'42');assert.equal(out.at(-1).status,'error');assert.equal(out.at(-1).snapshot,null);assert.equal(out.at(-1).error,'invalidWorldBuffs');page.deepvein.session.context.windows=[];sync.sample();assert.equal(out.at(-1).status,'live');
});

test('malformed world-window rows keep the known role and use the explicit world-data error',()=>{
 for(const row of [null,false,'invalid',[]]){const page=fixture(),out=[],sync=createGameSync(page,e=>out.push(e));sync.sample();page.deepvein.session.context.windows=[row];assert.throws(()=>readClient(page),/invalidWorldBuffs/);sync.sample();assert.equal(out.at(-1).role,'42');assert.equal(out.at(-1).status,'error');assert.equal(out.at(-1).error,'invalidWorldBuffs');assert.equal(out.at(-1).snapshot,null);sync.dispose();}
});
