// Local-only discovery helpers: no network, credentials or storage access.
import {polygonBounds} from './mapPresentation.js';
const rad=Math.PI/180;
export function polygonCenter(place){
  const b=polygonBounds(place?.coords);
  return b?{lat:(b[1]+b[3])/2,lng:(b[0]+b[2])/2}:null;
}
export function distanceMeters(a,b){
  if(!a||!b||![a.lat,a.lng,b.lat,b.lng].every(Number.isFinite))return null;
  const la=(b.lat-a.lat)*rad,lo=(b.lng-a.lng)*rad;
  const q=Math.sin(la/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(lo/2)**2;
  return 12742000*Math.asin(Math.min(1,Math.sqrt(q)));
}
// Shoelace on an equirectangular plane; used for relative area ordering only.
export function polygonAreaMeters(place){
  const points=place?.coords;
  if(!Array.isArray(points)||points.length<3||!polygonBounds(points))return 0;
  const mid=polygonCenter(place).lat*rad,dx=111195*Math.cos(mid),dy=111195;
  let twice=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    twice+=(a[1]*dx)*(b[0]*dy)-(b[1]*dx)*(a[0]*dy);
  }
  return Math.abs(twice)/2;
}
export function discoverPlaces(places,{text='',filter='all',sort='title',favorites=[],offline=[],location=null}={}){
  const fav=new Set(favorites.filter(x=>x.source==='wikimapia').map(x=>x.id));
  const saved=new Set(offline.map(x=>x.id));
  const needle=String(text).trim().toLocaleLowerCase('ru');
  const result=(Array.isArray(places)?places:[]).filter(p=>
    (filter!=='favorite'||fav.has(p.id))&&
    (filter!=='offline'||saved.has(p.id))&&
    (!needle||String(p.title||'').toLocaleLowerCase('ru').includes(needle)||String(p.id).includes(needle))
  );
  const distance=p=>distanceMeters(location,polygonCenter(p));
  return result.sort((a,b)=>{
    if(sort==='distance'&&location){
      const da=distance(a),db=distance(b);
      if(da!==null&&db!==null&&da!==db)return da-db;
    }
    if(sort==='area'){const da=polygonAreaMeters(a),db=polygonAreaMeters(b);if(da!==db)return db-da;}
    return String(a.title||'').localeCompare(String(b.title||''),'ru')||a.id-b.id;
  });
}
export function distanceLabel(distance){
  if(distance===null||!Number.isFinite(distance))return '';
  return distance<1000?`≈ ${Math.round(distance/10)*10} м до центра`:`≈ ${(distance/1000).toFixed(1)} км до центра`;
}
