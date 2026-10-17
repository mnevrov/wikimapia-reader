import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';
import { wikimapiaCall } from './client.js';
import { normalizeArea, normalizePlace, diagnosticError, geometryOf } from './api.js';
import { DEMO_AREA, DEMO_DETAILS } from './demo.js';

const DEFAULT_CENTER = [55.752, 37.618];
function MapPane({ demo, apiKey, refresh, focus, onSelect, onError, onCount }) {
  const el = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);
  const job = useRef(0);
  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = L.map(el.current, {zoomControl: false, attributionControl: false}).setView(DEFAULT_CENTER, 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
    L.control.zoom({position: 'topright'}).addTo(map);
    // Attribution must stay visible even when the bottom sheet covers the map.
    L.control.attribution({position: 'topright', prefix: false}).addTo(map);
    mapRef.current = map;
    overlayRef.current = L.featureGroup().addTo(map);
    return () => { map.remove(); mapRef.current = null; overlayRef.current = null; };
  }, []);
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const controller = new AbortController();
    async function load() {
      const requestId = ++job.current;
      const overlay = overlayRef.current;
      if (!overlay) return;
      overlay.clearLayers();
      if (!demo && !apiKey) { onCount('Введите ключ API для реальных объектов'); return; }
      if (!demo && !refresh) { onCount('Нажмите «Загрузить область». Официальный API: box.'); return; }
      if (!demo && map.getZoom() < 16) { onCount('Увеличьте карту до масштаба 16+'); return; }
      let places;
      if (demo) { places = DEMO_AREA; }
      else {
        const b = map.getBounds();
        const bbox = [b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];
        try { places = normalizeArea(await wikimapiaCall('box', apiKey, {bbox, signal:controller.signal})); }
        catch (e) { if (requestId === job.current) { onError(diagnosticError(e)); onCount('Нет данных'); } return; }
      }
      if (requestId !== job.current) return;
      for (const place of places) {
        if (place.coords.length < 3) continue;
        L.polygon(place.coords, {color: '#16c7a3',weight: 2.6,fillColor:'#16c7a3',fillOpacity:0.19})
          .on('click', () => onSelect(place)).addTo(overlay);
      }
      onCount(`${places.length} объектов${!demo && places.length === 50 ? ' (только первая страница)' : ''}`);
      if (!demo && places.length && !places.some(p => p.coords.length >= 3)) onError('API вернул объекты, но геометрия отличается от поддерживаемых примеров. Нужен реальный образец JSON.');
    }
    load();
    return () => { controller.abort(); job.current++; };
  }, [demo, apiKey, refresh, onSelect, onError, onCount]);
  useEffect(() => {
    if (focus?.length >= 3 && mapRef.current) {
      const map=mapRef.current;
      const polygon=L.polygon(focus,{color:'#de7900',weight:3,fillOpacity:0.15}).addTo(map);
      map.fitBounds(focus, {maxZoom:17});
      return ()=>polygon.remove();
    }
  },[focus]);
  return <div className="map" ref={el} aria-label="Карта" />;
}
function Details({data, busy, error, onClose, onRetry, favorites, toggleFavorite}) {
  const [tab, setTab] = useState('description');
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { setTab('description'); setExpanded(false); }, [data?.id]);
  if (!data && !busy && !error) return null;
  return <section className={`sheet ${expanded ? 'expanded' : ''}`} aria-label="Информация об объекте">
    <div className="handle" onClick={() => setExpanded(x=>!x)} role="button" tabIndex="0" onKeyDown={e=>e.key==='Enter'&&setExpanded(x=>!x)} aria-label="Развернуть карточку" />
    <div className="sheet-header"><div><div className="eyebrow">WIKIMAPIA · ОБЪЕКТ</div><h2>{data?.title || 'Загрузка объекта…'}</h2></div><div className="header-actions"><button className="icon-btn" onClick={()=>setExpanded(x=>!x)} title="Развернуть">{expanded?'▾':'▴'}</button><button className="icon-btn" onClick={onClose} title="Закрыть">×</button></div></div>
    {busy ? <p className="content-hint">Загружаем сведения…</p> : error ? <div className="error">{error}<button className="ghost" onClick={onRetry}>Повторить</button></div> : <>
      <div className="tabs" role="tablist">
        {[["description","Описание"],["photos","Фото"],["comments","Комментарии"]].map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}{id==='photos' ? ` · ${data.photos?.length ?? 0}` : id==='comments' ? ` · ${data.comments?.length ?? 0}`:''}</button>)}
      </div>
      <div className="sheet-scroll">
        {tab==='description' && <p className="description">{data.description || 'Описание пока не добавлено.'}</p>}
        {tab==='photos' && (data.photos?.length ? <div className="photos">{data.photos.map((p,i)=><div key={i}><a href={p.src} target="_blank" rel="noreferrer"><img src={p.src} alt={`Фото ${i+1}`} loading="lazy" /></a><small>{p.author}</small></div>)}</div>:<p className="content-hint">Фотографий пока нет или они недоступны через API.</p>)}
        {tab==='comments' && (data.comments?.length ? data.comments.map((c,i)=><article className="comment" key={i}><b>{c.author}</b><p>{c.text}</p></article>):<p className="content-hint">Комментарии отсутствуют или не возвращаются API.</p>)}
      </div>
      <div className="sheet-footer"><button className="ghost" onClick={()=>toggleFavorite(data.id)}>{favorites.includes(data.id)?'★ Сохранено':'☆ В избранное'}</button><a className="primary" href={data.url} target="_blank" rel="noopener noreferrer">Wikimapia ↗</a></div>
    </>}
  </section>;
}
function App() {
  const [demo,setDemo] = useState(true);
  const [key,setKey] = useState('');
  const [draftKey,setDraftKey] = useState('');
  const [placeId,setPlaceId] = useState('55');
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
  const reportCount = React.useCallback(message=>{if(!message.startsWith('Нет данных'))setNotice(message);}, []);
  const onClose = () => {detailAbort.current?.abort();request.current++;setSelected(null);setDetails(null);setError('');setBusy(false);};
  const toggleFavorite = id => {const next=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];setFavorites(next);try{localStorage.setItem('wikimapia-reader-favorites',JSON.stringify(next));}catch{setNotice('Не удалось сохранить избранное на этом устройстве.');}};
  return <main>
    <MapPane demo={demo} apiKey={key} refresh={refresh} focus={focus} onSelect={onSelect} onError={setNotice} onCount={reportCount} />
    <div className="topbar"><div className="logo"><span className="logo-mark">◈</span><span>Wiki<span className="accent">Reader</span></span></div><button className="settings" onClick={()=>setSettings(v=>!v)}>⚙ Настройки</button></div>
    <div className="status">{demo?'● ДЕМО':'● API'} <span>{notice}</span></div>
    {settings && <aside className="settings-panel"><div className="settings-head"><strong>Источник данных</strong><button className="icon-btn" aria-label="Закрыть настройки" onClick={()=>setSettings(false)}>×</button></div><p className="small">Для реальных данных примените свой ключ. Для краткой проверки доступен публичный example из документации (общий лимит). Демо содержит вымышленные объекты.</p>
      <label htmlFor="api-key">API-ключ Wikimapia</label><input id="api-key" type="password" autoComplete="off" spellCheck="false" value={draftKey} onChange={e=>setDraftKey(e.target.value)} placeholder="Введите ключ локально" />
      <button className="primary" disabled={!draftKey.trim()} onClick={()=>{onClose();setKey(draftKey.trim());setDemo(false);setRefresh(0);setNotice('Ключ применён. Можно открыть объект по ID или загрузить область.');}}>Применить ключ</button>
      <button className="ghost" onClick={()=>{onClose();setDemo(true);setKey('');setDraftKey('');setRefresh(0);setFocus(null);setNotice('Демонстрационные данные: не настоящие объекты Wikimapia');}}>Включить демо</button>
      {!demo && <div className="open-id"><label htmlFor="place-id">ID объекта Wikimapia</label><input id="place-id" type="number" min="1" value={placeId} onChange={e=>setPlaceId(e.target.value)} /><button className="primary" onClick={()=>{if(!Number.isSafeInteger(Number(placeId))||Number(placeId)<1){setNotice('Неверный ID объекта');return;}onSelect({id:Number(placeId),title:'Объект '+placeId});}}>Открыть по ID</button></div>}
      {favorites.length>0 && <div className="saved"><strong>Избранные ID</strong>{favorites.map(id=><button className="ghost" key={id} onClick={()=>{if(demo && !DEMO_DETAILS[id]){setNotice('Примените ключ для реального объекта');return;}onSelect({id,title:'Объект '+id});}}>#{id}</button>)}</div>}
      <p className="small">Ключ хранится только в памяти приложения до перезапуска. Не отправляйте его в чат или репозиторий. Для веб-режима возможна ошибка CORS; Android использует нативный HTTP.</p>
      <a target="_blank" rel="noreferrer" href="https://wikimapia.org/api?action=create_key">Получить ключ на Wikimapia ↗</a></aside>}
    {!demo && <button className="load-area primary" onClick={()=>{onClose();setRefresh(v=>v+1);}}>Загрузить область</button>}
    <div className="lower-hint">Нажми на выделенный контур, чтобы открыть карточку</div>
    <Details data={details || (selected ? {id:selected.id,title:selected.title} : null)} busy={busy} error={error} onClose={onClose} onRetry={()=>selected&&onSelect(selected)} favorites={favorites} toggleFavorite={toggleFavorite}/>
    <div className="credits">Данные Wikimapia © участники Wikimapia · Демонстрационный прототип</div>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
