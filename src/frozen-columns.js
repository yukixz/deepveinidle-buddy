// Store measured offsets on the host, outside the reconciled view.
export function installFrozenColumns(root){
 const tables=new Map([['recipe-candidates','recipes'],['purchase-materials','procurement'],['execution-actions','actions']]),observed=new Set();
 function measure(){
  for(const [id,key] of tables){
   const width=root.querySelector(`#${id} th`)?.getBoundingClientRect().width;
   if(width>0){const value=`${width}px`,property=`--${key}-item-width`;if(root.host.style.getPropertyValue(property)!==value)root.host.style.setProperty(property,value);}
  }
 }
 const observer=new root.ownerDocument.defaultView.ResizeObserver(measure);
 return {
  refresh(){
   const cells=new Set([...tables.keys()].map(id=>root.querySelector(`#${id} th`)).filter(Boolean));
   for(const cell of observed)if(!cells.has(cell)){observer.unobserve(cell);observed.delete(cell);}
   for(const cell of cells)if(!observed.has(cell)){observed.add(cell);observer.observe(cell);}
   measure();
  },
  dispose(){observer.disconnect();for(const key of tables.values())root.host.style.removeProperty(`--${key}-item-width`);},
 };
}
