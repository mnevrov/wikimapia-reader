import {readFavorites} from './favorites.js';
import {readHistory} from './readingHistory.js';
export const BACKUP_FORMAT='wikireader-library';
export const BACKUP_VERSION=1;
const maxLen=10*1048576;
function validId(id){return Number.isSafeInteger(id)&&id>0;}
function cleanOffline(items){
  if(!Array.isArray(items)||items.length>5000)throw new Error('Недопустимое количество офлайн-карточек');
  const unique=new Map();
  for(const item of items){
    if(!item||!validId(item.id)||typeof item.title!=='string'||typeof item.description!=='string'||item.title.length>1000||item.description.length>400000)
      throw new Error('Некорректная офлайн-карточка в резервной копии');
    if(!Array.isArray(item.comments)||item.comments.length>500)throw new Error('Некорректные комментарии');
    const comments=item.comments.map(c=>{
      if(!c||typeof c.author!=='string'||typeof c.text!=='string'||c.author.length>250||c.text.length>30000)
        throw new Error('Некорректный комментарий');
      return {author:c.author,text:c.text,date:typeof c.date==='string'?c.date.slice(0,40):null};
    });
    const savedAt=Number(item.savedAt);
    if(!Number.isSafeInteger(savedAt)||savedAt<1577836800000||savedAt>Date.now()+86400000)
      throw new Error('Некорректная дата сохранения');
    // No arbitrary URLs, HTML, credentials, media or location are restored.
    unique.set(item.id,{id:item.id,title:item.title,description:item.description,comments,savedAt});
  }
  return [...unique.values()];
}
export function buildBackup({favorites,history,offline}){
  return {
    format:BACKUP_FORMAT,version:BACKUP_VERSION,exportedAt:new Date().toISOString(),
    mediaIncluded:false,
    favorites:readFavorites(JSON.stringify(favorites||[])).filter(x=>x.source==='wikimapia'),
    history:JSON.parse(JSON.stringify(history||[])).map(x=>({id:x.id,title:x.title,viewedAt:x.viewedAt})),
    offline:cleanOffline((offline||[]).map(x=>({id:x.id,title:x.title,description:x.description||'',comments:x.comments||[],savedAt:x.savedAt})))
  };
}
export function parseBackup(raw){
  if(typeof raw!=='string'||new TextEncoder().encode(raw).length>maxLen)throw new Error('Файл слишком велик (максимум 10 МБ)');
  let data;try{data=JSON.parse(raw);}catch{throw new Error('Файл не является корректным JSON');}
  if(!data||data.format!==BACKUP_FORMAT||data.version!==BACKUP_VERSION||data.mediaIncluded!==false)
    throw new Error('Неизвестный формат или версия резервной копии');
  if(!Array.isArray(data.favorites)||data.favorites.length>5000||!Array.isArray(data.history)||data.history.length>500||!Array.isArray(data.offline))
    throw new Error('Повреждённые списки в резервной копии');
  return {
    favorites:readFavorites(JSON.stringify(data.favorites)).filter(x=>x.source==='wikimapia'),
    history:readHistory(JSON.stringify(data.history)),
    offline:cleanOffline(data.offline)
  };
}
