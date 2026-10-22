// UI uses M and M/h; calculations and stored intent use coins and coins/minute.
const scales={fixed:1e6,percent:1,minute:1e6/60};
const valid=value=>Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER;
function scale(key){if(!Object.hasOwn(scales,key))throw Error('invalidNumber');return scales[key];}
export function feeInputMax(key){return Number.MAX_SAFE_INTEGER/scale(key);}
export function feeToInput(key,value){const factor=scale(key);if(!valid(value))throw Error('invalidNumber');return Number((value/factor).toPrecision(15));}
export function feeFromInput(key,value){const factor=scale(key);if(!Number.isFinite(value)||value<0)throw Error('invalidNumber');const amount=value*factor;if(!valid(amount))throw Error('quantityOverflow');return amount;}
