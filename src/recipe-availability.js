// Candidates are assessed independently against the same market snapshot.
export function hasAvailableAsks(materials,prices){
 return Object.entries(materials).every(([id,required])=>{
  if(!Number.isFinite(required)||required<0||required>Number.MAX_SAFE_INTEGER)throw Error('quantityOverflow');
  if(required===0)return true;
  const item=prices.getItem(Number(id));
  return item.sellPrice!==null&&Number.isSafeInteger(item.sellQuantity)&&item.sellQuantity>=Math.ceil(required);
 });
}
