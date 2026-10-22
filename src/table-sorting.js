import * as game from './engine/upstream.js';
export function itemLevel(id){return game.recipeLevel(game.baseItemId(id))??null;}
export function sortItemRows(rows,column='item',direction='asc',getId=row=>row.id){
 if(!['item','rarity'].includes(column)||!['asc','desc'].includes(direction))throw Error('invalidSort');
 const sign=direction==='asc'?1:-1;
 const compareLevel=(a,b)=>a===null?(b===null?0:1):b===null?-1:a-b;
 return rows.map((row,index)=>{const id=getId(row);return {row,index,id,base:game.baseItemId(id),level:itemLevel(id),tier:game.itemTier(id)};}).sort((a,b)=>{
  const primary=column==='rarity'?sign*(a.tier-b.tier):(a.level===null||b.level===null?compareLevel(a.level,b.level):sign*(a.level-b.level));
  return primary||compareLevel(a.level,b.level)||a.base-b.base||a.tier-b.tier||String(a.row.key??a.id).localeCompare(String(b.row.key??b.id),undefined,{numeric:true})||a.index-b.index;
 }).map(entry=>entry.row);
}

export function sortNumericRows(rows,value,direction='asc',getId=row=>row.id){
 if(!['asc','desc'].includes(direction))throw Error('invalidSort');
 const ranked=sortItemRows(rows,'item','asc',getId).map((row,index)=>{const number=value(row)??null;if(number!==null&&(typeof number!=='number'||!Number.isFinite(number)||number<0||number>Number.MAX_SAFE_INTEGER))throw Error('invalidSortValue');return {row,index,number};});
 const sign=direction==='asc'?1:-1;ranked.sort((a,b)=>a.number===null?(b.number===null?a.index-b.index:1):b.number===null?-1:sign*(a.number-b.number)||a.index-b.index);return ranked.map(entry=>entry.row);
}
