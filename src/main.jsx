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
import {YANDEX_KEY_PATTERN} from './yandexUsage.js';
import {searchIntent} from './searchIntent.js';
import {readFavorites,toggleFavorite as updateFavorites} from './favorites.js';
import {offlineStore} from './offlineStore.js';
import {nextFollowState,acceptableFix} from './gpsFollow.js';
import {HISTORY_KEY,HISTORY_ENABLED_KEY,readHistory,recordHistory} from './readingHistory.js';
import SavedLibrary from './SavedLibrary.jsx';

const navigation=[['map','Карта','map'],['search','Поиск','search'],['saved','Избранное','bookmark'],['settings','Настройки','settings']];
function App(){
  const credentials=useCredentials();
  const [online,setOnline]=useState(navigator.onLine);
  const [returnTo,setReturnTo]=useState('map'),[confirmForget,setConfirmForget]=useState(false);
  const [undo,setUndo]=useState(null),[savedQuery,setSavedQuery]=useState('');
  const [history,setHistory]=useState(()=>{try{return readHistory(localStorage.getItem(HISTORY_KEY));}catch{return [];}});
  const [historyEnabled,setHistoryEnabled]=useState(()=>{try{return localStorage.getItem(HISTORY_ENABLED_KEY)!=='false';}catch{return true;}});
  useEffect(()=>{try{localStorage.setItem(HISTORY_KEY,JSON.stringify(history));}catch{}},[history]);
  const rememberViewed=useCallback(place=>{if(historyEnabled&&place?.source!=='demo')setHistory(items=>recordHistory(items,place));},[historyEnabled]);
  const toggleHistory=enabled=>{setHistoryEnabled(enabled);if(!enabled)setHistory([]);try{localStorage.setItem(HISTORY_ENABLED_KEY,String(enabled));if(!enabled)localStorage.removeItem(HISTORY_KEY);}catch{}};
  const screenBody=useRef(null),positions=useRef({}),origin=useRef(null),restoreFocus=useRef(false);
  const rememberScreen=()=>{if(screenBody.current)positions.current[screen]=screenBody.current.scrollTop;};
  const [theme,setTheme]=useTheme();
  const [screen,setScreen]=useState('map'),[demoMode,setDemo]=useState(null);
  const demo=demoMode??!credentials.key;
  const [auto,setAutoState]=useState(()=>{try{return localStorage.getItem('wikimapia-reader-auto')!=='false';}catch{return true;}});
  const [mapPanel,setMapPanel]=useState(null),[visiblePlaces,setVisiblePlaces]=useState([]);
  const [density,setDensityState]=useState(()=>{try{return validDensity(localStorage.getItem('wikimapia-reader-density'));}catch{return 'auto';}});
  const [basemap,setBasemapState]=useState(()=>{try{return localStorage.getItem('wikireader-basemap')==='yandex'?'yandex':'osm';}catch{return 'osm';}});
  const [yandexKey,setYandexKeyState]=useState(()=>{try{return localStorage.getItem('wikireader-yandex-js-key')||'';}catch{return '';}});
  const [yandexReferer,setYandexRefererState]=useState(()=>{try{return localStorage.getItem('wikireader-yandex-referer-confirmed')==='true';}catch{return false;}});
  const setBasemap=value=>{const next=value==='yandex'&&yandexReferer&&YANDEX_KEY_PATTERN.test(yandexKey)?'yandex':'osm';if(next==='yandex')setYandexDiagnostic(null);setBasemapState(next);try{localStorage.setItem('wikireader-basemap',next);}catch{}};
  const setYandexKey=value=>{setYandexKeyState(value);setBasemapState('osm');try{if(value)localStorage.setItem('wikireader-yandex-js-key',value);else localStorage.removeItem('wikireader-yandex-js-key');localStorage.setItem('wikireader-basemap','osm');}catch{}};
  const setYandexReferer=value=>{setYandexRefererState(value);if(!value)setBasemap('osm');try{localStorage.setItem('wikireader-yandex-referer-confirmed',String(value));}catch{}};
  const [yandexDiagnostic,setYandexDiagnostic]=useState(null);
  const fallbackBasemap=useCallback((message,diagnostic)=>{
    if(diagnostic)setYandexDiagnostic(diagnostic);
    setBasemapState('osm');
    try{localStorage.setItem('wikireader-basemap','osm');}catch{}
    setToast(message||'Яндекс Карты недоступны. Используется OSM.');
  },[]);

  const setDensity=value=>{const next=validDensity(value);setDensityState(next);try{localStorage.setItem('wikimapia-reader-density',next);}catch{}};
  const [area,setArea]=useState({places:[],page:0,more:false,loading:false});
  const [cacheEpoch,setCacheEpoch]=useState(0),[cacheClearing,setCacheClearing]=useState(false);
  const [currentAreaIds,setCurrentAreaIds]=useState([]),[cacheView,setCacheView]=useState(null),[candidates,setCandidates]=useState([]);
  const acceptArea=useCallback(state=>{setArea(state);if(state.cacheIds?.length)setCurrentAreaIds(state.cacheIds);},[]);
  const changeCache=async(action,message)=>{setCacheClearing(true);try{const result=await action();setCacheEpoch(x=>x+1);setToast(message);return result;}catch(e){setToast(e instanceof CacheCapacityError?e.message:'Не удалось изменить кэш. Попробуйте ещё раз.');return null;}finally{setCacheClearing(false);}};
  const [refresh,setRefresh]=useState(0),[moreRequest,setMoreRequest]=useState(0),[zoomRequest,setZoomRequest]=useState(null);
  const [focus,setFocus]=useState(null),[location,setLocation]=useState(null),[locating,setLocating]=useState(false);
   const [gpsFollow,setGpsFollow]=useState('off'),[gpsError,setGpsError]=useState('');
   const [offlineEpoch,setOfflineEpoch]=useState(0),[offlineEntries,setOfflineEntries]=useState([]),[offlineInfo,setOfflineInfo]=useState(null),[offlineBusy,setOfflineBusy]=useState(false);
   const offlineUrls=useRef([]),offlineAbort=useRef(null);
   const revokeOffline=()=>{for(const url of offlineUrls.current)URL.revokeObjectURL(url);offlineUrls.current=[];};
   const reloadOffline=useCallback(()=>offlineStore.snapshot().then(s=>setOfflineEntries(s.entries)).catch(()=>setOfflineEntries([])),[]);
   useEffect(()=>{reloadOffline();},[reloadOffline,offlineEpoch]);
  const [selected,setSelected]=useState(null),[details,setDetails]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [notice,setNotice]=useState('Открываем карту…'),[toast,setToast]=useState('');
  const [favorites,setFavorites]=useState(()=>{try{return readFavorites(localStorage.getItem('wikimapia-reader-favorites'));}catch{return[];}});
  const [query,setQuery]=useState(''),[results,setResults]=useState([]),[searchBusy,setSearchBusy]=useState(false),[searchStatus,setSearchStatus]=useState(''),[placeId,setPlaceId]=useState('55');
  const detailAbort=useRef(null),searchAbort=useRef(null),request=useRef(0),locationJob=useRef(0);
  const apiKey=demo?'':credentials.key;
  useEffect(()=>{if(credentials.key)setDemo(false);},[credentials.key]);
  const closeCard=useCallback(()=>{revokeOffline();offlineAbort.current?.abort();detailAbort.current?.abort();request.current++;setCandidates([]);setSelected(null);setDetails(null);setError('');setBusy(false);setFocus(null);},[]);
  const dismissCard=()=>{restoreFocus.current=returnTo!=='map';const panel=origin.current?.panel;closeCard();setScreen(returnTo);if(panel&&returnTo==='map')setMapPanel(panel);};
  const onSelect=useCallback(async place=>{
    setCandidates([]);detailAbort.current?.abort();const token=++request.current,controller=new AbortController();detailAbort.current=controller;
    const useDemo=place.source==='demo'||(!place.source&&demo);
    const cached=useDemo?null:await offlineStore.read(place.id).catch(()=>null);
    if(token!==request.current){cached?.details.photos.forEach(p=>URL.revokeObjectURL(p.src));return;}
    if(!useDemo&&!credentials.key&&!cached){setToast('Подключите Wikimapia в настройках');setScreen('settings');return;}
    revokeOffline();offlineUrls.current=cached?.details.photos.map(p=>p.src)||[];
    setOfflineInfo(cached?{status:cached.status,savedAt:cached.record.savedAt,missing:cached.record.missing}:null);
    if(screen!=='map'){rememberScreen();origin.current={screen,id:place.id,source:useDemo?'demo':'wikimapia'};setReturnTo(screen);}else if(!selected){setReturnTo('map');origin.current=mapPanel?{panel:mapPanel}:null;}
    document.activeElement?.blur();
    setMapPanel(null);
    setDemo(useDemo);setFocus(null);setScreen('map');setSelected({...place,source:useDemo?'demo':'wikimapia'});setDetails(null);setError('');
    if(useDemo){setDetails(DEMO_DETAILS[place.id]||null);setBusy(false);return;}
    if(cached&&(!online||!credentials.key)){setDetails(cached.details);rememberViewed({id:place.id,title:cached.details.title,source:'wikimapia'});setBusy(false);return;}
    if(!online){setError('Нет сети. Этот объект не сохранён для офлайн-чтения.');setBusy(false);return;}
    setBusy(true);
    try{
      const payload=await wikimapiaCall('place.getbyid',credentials.key,{id:place.id,signal:controller.signal});
      if(token===request.current){const loaded=normalizePlace(payload);revokeOffline();setDetails(loaded);setFocus(geometryOf(payload));rememberViewed({id:place.id,title:loaded.title,source:'wikimapia'});}
    }catch(e){
      if(token===request.current){
        if(cached){setDetails(cached.details);rememberViewed({id:place.id,title:cached.details.title,source:'wikimapia'});setToast('Сервер недоступен · показана сохранённая карточка');}
        else setError(diagnosticError(e));
      }
    }finally{if(token===request.current)setBusy(false);}
  },[demo,credentials.key,screen,selected,mapPanel,online,rememberViewed]);
  const active=usePlatform(()=>{if(screen==='settings'&&confirmForget){setConfirmForget(false);return true;}if(screen!=='map'){setScreen('map');return true;}if(candidates.length){setCandidates([]);return true;}if(selected){dismissCard();return true;}if(mapPanel){searchAbort.current?.abort();setSearchBusy(false);setMapPanel(null);return true;}return false;});
  useEffect(()=>{const on=()=>setOnline(true),off=()=>setOnline(false);window.addEventListener('online',on);window.addEventListener('offline',off);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off);};},[]);
  useLayoutEffect(()=>{if(screenBody.current){screenBody.current.scrollTop=positions.current[screen]??0;if(restoreFocus.current&&origin.current?.screen===screen){const o=origin.current;screenBody.current.querySelector(`[data-place-id="${o.id}"][data-source="${o.source}"]`)?.focus({preventScroll:true});restoreFocus.current=false;}}},[screen]);
  useEffect(()=>{if(!undo)return;const t=setTimeout(()=>setUndo(null),8000);return()=>clearTimeout(t);},[undo]);
  useEffect(()=>{if(!active){detailAbort.current?.abort();searchAbort.current?.abort();request.current++;if(busy)setError('Загрузка прервана. Нажмите «Повторить».');setBusy(false);setSearchBusy(false);locationJob.current++;setLocating(false);}},[active]);
  useEffect(()=>{if(screen!=='settings')setConfirmForget(false);},[screen]);
  useEffect(()=>{if(screen!=='search'){searchAbort.current?.abort();setSearchBusy(false);}},[screen]);
  useEffect(()=>()=>{detailAbort.current?.abort();searchAbort.current?.abort();offlineAbort.current?.abort();revokeOffline();},[]);
  useEffect(()=>{
    if(gpsFollow!=='following'||!active||screen!=='map'||!!selected)return;
    let cancelled=false,watchId;
    const start=async()=>{
      try{
        watchId=await Geolocation.watchPosition({enableHighAccuracy:false,timeout:15000,maximumAge:12000,minimumUpdateInterval:3000},(p,error)=>{
          if(cancelled)return;
          if(error){setGpsError('Местоположение недоступно · проверьте разрешение или сигнал GPS.');if(error.code===1||/permission|denied|разрешен/i.test(String(error.message||'')))setGpsFollow('off');return;}
          if(!p?.coords||!Number.isFinite(p.coords.latitude)||!Number.isFinite(p.coords.longitude))return;
          if(!acceptableFix(p.coords)){setGpsError('Низкая точность GPS · ожидаем сигнал');return;}
          setGpsError('');
          setLocation({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,at:Date.now()});
        });
        if(cancelled&&watchId)await Geolocation.clearWatch({id:watchId});
      }catch{if(!cancelled){setGpsError('Местоположение недоступно · разрешите геолокацию.');setGpsFollow('off');}}
    };
    start();
    return()=>{cancelled=true;if(watchId)Geolocation.clearWatch({id:watchId}).catch(()=>{});};
  },[gpsFollow,active,screen,selected]);
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
  const locate=async()=>{
    if(locating)return;const token=++locationJob.current;setLocating(true);setNotice('Определяем местоположение…');
    try{const p=await Geolocation.getCurrentPosition({enableHighAccuracy:false,timeout:12000,maximumAge:60000});if(token!==locationJob.current)return;closeCard();setLocation({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy});setNotice('Местоположение определено');}
    catch{if(token===locationJob.current)setNotice('Местоположение недоступно. Проверьте разрешение и геопозицию.');}
    finally{if(token===locationJob.current)setLocating(false);}
  };
  const toggleGps=()=>{
    if(gpsFollow==='following'){setGpsFollow(nextFollowState(gpsFollow,'tap'));setGpsError('');return;}
    setGpsError('');setGpsFollow(nextFollowState(gpsFollow,'tap'));locate();
  };
  const saveOffline=async()=>{
    if(!details||demo||offlineBusy||!online)return;
    setOfflineBusy(true);
    const controller=new AbortController();offlineAbort.current=controller;
    try{
      const result=await offlineStore.save(details,{signal:controller.signal});
      setOfflineInfo({status:result.status,missing:result.missing,savedAt:Date.now()});
      setOfflineEpoch(v=>v+1);
      setToast(result.missing?'Описание сохранено, часть фотографий недоступна':'Объект сохранён для офлайн-чтения');
    }catch(e){setOfflineInfo({status:'error',missing:0});setToast(e.message||'Не удалось сохранить объект');}
    finally{if(offlineAbort.current===controller)offlineAbort.current=null;setOfflineBusy(false);setOfflineEpoch(v=>v+1);}
  };
  const removeOffline=async id=>{
    try{await offlineStore.remove(id);setOfflineEpoch(v=>v+1);if(selected?.id===id)setOfflineInfo(null);setToast('Офлайн-копия удалена');}
    catch(e){setToast(e.message||'Не удалось удалить офлайн-копию');}
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
  const areaBusy=!!(area.loading||area.draining);
  const areaActionLabel=areaBusy?(area.draining?'Догружаем область':'Загружаем область')
    :area.error?(area.more?'Повторить догрузку':'Повторить загрузку')
    :area.more?'Догрузить область':'Обновить область';
  const areaActionTitle=areaBusy?`${areaActionLabel}: ${area.places.length}${area.found!=null?` из ${area.found}`:''} объектов`
    :area.more?'Загрузить остальные объекты области':area.error?'Повторить запрос области':'Обновить область с сервера';
  const refreshArea=()=>{if(demo||areaBusy||!active)return;closeCard();setRefresh(x=>x+1);};
  const runAreaAction=()=>{if(demo||areaBusy||!active)return;if(area.more)setMoreRequest(x=>x+1);else refreshArea();};
  if(!credentials.ready)return <Startup/>;
  return <main className={`${selected||candidates.length?'has-sheet':''} ${screen!=='map'?'has-screen':''} ${mapPanel?'has-map-panel':''} ${toast?'has-toast':''}`}>
    <div className="map-stage" inert={screen!=='map'} aria-hidden={screen!=='map'}>
      <MapPane zoomRequest={zoomRequest} demo={demo} apiKey={apiKey} auto={auto} active={active} paused={screen!=='map'||!!selected||cacheClearing||gpsFollow==='following'} cacheEpoch={cacheEpoch} refresh={refresh} moreRequest={moreRequest} focus={focus} location={location} gpsFollowing={gpsFollow==='following'} onGpsPause={()=>setGpsFollow(s=>nextFollowState(s,'manual-pan'))} cacheView={cacheView} selectedId={selected?.id} density={density} basemap={basemap} yandexKey={yandexKey} yandexReferer={yandexReferer} onBasemapFallback={fallbackBasemap} onBasemapConnected={()=>setYandexDiagnostic(null)} onVisiblePlaces={setVisiblePlaces} onCandidates={setCandidates} onSelect={onSelect} onState={acceptArea} onMessage={setNotice}/>
      {!online&&<div className="network-hint" role="status">Нет подключения · доступно офлайн-чтение сохранённых карточек; карта может быть недоступна.</div>}
      <div className="map-tools" role="toolbar" aria-label="Управление картой">
        <button className="icon-btn search-launch" aria-label="Найти место" title="Найти место" aria-pressed={mapPanel==='search'} onClick={()=>setMapPanel(v=>v==='search'?null:'search')}><Icon name="search"/></button>
        <button className="icon-btn" aria-label="Список объектов области" title="Список объектов области" aria-pressed={mapPanel==='list'} onClick={()=>setMapPanel(v=>v==='list'?null:'list')}><Icon name="map"/></button>
        <button className="icon-btn" aria-label="Приблизить карту" title="Приблизить карту" onClick={()=>setZoomRequest(v=>({delta:1,seq:(v?.seq??0)+1}))}><Icon name="plus"/></button>
        <button className="icon-btn" aria-label="Отдалить карту" title="Отдалить карту" onClick={()=>setZoomRequest(v=>({delta:-1,seq:(v?.seq??0)+1}))}><Icon name="minus"/></button>
        <button className={'icon-btn gps-control gps-'+gpsFollow} title={gpsFollow==='off'?'Следовать за GPS':gpsFollow==='paused'?'Возобновить GPS Follow':'Выключить GPS Follow'} aria-label="Моё местоположение" aria-pressed={gpsFollow==='following'} onClick={toggleGps}><Icon name="locate"/></button>
        {!demo&&<button className={`icon-btn area-action ${areaBusy?'is-loading':''} ${area.error?'has-error':''} ${area.more&&!areaBusy&&!area.error?'can-continue':''}`} aria-label={areaActionLabel} title={areaActionTitle} aria-busy={areaBusy} disabled={areaBusy||!active} onClick={runAreaAction}><Icon name={areaBusy||area.error||!area.more?'refresh':'download'}/></button>}
      </div>
      <Motion open={!!mapPanel&&!selected&&!candidates.length} identity={mapPanel} kind="discovery"><MapDiscover mode={mapPanel} demo={demo} query={query} onQuery={queryOnMap} onSearch={search} results={results} searchBusy={searchBusy} searchStatus={searchStatus} visiblePlaces={visiblePlaces} area={area} notice={notice} density={density} onDensity={setDensity} onSelect={onSelect} onRefreshArea={refreshArea} onCancelSearch={cancelMapSearch} onSettings={()=>navigate('settings')} onClose={closeMapPanel}/></Motion>
      {!selected&&!candidates.length&&(gpsError||notice)&&<div className="map-feedback"><div className="status" role="status" aria-live="polite">{gpsError|| (gpsFollow==='paused'?'GPS Follow приостановлен · нажмите кнопку геолокации для возобновления':notice)}</div>{demo&&<button className="connect-action" onClick={()=>navigate('settings')}>Подключить Wikimapia <Icon name="arrow" size={18}/></button>}</div>}
      <span className="sr-only" role="status" aria-live="polite">{area.draining?`Догружаем: ${area.places.length}${area.found!=null?` из ${area.found}`:" объектов"}`:''}</span>
      <Motion open={candidates.length>0} identity={candidates.map(p=>p.id).join(',')} kind="chooser"><ObjectChooser places={candidates} onPick={onSelect} onClose={()=>setCandidates([])}/></Motion>
      <Motion open={!!selected||busy||!!error} identity={selected?.id} kind="sheet"><Details returnLabel={returnTo==='search'||origin.current?.panel==='search'?'К результатам поиска':returnTo==='saved'?'К избранному':origin.current?.panel==='list'?'К объектам области':null} onReturn={dismissCard} data={details||(selected?{id:selected.id,title:selected.title}:null)} busy={busy} error={error} onClose={dismissCard} onRetry={()=>selected&&onSelect(selected)} basemap={basemap} favorites={favorites.filter(x=>x.source===(demo?'demo':'wikimapia')).map(x=>x.id)} toggleFavorite={toggleFavorite} offlineInfo={offlineInfo} offlineBusy={offlineBusy} onSaveOffline={saveOffline} onRemoveOffline={()=>removeOffline(selected?.id)} offlineAvailable={!demo&&online}/></Motion>
    </div>
    <Motion open={screen!=='map'} identity={screen} kind="screen"><section className="app-screen" aria-label={navigation.find(x=>x[0]===screen)[1]}>
      <header className="screen-header"><button className="icon-btn" aria-label="Вернуться на карту" onClick={()=>setScreen('map')}><Icon name="back"/></button><div><p>WikiReader</p><h1>{navigation.find(x=>x[0]===screen)[1]}</h1></div></header>
      {screen==='settings'&&<Settings confirmForget={confirmForget} setConfirmForget={setConfirmForget} credentials={credentials} onCacheAction={changeCache} onShowArea={showCachedArea} cacheEpoch={cacheEpoch} currentAreaIds={currentAreaIds} cacheClearing={cacheClearing} offlineEpoch={offlineEpoch} onOfflineChange={()=>setOfflineEpoch(v=>v+1)} theme={theme} setTheme={setTheme} auto={auto} setAuto={setAuto} density={density} setDensity={setDensity} basemap={basemap} setBasemap={setBasemap} yandexKey={yandexKey} setYandexKey={setYandexKey} yandexReferer={yandexReferer} setYandexReferer={setYandexReferer} yandexDiagnostic={yandexDiagnostic} onApply={applyKey} onForget={forgetKey} demo={demo} onDemo={()=>{resetRequests();setDemo(true);setScreen('map');}} onReal={()=>{resetRequests();setDemo(false);setScreen('map');}}/>}
      {!online&&<div className="screen-network" role="status">Нет сети. Доступны сохранённые офлайн-карточки, избранное и контуры; новая загрузка требует сети.</div>}
      {screen==='search'&&<div className="screen-body search-page" ref={screenBody}>{demo?<div className="empty-state"><Icon name="search" size={36}/><h2>Найдите нужное место</h2><p>Подключите Wikimapia, чтобы искать по названию или открывать объекты по ID.</p><button className="primary" onClick={()=>setScreen('settings')}>Добавить API-ключ</button></div>:<><form className="search-form" onSubmit={search}><label htmlFor="place-query">Название, ID или ссылка Wikimapia</label><div className="search-input"><Icon name="search"/><input id="place-query" type="search" value={query} maxLength={200} onChange={e=>{searchAbort.current?.abort();setSearchBusy(false);setQuery(e.target.value);setResults([]);setSearchStatus('');}} enterKeyHint="search" placeholder="Место или ссылка на объект"/><button className="primary" disabled={searchBusy||!query.trim()}>Найти</button></div></form><div className="search-actions">{query&&<button className="text-button" onClick={()=>{searchAbort.current?.abort();setQuery('');setResults([]);setSearchStatus('');setSearchBusy(false);document.getElementById('place-query')?.focus();}}>Очистить поиск</button>}{searchBusy&&<button className="text-button" onClick={()=>{searchAbort.current?.abort();setSearchBusy(false);setSearchStatus('Поиск отменён');}}>Отменить поиск</button>}</div><p className="search-feedback" role="status">{searchStatus||'Поиск по объектам Wikimapia рядом с текущей картой'}</p><ul className="search-results">{results.map(p=><li key={p.id}><button data-place-id={p.id} data-source="wikimapia" onClick={()=>onSelect(p)}><span><strong>{p.title}</strong><small>Wikimapia · #{p.id}</small></span><Icon name="arrow" size={18}/></button></li>)}</ul><Disclosure className="id-disclosure" title="Открыть объект по ID"><div className="open-id"><label htmlFor="place-id">Число из ссылки Wikimapia</label><input id="place-id" type="number" min="1" value={placeId} onChange={e=>setPlaceId(e.target.value)}/><button className="secondary" onClick={openId}>Открыть по ID</button></div></Disclosure></>}</div>}
      {screen==='saved'&&<SavedLibrary offlineEntries={offlineEntries} favorites={favorites} history={history} historyEnabled={historyEnabled} savedQuery={savedQuery} onQuery={setSavedQuery} scrollRef={screenBody} onSelect={onSelect} onRemoveOffline={removeOffline} onRemoveFavorite={removeFavorite} onClearHistory={()=>setHistory([])} onRemoveHistory={id=>setHistory(items=>items.filter(p=>p.id!==id))} onToggleHistory={toggleHistory} onGoMap={()=>setScreen('map')}/>}
    </section></Motion>
    <nav className="bottom-nav" aria-label="Основная навигация">{navigation.map(([id,label,icon])=><button key={id} aria-current={screen===id?'page':undefined} onClick={()=>navigate(id)}><Icon name={icon}/><span>{label}</span></button>)}</nav>
    <Motion open={!!undo} identity={undo?`${undo.place.source}:${undo.place.id}`:''} kind="toast"><div className="undo-toast" role="status"><span>Место удалено из избранного</span><button className="text-button" onClick={undoRemove}>Вернуть</button></div></Motion>
    <Motion open={!!toast} identity={toast} kind="toast"><div className="toast" role="status">{toast}</div></Motion>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
