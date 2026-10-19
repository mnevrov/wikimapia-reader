import React,{useEffect,useState} from 'react';
import {offlineStore} from './offlineStore.js';
import Icon from './Icon.jsx';
const size=n=>n<1048576?Math.round(n/1024)+' КБ':(n/1048576).toFixed(1)+' МБ';
export default function OfflineSettings({epoch,onChange}){
  const [snapshot,setSnapshot]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState(false);
  useEffect(()=>{let alive=true;offlineStore.snapshot().then(x=>{if(alive){setSnapshot(x);setError('');}}).catch(()=>{if(alive)setError('Хранилище недоступно');});return()=>{alive=false;};},[epoch]);
  const action=async fn=>{
    setBusy(true);setError('');
    try{await fn();setSnapshot(await offlineStore.snapshot());onChange?.();setConfirm(false);}
    catch(e){setError(e.message||'Не удалось изменить настройки');}
    finally{setBusy(false);}
  };
  return <section className="settings-group offline-settings" aria-label="Офлайн-хранилище">
    <h2>Офлайн-чтение</h2>
    <p className="helper">Здесь хранятся только выбранные карточки Wikimapia, отдельно от кэша контуров и настроек подключения. Подложка карты не сохраняется.</p>
    {error&&<p role="alert" className="error">{error}</p>}
    {snapshot&&<>
      <div className="cache-stats"><strong>{size(snapshot.bytes)} из {snapshot.preferences.limitMB} МБ</strong><span>{snapshot.count} объектов · Текст: {size(snapshot.textBytes)} · Фото: {size(snapshot.mediaBytes)}</span></div>
      <label className="cache-retention" htmlFor="offline-limit">Лимит сохранённых объектов
        <select id="offline-limit" value={snapshot.preferences.limitMB} disabled={busy} onChange={e=>action(()=>offlineStore.setPreferences({...snapshot.preferences,limitMB:Number(e.target.value)}))}>
          {[25,50,100,250,500].map(x=><option key={x} value={x}>{x} МБ</option>)}
        </select>
      </label>
      <label className="cache-retention" htmlFor="offline-days">Срок актуальности
        <select id="offline-days" value={snapshot.preferences.retentionDays} disabled={busy} onChange={e=>action(()=>offlineStore.setPreferences({...snapshot.preferences,retentionDays:Number(e.target.value)}))}>
          {[7,30,90,365].map(x=><option key={x} value={x}>{x} дней</option>)}
        </select>
      </label>
      <p className="helper">После окончания срока карточка помечается устаревшей, но не удаляется автоматически. Для обновления откройте объект онлайн и сохраните повторно.</p>
      {!!snapshot.count&&(!confirm?<button className="danger-button" disabled={busy} onClick={()=>setConfirm(true)}><Icon name="trash" size={18}/>Очистить офлайн-хранилище…</button>:<div role="group" className="cache-confirm" aria-label="Подтверждение очистки офлайн"><p>Удалить все {snapshot.count} сохранённых объектов, включая фотографии? Избранное и кэш карты останутся.</p><div className="split-actions"><button className="danger-button" disabled={busy} onClick={()=>action(()=>offlineStore.clear())}>Удалить всё</button><button className="secondary" onClick={()=>setConfirm(false)}>Отмена</button></div></div>)}
    </>}
  </section>;
}
