import React,{useState} from 'react';
import {createPortal} from 'react-dom';
import Icon from './Icon.jsx';
import {FONT_SIZES,READER_SIZE_KEY,validReaderSize,splitParagraphs,hapticTap} from './readerModel.js';
import {useViewerOverlay} from './useViewerOverlay.js';

export default function ReadingOverlay({title,description,onClose}){
 const closeButton=useViewerOverlay(onClose);
 const [size,setSize]=useState(()=>{
  try{return validReaderSize(localStorage.getItem(READER_SIZE_KEY));}catch{return 18;}
 });
 const paragraphs=splitParagraphs(description);
 const update=delta=>{
  const i=FONT_SIZES.indexOf(size),next=FONT_SIZES[Math.max(0,Math.min(FONT_SIZES.length-1,i+delta))];
  setSize(next);try{localStorage.setItem(READER_SIZE_KEY,String(next));}catch{}
  hapticTap();
 };
 return createPortal(<div data-viewer-overlay="reader" className="viewer-overlay reader-view" role="dialog" aria-modal="true" aria-label="Режим чтения">
  <header className="viewer-topbar">
   <button ref={closeButton} className="icon-btn" aria-label="Закрыть режим чтения" onClick={onClose}><Icon name="back"/></button>
   <strong>Режим чтения</strong>
   <div className="reader-font-tools" role="group" aria-label="Размер текста">
    <button className="icon-btn" aria-label="Уменьшить текст" disabled={size===FONT_SIZES[0]} onClick={()=>update(-1)}>A−</button>
    <button className="icon-btn" aria-label="Увеличить текст" disabled={size===FONT_SIZES.at(-1)} onClick={()=>update(1)}>A+</button>
   </div>
  </header>
  <article className="reader-scroll">
   <p className="reader-kicker">Wikimapia · описание объекта</p>
   <h1>{title}</h1>
   <div className="reader-text" style={{fontSize:size+'px'}}>
    {paragraphs.length?paragraphs.map((p,i)=><p key={i}>{p}</p>):<p>Описание этого объекта пока не добавлено.</p>}
   </div>
  </article>
 </div>,document.body);
}
