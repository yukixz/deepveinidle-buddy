const valid=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const tick=value=>Number.isSafeInteger(value)&&value>=0;
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

// Shared capture contract: missing capability cannot prove rarity is zero.
export function readWorldBuffs(snapshot){
 const reset=warning=>({weeklyXp:0,worldRarity:0,warning});
 if(snapshot.worldBuffsVersion!==1)return reset('worldBuffs.upgrade');
 const windows=snapshot.worldBuffs,at=snapshot.worldTick;
 if(!tick(at)||!Array.isArray(windows)||!windows.every(w=>record(w)&&tick(w.fromTick)&&tick(w.toTick)&&w.toTick>=w.fromTick&&valid(w.xpMult??1,1,100001)&&valid(w.rarityMult??1,1,100001)))return reset('weeklyXp.reset');
 const active=windows.filter(w=>w.fromTick<=at&&at<=w.toTick);
 const sum=key=>Math.round(active.reduce((total,w)=>total+((w[key]??1)-1)*100,0)*1e8)/1e8;
 const weeklyXp=sum('xpMult'),worldRarity=sum('rarityMult');
 if(!valid(weeklyXp,0,1e7)||!valid(worldRarity,0,1e7))return reset('weeklyXp.reset');
 return {weeklyXp,worldRarity};
}

export function worldBuffWarningText(language,warning,{rarity=true}={}){
 const zhField=rarity?'经验与稀有度':'经验',enField=rarity?'XP and rarity were':'XP was';
 if(warning==='worldBuffs.upgrade')return language==='zh'
  ?`【世界增益】请更新 userscript 至 2.8.0 或更新版本，刷新游戏后重新捕获并导入；世界增益${zhField}已重置为 0%。`
  :`[World buffs] Update userscript to 2.8.0 or later, refresh the game, recapture and import again. World buff ${enField} reset to 0%.`;
 if(warning==='weeklyXp.reset')return language==='zh'
  ?`【世界增益】数据缺失或无效，世界增益${zhField}已重置为 0%，请手动配置。`
  :`[World buffs] Missing or invalid data. World buff ${enField} reset to 0%; please configure manually.`;
 return '';
}
