import React,{useEffect,useState} from 'react';
export default function Details({data, busy, error, onClose, onRetry, favorites, toggleFavorite}) {
  const [tab, setTab] = useState('description');
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { setTab('description'); setExpanded(false); }, [data?.id]);
  if (!data && !busy && !error) return null;
  return <section className={`sheet ${expanded ? 'expanded' : ''}`} aria-label="Информация об объекте">
    <div className="handle" onClick={() => setExpanded(x=>!x)} role="button" tabIndex="0" onKeyDown={e=>e.key==='Enter'&&setExpanded(x=>!x)} aria-label="Развернуть карточку" />
    <div className="sheet-header"><div><div className="eyebrow">WIKIMAPIA · ОБЪЕКТ</div><h2>{data?.title || 'Загрузка объекта…'}</h2></div><div className="header-actions"><button className="icon-btn" onClick={()=>setExpanded(x=>!x)} title="Развернуть">{expanded?'▾':'▴'}</button><button className="icon-btn" onClick={onClose} title="Закрыть">×</button></div></div>
    {busy ? <p className="content-hint">Загружаем сведения…</p> : error ? <div className="error">{error}<button className="ghost" onClick={onRetry}>Повторить</button></div> : <>
      <div className="tabs" role="tablist">
        {[["description","Описание"],["photos","Фото"],["comments","Комментарии"]].map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}{id==='photos' ? ` · ${data.photos?.length ?? 0}` : id==='comments' ? ` · ${data.comments?.length ?? 0}`:''}</button>)}
      </div>
      <div className="sheet-scroll">
        {tab==='description' && <p className="description">{data.description || 'Описание пока не добавлено.'}</p>}
        {tab==='photos' && (data.photos?.length ? <div className="photos">{data.photos.map((p,i)=><div key={i}><a href={p.src} target="_blank" rel="noreferrer"><img src={p.src} alt={`Фото ${i+1}`} loading="lazy" /></a><small>{p.author}</small></div>)}</div>:<p className="content-hint">Фотографий пока нет или они недоступны через API.</p>)}
        {tab==='comments' && (data.comments?.length ? data.comments.map((c,i)=><article className="comment" key={i}><header><b>{c.author}</b>{c.date && <time dateTime={c.date}>{new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'}).format(new Date(c.date))}</time>}</header><p>{c.text}</p></article>):<p className="content-hint">Комментарии отсутствуют или не возвращаются API.</p>)}
      </div>
      <div className="sheet-footer"><button className="ghost" onClick={()=>toggleFavorite(data.id)}>{favorites.includes(data.id)?'★ Сохранено':'☆ В избранное'}</button><a className="primary" href={data.url} target="_blank" rel="noopener noreferrer">Wikimapia ↗</a></div>
    </>}
    <div className="sheet-attribution">Карта © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></div>
  </section>;
}
