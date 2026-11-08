import React,{useEffect,useState} from 'react';
import appPackage from '../package.json';
import {Capacitor} from '@capacitor/core';
import {Geolocation} from '@capacitor/geolocation';
import {car,hasCar} from './carBridge.js';
import {compareAndroidTransports} from './androidTransportProbe.js';
import Icon from './Icon.jsx';
import Motion from './Motion.jsx';
import CacheSettings from './CacheSettings.jsx';
import OfflineSettings from './OfflineSettings.jsx';
import {YANDEX_KEY_PATTERN} from './yandexUsage.js';
import {yandexDiagnosticReport} from './yandexDiagnosis.js';
import {diagnosticSnapshot,clearDiagnostics} from './apiDiagnostics.js';
export default function Settings({confirmForget,setConfirmForget,credentials,onCacheAction,onShowArea,cacheEpoch,currentAreaIds,cacheClearing,offlineEpoch,onOfflineChange,theme,setTheme,auto,setAuto,density,setDensity,basemap,setBasemap,yandexKey,setYandexKey,yandexReferer,setYandexReferer,yandexDiagnostic,onApply,onForget,demo,onDemo,onReal}){
  const [editing,setEditing]=useState(false),[draft,setDraft]=useState('');
  const [reportStatus,setReportStatus]=useState('');
  const [apiReportStatus,setApiReportStatus]=useState('');
  const [transportBusy,setTransportBusy]=useState(false);
  const [transportProgress,setTransportProgress]=useState('');
  const [transportReport,setTransportReport]=useState(null);
  const [carGpsEnabled,setCarGpsEnabled]=useState(false);
  const [carGpsBusy,setCarGpsBusy]=useState(false);
  const [carGpsMessage,setCarGpsMessage]=useState('');
  const [tilesDraft,setTilesDraft]=useState('');
  const [carTiles,setCarTiles]=useState({configured:false,provider:'osm',nightPolicy:'auto'});
  const [tilesMessage,setTilesMessage]=useState('');
  const [tilesBusy,setTilesBusy]=useState(false);
  useEffect(()=>{
    if(!hasCar())return;
    let alive=true;
    car.tilesStatus().then(state=>{if(alive)setCarTiles({configured:Boolean(state.configured),provider:state.provider||'osm',nightPolicy:state.nightPolicy||'auto'});})
      .catch(()=>{if(alive)setTilesMessage('Не удалось прочитать настройки автомобильной карты');});
    return()=>{alive=false;};
  },[]);
  const tilesSave=async()=>{
    if(!hasCar()||tilesBusy||!tilesDraft.trim())return;
    setTilesBusy(true);
    try{
      await car.tilesSaveKey({key:tilesDraft.trim()});setTilesDraft('');
      const state=await car.tilesStatus();
      setCarTiles({configured:Boolean(state.configured),provider:state.provider||'osm',nightPolicy:state.nightPolicy||'auto'});
      setTilesMessage('Ключ Tiles API зашифрован и сохранён на устройстве');
    }catch{setTilesMessage('Не удалось сохранить ключ. Проверьте формат ключа Tiles API.');}
    finally{setTilesBusy(false);}
  };
  const tilesSelect=async provider=>{
    if(!hasCar()||tilesBusy)return;
    setTilesBusy(true);
    try{
      await car.tilesSelect({provider});const state=await car.tilesStatus();
      setCarTiles({configured:Boolean(state.configured),provider:state.provider||'osm',nightPolicy:state.nightPolicy||'auto'});
      setTilesMessage('Подложка Android Auto: '+(provider==='yandex'?'Яндекс Карты':'OpenStreetMap')+'. При необходимости переподключите автомобиль.');
    }catch{setTilesMessage('Источник не переключён. Для Яндекса нужен отдельный Tiles API ключ.');}
    finally{setTilesBusy(false);}
  };
  const tilesNightSelect=async policy=>{
    if(!hasCar()||tilesBusy||policy===carTiles.nightPolicy)return;
    setTilesBusy(true);
    try{
      await car.tilesSelectNightPolicy({policy});
      setCarTiles(previous=>({...previous,nightPolicy:policy}));
      setTilesMessage(policy==='auto'
        ?'Ночью OSM с локальной цветовой стилизацией; днём — выбранная подложка.'
        :'Яндекс остаётся светлым даже ночью. Изменение применяется в автомобиле.');
    }catch{setTilesMessage('Не удалось изменить ночной режим карты');}
    finally{setTilesBusy(false);}
  };
  const tilesClear=async()=>{
    if(!hasCar()||tilesBusy)return;
    setTilesBusy(true);
    try{
      await car.tilesClearKey();
      setCarTiles(previous=>({...previous,configured:false,provider:'osm'}));setTilesDraft('');
      setTilesMessage('Ключ Tiles API удалён, автомобиль использует OSM');
    }catch{setTilesMessage('Не удалось удалить ключ Tiles API');}
    finally{setTilesBusy(false);}
  };

  useEffect(()=>{
    if(!hasCar())return;
    let alive=true;
    car.gpsStatus().then(r=>{if(alive)setCarGpsEnabled(Boolean(r.running));})
      .catch(()=>{if(alive)setCarGpsMessage('Статус GPS Android Auto не получен');});
    return()=>{alive=false;};
  },[]);
  const toggleCarGps=async()=>{
    if(!hasCar()||carGpsBusy)return;
    setCarGpsBusy(true);
    try{
      if(carGpsEnabled){
        await car.gpsStop();setCarGpsEnabled(false);
        setCarGpsMessage('Фоновый GPS остановлен');
      }else{
        await Geolocation.requestPermissions();
        await car.gpsStart();
        // startForegroundService schedules onStartCommand asynchronously.
        await new Promise(resolve=>setTimeout(resolve,700));
        const status=await car.gpsStatus();
        setCarGpsEnabled(Boolean(status.running));
        setCarGpsMessage(status.running
          ?'GPS Follow активен. Подключите Android Auto; пока работает служба, отображается уведомление.'
          :'Не удалось запустить GPS. Проверьте разрешение местоположения и ограничения батареи.');
      }
    }catch{
      setCarGpsMessage('Разрешите геопозицию и запустите GPS из открытого WikiReader на телефоне');
    }finally{setCarGpsBusy(false);}
  };

  const startTransportProbe=async()=>{
    if(transportBusy||!credentials.key||!Capacitor.isNativePlatform())return;
    setTransportBusy(true);setTransportReport(null);setTransportProgress('');
    try{setTransportReport(await compareAndroidTransports(credentials.key,setTransportProgress));}
    catch{setTransportProgress('Не удалось выполнить диагностику');}
    finally{setTransportBusy(false);}
  };
  const copyTransportReport=async()=>{
    if(!transportReport)return;
    try{await navigator.clipboard.writeText(JSON.stringify(transportReport,null,2));setTransportProgress('Обезличенный отчёт скопирован');}
    catch{setTransportProgress('Не удалось скопировать отчёт');}
  };
  const copyApiReport=async()=>{
    try { await navigator.clipboard.writeText(JSON.stringify(diagnosticSnapshot(),null,2)); setApiReportStatus('Обезличенная статистика скопирована'); }
    catch { setApiReportStatus('Буфер обмена недоступен; копирование отменено'); }
  };
  const copyYandexReport=async()=>{
    const report=yandexDiagnosticReport(yandexDiagnostic);
    if(!report)return;
    try{
      await navigator.clipboard.writeText(report);
      setReportStatus('Диагностика скопирована без API-ключа');
    }catch{setReportStatus('Не удалось скопировать автоматически. Сделайте скриншот блока диагностики.');}
  };
  useEffect(()=>{setEditing(false);setDraft('');setConfirmForget(false);},[credentials.key]);
  const submit=async e=>{e.preventDefault();if(await onApply(draft)){setDraft('');setEditing(false);}};
  return <div className="settings-panel screen-body">
    <section className="settings-group"><h2>Подключение к Wikimapia</h2>
      <div className="connection-card"><span className="connection-icon"><Icon name="key"/></span><div><strong>{credentials.key?(credentials.saved?'Ключ сохранён на устройстве':'Ключ действует в этой вкладке'):'Чтение с сайта'}</strong><p>{credentials.saved?'Будет восстановлен при следующем запуске.':credentials.key?'В браузере постоянное хранение отключено.':'Ключ необязателен: сайт используется первым, API дополняет недоступные данные.'}</p></div>{credentials.saved&&<Icon name="check"/>}</div>
      {credentials.error&&<div className="error" role="alert"><p>{credentials.error}</p>{!credentials.key&&<button className="secondary" disabled={credentials.busy} onClick={onForget}>Удалить сохранённую запись</button>}</div>}
      <Motion open={!credentials.key||editing} kind="disclosure"><form className="credential-form" onSubmit={submit}><label htmlFor="api-key">API-ключ Wikimapia — необязательно</label><input id="api-key" type="password" autoComplete="off" autoCapitalize="none" spellCheck="false" maxLength={4096} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Вставьте ключ Wikimapia"/><button className="primary" disabled={credentials.busy||!draft.trim()}>{credentials.busy?'Сохраняем…':'Сохранить и подключить'}</button>{editing&&<button type="button" className="text-button" onClick={()=>{setEditing(false);setDraft('');}}>Отмена</button>}</form></Motion>
      {credentials.key&&!editing&&<div className="split-actions"><button className="secondary" disabled={credentials.busy} onClick={()=>{setConfirmForget(false);setEditing(true);}}>Заменить ключ</button><button className="danger-button" disabled={credentials.busy} onClick={()=>setConfirmForget(true)}><Icon name="trash" size={18}/>Удалить ключ</button></div>}
      <Motion open={confirmForget} kind="disclosure"><div className="confirm-delete" role="group" aria-label="Удаление API-ключа"><p>Удалить ключ с этого устройства? Чтение с сайта, избранное и кэш останутся доступны.</p><div className="split-actions"><button className="secondary" autoFocus onClick={()=>setConfirmForget(false)}>Отмена</button><button className="danger-button" disabled={credentials.busy} onClick={onForget}>Удалить с устройства</button></div></div></Motion>
      <p className="helper">{credentials.persistentSupported?'Ключ хранится зашифрованным только на этом устройстве. После удаления приложения его нужно ввести заново.':'В браузере ключ действует до закрытия страницы. Для сохранения используйте Android-приложение.'}</p>
      <a className="inline-link" href="https://wikimapia.org/api?action=create_key" target="_blank" rel="noreferrer">Получить API-ключ <Icon name="external" size={16}/></a>
    </section>
    <section className="settings-group"><h2>Карта</h2><label className="setting-row" htmlFor="auto-load"><span><strong>Автозагрузка области</strong><small>После остановки карты, с учётом лимита API</small></span><input id="auto-load" type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/></label><p className="helper">Объекты загружаются при перемещении карты. В плотных областях после первых трёх страниц появится кнопка «Догрузить область». Одно нажатие запустит последовательную загрузку с прогрессом.</p><label className="density-setting" htmlFor="density-setting">Плотность контуров<select id="density-setting" value={density} onChange={e=>setDensity(e.target.value)}><option value="auto">Автоматически</option><option value="detailed">Подробно</option><option value="calm">Спокойный вид</option></select></label><p className="helper">«Автоматически» уменьшает контраст контуров в плотных областях. Объекты остаются доступными для выбора.</p></section>
    {hasCar()&&<section className="settings-group" aria-label="Android Auto GPS Follow">
      <h2>GPS Follow в Android Auto</h2>
      <p className="helper">Android Auto работает в фоновом режиме телефона. Для надёжного слежения во время движения запустите GPS-службу здесь, пока WikiReader открыт на телефоне, затем подключите автомобиль. Показывается системное уведомление о геолокации.</p>
      <button type="button" className="secondary" onClick={toggleCarGps} disabled={carGpsBusy}>
        {carGpsBusy?'Применяем…':carGpsEnabled?'Остановить GPS Follow для Android Auto':'Включить GPS Follow для Android Auto'}
      </button>
      <p className="helper" role="status">{carGpsMessage||(carGpsEnabled?'GPS-служба включена':'GPS-служба выключена')}</p>
      <p className="helper">При отключении GPS службы или завершении поездки можно остановить её здесь. Если обновлений нет, проверьте разрешение геолокации и экономию энергии Android.</p>
    </section>}
    {hasCar()&&<section className="settings-group car-tiles-settings" aria-label="Подложка Android Auto">
      <h2>Подложка Android Auto</h2>
      <p className="helper car-tiles-intro">Выберите карту для экрана автомобиля. Настройки подложки на телефоне находятся ниже.</p>
      <div className="basemap-choice car-tiles-choice" role="group" aria-label="Источник автомобильной карты">
        <button type="button" aria-pressed={carTiles.provider==='osm'} disabled={tilesBusy} onClick={()=>tilesSelect('osm')}>OpenStreetMap</button>
        <button type="button" aria-pressed={carTiles.provider==='yandex'} disabled={tilesBusy||!carTiles.configured} onClick={()=>tilesSelect('yandex')}>Яндекс Карты</button>
      </div>
      <p className="car-tiles-current">
        {carTiles.configured
          ?'Ключ сохранён · выбрана '+(carTiles.provider==='yandex'?'подложка Яндекса':'OpenStreetMap')
          :'Для Яндекса нужен отдельный ключ Tiles API'}
      </p>
      <div className="car-night-policy">
        <label htmlFor="car-night-policy">Ночной режим</label>
        <select id="car-night-policy" disabled={tilesBusy} value={carTiles.nightPolicy}
          onChange={e=>tilesNightSelect(e.target.value)}>
          <option value="auto">Авто: ночью стилизация OSM</option>
          <option value="keep_yandex">Всегда выбранная подложка</option>
        </select>
        <p className="helper">Tiles API Яндекса предоставляет только светлую схему. Автоматический режим ночью перекрашивает стандартные тайлы OSM. Это временный фильтр, а не отдельный полноценный ночной стиль. Яндекс днём остаётся без изменений.</p>
      </div>
      <div className="car-tiles-credentials">
        <label htmlFor="car-tiles-api-key">Ключ Яндекс Tiles API</label>
        <input id="car-tiles-api-key" type="password" autoComplete="off" spellCheck="false" autoCapitalize="none"
          maxLength={128} value={tilesDraft}
          placeholder={carTiles.configured?'Новый ключ (старый сохранён)':'Вставьте ключ Tiles API'}
          onChange={e=>setTilesDraft(e.target.value)}/>
        <button type="button" className="secondary car-tiles-save" disabled={tilesBusy||!tilesDraft.trim()} onClick={tilesSave}>
          {tilesBusy?'Сохраняем…':'Сохранить ключ'}
        </button>
        {carTiles.configured&&<button type="button" className="text-button car-tiles-remove" disabled={tilesBusy} onClick={tilesClear}>Удалить сохранённый ключ</button>}
        {tilesMessage&&<p className="helper car-tiles-message" role="status">{tilesMessage}</p>}
      </div>
      <details className="car-tiles-help">
        <summary>Как получить ключ и условия использования</summary>
        <p className="helper">Для автомобиля нужен ключ <strong>Yandex Tiles API</strong>. Ключ JavaScript API 3.0 для карты телефона сюда не подходит. Ключ автомобиля хранится в Android Keystore и не показывается повторно.</p>
        <p className="helper">Логотип Яндекса должен быть виден и вести на Яндекс Карты; работу ссылки ещё необходимо подтвердить на автомобильном экране.</p>
        <a className="inline-link" href="https://yandex.ru/maps-api/docs/tiles-api/quickstart.html" target="_blank" rel="noopener noreferrer">Получить ключ Tiles API <Icon name="external" size={16}/></a>
      </details>
    </section>}
    <section className="settings-group yandex-settings" aria-label="Картографическая подложка">
      <h2>Подложка карты</h2>
      <div className="basemap-choice" role="group" aria-label="Источник карты">
        <button type="button" aria-pressed={basemap==='osm'} onClick={()=>setBasemap('osm')}>OpenStreetMap</button>
        <button type="button" aria-pressed={basemap==='yandex'} disabled={!YANDEX_KEY_PATTERN.test(yandexKey)||!yandexReferer} onClick={()=>setBasemap('yandex')}>Яндекс Карты</button>
      </div>
      <p className="helper">Цвет карты Яндекса автоматически следует оформлению приложения: чёрная тема — ночная карта, светлая — дневная, «Как в системе» — по системной теме. Объекты, поиск и карточки загружаются из Wikimapia. При ошибке вернётся OpenStreetMap.</p>
      <label htmlFor="yandex-api-key">Ключ Яндекс JavaScript API 3.0</label>
      <input id="yandex-api-key" type="password" autoComplete="off" spellCheck="false" autoCapitalize="none" maxLength={64} value={yandexKey} placeholder="Вставьте ключ JS API" onChange={e=>setYandexKey(e.target.value.trim())}/>
      <label className="setting-row yandex-confirm" htmlFor="yandex-referer">
        <span><strong>Ограничение HTTP Referer настроено</strong><small>Обязательное условие для работы ключа JS API. Для Android WebView проверьте адрес источника запросов. Не используйте ключ без ограничения.</small></span>
        <input id="yandex-referer" type="checkbox" checked={yandexReferer} onChange={e=>setYandexReferer(e.target.checked)}/>
      </label>
      {yandexDiagnostic&&<div className="yandex-diagnostic" role="status" aria-label="Диагностика подключения Яндекс Карт">
        <strong>Ошибка Яндекс Карт: {yandexDiagnostic.code}</strong>
        <p>{yandexDiagnostic.title}. {yandexDiagnostic.help}</p>
        {yandexDiagnostic.previous&&<p>Предыдущий сбой: <code>{yandexDiagnostic.previous}</code></p>}
        {yandexDiagnostic.retrySeconds>0&&<p>Повтор доступен примерно через {yandexDiagnostic.retrySeconds} с.</p>}
        <p>Адрес страницы WebView: <code>{yandexDiagnostic.origin}</code></p>
        <p>Сеть: {yandexDiagnostic.online?'Android сообщает, что подключение есть':'Android сообщает об отсутствии подключения'}. Адрес страницы не подтверждает фактический заголовок HTTP Referer.</p>
        <button className="secondary" type="button" onClick={copyYandexReport}>Скопировать диагностику</button>
        {reportStatus&&<p>{reportStatus}</p>}
      </div>}
      <p className="helper">Ключ JS API хранится в настройках данного устройства, не попадает в GitHub и не используется без выбора Яндекса. Обычные просмотры карты бесплатны; геокодирование, панорамы и поиск Яндекса не вызываются. <a href="https://yandex.ru/maps-api/docs/js-api/limit.html" target="_blank" rel="noopener noreferrer">Настройка ключа <Icon name="external" size={14}/></a> · <a href="https://yandex.ru/legal/maps_termsofuse/" target="_blank" rel="noopener noreferrer">Условия Яндекс Карт</a></p>
      <button className="text-button" type="button" disabled={!yandexKey} onClick={()=>{setBasemap('osm');setYandexKey('');setYandexReferer(false);}}>Удалить ключ карты с устройства</button>
    </section>
    <section className="settings-group" aria-label="Диагностика API Wikimapia">
      <h2>Диагностика Wikimapia</h2>
      <p className="helper">Локальная статистика за текущий запуск: число запросов, время ответа, категории ошибок и полнота загрузки. Ключи, координаты, ID объектов и тексты ответов не собираются. Ничего не отправляется автоматически.</p>
      <div className="split-actions">
        <button className="secondary" type="button" onClick={copyApiReport}>Скопировать статистику</button>
        <button className="text-button" type="button" onClick={()=>{clearDiagnostics();setApiReportStatus('Статистика очищена');}}>Очистить</button>
      </div>
      {apiReportStatus&&<p className="helper" role="status">{apiReportStatus}</p>}
      {Capacitor.isNativePlatform()&&credentials.key&&!demo&&<div className="transport-diagnostic" aria-label="Проверка сетевого подключения Android">
        <h3>Резервный API: диагностика Android</h3>
        <p className="helper">Основное чтение работает с сайтом без ключа. Эта проверка запускается только вручную и касается дополнительного API. Не более двух запросов на публичной тестовой области, интервал не менее 6 секунд. При отказе по квоте или ключу второй запрос пропускается. Никаких ключей, адресов запросов и координат в отчёте нет.</p>
        <button className="secondary" type="button" disabled={transportBusy} onClick={startTransportProbe}>{transportBusy?'Проверяем соединение…':'Проверить два HTTP-транспорта'}</button>
        {transportProgress&&<p className="helper" role="status">{transportProgress}</p>}
        {transportReport&&<div className="transport-results" role="group" aria-label="Результаты теста транспорта">
          {transportReport.results.map(item=><p key={item.transport}><strong>{item.transport==='android_native'?'Android HTTP':'WebView'}:</strong> {item.outcome}{item.reason?` (${item.reason})`:''}, {item.durationMs} мс{item.httpStatus!==null?`, HTTP ${item.httpStatus}`:''}{item.apiCode!=null?`, код API ${item.apiCode}`:''}{item.contentCategory?`, ответ: ${item.contentCategory}`:''}{item.objects!==null?`, объектов ${item.objects}, контуров ${item.polygons}`:''}</p>)}
          <button className="secondary" type="button" onClick={copyTransportReport}>Скопировать результат проверки</button>
        </div>}
      </div>}
    </section>
    <CacheSettings epoch={cacheEpoch} busy={cacheClearing} currentIds={currentAreaIds} demo={demo} onAction={onCacheAction} onShowArea={onShowArea}/>
    <OfflineSettings epoch={offlineEpoch} onChange={onOfflineChange}/>
    <fieldset className="settings-group theme-choice"><legend>Оформление</legend><div>{[['dark','Чёрная'],['light','Светлая'],['system','Как в системе']].map(([value,label])=><button key={value} aria-pressed={theme===value} onClick={()=>setTheme(value)}>{label}</button>)}</div></fieldset>
    <section className="settings-group"><h2>Демонстрация</h2><p className="helper">Вымышленные объекты для знакомства с карточками. Сохранённый ключ не удаляется.</p><button className="secondary" disabled={credentials.busy} onClick={demo?onReal:onDemo}>{demo?'Вернуться к реальным данным':'Открыть деморежим'}</button></section>
    <p className="about">WikiReader {appPackage.version} · Неофициальный клиент<br/>Данные © участники Wikimapia</p>
  </div>;
}
