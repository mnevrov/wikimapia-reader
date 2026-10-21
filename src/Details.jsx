import React,{useEffect,useRef,useState} from 'react';
import Icon from './Icon.jsx';
import {useSheetGesture} from './useSheetGesture.js';
import ReadingOverlay from './ReadingOverlay.jsx';
import GalleryOverlay from './GalleryOverlay.jsx';
import {hapticTap} from './readerModel.js';
const dateFormat=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'});
export default function Details({data,busy,error,onClose,onRetry,favorites,toggleFavorite,returnLabel,onReturn,basemap='osm',offlineInfo,offlineBusy=false,offlineAvailable=false,onSaveOffline,onRemoveOffline,onShowOnMap,onShare,shareAvailable=true}){
  const [tab,setTab]=useState('description'),[expanded,setExpanded]=useState(false),[menuOpen,setMenuOpen]=useState(false);
  const [reading,setReading]=useState(false),[galleryIndex,setGalleryIndex]=useState(null),[touchStart,setTouchStart]=useState(null);
  const scroll=useRef(null),root=useRef(null),menu=useRef(null),menuButton=useRef(null);
  const closeMenu=()=>{setMenuOpen(false);menuButton.current?.focus({preventScroll:true});};
  useEffect(()=>{
    if(!menuOpen)return;
    const close=closeMenu;
    const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}};
    const outside=e=>{if(!menu.current?.contains(e.target)&&!menuButton.current?.contains(e.target))setMenuOpen(false);};
    window.addEventListener('keydown',key,true);document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);document.addEventListener('wikireader-dismiss-menu',close);
    menu.current?.querySelector('button,a')?.focus({preventScroll:true});
    return()=>{window.removeEventListener('keydown',key,true);document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);document.removeEventListener('wikireader-dismiss-menu',close);};
  },[menuOpen]);
  const gesture=useSheetGesture(root,{expanded,setExpanded,onClose,identity:data?.id});
  useEffect(()=>{setMenuOpen(false);setTab('description');setExpanded(!!returnLabel);setReading(false);setGalleryIndex(null);},[data?.id]);
  useEffect(()=>{scroll.current?.scrollTo(0,0);},[data?.id,tab]);
  const tabs=['description','photos','comments'];
  const selectTab=id=>{setTab(id);if(id!=='description')setExpanded(true);hapticTap();};
  const onSwipeEnd=e=>{
    if(!touchStart||!e.changedTouches?.length)return;
    const deltaX=e.changedTouches[0].clientX-touchStart.x,deltaY=e.changedTouches[0].clientY-touchStart.y;
    setTouchStart(null);
    if(Math.abs(deltaX)>100&&Math.abs(deltaX)>Math.abs(deltaY)*1.7){
      selectTab(tabs[(tabs.indexOf(tab)+(deltaX<0?1:tabs.length-1))%tabs.length]);
    }
  };
  if(!data&&!busy&&!error)return null;
  const saved=favorites.includes(data?.id);
  const hasOffline=!!offlineInfo&&offlineInfo.status!=='error';
  return <section ref={root} className={`sheet ${expanded?'expanded':''}`} aria-label="Информация об объекте">
    <button className="handle" aria-label={expanded?'Свернуть карточку':'Развернуть карточку'} {...gesture}><span/></button>
    {returnLabel&&<button className="return-to-list" onClick={onReturn}><Icon name="back" size={18}/>{returnLabel}</button>}
    <div className="sheet-header"><div><h2 title={data?.title}>{data?.title||'Загрузка объекта…'}</h2></div><div className="sheet-controls">
      {!busy&&!error&&<><button className={`icon-btn save-place ${saved?'is-saved':''}`} aria-label={saved?'Убрать из избранного':'Сохранить'} aria-pressed={saved} onClick={()=>toggleFavorite(data.id)}><Icon name="bookmark"/></button>
      <button ref={menuButton} className="icon-btn" aria-label="Действия с объектом" aria-expanded={menuOpen} aria-controls="object-actions" onClick={()=>setMenuOpen(v=>!v)}><Icon name="more"/></button></>}
      <button className="icon-btn" title="Закрыть" aria-label="Закрыть карточку" onClick={onClose}><Icon name="close"/></button>
    </div></div>
    {busy?<div className="sheet-scroll loading-state"><span className="spinner"/><p>Получаем описание, фото и комментарии…</p></div>:error?<div className="sheet-scroll"><div className="error" role="alert"><p>{error}</p><button className="secondary" onClick={onRetry}>Повторить</button></div></div>:<>
      {data.warnings?.length>0&&<p className="offline-card-status" role="status">{data.warnings.join(' ')}</p>}
      <div className="tabs" role="tablist" aria-label="Разделы объекта">{[['description','Описание',null],['photos','Фото',data.photos?.length||0],['comments','Комментарии',data.comments?.length||0]].map(([id,label,count])=><button key={id} role="tab" aria-selected={tab===id} aria-controls="object-content" id={`tab-${id}`} tabIndex={tab===id?0:-1} onKeyDown={e=>{let next;if(e.key==='ArrowRight')next=tabs[(tabs.indexOf(id)+1)%3];if(e.key==='ArrowLeft')next=tabs[(tabs.indexOf(id)+2)%3];if(e.key==='Home')next=tabs[0];if(e.key==='End')next=tabs[2];if(next){e.preventDefault();selectTab(next);document.getElementById(`tab-${next}`)?.focus();}}} onClick={()=>selectTab(id)}>{label}{count!==null&&<span>{count}</span>}</button>)}</div>
      <div key={tab} className="sheet-scroll" id="object-content" role="tabpanel" aria-labelledby={`tab-${tab}`} ref={scroll} onTouchStart={e=>setTouchStart({x:e.touches[0].clientX,y:e.touches[0].clientY})} onTouchEnd={onSwipeEnd} onTouchCancel={()=>setTouchStart(null)}>
        {tab==='description'&&<><p className="description">{data.description||(data.blocks?.description==='unavailable'?'Описание временно недоступно.':'Описание этого объекта пока не добавлено.')}</p>{data.description&&<div className="reading-actions"><button className="text-button" aria-label="Открыть режим чтения" onClick={()=>{setReading(true);hapticTap();}}><Icon name="expand" size={17}/> Читать полностью</button></div>}</>}
        {tab==='photos'&&(data.photos?.length?<div className="photos">{data.photos.map((p,i)=><figure key={`${p.src}-${i}`}><button className="photo-open" aria-label={`Открыть фото ${i+1}`} onClick={()=>{setGalleryIndex(i);hapticTap();}}><img src={p.src} alt={`Фото ${i+1}: ${data.title}`} loading="lazy"/></button>{p.author&&<figcaption>{p.author}</figcaption>}</figure>)}</div>:<div className="empty-inline">{data.blocks?.photos==='unavailable'?'Фотографии временно недоступны':'Фотографий пока нет'}</div>)}
        {tab==='comments'&&(data.comments?.length?data.comments.map((c,i)=><article className="comment" key={i}><header><span className="avatar" aria-hidden="true">{c.author?.slice(0,1).toUpperCase()||'W'}</span><div><b>{c.author}</b><time dateTime={c.date&&Number.isFinite(Date.parse(c.date))?c.date:undefined}>{c.date&&Number.isFinite(Date.parse(c.date))?dateFormat.format(new Date(c.date)):c.dateLabel||'Дата не указана'}</time></div></header><p>{c.text}</p></article>):<div className="empty-inline">{data.blocks?.comments==='unavailable'?'Комментарии временно недоступны':'Комментариев пока нет'}</div>)}
      </div>
      {menuOpen&&<div ref={menu} id="object-actions" className="object-actions" role="group" aria-label="Действия с объектом" data-card-menu>
        <p className="eyebrow">Объект #{data.id}</p>
        <button onClick={onShowOnMap}><Icon name="map" size={19}/>На карте</button>
        {shareAvailable&&<button onClick={()=>{closeMenu();onShare?.();}}><Icon name="external" size={19}/>Поделиться</button>}
        {onSaveOffline&&<button className={'offline-card-action '+(hasOffline?'is-saved':'')} disabled={offlineBusy||(!offlineAvailable&&!hasOffline)} aria-label={offlineBusy?'Сохранение для офлайн-чтения':hasOffline?'Удалить офлайн-копию':offlineInfo?.status==='error'?'Повторить сохранение для офлайн-чтения':'Сохранить для чтения без сети'} title={hasOffline?'Офлайн: '+(offlineInfo.status==='partial'?'частично':offlineInfo.status==='stale'?'устарело':'сохранено'):offlineInfo?.status==='error'?'Ошибка сохранения: повторить':'Сохранить описание и фото без сети'} onClick={hasOffline?onRemoveOffline:onSaveOffline} aria-busy={offlineBusy} aria-pressed={hasOffline}><Icon name={hasOffline?'check':'download'} size={19}/><span>{offlineBusy?'Сохранение…':hasOffline?'Удалить офлайн-копию':'Сохранить для чтения без сети'}</span></button>}
        <button title={expanded?'Свернуть':'Развернуть'} onClick={()=>{setExpanded(v=>!v);closeMenu();}}><Icon name="expand" size={19}/>{expanded?'Свернуть карточку':'Развернуть карточку'}</button>
        <a href={data.url} target="_blank" rel="noopener noreferrer"><Icon name="external" size={19}/>Открыть в Wikimapia</a>
      </div>}

    </>}
    {offlineInfo&&<p className="offline-card-status" role="status">Офлайн: {offlineInfo.status==='partial'?'сохранено частично':offlineInfo.status==='stale'?'нужно обновить':offlineInfo.status==='error'?'ошибка':'доступно без сети'}{offlineInfo.missing>0?' · недоступно фотографий: '+offlineInfo.missing:''}</p>}
    <div className="sheet-attribution"><a href={data?.url||'https://wikimapia.org/'} target="_blank" rel="noopener noreferrer">Wikimapia</a> · {basemap==='yandex'?<>Подложка © <a href="https://yandex.ru/maps/" target="_blank" rel="noopener noreferrer">Яндекс Карты</a></>:<>Карта © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></>}</div>
    {reading&&<ReadingOverlay title={data?.title} description={data?.description} onClose={()=>setReading(false)}/>}
    {galleryIndex!==null&&data?.photos?.length>0&&<GalleryOverlay title={data.title} photos={data.photos} initialIndex={galleryIndex} onClose={()=>setGalleryIndex(null)}/>}
  </section>;
}
