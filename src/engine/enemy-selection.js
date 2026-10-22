import * as game from './upstream.js';
export const monsterKey=monster=>`monster-${monster.id}`;
export function normalizeEnemySelection(value){
 return ['all',...game.monsters.map(monsterKey)].includes(value)?value:'all';
}
export function selectedEnemies(selection='all'){
 selection=normalizeEnemySelection(selection);
 return {
  monsters:game.monsters.filter(m=>selection==='all'||selection===monsterKey(m)),
 };
}
