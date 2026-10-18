export function readFavorites(value){
  try{
    const list=JSON.parse(value||'[]');if(!Array.isArray(list))return[];
    const unique=new Map();
    for(const item of list){
      const id=typeof item==='number'?item:item?.id;
      if(!Number.isSafeInteger(id)||id<=0)continue;
      const source=['demo','wikimapia'].includes(item?.source)?item.source:'wikimapia';
      const title=item?.source&&typeof item.title==='string'?item.title:`Объект #${id}`;
      unique.set(`${source}:${id}`,{id,source,title});
    }
    return [...unique.values()];
  }catch{return[];}
}
export function toggleFavorite(list,place){
 const exists=list.some(x=>x.id===place.id&&x.source===place.source);
 return exists?list.filter(x=>x.id!==place.id||x.source!==place.source):[...list,place];
}
