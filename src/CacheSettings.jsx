import React,{useEffect,useState} from 'react';
import {areaCache,CACHE_MAX_AREAS,CACHE_MAX_BYTES} from './areaCache.js';
import Icon from './Icon.jsx';
import Motion from './Motion.jsx';
import Disclosure from './Disclosure.jsx';
const size=bytes=>bytes<1024?`${bytes} Б`:`${new Intl.NumberFormat('ru',{maximumFractionDigits:1}).format(bytes/(bytes<1024*1024?1024:1024*1024))} ${bytes<1024*1024?'КБ':'МБ'}`;
const updated=value=>new Intl.DateTimeFormat('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
export default function CacheSettings({epoch,busy,currentIds,demo,onAction,onShowArea}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[confirm,setConfirm]=useState(false);
 useEffect(()=>{let alive=true;areaCache.snapshot().then(value=>{if(alive){setData(value);setError('');}}).catch(()=>{if(alive)setError('Не удалось прочитать сохранённые области.');});return()=>{alive=false;};},[epoch]);
 const act=async(action,message)=>{const next=await onAction(action,message);if(next){setData(next);setConfirm(false);}};
 const current=data?.entries.filter(e=>currentIds.includes(e.id))??[];
 const allPinned=current.length>0&&current.every(e=>e.pinned);
 return <section className="settings-group cache-settings"><h2>Кэш областей</h2>
  {error&&<p className="error" role="alert">{error}</p>}
  {!data&&!error&&<p className="helper">Читаем сохранённые области…</p>}
  {data&&<><div className="cache-stats"><strong>{size(data.bytes)} из {size(CACHE_MAX_BYTES)}</strong><span>{data.count} из {CACHE_MAX_AREAS} областей · Закреплено: {data.pinnedCount}</span></div>
   <label className="cache-retention" htmlFor="cache-days">Хранить незакреплённые области<select id="cache-days" disabled={busy} value={data.preferences.retentionDays} onChange={e=>act(()=>areaCache.setPreferences({retentionDays:Number(e.target.value)}),'Срок хранения изменён')}><option value="1">1 день</option><option value="7">7 дней</option><option value="30">30 дней</option></select></label>
   <button className="secondary cache-pin-current" disabled={busy||demo||!current.length} onClick={()=>act(()=>areaCache.pinMany(current.map(e=>e.id),!allPinned),allPinned?'Область откреплена':'Область закреплена')}><Icon name="bookmark" size={18}/>{allPinned?'Открепить текущую область':'Закрепить текущую область'}</button>
   <p className="helper">Закреплённые области не удаляются автоматически и занимают общий лимит. Сохраняются только контуры. Данные старше 5 минут обновляются при просмотре; подложка и карточки требуют интернета.</p>
   {data.entries.length>0&&<Disclosure className="cached-areas" title={`Сохранённые области · ${data.count}`}><ul>{[...data.entries].sort((a,b)=>b.updated-a.updated).map(entry=><li key={entry.id}><div className="cached-area-title"><strong>{entry.state.places[0]?.title||'Область без объектов'}</strong>{entry.pinned&&<span className="pin-label"><Icon name="bookmark" size={14}/>Закреплено</span>}</div><small>Обновлено {updated(entry.updated)} · {size(entry.bytes)}</small><small>{((entry.bbox[1]+entry.bbox[3])/2).toFixed(4)}, {((entry.bbox[0]+entry.bbox[2])/2).toFixed(4)}{currentIds.includes(entry.id)?' · На текущей карте':''}</small><div className="cached-area-actions"><button className="text-button" aria-label="Показать область на карте" onClick={()=>onShowArea(entry.bbox)}><Icon name="map" size={18}/>На карту</button><button className="text-button" disabled={busy} aria-label={entry.pinned?'Открепить область':'Закрепить область'} onClick={()=>act(()=>areaCache.pinMany([entry.id],!entry.pinned),entry.pinned?'Область откреплена':'Область закреплена')}><Icon name="bookmark" size={18}/>{entry.pinned?'Открепить':'Закрепить'}</button></div></li>)}</ul></Disclosure>}
   <button className="secondary" disabled={busy} onClick={()=>act(()=>areaCache.clear(),'Кэш областей очищен')}>Очистить кэш областей</button><p className="helper">При обычной очистке закреплённые области сохраняются.</p>
   {data.pinnedCount>0&&!confirm&&<button className="text-button danger-text" disabled={busy} onClick={()=>setConfirm(true)}>Удалить весь кэш…</button>}
   <Motion open={data.pinnedCount>0&&confirm} kind="disclosure"><div className="cache-confirm" role="group" aria-label="Удаление всего кэша"><p>Удалить все области, включая закреплённые?</p><div className="split-actions"><button className="danger-button" disabled={busy} onClick={()=>act(()=>areaCache.clear({includePinned:true}),'Весь кэш удалён')}>Удалить всё</button><button className="secondary" onClick={()=>setConfirm(false)}>Отмена</button></div></div></Motion>
  </>}
 </section>;
}
