import * as game from './upstream.js';
export function rarityProbabilities(multiplier,thresholds=game.rarityThresholds){
 const cumulative=['uncommon','rare','epic','legendary'].map(key=>Math.min(1,Math.max(0,thresholds[key]*multiplier)));
 return [1-cumulative[0],cumulative[0]-cumulative[1],cumulative[1]-cumulative[2],cumulative[2]-cumulative[3],cumulative[3]];
}
