import React,{useRef,useState} from 'react';
import Icon from './Icon.jsx';
import {filterLibrary} from './readingHistory.js';
import {parseBackup} from './libraryBackup.js';
import {isNativeTransfer,pickLibraryText} from './nativeTransfer.js';

export default function SavedLibrary({offlineEntries,favorites,history,historyEnabled,savedQuery,onQuery,onSelect,onRemoveOffline,onRemoveFavorite,onClearHistory,onRemoveHistory,onToggleHistory,onGoMap,onExportLibrary,onImportLibrary,scrollRef}){
  const [confirmClear,setConfirmClear]=useState(false);
  const fileInput=useRef(null);
  const [importPending,setImportPending]=useState(null),[backupBusy,setBackupBusy]=useState(false),[backupNotice,setBackupNotice]=useState('');
  const prepareBackup=text=>{
    try{setImportPending(parseBackup(text));setBackupNotice('');}
    catch(e){setBackupNotice(e?.message||'Не удалось прочитать резервную копию');setImportPending(null);}
  };
  const chooseBackup=async()=>{
    setBackupNotice('');
    if(isNativeTransfer()){
      try{setBackupBusy(true);prepareBackup(await pickLibraryText());}
      catch(e){if(e?.code!=='CANCELLED')setBackupNotice(e?.message||'Не удалось открыть файл');}
      finally{setBackupBusy(false);}
    }else fileInput.current?.click();
  };
  const handleFile=async event=>{
    const file=event.target.files?.[0];event.target.value='';
    if(!file)return;
    if(file.size>10*1048576){setBackupNotice('Файл слишком велик (максимум 10 МБ)');return;}
    try{setBackupBusy(true);prepareBackup(await file.text());}
    catch{setBackupNotice('Не удалось прочитать файл');}
    finally{setBackupBusy(false);}
  };
  const confirmImport=async()=>{
    if(!importPending)return;
    try{
      setBackupBusy(true);
      const result=await onImportLibrary(importPending);
      setBackupNotice(`Импорт завершён: ${result.offline} офлайн-карточек, ${result.favorites} избранных, ${result.history} записей истории добавлено.`);
      setImportPending(null);
    }catch(e){setBackupNotice(e?.message||'Импорт не удался. Существующие записи не удалены.');}
    finally{setBackupBusy(false);}
  };
  const exportBackup=async()=>{
    try{setBackupBusy(true);await onExportLibrary();setBackupNotice('Экспорт подготовлен. Сохраните файл в выбранном месте.');}
    catch(e){if(e?.code!=='CANCELLED')setBackupNotice(e?.message||'Не удалось создать резервную копию');}
    finally{setBackupBusy(false);}
  };
  const offline=filterLibrary(offlineEntries,savedQuery,{searchDescription:true});
  const starred=filterLibrary(favorites,savedQuery);
  const recent=filterLibrary(history,savedQuery);
  const populated=offlineEntries.length+favorites.length+history.length>0;
  return <div className="screen-body" aria-label="Библиотека" ref={scrollRef}>
    {populated&&<label className="saved-filter" htmlFor="saved-library-search">Найти в избранном, офлайн-карточках и истории
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
    <section className="library-backup" aria-label="Резервная копия библиотеки">
      <h2>Резервная копия</h2>
      <p className="helper">Переносит избранное, историю и тексты офлайн-карточек. Фото и настройки не включены. API-ключ и геопозиция не экспортируются. Файл содержит ваши сохранённые тексты.</p>
      <div className="split-actions">
        <button className="secondary" disabled={backupBusy} onClick={exportBackup}><Icon name="download" size={17}/>Экспорт</button>
        <button className="secondary" disabled={backupBusy} onClick={chooseBackup}><Icon name="bookmark" size={17}/>Импорт</button>
      </div>
      <input ref={fileInput} className="backup-file-input" type="file" accept=".json,application/json" tabIndex={-1} aria-label="Выбрать файл резервной копии" onChange={handleFile}/>
      {importPending&&<div className="cache-confirm" role="group" aria-label="Подтверждение импорта">
        <p>Объединить с текущей библиотекой: {importPending.favorites.length} избранных, {importPending.history.length} просмотров и {importPending.offline.length} офлайн-карточек? Существующие записи не заменяются, медиа в файл не включены.</p>
        <div className="split-actions"><button className="primary" disabled={backupBusy} onClick={confirmImport}>Импортировать</button><button className="secondary" disabled={backupBusy} onClick={()=>setImportPending(null)}>Отмена</button></div>
      </div>}
      {backupNotice&&<p className="helper" role="status">{backupNotice}</p>}
    </section>
  </div>;
}
