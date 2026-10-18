import React,{useEffect,useLayoutEffect,useRef,useState,useCallback} from 'react';
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
import Startup from './Startup.jsx';
import Motion from './Motion.jsx';
import Disclosure from './Disclosure.jsx';
import {CacheCapacityError} from './areaCache.js';
import ObjectChooser from './ObjectChooser.jsx';
import MapDiscover from './MapDiscover.jsx';
import {validDensity} from './mapPresentation.js';
import {searchIntent} from './searchIntent.js';
import {readFavorites,toggleFavorite as updateFavorites} from './favorites.js';

const navigation=[['map','Карта','map'],['search','Поиск','search'],['saved','Избранное','bookmark'],['settings','Настройки','settings']];
function App(){
  const credentials=useCredentials();
  const [online,setOnline]=useState(navigator.onLine);
  const [returnTo,setReturnTo]=useState('map'),[confirmForget,setConfirmForget]=useState(false);
  const [undo,setUndo]=useState(null),[savedQuery,setSavedQuery]=useState('');
  const screenBody=useRef(null),positions=useRef({}),origin=useRef(null),restoreFocus=useRef(false);
  const rememberScreen=()=>{if(screenBody.current)positions.current[screen]=screenBody.current.scrollTop;};
  const [theme,setTheme]=useTheme();
  const [screen,setScreen]=useState('map'),[demoMode,setDemo]=useState(null);
  const demo=demoMode??!credentials.key;
  const [auto,setAutoState]=useState(()=>{try{return localStorage.getItem('wikimapia-reader-auto')!=='false';}catch{return true;}});
  const [mapPanel,setMapPanel]=useState(null),[visiblePlaces,setVisiblePlaces]=useState([]);
  const [density,setDensityState]=useState(()=>{try{return validDensity(localStorage.getItem('wikimapia-reader-density'));}catch{return 'auto';}});
  const setDensity=value=>{const next=validDensity(value);setDensityState(next);try{localStorage.setItem('wikimapia-reader-density',next);}catch{}};
  const [area,setArea]=useState({places:[],page:0,more:false,loading:false});
  const [cacheEpoch,setCacheEpoch]=useState(0),[cacheClearing,setCacheClearing]=useState(false);
  const [currentAreaIds,setCurrentAreaIds]=useState([]),[cacheView,setCacheView]=useState(null),[candidates,setCandidates]=useState([]);
  const acceptArea=useCallback(state=>{setArea(state);if(state.cacheIds?.length)setCurrentAreaIds(state.cacheIds);},[]);
  const changeCache=async(action,message)=>{setCacheClearing(true);try{const result=await action();setCacheEpoch(x=>x+1);setToast(message);return result;}catch(e){setToast(e instanceof CacheCapacityError?e.message:'Не удалось изменить кэш. Попробуйте ещё раз.');return null;}finally{setCacheClearing(false);}};
  const [refresh,setRefresh]=useState(0),[moreRequest,setMoreRequest]=useState(0),[zoomRequest,setZoomRequest]=useState(null);
  const [focus,setFocus]=useState(null),[location,setLocation]=useState(null),[locating,setLocating]=useState(false);
  const [selected,setSelected]=useState(null),[details,setDetails]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [notice,setNotice]=useState('Открываем карту…'),[toast,setToast]=useState('');
  const [favorites,setFavorites]=useState(()=>{try{return readFavorites(localStorage.getItem('wikimapia-reader-favorites'));}catch{return[];}});
  const [query,setQuery]=useState(''),[results,setResults]=useState([]),[searchBusy,setSearchBusy]=useState(false),[searchStatus,setSearchStatus]=useState(''),[placeId,setPlaceId]=useState('55');
  const detailAbort=useRef(null),searchAbort=useRef(null),request=useRef(0),locationJob=useRef(0);
  const apiKey=demo?'':credentials.key;
  useEffect(()=>{if(credentials.key)setDemo(false);},[credentials.key]);
  const closeCard=useCallback(()=>{detailAbort.current?.abort();request.current++;setCandidates([]);setSelected(null);setDetails(null);setError('');setBusy(false);setFocus(null);},[]);
  const dismissCard=()=>{restoreFocus.current=returnTo!=='map';const panel=origin.current?.panel;closeCard();setScreen(returnTo);if(panel&&returnTo==='map')setMapPanel(panel);};
  const onSelect=useCallback(async place=>{
    setCandidates([]);detailAbort.current?.abort();const token=++request.current,controller=new AbortController();detailAbort.current=controller;
    const useDemo=place.source==='demo'||(!place.source&&demo);
    if(!useDemo&&!credentials.key){setToast('Подключите Wikimapia в настройках');setScreen('settings');return;}
    if(screen!=='map'){rememberScreen();origin.current={screen,id:place.id,source:useDemo?'demo':'wikimapia'};setReturnTo(screen);}else if(!selected){setReturnTo('map');origin.current=mapPanel?{panel:mapPanel}:null;}
    document.activeElement?.blur();
    setMapPanel(null);
    setDemo(useDemo);setFocus(null);setScreen('map');setSelected({...place,source:useDemo?'demo':'wikimapia'});setDetails(null);setError('');
    if(useDemo){setDetails(DEMO_DETAILS[place.id]||null);setBusy(false);return;}
    setBusy(true);
    try{const payload=await wikimapiaCall('place.getbyid',credentials.key,{id:place.id,signal:controller.signal});if(token===request.current){setDetails(normalizePlace(payload));setFocus(geometryOf(payload));}}
    catch(e){if(token===request.current)setError(diagnosticError(e));}
    finally{if(token===request.current)setBusy(false);}
  },[demo,credentials.key,screen,selected,mapPanel]);
  const active=usePlatform(()=>{if(screen==='settings'&&confirmForget){setConfirmForget(false);return true;}if(screen!=='map'){setScreen('map');return true;}if(candidates.length){setCandidates([]);return true;}if(selected){dismissCard();return true;}if(mapPanel){searchAbort.current?.abort();setSearchBusy(false);setMapPanel(null);return true;}return false;});
  useEffect(()=>{const on=()=>setOnline(true),off=()=>setOnline(false);window.addEventListener('online',on);window.addEventListener('offline',off);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off);};},[]);
  useLayoutEffect(()=>{if(screenBody.current){screenBody.current.scrollTop=positions.current[screen]??0;if(restoreFocus.current&&origin.current?.screen===screen){const o=origin.current;screenBody.current.querySelector(`[data-place-id="${o.id}"][data-source="${o.source}"]`)?.focus({preventScroll:true});restoreFocus.current=false;}}},[screen]);
  useEffect(()=>{if(!undo)return;const t=setTimeout(()=>setUndo(null),8000);return()=>clearTimeout(t);},[undo]);
  useEffect(()=>{if(!active){detailAbort.current?.abort();searchAbort.current?.abort();request.current++;if(busy)setError('Загрузка прервана. Нажмите «Повторить».');setBusy(false);setSearchBusy(false);locationJob.current++;setLocating(false);}},[active]);
  useEffect(()=>{if(screen!=='settings')setConfirmForget(false);},[screen]);
  useEffect(()=>{if(screen!=='search'){searchAbort.current?.abort();setSearchBusy(false);}},[screen]);
  useEffect(()=>()=>{detailAbort.current?.abort();searchAbort.current?.abort();},[]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),3000);return()=>clearTimeout(t);},[toast]);
  const resetRequests=()=>{closeCard();searchAbort.current?.abort();setSearchBusy(false);setResults([]);setSearchStatus('');setRefresh(0);};
  const applyKey=async value=>{if(await credentials.apply(value)){resetRequests();setDemo(false);setScreen('map');setToast('Wikimapia подключена');return true;}return false;};
  const forgetKey=async()=>{if(await credentials.forget()){resetRequests();setDemo(true);setToast('Сохранённый ключ удалён');}};
  const setAuto=value=>{setAutoState(value);try{localStorage.setItem('wikimapia-reader-auto',String(value));}catch{}};
  const toggleFavorite=id=>{
    const source=selected?.source||(demo?'demo':'wikimapia');
    const existing=favorites.find(x=>x.id===id&&x.source===source);if(existing){removeFavorite(existing);return;}
    const next=updateFavorites(favorites,{id,source,title:details?.title||selected?.title||`Объект #${id}`});
    try{localStorage.setItem('wikimapia-reader-favorites',JSON.stringify(next));setFavorites(next);setToast(next.length>favorites.length?'Место сохранено':'Место удалено из избранного');}catch{setToast('Не удалось сохранить избранное');}
  };
  const removeFavorite=place=>{
    const index=favorites.findIndex(x=>x.id===place.id&&x.source===place.source);
    const next=favorites.filter(x=>x.id!==place.id||x.source!==place.source);
    try{localStorage.setItem('wikimapia-reader-favorites',JSON.stringify(next));setFavorites(next);setToast('');setUndo({place,index});}catch{setToast('Не удалось удалить избранное');}
  };
  const undoRemove=()=>{
    if(!undo)return;const next=[...favorites];if(!next.some(x=>x.id===undo.place.id&&x.source===undo.place.source))next.splice(Math.min(undo.index,next.length),0,undo.place);
    try{localStorage.setItem('wikimapia-reader-favorites',JSON.stringify(next));setFavorites(next);setUndo(null);}catch{setToast('Не удалось вернуть место');}
  };
  const visibleFavorites=favorites.filter(p=>p.title.toLocaleLowerCase('ru').includes(savedQuery.trim().toLocaleLowerCase('ru')));
  const locate=async()=>{
    if(locating)return;const token=++locationJob.current;setLocating(true);setNotice('Определяем местоположение…');
    try{const p=await Geolocation.getCurrentPosition({enableHighAccuracy:false,timeout:12000,maximumAge:60000});if(token!==locationJob.current)return;closeCard();setLocation({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy});setNotice('Местоположение определено');}
    catch{if(token===locationJob.current)setNotice('Местоположение недоступно. Проверьте разрешение и геопозицию.');}
    finally{if(token===locationJob.current)setLocating(false);}
  };
  const search=async e=>{
    e.preventDefault();const intent=searchIntent(query);if(intent.kind==='invalid'){setSearchStatus('Введите название, положительный ID или ссылку на объект wikimapia.org.');return;}if(intent.kind==='place'){onSelect({id:intent.id,title:`Объект #${intent.id}`});return;}
    document.activeElement?.blur();searchAbort.current?.abort();const controller=new AbortController();searchAbort.current=controller;setSearchBusy(true);setResults([]);setSearchStatus('Поиск…');
    try{let center={lat:55.752,lng:37.618};try{const saved=JSON.parse(localStorage.getItem('wikimapia-reader-view'));if(saved)center=saved;}catch{}
      const payload=await wikimapiaCall('search',apiKey,{query:intent.query,lat:center.lat,lon:center.lng,signal:controller.signal});
      if(!controller.signal.aborted){const places=normalizeArea(payload);setResults(places);setSearchStatus(places.length?`Показано ${places.length} из ${payload.found??places.length}`:'Ничего не найдено. Попробуйте другое название.');}
    }catch(e){if(!controller.signal.aborted)setSearchStatus(diagnosticError(e));}
    finally{if(searchAbort.current===controller)setSearchBusy(false);}
  };
  const openId=()=>{const id=Number(placeId);if(!Number.isSafeInteger(id)||id<1){setSearchStatus('Неверный ID объекта');return;}onSelect({id,title:`Объект #${id}`});};
  const navigate=next=>{rememberScreen();setCandidates([]);setMapPanel(null);setScreen(next);};
  const closeMapPanel=()=>{searchAbort.current?.abort();setSearchBusy(false);setMapPanel(null);};
  const queryOnMap=value=>{searchAbort.current?.abort();setSearchBusy(false);setQuery(value);setResults([]);setSearchStatus('');};
  const cancelMapSearch=()=>{searchAbort.current?.abort();setSearchBusy(false);setSearchStatus('Поиск отменён');};
  const showCachedArea=bbox=>{if(!credentials.key){setToast('Подключите Wikimapia для просмотра сохранённых областей');return;}closeCard();setDemo(false);setScreen('map');setCacheView({bbox:[...bbox]});};
  if(!credentials.ready)return <Startup/>;
  return <main className={`${selected||candidates.length?'has-sheet':''} ${screen!=='map'?'has-screen':''} ${mapPanel?'has-map-panel':''} ${toast?'has-toast':''}`}>
    <div className="map-stage" inert={screen!=='map'} aria-hidden={screen!=='map'}>
      <MapPane zoomRequest={zoomRequest} demo={demo} apiKey={apiKey} auto={auto} active={active} paused={screen!=='map'||!!selected||cacheClearing} cacheEpoch={cacheEpoch} refresh={refresh} moreRequest={moreRequest} focus={focus} location={location} cacheView={cacheView} selectedId={selected?.id} density={density} onVisiblePlaces={setVisiblePlaces} onCandidates={setCandidates} onSelect={onSelect} onState={acceptArea} onMessage={setNotice}/>
      {!online&&<div className="network-hint" role="status">Нет подключения · доступны сохранённые контуры. Описания и подложка требуют сети.</div>}
      <div className="map-tools" role="toolbar" aria-label="Управление картой">
        <button className="icon-btn search-launch" aria-label="Найти место" title="Найти место" aria-pressed={mapPanel==='search'} onClick={()=>setMapPanel(v=>v==='search'?null:'search')}><Icon name="search"/></button>
        <button className="icon-btn" aria-label="Список объектов области" title="Список объектов области" aria-pressed={mapPanel==='list'} onClick={()=>setMapPanel(v=>v==='list'?null:'list')}><Icon name="map"/></button>
        <button className="icon-btn" aria-label="Приблизить карту" title="Приблизить карту" onClick={()=>setZoomRequest(v=>({delta:1,seq:(v?.seq??0)+1}))}><Icon name="plus"/></button>
        <button className="icon-btn" aria-label="Отдалить карту" title="Отдалить карту" onClick={()=>setZoomRequest(v=>({delta:-1,seq:(v?.seq??0)+1}))}><Icon name="minus"/></button>
        <button className="icon-btn" title="Моё местоположение" aria-label="Моё местоположение" disabled={locating} onClick={locate}><Icon name="locate"/></button>
        {!demo&&<button aria-label="Загрузить область" title={area.loading?(area.background?"Обновление в фоне":"Загрузка объектов"):"Обновить область"} aria-busy={!!area.loading} className={`icon-btn ${area.loading?'is-loading':''}`} disabled={area.loading||area.draining||!active} onClick={()=>{closeCard();setRefresh(x=>x+1);}}><Icon name="refresh"/></button>}
        {!demo&&area.more&&(!auto||area.page>=3||area.error||area.draining)&&<button className={`icon-btn area-more ${area.draining?'is-loading':''}`} aria-label={area.draining?`Догружаем: ${area.places.length}${area.found!=null?` из ${area.found}`:" объектов"}`:"Догрузить область"} title={area.draining?`Догружаем: ${area.places.length}${area.found!=null?` из ${area.found}`:" объектов"}`:"Догрузить область"} disabled={area.loading||area.draining} aria-busy={!!area.draining} onClick={()=>setMoreRequest(x=>x+1)}><Icon name={area.draining?'refresh':'download'}/></button>}
      </div>
      <Motion open={!!mapPanel&&!selected&&!candidates.length} identity={mapPanel} kind="discovery"><MapDiscover mode={mapPanel} demo={demo} query={query} onQuery={queryOnMap} onSearch={search} results={results} searchBusy={searchBusy} searchStatus={searchStatus} visiblePlaces={visiblePlaces} area={area} notice={notice} density={density} onDensity={setDensity} onSelect={onSelect} onCancelSearch={cancelMapSearch} onSettings={()=>navigate('settings')} onClose={closeMapPanel}/></Motion>
      {!selected&&!candidates.length&&notice&&<div className="map-feedback"><div className="status" role="status" aria-live="polite">{notice}</div>{demo&&<button className="connect-action" onClick={()=>navigate('settings')}>Подключить Wikimapia <Icon name="arrow" size={18}/></button>}</div>}
      <span className="sr-only" role="status" aria-live="polite">{area.draining?`Догружаем: ${area.places.length}${area.found!=null?` из ${area.found}`:" объектов"}`:''}</span>
      <Motion open={candidates.length>0} identity={candidates.map(p=>p.id).join(',')} kind="chooser"><ObjectChooser places={candidates} onPick={onSelect} onClose={()=>setCandidates([])}/></Motion>
      <Motion open={!!selected||busy||!!error} identity={selected?.id} kind="sheet"><Details returnLabel={returnTo==='search'||origin.current?.panel==='search'?'К результатам поиска':returnTo==='saved'?'К избранному':origin.current?.panel==='list'?'К объектам области':null} onReturn={dismissCard} data={details||(selected?{id:selected.id,title:selected.title}:null)} busy={busy} error={error} onClose={dismissCard} onRetry={()=>selected&&onSelect(selected)} favorites={favorites.filter(x=>x.source===(demo?'demo':'wikimapia')).map(x=>x.id)} toggleFavorite={toggleFavorite}/></Motion>
    </div>
    <Motion open={screen!=='map'} identity={screen} kind="screen"><section className="app-screen" aria-label={navigation.find(x=>x[0]===screen)[1]}>
      <header className="screen-header"><button className="icon-btn" aria-label="Вернуться на карту" onClick={()=>setScreen('map')}><Icon name="back"/></button><div><p>WikiReader</p><h1>{navigation.find(x=>x[0]===screen)[1]}</h1></div></header>
      {screen==='settings'&&<Settings confirmForget={confirmForget} setConfirmForget={setConfirmForget} credentials={credentials} onCacheAction={changeCache} onShowArea={showCachedArea} cacheEpoch={cacheEpoch} currentAreaIds={currentAreaIds} cacheClearing={cacheClearing} theme={theme} setTheme={setTheme} auto={auto} setAuto={setAuto} density={density} setDensity={setDensity} onApply={applyKey} onForget={forgetKey} demo={demo} onDemo={()=>{resetRequests();setDemo(true);setScreen('map');}} onReal={()=>{resetRequests();setDemo(false);setScreen('map');}}/>}
      {!online&&<div className="screen-network" role="status">Нет подключения. Поиск и новые описания требуют сети; избранное и сохранённые контуры доступны на устройстве.</div>}
      {screen==='search'&&<div className="screen-body search-page" ref={screenBody}>{demo?<div className="empty-state"><Icon name="search" size={36}/><h2>Найдите нужное место</h2><p>Подключите Wikimapia, чтобы искать по названию или открывать объекты по ID.</p><button className="primary" onClick={()=>setScreen('settings')}>Добавить API-ключ</button></div>:<><form className="search-form" onSubmit={search}><label htmlFor="place-query">Название, ID или ссылка Wikimapia</label><div className="search-input"><Icon name="search"/><input id="place-query" type="search" value={query} maxLength={200} onChange={e=>{searchAbort.current?.abort();setSearchBusy(false);setQuery(e.target.value);setResults([]);setSearchStatus('');}} enterKeyHint="search" placeholder="Место или ссылка на объект"/><button className="primary" disabled={searchBusy||!query.trim()}>Найти</button></div></form><div className="search-actions">{query&&<button className="text-button" onClick={()=>{searchAbort.current?.abort();setQuery('');setResults([]);setSearchStatus('');setSearchBusy(false);document.getElementById('place-query')?.focus();}}>Очистить поиск</button>}{searchBusy&&<button className="text-button" onClick={()=>{searchAbort.current?.abort();setSearchBusy(false);setSearchStatus('Поиск отменён');}}>Отменить поиск</button>}</div><p className="search-feedback" role="status">{searchStatus||'Поиск по объектам Wikimapia рядом с текущей картой'}</p><ul className="search-results">{results.map(p=><li key={p.id}><button data-place-id={p.id} data-source="wikimapia" onClick={()=>onSelect(p)}><span><strong>{p.title}</strong><small>Wikimapia · #{p.id}</small></span><Icon name="arrow" size={18}/></button></li>)}</ul><Disclosure className="id-disclosure" title="Открыть объект по ID"><div className="open-id"><label htmlFor="place-id">Число из ссылки Wikimapia</label><input id="place-id" type="number" min="1" value={placeId} onChange={e=>setPlaceId(e.target.value)}/><button className="secondary" onClick={openId}>Открыть по ID</button></div></Disclosure></>}</div>}
      {screen==='saved'&&<div className="screen-body" ref={screenBody}>{favorites.length?<><p className="section-caption">Сохранённые места · {favorites.length}</p><label className="saved-filter">Найти в избранном<input type="search" value={savedQuery} onChange={e=>setSavedQuery(e.target.value)} placeholder="Название сохранённого места"/></label>{!visibleFavorites.length&&<p className="helper">Совпадений нет. Измените название или очистите поиск.</p>}<ul className="saved-list">{visibleFavorites.map(p=><li key={`${p.source}:${p.id}`}><button className="saved-open" data-place-id={p.id} data-source={p.source} onClick={()=>onSelect(p)}><span className="saved-icon"><Icon name="bookmark"/></span><span><strong>{p.title}</strong><small>{p.source==='demo'?'Демо':'Wikimapia'} · #{p.id}</small></span><Icon name="arrow" size={18}/></button><button className="icon-btn" aria-label={`Удалить ${p.title} из избранного`} onClick={()=>removeFavorite(p)}><Icon name="trash" size={18}/></button></li>)}</ul></>:<div className="empty-state"><Icon name="bookmark" size={36}/><h2>Места, к которым хочется вернуться</h2><p>Откройте объект на карте и нажмите «Сохранить» в его карточке.</p><button className="secondary" onClick={()=>setScreen('map')}>На карту</button></div>}</div>}
    </section></Motion>
    <nav className="bottom-nav" aria-label="Основная навигация">{navigation.map(([id,label,icon])=><button key={id} aria-current={screen===id?'page':undefined} onClick={()=>navigate(id)}><Icon name={icon}/><span>{label}</span></button>)}</nav>
    <Motion open={!!undo} identity={undo?`${undo.place.source}:${undo.place.id}`:''} kind="toast"><div className="undo-toast" role="status"><span>Место удалено из избранного</span><button className="text-button" onClick={undoRemove}>Вернуть</button></div></Motion>
    <Motion open={!!toast} identity={toast} kind="toast"><div className="toast" role="status">{toast}</div></Motion>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
