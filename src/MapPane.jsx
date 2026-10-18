import React, {useEffect, useMemo, useRef, useState} from 'react';
import L from 'leaflet';
import {wikimapiaCall} from './client.js';
import {AreaLoader} from './area.js';
import {DEMO_AREA} from './demo.js';

function initialView() {
  try {
    const v=JSON.parse(localStorage.getItem('wikimapia-reader-view'));
    if (v && Number.isFinite(v.lat) && Math.abs(v.lat)<=85 && Number.isFinite(v.lng) && Math.abs(v.lng)<=180 && Number.isInteger(v.zoom) && v.zoom>=2 && v.zoom<=19) return v;
  } catch {}
  return {lat:55.752,lng:37.618,zoom:16};
}
export default function MapPane({demo,apiKey,auto,active,paused,refresh,moreRequest,focus,location,onSelect,onState,onMessage}) {
  const el=useRef(null), mapRef=useRef(null), overlayRef=useRef(null);
  const [viewport,setViewport]=useState(0);
  const [moving,setMoving]=useState(false);
  const [places,setPlaces]=useState(()=>demo?DEMO_AREA:[]);
  const blocked=useRef(false);
  const currentLoader=useRef(null);
  const loader=useMemo(()=>new AreaLoader(opts=>wikimapiaCall('box',apiKey,opts), state=>{
    if(demo)return;
    setPlaces(state.places);onState(state);
    if(state.error){blocked.current=true;onMessage(state.error);}
    else if(state.loading)onMessage(state.page?'Загружаем следующую страницу…':'Загружаем область…');
    else if(state.page)onMessage(`${state.places.length} объектов${state.found!==null?` из ${state.found}`:''}`);
  }),[demo,apiKey,onState,onMessage]);
  currentLoader.current=loader;
  useEffect(()=>{
    const v=initialView();
    const map=L.map(el.current,{zoomControl:false,attributionControl:false}).setView([v.lat,v.lng],v.zoom);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
    L.control.zoom({position:'topright'}).addTo(map);
    L.control.attribution({position:'bottomleft',prefix:false}).addTo(map);
    mapRef.current=map;overlayRef.current=L.featureGroup().addTo(map);
    map.on('movestart',()=>{setMoving(true);currentLoader.current?.invalidate();});
    map.on('moveend',()=>{
      setMoving(false);
      const c=map.getCenter();
      try{localStorage.setItem('wikimapia-reader-view',JSON.stringify({lat:c.lat,lng:c.lng,zoom:map.getZoom()}));}catch{}
      setViewport(v=>v+1);
    });
    const observer=new ResizeObserver(()=>map.invalidateSize());observer.observe(el.current);
    return()=>{observer.disconnect();map.remove();mapRef.current=null;};
  },[]);
  useEffect(()=>{
    blocked.current=false;
    setPlaces(demo?DEMO_AREA:[]);
    onState({places:[],page:0,found:null,more:false,loading:false,error:''});
    onMessage(demo?'Демо · вымышленные объекты':auto?'Остановите карту, чтобы загрузить объекты':'Нажмите обновление, чтобы загрузить область');
    return()=>loader.stop();
  },[demo,loader,onState,onMessage]);
  const loadRef=useRef(null);
  loadRef.current=(force=false)=>{
    const map=mapRef.current;
    if(demo||!apiKey||!active||!map)return;
    if(map.getZoom()<16){onMessage('Приблизьте карту: масштаб 16+');return;}
    const b=map.getBounds();
    const bbox=[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];
    if(bbox[2]-bbox[0]>.035||bbox[3]-bbox[1]>.035){onMessage('Приблизьте карту для загрузки объектов');return;}
    return loader.load(bbox,{force});
  };
  useEffect(()=>{
    if(demo||!apiKey||!active||paused||moving||!auto||blocked.current){loader.stop();return;}
    const timer=setTimeout(()=>loadRef.current(),900);
    return()=>{clearTimeout(timer);loader.stop();};
  },[demo,apiKey,active,paused,auto,moving,viewport,loader]);
  useEffect(()=>{if(refresh){blocked.current=false;loadRef.current(true);}},[refresh]);
  useEffect(()=>{if(moreRequest&&active&&!paused)loader.more();},[moreRequest]);
  useEffect(()=>{
    const layer=overlayRef.current;if(!layer)return;layer.clearLayers();
    for(const p of places){if(p.coords.length>=3)L.polygon(p.coords,{color:'#28c7a4',weight:2,fillColor:'#28c7a4',fillOpacity:.12}).on('click',()=>onSelect(p)).addTo(layer);}
  },[places,onSelect]);
  useEffect(()=>{
    if(focus?.length<3||!focus||!mapRef.current)return;
    const map=mapRef.current;
    const p=L.polygon(focus,{color:'#f1a23b',weight:3,fillOpacity:.16}).addTo(map);
    map.fitBounds(focus,{maxZoom:17,paddingTopLeft:[24,88],paddingBottomRight:[32,Math.min(window.innerHeight*.52,420)]});
    return()=>p.remove();
  },[focus]);
  useEffect(()=>{
    if(!location||!mapRef.current)return;
    const map=mapRef.current;
    map.setView([location.lat,location.lng],17);
    const marker=L.circleMarker([location.lat,location.lng],{radius:7,color:'#fff',weight:3,fillColor:'#2d86ff',fillOpacity:1}).addTo(map);
    const circle=L.circle([location.lat,location.lng],{radius:Math.min(location.accuracy,1000),color:'#2d86ff',weight:1,fillOpacity:.08}).addTo(map);
    return()=>{marker.remove();circle.remove();};
  },[location]);
  return <div className="map" ref={el} aria-label="Карта"/>;
}
