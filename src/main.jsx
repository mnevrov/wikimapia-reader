import React,{useEffect,useRef,useState,useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import {Geolocation} from '@capacitor/geolocation';
import 'leaflet/dist/leaflet.css';
import './style.css';
import {wikimapiaCall} from './client.js';
import {normalizeArea,normalizePlace,diagnosticError,geometryOf} from './api.js';
import {useCredentials} from './useCredentials.js';
import {useTheme} from './useTheme.js';
import {usePlatform} from './usePlatform.js';
import {DEMO_DETAILS} from './demo.js';
import MapPane from './MapPane.jsx';
import Details from './Details.jsx';
import Settings from './Settings.jsx';
import Icon from './Icon.jsx';
import {CacheCapacityError} from './areaCache.js';
import ObjectChooser from './ObjectChooser.jsx';
import {readFavorites,toggleFavorite as updateFavorites} from './favorites.js';

const navigation=[['map','Карта','map'],['search','Поиск','search'],['saved','Избранное','bookmark'],['settings','Настройки','settings']];
function App(){
  const credentials=useCredentials();
  const [theme,setTheme]=useTheme();
  const [screen,setScreen]=useState('map'),[demoMode,setDemo]=useState(null);
  const demo=demoMode??!credentials.key;
  const [auto,setAutoState]=useState(()=>{try{return localStorage.getItem('wikimapia-reader-auto')!=='false';}catch{return true;}});
  const [area,setArea]=useState({places:[],page:0,more:false,loading:false});
  const [cacheEpoch,setCacheEpoch]=useState(0),[cacheClearing,setCacheClearing]=useState(false);
  const [currentAreaIds,setCurrentAreaIds]=useState([]),[cacheView,setCacheView]=useState(null),[candidates,setCandidates]=useState([]);
  const acceptArea=useCallback(state=>{setArea(state);if(state.cacheIds?.length)setCurrentAreaIds(state.cacheIds);},[]);
  const changeCache=async(action,message)=>{setCacheClearing(true);try{const result=await action();setCacheEpoch(x=>x+1);setToast(message);return result;}catch(e){setToast(e instanceof CacheCapacityError?e.message:'Не удалось изменить кэш. Попробуйте ещё раз.');return null;}finally{setCacheClearing(false);}};
  const [refresh,setRefresh]=useState(0),[moreRequest,setMoreRequest]=useState(0);
  const [focus,setFocus]=useState(null),[location,setLocation]=useState(null),[locating,setLocating]=useState(false);
  const [selected,setSelected]=useState(null),[details,setDetails]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [notice,setNotice]=useState('Открываем карту…'),[toast,setToast]=useState('');
  const [favorites,setFavorites]=useState(()=>{try{return readFavorites(localStorage.getItem('wikimapia-reader-favorites'));}catch{return[];}});
  const [query,setQuery]=useState(''),[results,setResults]=useState([]),[searchBusy,setSearchBusy]=useState(false),[searchStatus,setSearchStatus]=useState(''),[placeId,setPlaceId]=useState('55');
  const detailAbort=useRef(null),searchAbort=useRef(null),request=useRef(0),locationJob=useRef(0);
  const apiKey=demo?'':credentials.key;
  useEffect(()=>{if(credentials.key)setDemo(false);},[credentials.key]);
  const closeCard=useCallback(()=>{detailAbort.current?.abort();request.current++;setCandidates([]);setSelected(null);setDetails(null);setError('');setBusy(false);setFocus(null);},[]);
  const onSelect=useCallback(async place=>{
    setCandidates([]);detailAbort.current?.abort();const token=++request.current,controller=new AbortController();detailAbort.current=controller;
    const useDemo=place.source==='demo'||(!place.source&&demo);
    if(!useDemo&&!credentials.key){setToast('Подключите Wikimapia в настройках');setScreen('settings');return;}
    setDemo(useDemo);setFocus(null);setScreen('map');setSelected({...place,source:useDemo?'demo':'wikimapia'});setDetails(null);setError('');
    if(useDemo){setDetails(DEMO_DETAILS[place.id]||null);setBusy(false);return;}
    setBusy(true);
    try{const payload=await wikimapiaCall('place.getbyid',credentials.key,{id:place.id,signal:controller.signal});if(token===request.current){setDetails(normalizePlace(payload));setFocus(geometryOf(payload));}}
    catch(e){if(token===request.current)setError(diagnosticError(e));}
    finally{if(token===request.current)setBusy(false);}
  },[demo,credentials.key]);
  const active=usePlatform(()=>{if(screen!=='map'){setScreen('map');return true;}if(candidates.length){setCandidates([]);return true;}if(selected){closeCard();return true;}return false;});
  useEffect(()=>{if(!active){detailAbort.current?.abort();searchAbort.current?.abort();request.current++;if(busy)setError('Загрузка прервана. Нажмите «Повторить».');setBusy(false);setSearchBusy(false);locationJob.current++;setLocating(false);}},[active]);
  useEffect(()=>{if(screen!=='search'){searchAbort.current?.abort();setSearchBusy(false);}},[screen]);
  useEffect(()=>()=>{detailAbort.current?.abort();searchAbort.current?.abort();},[]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),3000);return()=>clearTimeout(t);},[toast]);
  const resetRequests=()=>{closeCard();searchAbort.current?.abort();setSearchBusy(false);setResults([]);setSearchStatus('');setRefresh(0);};
  const applyKey=async value=>{if(await credentials.apply(value)){resetRequests();setDemo(false);setScreen('map');setToast('Wikimapia подключена');return true;}return false;};
  const forgetKey=async()=>{if(await credentials.forget()){resetRequests();setDemo(true);setToast('Сохранённый ключ удалён');}};
  const setAuto=value=>{setAutoState(value);try{localStorage.setItem('wikimapia-reader-auto',String(value));}catch{}};
  const toggleFavorite=id=>{
    const source=selected?.source||(demo?'demo':'wikimapia');
    const next=updateFavorites(favorites,{id,source,title:details?.title||selected?.title||`Объект #${id}`});
    try{localStorage.setItem('wikimapia-reader-favorites',JSON.stringify(next));setFavorites(next);}catch{setToast('Не удалось сохранить избранное');}
  };
  const locate=async()=>{
    if(locating)return;const token=++locationJob.current;setLocating(true);setNotice('Определяем местоположение…');
    try{const p=await Geolocation.getCurrentPosition({enableHighAccuracy:false,timeout:12000,maximumAge:60000});if(token!==locationJob.current)return;closeCard();setLocation({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy});setNotice('Местоположение определено');}
    catch{if(token===locationJob.current)setNotice('Местоположение недоступно. Проверьте разрешение и геопозицию.');}
    finally{if(token===locationJob.current)setLocating(false);}
  };
  const search=async e=>{
    e.preventDefault();searchAbort.current?.abort();const controller=new AbortController();searchAbort.current=controller;setSearchBusy(true);setResults([]);setSearchStatus('Поиск…');
    try{let center={lat:55.752,lng:37.618};try{const saved=JSON.parse(localStorage.getItem('wikimapia-reader-view'));if(saved)center=saved;}catch{}
      const payload=await wikimapiaCall('search',apiKey,{query,lat:center.lat,lon:center.lng,signal:controller.signal});
      if(!controller.signal.aborted){const places=normalizeArea(payload);setResults(places);setSearchStatus(places.length?`Показано ${places.length} из ${payload.found??places.length}`:'Ничего не найдено. Попробуйте другое название.');}
    }catch(e){if(!controller.signal.aborted)setSearchStatus(diagnosticError(e));}
    finally{if(searchAbort.current===controller)setSearchBusy(false);}
  };
  const openId=()=>{const id=Number(placeId);if(!Number.isSafeInteger(id)||id<1){setSearchStatus('Неверный ID объекта');return;}onSelect({id,title:`Объект #${id}`});};
  const navigate=next=>{setCandidates([]);setScreen(next);};
  const showCachedArea=bbox=>{if(!credentials.key){setToast('Подключите Wikimapia для просмотра сохранённых областей');return;}closeCard();setDemo(false);setScreen('map');setCacheView({bbox:[...bbox]});};
  if(!credentials.ready)return <main className="startup"><Icon name="map" size={36}/><h1>WikiReader</h1><p>Открываем карту…</p></main>;
  return <main className={`${selected||candidates.length?'has-sheet':''} ${screen!=='map'?'has-screen':''}`}>
    <div className="map-stage" inert={screen!=='map'} aria-hidden={screen!=='map'}>
      <MapPane demo={demo} apiKey={apiKey} auto={auto} active={active} paused={screen!=='map'||!!selected||cacheClearing} cacheEpoch={cacheEpoch} refresh={refresh} moreRequest={moreRequest} focus={focus} location={location} cacheView={cacheView} selectedId={selected?.id} onCandidates={setCandidates} onSelect={onSelect} onState={acceptArea} onMessage={setNotice}/>
      <header className="map-header"><button className="search-launch" onClick={()=>navigate('search')}><Icon name="search"/><span>Найти место<span>Название или ID Wikimapia</span></span></button></header>
      <div className="map-tools"><button className="icon-btn" title="Моё местоположение" aria-label="Моё местоположение" disabled={locating} onClick={locate}><Icon name="locate"/></button>{!demo&&<button aria-label="Загрузить область" title={area.loading?(area.background?"Обновление в фоне":"Загрузка объектов"):"Обновить область"} aria-busy={!!area.loading} className={`icon-btn ${area.loading?'is-loading':''}`} disabled={area.loading||!active} onClick={()=>{closeCard();setRefresh(x=>x+1);}}><Icon name="refresh"/></button>}</div>
      {!selected&&!candidates.length&&(notice||(!demo&&area.more))&&<div className="map-feedback"><div className="status" role="status" aria-live="polite">{notice}</div>{!demo&&area.more&&(!auto||area.page>=3||area.error)&&<button className="text-button" disabled={area.loading} onClick={()=>setMoreRequest(x=>x+1)}>Показать ещё объекты <Icon name="arrow" size={16}/></button>}{demo&&<button className="connect-action" onClick={()=>navigate('settings')}>Подключить Wikimapia <Icon name="arrow" size={18}/></button>}</div>}
      <ObjectChooser places={candidates} onPick={onSelect} onClose={()=>setCandidates([])}/>
      <Details data={details||(selected?{id:selected.id,title:selected.title}:null)} busy={busy} error={error} onClose={closeCard} onRetry={()=>selected&&onSelect(selected)} favorites={favorites.filter(x=>x.source===(demo?'demo':'wikimapia')).map(x=>x.id)} toggleFavorite={toggleFavorite}/>
    </div>
    {screen!=='map'&&<section className="app-screen" aria-label={navigation.find(x=>x[0]===screen)[1]}>
      <header className="screen-header"><button className="icon-btn" aria-label="Вернуться на карту" onClick={()=>setScreen('map')}><Icon name="back"/></button><div><p>WikiReader</p><h1>{navigation.find(x=>x[0]===screen)[1]}</h1></div></header>
      {screen==='settings'&&<Settings credentials={credentials} onCacheAction={changeCache} onShowArea={showCachedArea} cacheEpoch={cacheEpoch} currentAreaIds={currentAreaIds} cacheClearing={cacheClearing} theme={theme} setTheme={setTheme} auto={auto} setAuto={setAuto} onApply={applyKey} onForget={forgetKey} demo={demo} onDemo={()=>{resetRequests();setDemo(true);setScreen('map');}} onReal={()=>{resetRequests();setDemo(false);setScreen('map');}}/>}
      {screen==='search'&&<div className="screen-body search-page">{demo?<div className="empty-state"><Icon name="search" size={36}/><h2>Найдите нужное место</h2><p>Подключите Wikimapia, чтобы искать по названию или открывать объекты по ID.</p><button className="primary" onClick={()=>setScreen('settings')}>Добавить API-ключ</button></div>:<><form className="search-form" onSubmit={search}><label htmlFor="place-query">Название места</label><div className="search-input"><Icon name="search"/><input id="place-query" type="search" value={query} maxLength={200} onChange={e=>{searchAbort.current?.abort();setSearchBusy(false);setQuery(e.target.value);setResults([]);setSearchStatus('');}} placeholder="Например, Эйфелева башня"/><button className="primary" disabled={searchBusy||!query.trim()}>Найти</button></div></form><p className="search-feedback" role="status">{searchStatus||'Поиск по объектам Wikimapia рядом с текущей картой'}</p><ul className="search-results">{results.map(p=><li key={p.id}><button onClick={()=>onSelect(p)}><span><strong>{p.title}</strong><small>Wikimapia · #{p.id}</small></span><Icon name="arrow" size={18}/></button></li>)}</ul><details className="id-disclosure"><summary>Открыть объект по ID</summary><div className="open-id"><label htmlFor="place-id">Число из ссылки Wikimapia</label><input id="place-id" type="number" min="1" value={placeId} onChange={e=>setPlaceId(e.target.value)}/><button className="secondary" onClick={openId}>Открыть по ID</button></div></details></>}</div>}
      {screen==='saved'&&<div className="screen-body">{favorites.length?<><p className="section-caption">Сохранённые места · {favorites.length}</p><ul className="saved-list">{favorites.map(p=><li key={`${p.source}:${p.id}`}><button className="saved-open" onClick={()=>onSelect(p)}><span className="saved-icon"><Icon name="bookmark"/></span><span><strong>{p.title}</strong><small>{p.source==='demo'?'Демо':'Wikimapia'} · #{p.id}</small></span><Icon name="arrow" size={18}/></button><button className="icon-btn" aria-label={`Удалить ${p.title} из избранного`} onClick={()=>{const next=favorites.filter(x=>x.id!==p.id||x.source!==p.source);try{localStorage.setItem('wikimapia-reader-favorites',JSON.stringify(next));setFavorites(next);}catch{setToast('Не удалось удалить избранное');}}}><Icon name="trash" size={18}/></button></li>)}</ul></>:<div className="empty-state"><Icon name="bookmark" size={36}/><h2>Места, к которым хочется вернуться</h2><p>Откройте объект на карте и нажмите «Сохранить» в его карточке.</p><button className="secondary" onClick={()=>setScreen('map')}>На карту</button></div>}</div>}
    </section>}
    <nav className="bottom-nav" aria-label="Основная навигация">{navigation.map(([id,label,icon])=><button key={id} aria-current={screen===id?'page':undefined} onClick={()=>navigate(id)}><Icon name={icon}/><span>{label}</span></button>)}</nav>
    {toast&&<div className="toast" role="status">{toast}</div>}
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
