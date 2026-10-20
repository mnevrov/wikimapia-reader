// Only minimal, non-sensitive fields are retained. No API keys, geometry or descriptions.
export const HISTORY_KEY='wikireader-reading-history-v1';
export const HISTORY_ENABLED_KEY='wikireader-reading-history-enabled';
export const HISTORY_LIMIT=50;
const validId=id=>Number.isSafeInteger(id)&&id>0;
const validTitle=title=>typeof title==='string'&&!!title.trim();
const validTime=t=>Number.isSafeInteger(t)&&t>=1577836800000&&t<=Date.now()+86400000;
export function readHistory(raw){
  let input;
  try{input=JSON.parse(raw||'[]');}catch{return [];}
  if(!Array.isArray(input))return [];
  const found=new Map();
  for(const item of input.slice(0,500)){
    if(!item||!validId(item.id)||!validTitle(item.title)||!validTime(item.viewedAt))continue;
    const current=found.get(item.id);
    if(!current||item.viewedAt>current.viewedAt)
      found.set(item.id,{id:item.id,title:item.title.trim().slice(0,140),viewedAt:item.viewedAt});
  }
  return [...found.values()].sort((a,b)=>b.viewedAt-a.viewedAt).slice(0,HISTORY_LIMIT);
}
export function recordHistory(items,place,at=Date.now()){
  const entries=readHistory(JSON.stringify(items));
  if(!place||place.source==='demo'||!validId(place.id)||!validTitle(place.title)||!validTime(at))return entries;
  return [{id:place.id,title:place.title.trim().slice(0,140),viewedAt:at},...entries.filter(x=>x.id!==place.id)].slice(0,HISTORY_LIMIT);
}
export function filterLibrary(items,query,{searchDescription=false}={}){
  const term=String(query||'').trim().toLocaleLowerCase('ru');
  if(!term)return items;
  return items.filter(item=>String(item.title||'').toLocaleLowerCase('ru').includes(term)
   ||(searchDescription&&String(item.description||'').toLocaleLowerCase('ru').includes(term))
   ||String(item.id).includes(term));
}
