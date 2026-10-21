import {useEffect,useRef,useState} from 'react';
import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';

export function usePlatform(onBack) {
  const handler=useRef(onBack);handler.current=onBack;
  const [active,setActive]=useState(!document.hidden);
  useEffect(()=>{
    let disposed=false;const subscriptions=[];
    const add=async(name,callback)=>{
      const sub=await App.addListener(name,callback);
      if(disposed)await sub.remove();else subscriptions.push(sub);
    };
    const visibility=()=>setActive(!document.hidden);
    const back=()=>{
      // Full-screen reader/gallery owns Back before the underlying card.
      if(document.querySelector('[data-viewer-overlay]')){
        document.dispatchEvent(new Event('wikireader-dismiss-overlay'));
        return true;
      }
      if(document.querySelector('[data-card-menu]')){document.dispatchEvent(new Event('wikireader-dismiss-menu'));return true;}
      return handler.current();
    };
    const escape=e=>{if(e.key==='Escape')back();};
    document.addEventListener('visibilitychange',visibility);
    document.addEventListener('keydown',escape);
    if(Capacitor.isNativePlatform()){
      add('appStateChange',({isActive})=>setActive(isActive));
      add('backButton',()=>{if(!back())App.minimizeApp();});
    }
    return()=>{disposed=true;for(const s of subscriptions)s.remove();document.removeEventListener('visibilitychange',visibility);document.removeEventListener('keydown',escape);};
  },[]);
  return active;
}
