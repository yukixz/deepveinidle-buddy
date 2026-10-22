export const hotSkills=['mining','fishing','woodcutting','farming','thieving','cooking','smithing','fletching','herblore','crafting','enhancing','combat'];
export const hotKinds=['xp','rarity'];
export const forecastStorageKey='dvi-forecast-filters-v1';

// Empty arrays mean no restriction; retain the original single-value API.
export function normalizeSelection(value,allowed){
 const values=value==='all'?[]:typeof value==='string'?[value]:value;
 if(!Array.isArray(values)||values.some(item=>!allowed.includes(item)))throw Error('invalidFilter');
 const selected=allowed.filter(item=>values.includes(item));
 return selected.length===allowed.length?[]:selected;
}
export function toggleSelection(current,value,allowed){
 return value==='all'?[]:normalizeSelection(current.includes(value)?current.filter(item=>item!==value):[...current,value],allowed);
}
export function parseForecastFilters(raw){
 if(!raw||raw.version!==1||!Array.isArray(raw.skills)||!Array.isArray(raw.kinds))throw Error('invalidFilter');
 return {skills:normalizeSelection(raw.skills,hotSkills),kinds:normalizeSelection(raw.kinds,hotKinds)};
}
