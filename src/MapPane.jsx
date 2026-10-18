import React, {useEffect, useMemo, useRef, useState} from 'react';
import L from 'leaflet';
import {wikimapiaCall} from './client.js';
import {AreaLoader} from './area.js';
import {areaCache} from './areaCache.js';
import {areaMessage} from './mapStatus.js';
import {hitTestPlaces} from './geometry.js';
import {DEMO_AREA} from './demo.js';

function initialView() {
  try {
    const v=JSON.parse(localStorage.getItem('wikimapia-reader-view'));
    if (v && Number.isFinite(v.lat) && Math.abs(v.lat)<=85 && Number.isFinite(v.lng) && Math.abs(v.lng)<=180 && Number.isInteger(v.zoom) && v.zoom>=2 && v.zoom<=19) return v;
  } catch {}
  return {lat:55.752,lng:37.618,zoom:16};
}
export default function MapPane({zoomRequest,demo,apiKey,auto,active,paused,refresh,moreRequest,focus,location,cacheEpoch,cacheView,selectedId,onCandidates,onSelect,onState,onMessage}) {
  const el=useRef(null), mapRef=useRef(null), overlayRef=useRef(null);
  const [viewport,setViewport]=useState(0);
  const [moving,setMoving]=useState(false);
  const [places,setPlaces]=useState(()=>demo?DEMO_AREA:[]);
  const blocked=useRef(false), retries=useRef(0);
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
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);

    L.control.attribution({position:'bottomleft',prefix:false}).addTo(map);
    mapRef.current=map;overlayRef.current=L.featureGroup().addTo(map);
    map.on('click',event=>pick.current?.(event.latlng));
    map.on('movestart',()=>{dismissPick.current?.();setMoving(true);retries.current=0;currentLoader.current?.invalidate();});
    map.on('moveend',()=>{
      dismissPick.current?.();setMoving(false);
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
  useEffect(()=>{
    const layer=overlayRef.current;if(!layer)return;layer.clearLayers();
    for(const p of places){if(p.id===selectedId&&focus?.length>=3)continue;if(p.coords.length>=3)L.polygon(p.coords,{color:p.id===selectedId?'#f1a23b':'#16ac8d',weight:p.id===selectedId?3:1.5,fill:p.id===selectedId,fillColor:'#f1a23b',fillOpacity:.12}).addTo(layer);}
  },[places,selectedId,focus]);
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
    const map=mapRef.current;
    map.setView([location.lat,location.lng],17);
    const marker=L.circleMarker([location.lat,location.lng],{radius:7,color:'#fff',weight:3,fillColor:'#2d86ff',fillOpacity:1}).addTo(map);
    const circle=L.circle([location.lat,location.lng],{radius:Math.min(location.accuracy,1000),color:'#2d86ff',weight:1,fillOpacity:.08}).addTo(map);
    return()=>{marker.remove();circle.remove();};
  },[location]);
  return <div className="map" ref={el} aria-label="Карта"/>;
}
