// Independent reference: run the unmodified offline engine with no account
// quests. Split before midnight so each segment has one day/week identifier.
export function questlessOffline(native,player,context,endTick){
 const counters=['deaths','coins','kills','deposits','drops','bonuses','burnt'];
 const result={skills:{},itemsGained:{},...Object.fromEntries(counters.map(k=>[k,0]))};
 while(player.lastTick<endTick){
  const first=player.lastTick+1,day=Math.floor(first/144000);
  player.quests={day,week:Math.floor(day/7),daily:[],weekly:[]};
  const report=native.offline(player,context,Math.min(endTick,(day+1)*144000-1));
  for(const [skill,value]of Object.entries(report.skills)){
   result.skills[skill]??={xp:0};result.skills[skill].xp+=value.xp;
  }
  for(const [id,qty]of Object.entries(report.itemsGained))result.itemsGained[id]=(result.itemsGained[id]??0)+qty;
  for(const key of counters)result[key]+=report[key];
 }
 return result;
}
