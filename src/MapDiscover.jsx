import React,{useEffect,useState} from 'react';
import Icon from './Icon.jsx';

export default function MapDiscover({mode,demo,query,onQuery,onSearch,results,searchBusy,searchStatus,
 visiblePlaces,area,notice,density,onDensity,onSelect,onCancelSearch,onSettings,onClose}) {
  const [limit,setLimit]=useState(80);
  useEffect(()=>setLimit(80),[mode,visiblePlaces]);
  const shown=visiblePlaces.slice(0,limit);
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
      <>
        <div className="discovery-controls">
          <label htmlFor="map-density">Контуры<select id="map-density" value={density} onChange={e=>onDensity(e.target.value)}><option value="auto">Авто</option><option value="detailed">Подробно</option><option value="calm">Спокойно</option></select></label>
          <span aria-live="polite">Видно: {visiblePlaces.length}</span>
        </div>
        <p className="discovery-status" role="status">{demo?'Демонстрационные объекты':area.loading||area.draining?notice:area.more?'Загружена лишь часть объектов области':area.found!=null?`Получено ${area.places.length} из ${area.found}`:'Показаны объекты, уже полученные на устройстве'}</p>
        {shown.length?
          <ul className="discovery-results">{shown.map(place=><li key={place.id}><button onClick={()=>onSelect(place)}><span><strong>{place.title}</strong><small>#{place.id}</small></span><Icon name="arrow" size={18}/></button></li>)}</ul>:
          <p className="discovery-empty">В этой части карты пока нет загруженных контуров. Приблизьте карту или дождитесь загрузки.</p>}
        {visiblePlaces.length>limit&&<button className="secondary discovery-more" onClick={()=>setLimit(v=>v+80)}>Показать ещё {Math.min(80,visiblePlaces.length-limit)}</button>}
      </>}
  </section>;
}
