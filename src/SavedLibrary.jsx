import React,{useState} from 'react';
import Icon from './Icon.jsx';
import {filterLibrary} from './readingHistory.js';

export default function SavedLibrary({offlineEntries,favorites,history,historyEnabled,savedQuery,onQuery,onSelect,onRemoveOffline,onRemoveFavorite,onClearHistory,onRemoveHistory,onToggleHistory,onGoMap,scrollRef}){
  const [confirmClear,setConfirmClear]=useState(false);
  const offline=filterLibrary(offlineEntries,savedQuery,{searchDescription:true});
  const starred=filterLibrary(favorites,savedQuery);
  const recent=filterLibrary(history,savedQuery);
  const populated=offlineEntries.length+favorites.length+history.length>0;
  return <div className="screen-body" aria-label="Библиотека" ref={scrollRef}>
    {populated&&<label className="saved-filter" htmlFor="saved-library-search">Найти в сохранённом и истории
      <input id="saved-library-search" type="search" value={savedQuery} onChange={e=>onQuery(e.target.value)} placeholder="Название, текст офлайн-карточки или ID"/>
    </label>}
    {!!offline.length&&<section className="offline-list"><p className="section-caption">Для чтения без сети · {offline.length}</p>
      <ul className="saved-list">{offline.map(p=><li key={'offline:'+p.id}><button className="saved-open" onClick={()=>onSelect({id:p.id,title:p.title,source:'wikimapia'})}><span className="saved-icon"><Icon name="download"/></span><span><strong>{p.title}</strong><small>#{p.id} · {p.status==='partial'?'Сохранено частично':p.status==='stale'?'Данные устарели':p.status==='error'?'Ошибка':'Доступно без сети'}</small></span><Icon name="arrow" size={18}/></button><button className="icon-btn" aria-label={'Удалить офлайн-копию '+p.title} onClick={()=>onRemoveOffline(p.id)}><Icon name="trash" size={18}/></button></li>)}</ul>
    </section>}
    {!!starred.length&&<section><p className="section-caption">Сохранённые места · {starred.length}</p>
      <ul className="saved-list">{starred.map(p=><li key={p.source+':'+p.id}><button className="saved-open" data-place-id={p.id} data-source={p.source} onClick={()=>onSelect(p)}><span className="saved-icon"><Icon name="bookmark"/></span><span><strong>{p.title}</strong><small>{p.source==='demo'?'Демо':'Wikimapia'} · #{p.id}</small></span><Icon name="arrow" size={18}/></button><button className="icon-btn" aria-label={'Удалить '+p.title+' из избранного'} onClick={()=>onRemoveFavorite(p)}><Icon name="trash" size={18}/></button></li>)}</ul>
    </section>}
    {!!recent.length&&<section className="history-list"><p className="section-caption">Недавно просмотренные · {recent.length}</p>
      <ul className="saved-list">{recent.map(p=><li key={'history:'+p.id}><button className="saved-open" data-place-id={p.id} data-source="wikimapia" onClick={()=>onSelect({id:p.id,title:p.title,source:'wikimapia'})}><span className="saved-icon"><Icon name="clock"/></span><span><strong>{p.title}</strong><small>#{p.id} · {new Date(p.viewedAt).toLocaleDateString('ru-RU')}</small></span><Icon name="arrow" size={18}/></button><button className="icon-btn" aria-label={'Удалить из истории '+p.title} onClick={()=>onRemoveHistory(p.id)}><Icon name="trash" size={18}/></button></li>)}</ul>
    </section>}
    {populated&&!offline.length&&!starred.length&&!recent.length&&<p className="helper">Совпадений нет. Измените запрос или очистите поиск.</p>}
    {!populated&&<div className="empty-state"><Icon name="bookmark" size={36}/><h2>Места, к которым хочется вернуться</h2><p>Откройте объект на карте или сохраните карточку для чтения без сети.</p><button className="secondary" onClick={onGoMap}>На карту</button></div>}
    <section className="reading-history-controls" aria-label="История просмотров">
      <label className="setting-row" htmlFor="history-enabled"><span><strong>История просмотров</strong><small>Последние 50 реальных объектов, только на этом устройстве. Демо не записывается.</small></span><input id="history-enabled" type="checkbox" checked={historyEnabled} onChange={e=>{setConfirmClear(false);onToggleHistory(e.target.checked);}}/></label>
      {!historyEnabled&&<p className="helper">Запись отключена. При отключении старая история удаляется.</p>}
      {!!history.length&&(!confirmClear?<button className="text-button" onClick={()=>setConfirmClear(true)}>Очистить всю историю…</button>:<div className="cache-confirm" role="group" aria-label="Подтверждение очистки истории"><p>Удалить {history.length} записей истории? Избранное и офлайн-копии останутся.</p><div className="split-actions"><button className="danger-button" onClick={()=>{onClearHistory();setConfirmClear(false);}}>Удалить историю</button><button className="secondary" onClick={()=>setConfirmClear(false)}>Отмена</button></div></div>)}
    </section>
  </div>;
}
