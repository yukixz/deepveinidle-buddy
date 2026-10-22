import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';

// Select upstream declarations by semantic signature; preserve their source verbatim.
const sourceInfo={sourceUrl:'https://deepveinidle.com/assets/index-CsTNPJ8i.js',retrieved:'2026-10-22',changelogVersion:'1.0.1199',sha256:'f7fb9a6b608d353de6a107c68ed99c990642f99260d41676073385285c9489a6'};
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const source = fs.readFileSync('vendor/game-original.js','utf8');
if(hash(source)!==sourceInfo.sha256)throw Error('Unreviewed upstream snapshot: review source metadata, export mappings and signatures before extraction');
const ast = parse(source,{ecmaVersion:'latest',sourceType:'module',ranges:true});
const declarations = new Map();
for (const node of ast.body) {
  if (node.type === 'FunctionDeclaration') declarations.set(node.id.name,{name:node.id.name,start:node.start,end:node.end,text:source.slice(node.start,node.end)});
  if (node.type === 'VariableDeclaration') for(const d of node.declarations) {
    // Keep destructuring together, so dependent constants retain original initialization.
    const ids=[]; const walk=n=>{if(!n)return;if(n.type==='Identifier')ids.push(n.name);else if(n.type==='ObjectPattern')n.properties.forEach(p=>walk(p.value));else if(n.type==='ArrayPattern')n.elements.forEach(walk);};walk(d.id);
    const entry={name:ids.join(','),start:d.start,end:d.end,text:node.kind+' '+source.slice(d.start,d.end)+';'};
    ids.forEach(id=>declarations.set(id,entry));
  }
}
// Reviewed public build mappings; the source hash guards every symbol.
const exportsMap={
  "questDay": "an",
  "questWeek": "v2",
  "monsters": "Rt",
  "equipment": "DH",
  "items": "cs",
  "marketFamilies": "QK",
  "marketFamily": "JO",
  "gear": "He",
  "item": "Ho",
  "canSell": "De",
  "vendorPrice": "ee",
  "encode": "as",
  "withRarity": "xc",
  "levelXp": "tt",
  "level": "$o",
  "maxLevel": "nd",
  "accuracy": "In",
  "maxHit": "Qd",
  "evasion": "Nn",
  "hitChance": "Dd",
  "magic": "ti",
  "style": "kt",
  "attackTicks": "qy",
  "maxHp": "La",
  "equipmentSlots": "on",
  "masteries": "Rn",
  "rooms": "Te",
  "foodBuff": "TO",
  "preferredBankFood": "Wh",
  "cropDuration": "lY",
  "isCrop": "kK",
  "damageReduction": "LT",
  "brewScale": "ze",
  "combine": "pa",
  "bosses": "Ak",
  "bossStats": "Lj",
  "bossWeakMultiplier": "Vj",
  "bossOtherMultiplier": "Jj",
  "tickMs": "uo",
  "strength": "iI",
  "armour": "rI",
  "magicDefenceScale": "Ty",
  "maxEnhancement": "St",
  "potions": "UO",
  "potionDurationTicks": "df",
  "recipes": "xo",
  "translations": "bL",
  "worldTranslations": "zL",
  "uiTranslations": "gL",
  "homeTranslations": "pL",
  "houseBonus": "qn",
  "houseDamageCap": "rW",
  "masteryRankLimit": "aT",
  "masteryRankCost": "Yd",
  "masteryTotalCost": "tT",
  "masteriesTotalCost": "Il",
  "masteryEarnedPoints": "Pn",
  "collectionThresholds": "Mr",
  "collectionPoints": "EK",
  "collectionItems": "Ll",
  "combatTick": "GI",
  "killMonster": "pI",
  "combatRarityMultiplier": "gI",
  "rarityThresholds": "yd",
  "mountRarityThresholds": "Sd",
  "mountChance": "cB",
  "baseAttackTicks": "Fr",
  "combatPetChance": "af",
  "combatPetItem": "uK",
  "isPet": "Na",
  "voidShardChance": "fI",
  "voidShardQuantity": "bI",
  "voidShardItemId": "id",
  "mountItemId": "xd",
  "abyssalGoldBonus": "Lk",
  "baseItemId": "fo",
  "itemTier": "jo",
  "coinItemId": "va",
  "hotSkill": "Zf",
  "masteryOfflineBaseHours": "lh",
  "predict": "Jr",
  "offline": "f7",
  "tick": "KP",
  "world": "j",
  "startFight": "xi",
  "resetActivity": "Da",
  "depositPack": "QW",
  "homeBank": "nG",
  "combatTargetTile": "dN",
  "nearbyTile": "vt",
  "predictionStartTick": "_b",
  "predictionChunkTicks": "nA",
  "allSkills": "Jc",
  "createContext": "_H",
  "fullFoodLoad": "$n",
  "perks": "uv",
  "hotXp": "Ix",
  "hotRare": "Nx",
  "tools": "PH",
  "tool": "Os",
  "toolLuck": "ry",
  "equipmentLuck": "fi",
  "brewRarityMultiplier": "hS",
  "houseRarityMultiplier": "vf",
  "masteryMultiplier": "ba",
  "mountSpeed": "rS",
  "randomFloat": "ly",
  "canEnhance": "os",
  "enhanceChance": "r2",
  "enhanceCost": "Fh",
  "enhanceXp": "CI",
  "enhanceTicks": "od",
  "protectionMin": "Yt",
  "startWork": "Gs",
  "workChance": "uP",
  "workModifiers": "hP",
  "recipeInputs": "Ye",
  "burnChance": "fB",
  "workXpMultiplier": "lG",
  "caughtChance": "rP",
  "packCapacity": "fa",
  "lootBoxItemId": "pi",
  "nearestWorkSite": "DW",
  "armourMultiplier": "s2",
  "restock": "rN",
  "upgradeRecipes": "hd",
  "upgradeResult": "xh",
  "upgradeMaterials": "eG",
  "applyUpgrade": "LI",
  "recipeLevel": "PI",
  "windowModifiers": "Vn",
  "hotRarityMultiplier": "Np",
  "skillPet": "fK",
  "skillPetChance": "yy",
  "itemSupportsRarity": "_f",
  "bonusMinimumUncommon": "Yf",
  "addPack": "ja",
  "enhancementTargetLimit": "HO",
  "enhanceMasteryMultiplier": "Vy",
  "enhanceMasteryBonusCap": "MW",
  "recipeRarity": "AO",
  "recipeOutput": "mi",
  "collectionExcluded": "XK"
};
const selected=new Set(); const allowed=new Set(['WeakSet','WeakMap','Uint8Array','Uint16Array','Uint32Array','Int32Array','Float64Array','Math','Map','Set','Number','Object','Array','String','Error','Date','Boolean','Infinity','undefined','JSON','RegExp','parseInt','parseFloat']);
function collect(name){
 const d=declarations.get(name);if(!d)throw Error('Missing declaration '+name);if(selected.has(d))return;selected.add(d);
 const a=parse(d.text,{ecmaVersion:'latest',sourceType:'module',ranges:true});
 const refs=analyze(a,{ecmaVersion:2024,sourceType:'module'}).globalScope.through.map(r=>r.identifier.name);
 for(const dep of new Set(refs))if(declarations.has(dep))collect(dep);else if(!allowed.has(dep))throw Error(`Unexpected external dependency ${dep} in ${name}`);
}
Object.values(exportsMap).forEach(collect);
const ordered=[...selected].sort((a,b)=>a.start-b.start);
fs.mkdirSync('src',{recursive:true});
fs.writeFileSync('src/engine/upstream.js','// GENERATED from reviewed vendor snapshots. Do not edit.\n'+ordered.map(d=>d.text).join('\n')+'\nexport { '+Object.entries(exportsMap).map(([alias,name])=>`${name} as ${alias}`).join(', ')+' };\n');
fs.writeFileSync('vendor/manifest.json',JSON.stringify({...sourceInfo,exports:exportsMap,declarations:ordered.map(({name,start,end,text})=>({name,start,end,sha256:hash(text)})),overrides:[]},null,2));
console.log(`Extracted ${ordered.length} original declarations (${fs.statSync('src/engine/upstream.js').size} bytes).`);
