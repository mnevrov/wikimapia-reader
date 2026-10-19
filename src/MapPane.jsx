import React, {useEffect, useMemo, useRef, useState} from 'react';
import L from 'leaflet';
import {wikimapiaCall} from './client.js';
import {AreaLoader} from './area.js';
import {areaCache} from './areaCache.js';
import {areaMessage} from './mapStatus.js';
import {hitTestPlaces} from './geometry.js';
import {DEMO_AREA} from './demo.js';
import {visibleInMap,contourStyle} from './mapPresentation.js';
import {useYandexUnderlay} from './useYandexUnderlay.js';
import {followMovement} from './gpsFollow.js';

function initialView() {
  try {
    const v=JSON.parse(localStorage.getItem('wikimapia-reader-view'));
    if (v && Number.isFinite(v.lat) && Math.abs(v.lat)<=85 && Number.isFinite(v.lng) && Math.abs(v.lng)<=180 && Number.isInteger(v.zoom) && v.zoom>=2 && v.zoom<=19) return v;
  } catch {}
  return {lat:55.752,lng:37.618,zoom:16};
}
export default function MapPane({zoomRequest,demo,apiKey,auto,active,paused,refresh,moreRequest,focus,location,gpsFollowing=false,onGpsPause,cacheEpoch,cacheView,selectedId,density,basemap,yandexKey,yandexReferer,onBasemapFallback,onBasemapConnected,onVisiblePlaces,onCandidates,onSelect,onState,onMessage}) {
  const el=useRef(null), mapRef=useRef(null), overlayRef=useRef(null), polygonsRef=useRef(new Map()),tileRef=useRef(null),yandexHost=useRef(null);
  const [viewport,setViewport]=useState(0);
  const [moving,setMoving]=useState(false);
  const [places,setPlaces]=useState(()=>demo?DEMO_AREA:[]);
  const blocked=useRef(false), retries=useRef(0);
  const followRef=useRef({active:false,pause:null});
  followRef.current={active:gpsFollowing,pause:onGpsPause};
  const markerRef=useRef(null),accuracyRef=useRef(null),lastFollow=useRef(null);
  const reduceMotion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [progress,setProgress]=useState({});
  const currentLoader=useRef(null),pick=useRef(null),dismissPick=useRef(null);
  const loader=useMemo(()=>new AreaLoader(opts=>wikimapiaCall('box',apiKey,opts), state=>{
    if(demo)return;
    setPlaces(state.displayPlaces??state.places);setProgress(state);onState(state);
    if(state.error)blocked.current=!state.retryable;
    else if(state.page&&(!state.more||state.page>=3))retries.current=0;
    onMessage(areaMessage(state));
  },areaCache),[demo,apiKey,cacheEpoch,onState,onMessage]);
  currentLoader.current=loader;
  pick.current=latlng=>{
    const map=mapRef.current;if(!map)return;
    const matches=hitTestPlaces(places,latlng,coords=>map.latLngToContainerPoint(coords));
    if(matches.length===1){onCandidates([]);onSelect(matches[0]);}else onCandidates(matches);
  };
  dismissPick.current=()=>onCandidates([]);
  useEffect(()=>{
    const v=initialView();
    const map=L.map(el.current,{zoomControl:false,attributionControl:false,inertia:false}).setView([v.lat,v.lng],v.zoom);
    tileRef.current=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);

    L.control.attribution({position:'bottomleft',prefix:false}).addTo(map);
    mapRef.current=map;overlayRef.current=L.featureGroup().addTo(map);setViewport(v=>v+1);
    map.on('click',event=>pick.current?.(event.latlng));
    map.on('dragstart',()=>{if(followRef.current.active)followRef.current.pause?.();});
    map.on('boxzoomstart',()=>{if(followRef.current.active)followRef.current.pause?.();});
    map.on('movestart',()=>{dismissPick.current?.();setMoving(true);retries.current=0;currentLoader.current?.invalidate();});
    map.on('moveend',()=>{
      dismissPick.current?.();setMoving(false);
      const c=map.getCenter();
      try{localStorage.setItem('wikimapia-reader-view',JSON.stringify({lat:c.lat,lng:c.lng,zoom:map.getZoom()}));}catch{}
      setViewport(v=>v+1);
    });
    const observer=new ResizeObserver(()=>map.invalidateSize());observer.observe(el.current);
    return()=>{observer.disconnect();polygonsRef.current.clear();markerRef.current=null;accuracyRef.current=null;lastFollow.current=null;map.remove();mapRef.current=null;tileRef.current=null;};
  },[]);
  useEffect(()=>{
    blocked.current=false;
    setPlaces(demo?DEMO_AREA:[]);
    onState({places:[],page:0,found:null,more:false,loading:false,error:''});
    onMessage(demo?'Демо · вымышленные объекты':'');
    return()=>loader.stop();
  },[demo,loader,onState,onMessage]);
  const loadRef=useRef(null);
  loadRef.current=(force=false)=>{
    const map=mapRef.current;
    if(demo||!apiKey||!active||!map)return;
    const b=map.getBounds();
    const bbox=[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];
    if(bbox[2]-bbox[0]>.035||bbox[3]-bbox[1]>.035){onMessage('Приблизьте карту для загрузки объектов');return;}
    // Fetch a small margin with the same documented box request. No requests for
    // unseen remote tiles; stay inside the existing 0.035 degree API safety bound.
    const dx=Math.min((bbox[2]-bbox[0])*.2,(.034999-(bbox[2]-bbox[0]))/2);
    const dy=Math.min((bbox[3]-bbox[1])*.2,(.034999-(bbox[3]-bbox[1]))/2);
    const padded=[Math.max(-180,bbox[0]-dx),Math.max(-85,bbox[1]-dy),Math.min(180,bbox[2]+dx),Math.min(85,bbox[3]+dy)];
    return loader.load(padded,{force,view:bbox});
  };
  useEffect(()=>{
    if(demo||!apiKey||!active||paused||moving||!auto||blocked.current){loader.stop();return;}
    const timer=setTimeout(()=>loadRef.current(),250);
    return()=>{clearTimeout(timer);loader.stop();};
  },[demo,apiKey,active,paused,auto,moving,viewport,loader]);
  useEffect(()=>{
    if(demo||!auto||!active||paused||moving||progress.loading||progress.draining||progress.error||!progress.more||progress.page>=3||blocked.current)return;
    const timer=setTimeout(()=>loader.more(),250);
    return()=>clearTimeout(timer);
  },[demo,auto,active,paused,moving,progress,loader]);
  useEffect(()=>{
    if(!auto||!active||paused||moving||!progress.error||!progress.retryable||retries.current>=2)return;
    const timer=setTimeout(()=>{retries.current++;if(progress.page&&progress.more)loader.more();else loadRef.current(true);},8000);
    return()=>clearTimeout(timer);
  },[auto,active,paused,moving,progress,loader]);
  useEffect(()=>{if(refresh){blocked.current=false;retries.current=0;loadRef.current(true);}},[refresh]);
  useEffect(()=>{if(moreRequest&&active&&!paused)loader.remaining();},[moreRequest]);
  // Reconcile only visible polygon layers. Avoid clearLayers() on each API page.
  useEffect(()=>{
    const map=mapRef.current,layer=overlayRef.current;if(!map||!layer)return;
    const view=map.getBounds();
    const bounds=[view.getWest(),view.getSouth(),view.getEast(),view.getNorth()];
    const visible=visibleInMap(places,bounds);
    onVisiblePlaces(visible);
    const desired=new Set();
    const styleZoom=map.getZoom();
    for(const p of visible){
      if(p.id===selectedId&&focus?.length>=3)continue;
      desired.add(p.id);
      const style=contourStyle(density,visible.length,styleZoom,p.id===selectedId);
      const current=polygonsRef.current.get(p.id);
      if(current){
        // A renewed response can replace geometry without replacing the layer object.
        if(current.coords!==p.coords){current.layer.setLatLngs(p.coords);current.coords=p.coords;}
        const key=JSON.stringify(style);
        if(current.styleSignature!==key){current.layer.setStyle(style);current.styleSignature=key;}
      }else{
        const polygon=L.polygon(p.coords,style).addTo(layer);
        polygonsRef.current.set(p.id,{layer:polygon,coords:p.coords,styleSignature:JSON.stringify(style)});
      }
    }
    for(const [id,record] of polygonsRef.current){
      if(!desired.has(id)){layer.removeLayer(record.layer);polygonsRef.current.delete(id);}
    }
  },[places,selectedId,focus,viewport,density,onVisiblePlaces]);
  useEffect(()=>{
    if(focus?.length<3||!focus||!mapRef.current)return;
    const map=mapRef.current;
    const p=L.polygon(focus,{color:'#f1a23b',weight:3,fillOpacity:.12}).addTo(map);
    map.fitBounds(focus,{maxZoom:17,paddingTopLeft:[24,88],paddingBottomRight:[32,Math.min(window.innerHeight*.52,420)]});
    return()=>p.remove();
  },[focus]);
  useEffect(()=>{
    if(!cacheView||!mapRef.current)return;
    const [w,s,e,n]=cacheView.bbox;
    mapRef.current.fitBounds([[s,w],[n,e]],{padding:[24,90],maxZoom:18});
  },[cacheView]);
  useEffect(()=>{if(zoomRequest&&mapRef.current)mapRef.current.setZoom(Math.max(2,Math.min(19,mapRef.current.getZoom()+zoomRequest.delta)));},[zoomRequest]);
  useEffect(()=>{
    if(!location||!mapRef.current)return;
    const map=mapRef.current,point=[location.lat,location.lng];
    if(!Number.isFinite(point[0])||!Number.isFinite(point[1]))return;
    if(!markerRef.current)markerRef.current=L.circleMarker(point,{radius:7,color:'#fff',weight:3,fillColor:'#2d86ff',fillOpacity:1}).addTo(map);
    else markerRef.current.setLatLng(point);
    const radius=Math.max(1,Math.min(Number(location.accuracy)||100,1000));
    if(!accuracyRef.current)accuracyRef.current=L.circle(point,{radius,color:'#2d86ff',weight:1,fillOpacity:.08}).addTo(map);
    else{accuracyRef.current.setLatLng(point);accuracyRef.current.setRadius(radius);}
    if(!gpsFollowing)return;
    const previous=lastFollow.current;
    if(previous){
      if(!followMovement(map.distance([previous.lat,previous.lng],point),Date.now()-previous.at,radius))return;
    }
    const currentZoom=map.getZoom();
    map.setView(point,Math.max(16,currentZoom),{animate:!reduceMotion,duration:.55});
    lastFollow.current={lat:location.lat,lng:location.lng,at:Date.now()};
  },[location,gpsFollowing]);
  const yandexActive=useYandexUnderlay({
    mapRef,hostRef:yandexHost,selected:basemap==='yandex',
    key:yandexKey,refererConfirmed:yandexReferer,
    onUnavailable:onBasemapFallback,onConnected:onBasemapConnected
  });
  useEffect(()=>{
    const map=mapRef.current,tile=tileRef.current;
    if(!map||!tile)return;
    if(yandexActive&&map.hasLayer(tile))map.removeLayer(tile);
    if(!yandexActive&&!map.hasLayer(tile))tile.addTo(map).bringToBack();
  },[yandexActive]);
  return <div className={`map-stack ${yandexActive?'has-yandex':''}`}>
    <div className="yandex-underlay" ref={yandexHost} aria-hidden="true"/>
    <div className="map" ref={el} aria-label="Карта"/>
  </div>;
}
