const key=p=>`${p.source}:${p.id}`;
export function favoriteOperations(before,after){
 const a=new Map(before.map(p=>[key(p),p])),b=new Map(after.map(p=>[key(p),p]));
 return [...before.filter(p=>!b.has(key(p))).map(place=>({place,remove:true})),...after.filter(p=>!a.has(key(p))||JSON.stringify(a.get(key(p)))!==JSON.stringify(p)).map(place=>({place,remove:false}))];
}
export function mergeAreas(a,b){const map=new Map();for(const r of [...a,...b]){const k=r.bbox.join(','),old=map.get(k);map.set(k,{...(!old||r.updated>=old.updated?r:old),pinned:!!(r.pinned||old?.pinned)});}return [...map.values()];}
