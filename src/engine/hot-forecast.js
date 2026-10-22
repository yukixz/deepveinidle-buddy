import {game} from './model.js';
import {hotSkills,hotKinds,normalizeSelection} from './forecast-filters.js';
export {hotSkills} from './forecast-filters.js';

export const epoch=Date.UTC(2026,0,1);
const rareSkills=new Set(['mining','fishing','woodcutting','farming','combat']);
export const tickTime=tick=>epoch+tick*game.tickMs;
export function forecast(now,skill='all',kind='all'){
 if(!Number.isFinite(now)||now<epoch)throw Error('invalidTime');
 const skills=normalizeSelection(skill,hotSkills),kinds=normalizeSelection(kind,hotKinds);
 const current=game.hotSkill(Math.floor((now-epoch)/game.tickMs));
 if(kinds.length===1&&kinds[0]==='rarity'&&skills.length&&!skills.some(skill=>rareSkills.has(skill)))return {current,entries:[],impossible:true};
 const filtered=skills.length>0||kinds.length>0,entries=[];
 let tick=current.until;
 for(let i=0;i<(filtered?366*48:48);i++){
  const hot=game.hotSkill(tick);
  if((!skills.length||skills.includes(hot.skill))&&(!kinds.length||kinds.includes(hot.kind)))entries.push(hot);
  if(filtered&&entries.length===10)break;
  tick=hot.until;
 }
 if(filtered&&entries.length!==10)throw Error('forecastIncomplete');
 return {current,entries,impossible:false};
}
