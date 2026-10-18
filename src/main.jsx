import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './style.css';
import { wikimapiaCall } from './client.js';
import { normalizeArea, normalizePlace, diagnosticError, geometryOf } from './api.js';
import MapPane from './MapPane.jsx';
import Details from './Details.jsx';
import {usePlatform} from './usePlatform.js';
import {Geolocation} from '@capacitor/geolocation';
import {useTheme} from './useTheme.js';
import { DEMO_DETAILS } from './demo.js';

function App() {
  const [themePreference,setThemePreference] = useTheme();
  const [demo,setDemo] = useState(true);
  const [key,setKey] = useState('');
  const [draftKey,setDraftKey] = useState('');
  const [placeId,setPlaceId] = useState('55');
  const [auto,setAuto] = useState(()=>{try{return localStorage.getItem('wikimapia-reader-auto')!=='false';}catch{return true;}});
  const [moreRequest,setMoreRequest] = useState(0);
  const [area,setArea] = useState({places:[],page:0,found:null,more:false,loading:false});
  const [location,setLocation] = useState(null);
  const [locating,setLocating] = useState(false);
  const [query,setQuery] = useState('');
  const [results,setResults] = useState([]);
  const [searchBusy,setSearchBusy] = useState(false);
  const searchAbort = useRef(null);
  const [refresh,setRefresh] = useState(0);
  const [focus,setFocus] = useState(null);
  const [selected,setSelected] = useState(null);
  const [details,setDetails] = useState(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('Демонстрационные данные: не настоящие объекты Wikimapia');
  const [settings,setSettings] = useState(false);
  const [favorites,setFavorites] = useState(() => { try { const v=JSON.parse(localStorage.getItem('wikimapia-reader-favorites')||'[]'); return Array.isArray(v)?v.filter(Number.isSafeInteger):[]; }catch{return [];} });
  const request = useRef(0);
  const detailAbort = useRef(null);
  const locationJob = useRef(0);
  const onSelect = React.useCallback(async place => {
    detailAbort.current?.abort();
    const n=++request.current;
    const controller = new AbortController(); detailAbort.current=controller;
    setSelected(place);setDetails(null);setError('');
    if (demo) { setDetails(DEMO_DETAILS[place.id]);setBusy(false);return; }
    setBusy(true);
    try { const payload=await wikimapiaCall('place.getbyid', key, {id:place.id,signal:controller.signal}); if(n===request.current){setDetails(normalizePlace(payload));setFocus(geometryOf(payload));} }
    catch(e){if(n===request.current)setError(diagnosticError(e));}
    finally{if(n===request.current)setBusy(false);}
  },[demo,key]);
  const onClose = () => {detailAbort.current?.abort();request.current++;setSelected(null);setDetails(null);setError('');setBusy(false);setFocus(null);};
  const active=usePlatform(()=>{if(settings)setSettings(false);else if(selected)onClose();else return false;return true;});
  useEffect(()=>{if(!active){detailAbort.current?.abort();searchAbort.current?.abort();request.current++;if(busy)setError('Загрузка прервана при уходе в фон. Нажмите «Повторить».');setBusy(false);setSearchBusy(false);locationJob.current++;setLocating(false);}},[active]);
  useEffect(()=>()=>{detailAbort.current?.abort();searchAbort.current?.abort();},[]);
  const locate=async()=>{
    if(locating)return;const job=++locationJob.current;setLocating(true);setNotice('Определяем местоположение…');
    try{
      const p=await Geolocation.getCurrentPosition({enableHighAccuracy:false,timeout:12000,maximumAge:60000});
      if(job!==locationJob.current)return;
      onClose();setLocation({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy});setNotice('Местоположение определено');
    }catch{if(job===locationJob.current)setNotice('Местоположение недоступно. Разрешите доступ к геопозиции и проверьте, включена ли она.');}
    finally{if(job===locationJob.current)setLocating(false);}
  };
  const search=async e=>{
    e.preventDefault();searchAbort.current?.abort();const controller=new AbortController();searchAbort.current=controller;
    setSearchBusy(true);setResults([]);
    try{let center={lat:55.752,lng:37.618};try{const saved=JSON.parse(localStorage.getItem('wikimapia-reader-view'));if(saved)center=saved;}catch{}
      const payload=await wikimapiaCall('search',key,{query,lat:center.lat,lon:center.lng,signal:controller.signal});
      if(!controller.signal.aborted){setResults(normalizeArea(payload));setNotice(`Поиск: ${normalizeArea(payload).length} объектов из ${payload.found ?? '?'}`);}
    }catch(e){if(!controller.signal.aborted)setNotice(diagnosticError(e));}
    finally{if(searchAbort.current===controller)setSearchBusy(false);}
  };
  const resetSearch=()=>{searchAbort.current?.abort();setSearchBusy(false);setResults([]);};
  const toggleFavorite = id => {const next=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];setFavorites(next);try{localStorage.setItem('wikimapia-reader-favorites',JSON.stringify(next));}catch{setNotice('Не удалось сохранить избранное на этом устройстве.');}};
  return <main className={selected?'has-sheet':''}>
    <MapPane demo={demo} apiKey={key} auto={auto} active={active} paused={settings||!!selected} refresh={refresh} moreRequest={moreRequest} focus={focus} location={location} onSelect={onSelect} onState={setArea} onMessage={setNotice} />
    <div className="topbar"><div className="logo"><span className="logo-mark">◈</span><span>Wiki<span className="accent">Reader</span></span></div><button className="settings" onClick={()=>setSettings(v=>!v)}>⚙ Настройки</button></div>
    <div className="status" role="status" aria-live="polite">{demo?'● ДЕМО':'● API'} <span>{notice}</span></div>
    {settings && <aside className="settings-panel"><div className="settings-head"><strong>Настройки</strong><button className="icon-btn" aria-label="Закрыть настройки" onClick={()=>setSettings(false)}>×</button></div><fieldset className="theme-choice"><legend>Оформление</legend><div>{[["dark","Чёрная"],["light","Светлая"],["system","Как в системе"]].map(([id,label])=><button type="button" key={id} aria-pressed={themePreference===id} onClick={()=>setThemePreference(id)}>{label}</button>)}</div></fieldset><label className="auto-choice"><input type="checkbox" checked={auto} onChange={e=>{setAuto(e.target.checked);try{localStorage.setItem('wikimapia-reader-auto',String(e.target.checked));}catch{}}}/>Автозагрузка области</label><p className="small">После остановки карты загружается первая страница. Минимум 6 секунд между запросами; остальные страницы — по кнопке «Ещё».</p><p className="small">Для реальных данных примените свой ключ. Для краткой проверки доступен публичный example из документации (общий лимит). Демо содержит вымышленные объекты.</p>
      <label htmlFor="api-key">API-ключ Wikimapia</label><input id="api-key" type="password" autoComplete="off" spellCheck="false" value={draftKey} onChange={e=>setDraftKey(e.target.value)} placeholder="Введите ключ локально" />
      <button className="primary" disabled={!draftKey.trim()} onClick={()=>{onClose();resetSearch();setKey(draftKey.trim());setDemo(false);setRefresh(0);setNotice('Ключ применён. Можно открыть объект по ID или загрузить область.');}}>Применить ключ</button>
      <button className="ghost" onClick={()=>{onClose();resetSearch();setDemo(true);setKey('');setDraftKey('');setRefresh(0);setFocus(null);setNotice('Демонстрационные данные: не настоящие объекты Wikimapia');}}>Включить демо</button>
      {!demo && <><form className="search-form" onSubmit={search}><label htmlFor="place-query">Поиск объектов</label><div><input id="place-query" type="search" value={query} maxLength={200} onChange={e=>setQuery(e.target.value)} placeholder="Название места"/><button className="primary" disabled={searchBusy||!query.trim()}>{searchBusy?'Ищем…':'Найти'}</button></div></form>{results.length>0&&<ul className="search-results">{results.map(p=><li key={p.id}><button onClick={()=>{setSettings(false);onSelect(p);}}>{p.title}<small>#{p.id}</small></button></li>)}</ul>}</>}
      {!demo && <div className="open-id"><label htmlFor="place-id">ID объекта Wikimapia</label><input id="place-id" type="number" min="1" value={placeId} onChange={e=>setPlaceId(e.target.value)} /><button className="primary" onClick={()=>{if(!Number.isSafeInteger(Number(placeId))||Number(placeId)<1){setNotice('Неверный ID объекта');return;}onSelect({id:Number(placeId),title:'Объект '+placeId});}}>Открыть по ID</button></div>}
      {favorites.length>0 && <div className="saved"><strong>Избранные ID</strong>{favorites.map(id=><button className="ghost" key={id} onClick={()=>{if(demo && !DEMO_DETAILS[id]){setNotice('Примените ключ для реального объекта');return;}onSelect({id,title:'Объект '+id});}}>#{id}</button>)}</div>}
      <p className="settings-feedback" role="status">{notice}</p><p className="small">Ключ хранится только в памяти приложения до перезапуска. Не отправляйте его в чат или репозиторий. Для веб-режима возможна ошибка CORS; Android использует нативный HTTP.</p>
      <a target="_blank" rel="noreferrer" href="https://wikimapia.org/api?action=create_key">Получить ключ на Wikimapia ↗</a></aside>}
    <div className="map-actions"><button className="icon-btn locate" aria-label="Моё местоположение" disabled={locating} onClick={locate}>{locating?'…':'⌖'}</button>{!demo && <button className="primary" disabled={area.loading||!active} onClick={()=>{onClose();setRefresh(v=>v+1);}}>{area.loading?'Загрузка…':'Загрузить область'}</button>}{!demo&&area.more&&<button className="ghost" disabled={area.loading} onClick={()=>setMoreRequest(v=>v+1)}>Ещё 50</button>}</div>
    <div className="lower-hint">Нажми на выделенный контур, чтобы открыть карточку</div>
    <Details data={details || (selected ? {id:selected.id,title:selected.title} : null)} busy={busy} error={error} onClose={onClose} onRetry={()=>selected&&onSelect(selected)} favorites={favorites} toggleFavorite={toggleFavorite}/>
    <div className="credits">Данные © участники Wikimapia · {demo?'Демо':'WikiReader'}</div>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
