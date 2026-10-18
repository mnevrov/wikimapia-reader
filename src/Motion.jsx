import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';

function useReducedMotion(){
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReduced(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 return reduced;
}
// Keep an exit snapshot only for the visual transition. Actions and accessibility
// follow open immediately; interruption cancels the previous completion callback.
export default function Motion({open,identity='',kind='sheet',children,onExit}){
 const [present,setPresent]=useState(open),[phase,setPhase]=useState('idle');
 const root=useRef(null),snapshot=useRef(null),lastIdentity=useRef(identity),interrupted=useRef(null),exit=useRef(onExit);
 const reduced=useReducedMotion(),rendered=open||present;exit.current=onExit;
 if(open){snapshot.current=children;lastIdentity.current=identity;}
 const visualIdentity=open?identity:lastIdentity.current;
 useLayoutEffect(()=>{
  const target=root.current?.firstElementChild;if(!target)return;
  let alive=true,completed=false,animation;
  const finish=()=>{if(!alive||completed)return;completed=true;if(open)animation?.cancel();document.removeEventListener('visibilitychange',visibility);setPhase('idle');setPresent(open);if(!open){snapshot.current=null;exit.current?.();}};
  const visibility=()=>{if(document.hidden)finish();};
  setPresent(true);
  if(reduced||document.hidden||typeof target.animate!=='function'){finish();return;}
  const style=getComputedStyle(target),dragged=kind==='sheet'&&target.dataset.dragging==='true',base=dragged?'':style.transform==='none'?'':style.transform;
  const prior=interrupted.current?.node===target&&interrupted.current.identity===visualIdentity?interrupted.current:null;
  interrupted.current=null;
  const offset=dragged?'translateY(calc(100% + 48px))':kind==='screen'?'translateX(18px)':kind==='sheet'&&matchMedia('(min-width:700px)').matches?'translateX(28px)':kind==='sheet'?'translateY(100%)':kind==='chooser'?'translateY(28px)':'translateY(12px)';
  const shifted=`${base} ${offset}`.trim(),rest=base||'none';
  const frames=kind==='disclosure'?
   [{height:prior?.height??(open?'0px':style.height),opacity:prior?.opacity??(open?0:1)},{height:open?`${target.scrollHeight}px`:'0px',opacity:open?1:0}]:
   [{transform:prior?.transform??(dragged?style.transform:open?shifted:rest),opacity:prior?.opacity??(open?0:1)},{transform:open?rest:shifted,opacity:open?1:0}];
  setPhase(open?'enter':'exit');
  try{animation=target.animate(frames,{duration:kind==='disclosure'?180:kind==='sheet'?280:open?240:180,easing:'cubic-bezier(.2,.8,.2,1)',fill:'both'});animation.onfinish=finish;document.addEventListener('visibilitychange',visibility);}catch{finish();}
  return()=>{alive=false;document.removeEventListener('visibilitychange',visibility);if(animation?.playState==='running'&&target.isConnected){const current=getComputedStyle(target);interrupted.current={node:target,identity:visualIdentity,transform:current.transform,opacity:current.opacity,height:current.height};}animation?.cancel();};
 },[open,visualIdentity,kind,reduced,rendered]);
 if(!rendered)return null;
 return <div ref={root} className="motion-layer" data-motion={kind} data-phase={phase} inert={!open} aria-hidden={!open||undefined}>{kind==='disclosure'?<div className="motion-size">{open?children:snapshot.current}</div>:open?children:snapshot.current}</div>;
}
