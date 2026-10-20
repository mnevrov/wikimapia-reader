import React,{useEffect,useMemo,useState} from 'react';
import Icon from './Icon.jsx';
import {areaCacheLabel} from './mapStatus.js';
import {discoverPlaces,polygonCenter,distanceMeters,distanceLabel} from './discoverModel.js';

export default function MapDiscover({mode,demo,query,onQuery,onSearch,results,searchBusy,searchStatus,
 visiblePlaces,area,notice,density,onDensity,onSelect,onRefreshArea,onCancelSearch,onSettings,onClose,
 sort,onSort,filter,onFilter,listQuery,onListQuery,favorites,offlineEntries,location,onLocate,onShowOnMap,highlightedId}) {
  const [limit,setLimit]=useState(80);
  const shownAll=useMemo(()=>discoverPlaces(visiblePlaces,{text:listQuery,filter,sort,favorites,offline:offlineEntries,location}),[visiblePlaces,listQuery,filter,sort,favorites,offlineEntries,location]);
  useEffect(()=>setLimit(80),[mode,visiblePlaces,listQuery,filter,sort]);
  const shown=shownAll.slice(0,limit);
  const count=`${area.places.length}${area.found!=null?` из ${area.found}`:''}`;
  const cacheLabel=areaCacheLabel(area);
  const areaStatus=area.error?area.error:
    area.draining?`Догружаем: ${count} объектов`:
    area.loading?`Загружаем: ${count} объектов`:
    area.more?`Получено ${count} объектов · доступны остальные`:
    area.found!=null?`Получено ${count} объектов`:
    notice||'Показаны объекты, уже полученные на устройстве';
  return <section className="discovery-panel" role="region" aria-label={mode==='search'?'Поиск на карте':'Объекты на карте'}>
    <header className="discovery-header">
      <div><p>WikiReader · Карта</p><h2>{mode==='search'?'Найти место':'Объекты в области'}</h2></div>
      <button className="icon-btn" aria-label="Закрыть панель карты" onClick={onClose}><Icon name="close"/></button>
    </header>
    {mode==='search'?demo?
      <div className="discovery-empty"><p>Для поиска нужен личный ключ Wikimapia.</p><button className="secondary" onClick={onSettings}>Подключить Wikimapia</button></div>:
      <>
        <form className="discovery-search" onSubmit={onSearch}>
          <label htmlFor="map-query">Название, ID или ссылка Wikimapia</label>
          <div><input id="map-query" type="search" value={query} maxLength={200} onChange={e=>onQuery(e.target.value)} placeholder="Найти на этой карте" enterKeyHint="search"/><button className="primary" disabled={!query.trim()||searchBusy}>Найти</button></div>
        </form>
        <p className="discovery-status" role="status">{searchStatus||'Поиск выполняется рядом с центром карты.'}</p>
        {searchBusy&&<button className="text-button" onClick={onCancelSearch}>Отменить поиск</button>}
        <ul className="discovery-results">{results.map(place=><li key={place.id}><button onClick={()=>onSelect(place)}><span><strong>{place.title}</strong><small>Wikimapia · #{place.id}</small></span><Icon name="arrow" size={18}/></button></li>)}</ul>
      </>:
      <div className="discovery-scroll">
        <div className="discovery-controls">
          <label htmlFor="map-density">Контуры<select id="map-density" value={density} onChange={e=>onDensity(e.target.value)}><option value="auto">Авто</option><option value="detailed">Подробно</option><option value="calm">Спокойно</option></select></label>
          <span aria-live="polite">Видно: {visiblePlaces.length}</span>
        </div>
        <details className="discover-options">
          <summary>Поиск, фильтры и сортировка</summary>
          <div className="discover-filters">
          <label htmlFor="discover-query">Поиск среди загруженных объектов<input id="discover-query" type="search" value={listQuery} onChange={e=>onListQuery(e.target.value)} placeholder="Название или ID"/></label>
          <div className="discover-selects">
            <label htmlFor="discover-filter">Показывать<select id="discover-filter" value={filter} onChange={e=>onFilter(e.target.value)}><option value="all">Все</option><option value="favorite">Избранное</option><option value="offline">Сохранено офлайн</option></select></label>
            <label htmlFor="discover-sort">Сортировка<select id="discover-sort" value={sort} onChange={e=>onSort(e.target.value)}><option value="title">По названию</option><option value="distance" disabled={!location}>По расстоянию</option><option value="area">По площади</option></select></label>
          </div>
          <button className="secondary discover-nearby" onClick={onLocate}><Icon name="locate" size={17}/>Рядом со мной</button>
          {sort==='distance'&&location&&<p className="discovery-status">Расстояние приблизительное, до центра границ контура.</p>}
          {!location&&<p className="discovery-status">Для расстояний разрешите геолокацию нажатием «Рядом со мной».</p>}
          </div>
        </details>
        <p className="discovery-status" role="status">{demo?'Демонстрационные объекты':areaStatus}</p>
        {!demo&&cacheLabel&&<p className="discovery-status" aria-label="Состояние данных области">{cacheLabel}</p>}
        {!demo&&<button className="text-button discovery-refresh" disabled={area.loading||area.draining} onClick={onRefreshArea}><Icon name="refresh" size={16}/>Обновить область с сервера</button>}
        {shown.length?
          <ul className="discovery-results discovery-place-list">{shown.map(place=><li key={place.id} className={highlightedId===place.id?'discover-active':''}>
            <button onClick={()=>onSelect(place)}><span><strong>{place.title}</strong><small>#{place.id}{location&&' · '+distanceLabel(distanceMeters(location,polygonCenter(place)))}</small></span><Icon name="arrow" size={18}/></button>
            <button className="discover-on-map" aria-label={'Показать контур #'+place.id} title="Показать контур" onClick={()=>onShowOnMap(place)}><Icon name="map" size={18}/></button>
          </li>)}</ul>:
          <p className="discovery-empty">{visiblePlaces.length?'Нет объектов по выбранным фильтрам.':'В этой части карты пока нет загруженных контуров. Приблизьте карту или дождитесь загрузки.'}</p>}
        {shownAll.length>limit&&<button className="secondary discovery-more" onClick={()=>setLimit(v=>v+80)}>Показать ещё {Math.min(80,shownAll.length-limit)}</button>}
        <p className="discovery-status">Список содержит только полученные контуры. Отсутствие объекта не означает его отсутствие в Wikimapia.</p>
      </div>}
  </section>;
}
