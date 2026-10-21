import{siteRequest}from'./siteTransport.js';
import{parseSitePlace,parseSiteSearch}from'./siteHtml.js';
import{createTileSource}from'./siteTiles.js';
import{createDataSource}from'./dataSource.js';
import{wikimapiaCall}from'./client.js';
const getArea=createTileSource(siteRequest);
export function wikimapiaSource(key){return createDataSource({getKey:()=>key,api:wikimapiaCall,site:{
 getArea,
 getPlace:async(id,{signal}={})=>parseSitePlace((await siteRequest({url:`https://wikimapia.org/${id}/ru/`,signal})).text,id),
 search:async({query,lat,lon,signal})=>{
  if(typeof query!=='string'||!query.trim()||query.length>200||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180)throw Error('Некорректный поиск');
  const body=new URLSearchParams({y:String(Math.round(lat*1e7)),x:String(Math.round(lon*1e7)),z:'16',qu:query,jtype:'simple',start:'0',try:'0'}).toString();
  const r=await siteRequest({url:`https://wikimapia.org/search/?q=${encodeURIComponent(query.toLowerCase())}`,body,signal});return {...parseSiteSearch(r.text),source:'site'};
 }
}});}
