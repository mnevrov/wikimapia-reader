import {useEffect,useRef,useState} from 'react';
import {requestYandexJsApi} from './yandexUsage.js';

// Leaflet remains the gesture/geometry owner. YMap paints only the underlay.
// This avoids a second hit-test engine and preserves Wikimapia caching/selection.
export function useYandexUnderlay({mapRef,hostRef,selected,key,refererConfirmed,onUnavailable}){
 const instance=useRef(null),raf=useRef(0),[active,setActive]=useState(false);
 const warn=useRef(onUnavailable);warn.current=onUnavailable;
 useEffect(()=>{
  if(!selected||!key||!refererConfirmed){setActive(false);return;}
  let cancelled=false;
  requestYandexJsApi({selected:true,key,refererConfigured:refererConfirmed,publiclyAccessible:true}).then(result=>{
   if(cancelled)return;
   if(!result.active){
    setActive(false);
    warn.current?.(result.reason==='sdk-unavailable'?'Яндекс Карты недоступны. Возвращена карта OSM.':'Не удалось подключить Яндекс. Проверьте ключ и HTTP Referer.');
    return;
   }
   const map=mapRef.current,host=hostRef.current;
   if(!map||!host)return;
   try{
    const sdk=result.api,c=map.getCenter();
    const theme=document.documentElement.dataset.theme==='light'?'light':'dark';
    const ymap=new sdk.YMap(host,{
     location:{center:[c.lng,c.lat],zoom:map.getZoom()},
     theme,behaviors:[],zoomRounding:'smooth'
    });
    ymap.addChild(new sdk.YMapDefaultSchemeLayer());
    if(cancelled){ymap.destroy?.();return;}
    instance.current=ymap;setActive(true);
   }catch{
    setActive(false);
    warn.current?.('Не удалось создать тёмную карту Яндекса. Возвращена OSM.');
   }
  });
  return()=>{
   cancelled=true;
   if(raf.current){cancelAnimationFrame(raf.current);raf.current=0;}
   if(instance.current){
    try{instance.current.destroy?.();}catch{}
    instance.current=null;
   }
   setActive(false);
  };
 },[selected,key,refererConfirmed,mapRef,hostRef]);
 useEffect(()=>{
  const map=mapRef.current;
  if(!map)return;
  const sync=()=>{
   if(raf.current||!instance.current)return;
   raf.current=requestAnimationFrame(()=>{
    raf.current=0;
    const native=instance.current,leaflet=mapRef.current;
    if(!native||!leaflet)return;
    const c=leaflet.getCenter();
    native.update({location:{center:[c.lng,c.lat],zoom:leaflet.getZoom(),duration:0}});
   });
  };
  map.on('move',sync);map.on('resize',sync);
  sync();
  return()=>{map.off('move',sync);map.off('resize',sync);if(raf.current){cancelAnimationFrame(raf.current);raf.current=0;}};
 },[active,mapRef]);
 useEffect(()=>{
  const native=instance.current;
  if(!native||!active)return;
  native.update({theme:document.documentElement.dataset.theme==='light'?'light':'dark'});
 },[active]);
 useEffect(()=>{
  const root=document.documentElement;
  const update=()=>instance.current?.update({theme:root.dataset.theme==='light'?'light':'dark'});
  const observer=new MutationObserver(update);
  observer.observe(root,{attributes:true,attributeFilter:['data-theme']});
  return()=>observer.disconnect();
 },[]);
 return active;
}
