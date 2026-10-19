import {useEffect,useRef,useState} from 'react';
import {requestYandexJsApi} from './yandexUsage.js';

// Leaflet remains the gesture/geometry owner. YMap paints only the underlay.
// This avoids a second hit-test engine and preserves Wikimapia caching/selection.
export function useYandexUnderlay({mapRef,hostRef,selected,key,refererConfirmed,onUnavailable}){
 const instance=useRef(null),schemeLayer=useRef(null),appliedTheme=useRef(null),raf=useRef(0),[active,setActive]=useState(false);
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
    // Set both scheme and map palettes: an independent layer can otherwise
    // retain the original colors after the application theme changes.
    const scheme=new sdk.YMapDefaultSchemeLayer({theme});
    ymap.addChild(scheme);
    if(cancelled){ymap.destroy?.();return;}
    instance.current=ymap;schemeLayer.current=scheme;appliedTheme.current=theme;setActive(true);
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
   schemeLayer.current=null;appliedTheme.current=null;
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
  const root=document.documentElement;
  const update=()=>{
   const native=instance.current,scheme=schemeLayer.current;
   if(!native||!scheme)return;
   const theme=root.dataset.theme==='light'?'light':'dark';
   if(appliedTheme.current===theme)return;
   try{
    native.update({theme});
    scheme.update({theme});
    appliedTheme.current=theme;
   }catch{
    warn.current?.('Не удалось переключить тему Яндекс Карт. Возвращена OSM.');
   }
  };
  // Pick up any change made while the SDK is loading; follow system theme too.
  update();
  const observer=new MutationObserver(update);
  observer.observe(root,{attributes:true,attributeFilter:['data-theme']});
  return()=>observer.disconnect();
 },[active]);
 return active;
}
