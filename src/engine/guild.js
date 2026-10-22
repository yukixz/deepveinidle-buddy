// Only retain the public identity of the character's own guild.
export function readGuild(value){
 if(value===undefined||value===null)return null;
 if(typeof value!=='object'||Array.isArray(value)||typeof value.name!=='string'||!value.name.trim()||typeof value.tag!=='string'||!value.tag.trim())throw Error('invalidSnapshot');
 return {name:value.name,tag:value.tag};
}
