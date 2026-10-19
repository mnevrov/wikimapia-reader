import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import Icon from './Icon.jsx';
import {nextPhotoIndex,hapticTap} from './readerModel.js';
import {useViewerOverlay} from './useViewerOverlay.js';

export default function GalleryOverlay({photos,initialIndex=0,title,onClose}){
 const closeButton=useViewerOverlay(onClose);
 const [index,setIndex]=useState(Math.max(0,Math.min(initialIndex,photos.length-1)));
 const [zoom,setZoom]=useState(1),[offset,setOffset]=useState({x:0,y:0});
 const pointers=useRef(new Map()),gesture=useRef(null);
 const show=delta=>{
  if(photos.length<2)return;
  setIndex(i=>nextPhotoIndex(i,photos.length,delta));
  setZoom(1);setOffset({x:0,y:0});pointers.current.clear();gesture.current=null;hapticTap();
 };
 const showRef=useRef(show);showRef.current=show;
 useEffect(()=>{
  const keyboard=e=>{
   if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
   e.preventDefault();e.stopPropagation();showRef.current(e.key==='ArrowRight'?1:-1);
  };
  window.addEventListener('keydown',keyboard,true);
  return()=>window.removeEventListener('keydown',keyboard,true);
 },[]);
 const clear=()=>{setZoom(1);setOffset({x:0,y:0});pointers.current.clear();gesture.current=null;};
 const pointerDown=e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  e.currentTarget.setPointerCapture(e.pointerId);
  pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.current.size===1)gesture.current={x:e.clientX,y:e.clientY,offset,zoom};
  if(pointers.current.size===2){
   const [a,b]=[...pointers.current.values()];
   gesture.current={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom,offset};
  }
 };
 const pointerMove=e=>{
  if(!pointers.current.has(e.pointerId))return;
  pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const points=[...pointers.current.values()],g=gesture.current;
  if(!g)return;
  if(points.length===2&&g.distance){
   const distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
   setZoom(Math.max(1,Math.min(4,g.zoom*distance/Math.max(g.distance,1))));
  }else if(points.length===1&&zoom>1){
   setOffset({x:Math.max(-240,Math.min(240,g.offset.x+points[0].x-g.x)),y:Math.max(-320,Math.min(320,g.offset.y+points[0].y-g.y))});
  }
 };
 const pointerUp=e=>{
  if(!pointers.current.has(e.pointerId))return;
  const g=gesture.current;
  if(pointers.current.size===1&&zoom===1&&g?.x!=null){
   const dx=e.clientX-g.x,dy=e.clientY-g.y;
   if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.4)show(dx<0?1:-1);
  }
  pointers.current.delete(e.pointerId);
  if(!pointers.current.size)gesture.current=null;
 };
 const toggleZoom=()=>{if(zoom>1)clear();else{setZoom(2);setOffset({x:0,y:0});}hapticTap();};
 const photo=photos[index];
 return createPortal(<div data-viewer-overlay="gallery" className="viewer-overlay gallery-view" role="dialog" aria-modal="true" aria-label="Просмотр фотографий">
  <header className="viewer-topbar gallery-topbar">
   <button ref={closeButton} className="icon-btn" aria-label="Закрыть галерею" onClick={onClose}><Icon name="close"/></button>
   <span aria-live="polite">{index+1} из {photos.length}</span>
   <button className="icon-btn gallery-zoom-button" aria-label={zoom>1?'Сбросить масштаб':'Увеличить фото'} onClick={toggleZoom}>{zoom>1?'1×':'2×'}</button>
  </header>
  <div className="gallery-stage" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={e=>{pointers.current.delete(e.pointerId);gesture.current=null;}} onDoubleClick={toggleZoom}>
   <img src={photo?.src} alt={`Фото ${index+1}: ${title}`} draggable="false" style={{transform:`translate(${offset.x}px,${offset.y}px) scale(${zoom})`}}/>
  </div>
  {photos.length>1&&<nav className="gallery-nav" aria-label="Переключение фотографий">
   <button aria-label="Предыдущее фото" onClick={()=>show(-1)}><Icon name="back" size={22}/></button>
   <button aria-label="Следующее фото" onClick={()=>show(1)}><Icon name="arrow" size={22}/></button>
  </nav>}
  <footer className="gallery-caption"><span>{photo?.author||'Фото объекта Wikimapia'}</span><a href={photo?.src} target="_blank" rel="noopener noreferrer">Открыть оригинал <Icon name="external" size={16}/></a></footer>
 </div>,document.body);
}
