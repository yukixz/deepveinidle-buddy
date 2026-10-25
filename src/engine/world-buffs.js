const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const tick=v=>Number.isSafeInteger(v)&&v>=0;
export function readWorldBuffs(snapshot){
 const at=snapshot.worldTick,windows=snapshot.worldBuffs;
 if(snapshot.worldBuffsVersion!==1||!tick(at)||!Array.isArray(windows)||!windows.every(w=>record(w)&&tick(w.fromTick)&&tick(w.toTick)&&w.toTick>=w.fromTick&&(w.rarityMult===undefined||typeof w.rarityMult==='number'&&Number.isFinite(w.rarityMult)&&w.rarityMult>=1&&w.rarityMult<=100001)))throw Error('invalidWorldBuffs');
 const worldRarity=Math.round(windows.filter(w=>w.fromTick<=at&&at<=w.toTick).reduce((sum,w)=>sum+((w.rarityMult??1)-1)*100,0)*1e8)/1e8;
 if(!Number.isFinite(worldRarity)||worldRarity>1e7)throw Error('invalidWorldBuffs');
 return {worldTick:at,worldRarity};
}
