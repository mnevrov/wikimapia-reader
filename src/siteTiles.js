// Public itiles are a website format, not a promise of complete coverage or unlimited access.
export function tileAddress(x,y,z){
 const n=2**z;if(!Number.isInteger(z)||z<1||z>15||![x,y].every(Number.isInteger)||x<0||y<0||x>=n||y>=n)throw Error('Некорректный тайл');
 let id='0';y=n-y-1;for(let b=z-1;b>=0;b--)id+=((x>>b)&1)+2*((y>>b)&1);
 return {id,url:`https://wikimapia.org/z1/itiles/${id.match(/.{1,3}/g).join('/')}.xy`};
}
function polygon(encoded,type){
 if(encoded.length>500000)throw Error('Большой контур');
 const points=[];
 if(type===1){let i=0,x=0,y=0;
  const number=()=>{let v=0,shift=0,c;do{if(i>=encoded.length||shift>30)throw Error('Повреждённый контур');c=encoded.charCodeAt(i++)-63;if(c<0||c>63)throw Error('Повреждённый контур');v|=(c&31)<<shift;shift+=5;}while(c>=32);return (v&1)?~(v>>>1):v>>>1;};
  while(i<encoded.length){x+=number();y+=number();const scale=Math.abs(y)>90e6?1e7:1e6;points.push([y/scale,x/scale]);if(points.length>30000)throw Error('Большой контур');}
 }else if(type===0){
  const parts=encoded.split(';');if(parts.length!==3||!/^\d+$/.test(parts[2].slice(0,2))&&!/^[a-f\d]{2}/i.test(parts[2]))throw Error('Неизвестная геометрия');
  let x=Number(parts[0]),y=Number(parts[1]);const width=parseInt(parts[2].slice(0,2),16)+1,hex=parts[2].slice(2);if(width<1||width>4||hex.length%(width*4)||!/^[a-f\d]*$/i.test(hex))throw Error('Неизвестная геометрия');
  points.push([y/1e7,x/1e7]);const signed=t=>{let v=0;for(let i=0;i<width;i++)v+=parseInt(t.slice(i*2,i*2+2),16)*2**(8*(width-i-1));return v>2**(8*width-1)-1?v-(width===1?256:2**(8*width)-1):v;};
  for(let i=0;i<hex.length;i+=width*4){x-=signed(hex.slice(i,i+width*2));y-=signed(hex.slice(i+width*2,i+width*4));points.push([y/1e7,x/1e7]);if(points.length>30000)throw Error('Большой контур');}
 }else throw Error('Неизвестная кодировка');
 if(points.length<3||points.some(([a,b])=>!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a)>90||Math.abs(b)>180))throw Error('Некорректный контур');return points;
}
export function parseSiteTile(text,expectedId){
 if(typeof text!=='string'||text.length>4194304)throw Error('Повреждённый тайл');
 const lines=text.split('\n'),header=lines.shift().trim().split('|');if(header[0]!==expectedId||!['0','1'].includes(header[1])||header.length<3)throw Error('Неожиданный тайл');
 const places=new Map();let invalid=0;
 for(const line of lines){if(!line.trim())continue;
  try{const f=line.split('|'),id=Number(f[0]),bbox=f[2]?.split(',').map(Number);if(f.length<8||!Number.isSafeInteger(id)||id<1||bbox?.length!==4||bbox.some(v=>!Number.isFinite(v))||bbox[0]>bbox[1]||bbox[2]>bbox[3]||Math.max(Math.abs(bbox[0]),Math.abs(bbox[1]))>180e7||Math.max(Math.abs(bbox[2]),Math.abs(bbox[3]))>90e7)throw Error();
   const titles=f[5].split('\x1f'),title=(titles.find(t=>t.charCodeAt(0)===33)||titles[0]||' Без названия').slice(1);
   places.set(id,{id,title,coords:polygon(f.slice(7).join('|'),Number(f[6])),url:`https://wikimapia.org/${id}/ru/`});
  }catch{invalid++;}
 }
 if(invalid)throw Error('Тайл содержит повреждённые объекты');
 return {places:[...places.values()],deeperTiles:header[1]==='1'};
}
export function createTileSource(request){
 const cache=new Map();let bytes=0;
 return async({bbox,signal,force=false})=>{
  signal?.throwIfAborted();if(!Array.isArray(bbox)||bbox.length!==4||bbox.some(v=>!Number.isFinite(v))||bbox[0]>=bbox[2]||bbox[1]>=bbox[3]||bbox[0]<-180||bbox[2]>180||bbox[1]<-85||bbox[3]>85||bbox[2]-bbox[0]>.035||bbox[3]-bbox[1]>.035)throw Error('Приблизьте карту для загрузки объектов');
  const z=15,n=2**z,tx=lon=>Math.min(n-1,Math.max(0,Math.floor((lon+180)/360*n))),ty=lat=>Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n);
  const unique=new Map();let complete=true,count=0;const total=(tx(bbox[2])-tx(bbox[0])+1)*(ty(bbox[1])-ty(bbox[3])+1);
  outer:for(let x=tx(bbox[0]);x<=tx(bbox[2]);x++)for(let y=ty(bbox[3]);y<=ty(bbox[1]);y++){
   if(++count>16){complete=false;break outer;}
   signal?.throwIfAborted();const address=tileAddress(x,y,z);let entry=cache.get(address.id);
   if(!entry||force||Date.now()-entry.at>300000){const r=await request({url:address.url,signal}),data=parseSiteTile(r.text,address.id);signal?.throwIfAborted();if(entry)bytes-=entry.bytes;entry={data,at:Date.now(),bytes:r.text.length*2};cache.delete(address.id);cache.set(address.id,entry);bytes+=entry.bytes;while(cache.size>32||bytes>8*1024*1024){const key=cache.keys().next().value;bytes-=cache.get(key).bytes;cache.delete(key);}}
   if(entry.data.deeperTiles)complete=false;for(const p of entry.data.places)unique.set(p.id,p);
  }
  return {places:[...unique.values()],complete:complete&&total<=16,source:'site'};
 };
}
