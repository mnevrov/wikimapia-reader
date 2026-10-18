import React,{useEffect,useRef,useState} from 'react';
import Icon from './Icon.jsx';
import {useSheetGesture} from './useSheetGesture.js';
const dateFormat=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'});
export default function Details({data,busy,error,onClose,onRetry,favorites,toggleFavorite,returnLabel,onReturn}){
  const [tab,setTab]=useState('description'),[expanded,setExpanded]=useState(false);
  const scroll=useRef(null),root=useRef(null);
  const gesture=useSheetGesture(root,{expanded,setExpanded,onClose,identity:data?.id});
  useEffect(()=>{setTab('description');setExpanded(!!returnLabel);},[data?.id]);
  useEffect(()=>{scroll.current?.scrollTo(0,0);},[data?.id,tab]);
  const tabs=['description','photos','comments'];
  const selectTab=id=>{setTab(id);if(id!=='description')setExpanded(true);};
  if(!data&&!busy&&!error)return null;
  const saved=favorites.includes(data?.id);
  return <section ref={root} className={`sheet ${expanded?'expanded':''}`} aria-label="Информация об объекте">
    <button className="handle" aria-label={expanded?'Свернуть карточку':'Развернуть карточку'} {...gesture}><span/></button>
    {returnLabel&&<button className="return-to-list" onClick={onReturn}><Icon name="back" size={18}/>{returnLabel}</button>}
    <div className="sheet-header"><div><p className="eyebrow">Wikimapia · #{data?.id}</p><h2>{data?.title||'Загрузка объекта…'}</h2></div><button className="icon-btn" title="Закрыть" aria-label="Закрыть карточку" onClick={onClose}><Icon name="close"/></button></div>
    {busy?<div className="sheet-scroll loading-state"><span className="spinner"/><p>Получаем описание, фото и комментарии…</p></div>:error?<div className="sheet-scroll"><div className="error" role="alert"><p>{error}</p><button className="secondary" onClick={onRetry}>Повторить</button></div></div>:<>
      <div className="tabs" role="tablist" aria-label="Разделы объекта">{[['description','Описание',null],['photos','Фото',data.photos?.length||0],['comments','Комментарии',data.comments?.length||0]].map(([id,label,count])=><button key={id} role="tab" aria-selected={tab===id} aria-controls="object-content" id={`tab-${id}`} tabIndex={tab===id?0:-1} onKeyDown={e=>{let next;if(e.key==='ArrowRight')next=tabs[(tabs.indexOf(id)+1)%3];if(e.key==='ArrowLeft')next=tabs[(tabs.indexOf(id)+2)%3];if(e.key==='Home')next=tabs[0];if(e.key==='End')next=tabs[2];if(next){e.preventDefault();selectTab(next);document.getElementById(`tab-${next}`)?.focus();}}} onClick={()=>selectTab(id)}>{label}{count!==null&&<span>{count}</span>}</button>)}</div>
      <div key={tab} className="sheet-scroll" id="object-content" role="tabpanel" aria-labelledby={`tab-${tab}`} ref={scroll}>
        {tab==='description'&&<p className="description">{data.description||'Описание этого объекта пока не добавлено.'}</p>}
        {tab==='photos'&&(data.photos?.length?<div className="photos">{data.photos.map((p,i)=><figure key={`${p.src}-${i}`}><a href={p.src} target="_blank" rel="noreferrer"><img src={p.src} alt={`Фото ${i+1}: ${data.title}`} loading="lazy"/></a>{p.author&&<figcaption>{p.author}</figcaption>}</figure>)}</div>:<div className="empty-inline">Фотографий пока нет</div>)}
        {tab==='comments'&&(data.comments?.length?data.comments.map((c,i)=><article className="comment" key={i}><header><span className="avatar" aria-hidden="true">{c.author?.slice(0,1).toUpperCase()||'W'}</span><div><b>{c.author}</b>{c.date&&<time dateTime={c.date}>{dateFormat.format(new Date(c.date))}</time>}</div></header><p>{c.text}</p></article>):<div className="empty-inline">Комментариев пока нет</div>)}
      </div>
      <div className="sheet-footer"><button className={`save-place ${saved?'is-saved':''}`} aria-label={saved?'Убрать из избранного':'Сохранить'} aria-pressed={saved} onClick={()=>toggleFavorite(data.id)}><Icon name="bookmark"/><span>{saved?'Сохранено':'Сохранить'}</span></button><button className="icon-btn expand-button" title={expanded?'Свернуть':'Развернуть'} aria-label={expanded?'Свернуть':'Развернуть'} onClick={()=>setExpanded(v=>!v)}><Icon name="expand"/></button><a className="external-link" href={data.url} target="_blank" rel="noopener noreferrer">Wikimapia<Icon name="external" size={18}/></a></div>
    </>}
    <div className="sheet-attribution">Карта © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></div>
  </section>;
}
