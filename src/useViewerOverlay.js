import {useEffect,useRef} from 'react';

// Portal lives outside <main> so the application is inert while the viewer is open.
export function useViewerOverlay(close){
 const closeRef=useRef(close);closeRef.current=close;
 const closeButton=useRef(null);
 useEffect(()=>{
  const main=document.querySelector('main'),previous=document.activeElement;
  const hadInert=main?.hasAttribute('inert');
  main?.setAttribute('inert','');
  const key=event=>{
   if(event.key!=='Escape')return;
   event.preventDefault();event.stopImmediatePropagation?.();event.stopPropagation();
   closeRef.current();
  };
  const native=()=>closeRef.current();
  window.addEventListener('keydown',key,true);
  document.addEventListener('wikireader-dismiss-overlay',native);
  closeButton.current?.focus({preventScroll:true});
  return()=>{
   window.removeEventListener('keydown',key,true);
   document.removeEventListener('wikireader-dismiss-overlay',native);
   if(!hadInert)main?.removeAttribute('inert');
   if(previous?.isConnected)previous.focus({preventScroll:true});
  };
 },[]);
 return closeButton;
}
