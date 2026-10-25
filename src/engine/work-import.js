import * as game from './upstream.js';

export function importWorkConfig(current,snapshot,{skills,slots,potions,rooms,masteries,perks,normalize,gear}){
 const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),valid=(v,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max,int=(v,min=0,max=Number.MAX_SAFE_INTEGER)=>valid(v,min,max)&&Number.isInteger(v);
 if(!record(snapshot)||snapshot.version!==2||!int(snapshot.capturedAt,1)||snapshot.capturedAt>Date.now()+60000||!record(snapshot.player)||!int(snapshot.player.lastTick))throw Error('invalidSnapshot');
 const s=normalize(current),p=snapshot.player,warnings=[];
 const put=(field,value,check,set)=>{if(check(value))set(value);else warnings.push(field);};
 for(const k of skills)put(`skills.${k}`,p.skills?.[k],v=>valid(v),v=>s.levels[k]=game.level(v));
 for(const slot of slots){const id=p.equipment?.[slot];if(id===null){s.gear[slot]={id:0,tier:0,plus:0};continue;}
  put(`equipment.${slot}`,id,v=>int(v,1)&&gear(slot,v)?.slot===slot&&int(game.itemTier(v),0,4)&&int(Math.floor(v/game.encode(0,1)),0,game.maxEnhancement),v=>s.gear[slot]={id:game.baseItemId(v),tier:game.itemTier(v),plus:Math.floor(v/game.encode(0,1))});
 }
 for(const {kind}of potions){
  if(!record(p.brews)||!int(p.brews[kind]??0)){warnings.push(`brews.${kind}`);continue;}
  if((p.brews[kind]??0)<=p.lastTick){s.brews[kind]=-1;continue;}
  const buckets=p.brewBuckets?.[kind];let tier=p.brewTier?.[kind]??0;
  if(buckets!==undefined){if(!Array.isArray(buckets)||buckets.length!==5||!buckets.every(v=>int(v))){warnings.push(`brewBuckets.${kind}`);continue;}const elapsed=Math.max(0,p.lastTick-(p.brews[kind]-buckets.reduce((a,b)=>a+b,0)));let sum=0;tier=-1;for(let i=4;i>=0;i--){sum+=buckets[i];if(elapsed<sum){tier=i;break;}}}
  put(`brewTier.${kind}`,tier,v=>int(v,0,4),v=>s.brews[kind]=v);
 }
 for(const r of rooms){if(!record(p.house)||!record(p.houseFurniture)){warnings.push(`house.${r.id}`);continue;}put(`house.${r.id}`,p.house[r.id]??0,v=>int(v),v=>s.house[r.id]=record(p.houseFurniture[r.id])?v:0);}
 for(const m of masteries)put(`masteries.${m.id}`,p.masteries?.[m.id]??(record(p.masteries)?0:undefined),v=>int(v,0,game.masteryRankLimit),v=>s.masteries[m.id]=v);
 for(const perk of perks)put(`perks.${perk.id}`,p.perks?.[perk.id]??(record(p.perks)?0:undefined),v=>int(v,0,perk.ranks),v=>s.perks[perk.id]=v);
 if('blessing' in s){if(record(p.brews)&&int(p.brews.blessing??0))s.blessing=(p.brews.blessing??0)>p.lastTick;else warnings.push('blessing');}
 return {state:normalize(s),capturedAt:snapshot.capturedAt,warnings};
}
