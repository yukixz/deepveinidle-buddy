import {game} from './model.js';
// Missing upstream terms only: game translations always take precedence.
export const fallbackTranslations={
"Upgrades":"升级",
"Pickaxe":"镐","Fishing rod":"鱼竿","Axe":"斧",
"Pan":"平底锅","Hammer":"锤","Knife":"刀","Mortar":"研钵","Needle":"针"};
export const dictionary={...fallbackTranslations,...game.uiTranslations,...game.worldTranslations,...game.translations,...game.homeTranslations};
export const translatedName=(text,language)=>language==='zh'?(dictionary[text]??text):text;
// Rarity is displayed separately; translate the original base item name.
export const translatedItemName=(id,language)=>translatedName(game.item(game.baseItemId(id)).name,language);
