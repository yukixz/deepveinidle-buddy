export function validateSimulationSeed(seed){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('Invalid simulation seed');
 return seed;
}
