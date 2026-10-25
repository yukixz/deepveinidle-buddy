import * as game from './upstream.js';
import {collectionIds,collectionRoutes} from './collection-model.js';
const ids=new Set(collectionIds),record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function validateCollectionSelection(raw){
 if(!record(raw)||!Number.isSafeInteger(raw.itemId)||!ids.has(raw.itemId)||!Number.isSafeInteger(raw.jobId)||!collectionRoutes(raw.itemId).some(j=>j.id===raw.jobId)||!game.collectionThresholds(game.baseItemId(raw.itemId)).includes(raw.target))throw Error('invalidPlan');
 return {itemId:raw.itemId,jobId:raw.jobId,target:raw.target};
}
