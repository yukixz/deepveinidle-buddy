// Estimated coins may exceed the exact-integer range; quantities use their own guards.
export function amount(value){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw Error('invalidAmount');
 return value;
}
export const addAmount=(a,b)=>amount(amount(a)+amount(b));
export const multiplyAmount=(a,b)=>amount(amount(a)*amount(b));
export function divideAmount(value,divisor){
 if(typeof divisor!=='number'||!Number.isFinite(divisor)||divisor<=0)throw Error('invalidAmount');
 return amount(amount(value)/divisor);
}
// null means missing data; error distinguishes a failed estimate from a missing quote.
export function estimateAmount(calculate,...errors){
 if(errors.some(Boolean))return {value:null,error:'invalidAmount'};
 try{const value=calculate();return {value:value===null?null:amount(value),error:null};}
 catch(error){if(error.message!=='invalidAmount')throw error;return {value:null,error:'invalidAmount'};}
}
export const amountError=(field,result)=>result.error?{[field+'Error']:result.error}:{};
