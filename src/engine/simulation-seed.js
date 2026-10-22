export function validateSimulationSeed(seed){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('Invalid simulation seed');
 return seed;
}

export function randomSimulationSeed(){
 return crypto.getRandomValues(new Uint32Array(1))[0];
}
