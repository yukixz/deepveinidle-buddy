import {sortItemRows} from './table-sorting.js';
const fields={points:'points',duration:'seconds',time:'secondsPerPoint',cost:'costPerPoint',coins:'cost'};
export function sortCollectionRows(rows,column='cost',direction='asc'){
 if(['item','rarity'].includes(column))return sortItemRows(rows,column,direction);
 const field=fields[column];if(!field||!['asc','desc'].includes(direction))throw Error('invalidSort');
 const ranked=rows.map(row=>{const value=row[field];if(value!==null&&value!==undefined&&(typeof value!=='number'||!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER))throw Error('invalidSortValue');return {row,value:value??null};});
 const sign=direction==='asc'?1:-1;
 ranked.sort((a,b)=>{
  if(a.value===null&&b.value!==null)return 1;if(b.value===null&&a.value!==null)return -1;
  const difference=a.value===null?0:sign*(a.value-b.value);
  return difference||a.row.job.levelReq-b.row.job.levelReq||String(a.row.key).localeCompare(String(b.row.key));
 });
 return ranked.map(r=>r.row);
}
