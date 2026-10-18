import {useEffect,useRef} from 'react';

// Only the handle owns vertical dragging; scrolling text/photos stays native.
export function useSheetGesture(root,{expanded,setExpanded,onClose,identity}){
 const drag=useRef(null),settling=useRef(null),skipClick=useRef(false);
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const clear=node=>{node.style.removeProperty('height');node.style.removeProperty('transform');node.style.removeProperty('transition');delete node.dataset.dragging;};
 const finish=()=>{const a=settling.current;if(a){settling.current=null;a.animation.cancel();clear(a.node);}};
 useEffect(()=>{const background=()=>{if(document.hidden){drag.current=null;finish();const node=root.current;if(node)clear(node);}};document.addEventListener('visibilitychange',background);return()=>{document.removeEventListener('visibilitychange',background);drag.current=null;finish();};},[identity]);
 const settle=(node,height)=>{
  const frames=[{height:getComputedStyle(node).height,transform:getComputedStyle(node).transform},{height:`${height}px`,transform:'none'}];
  if(reduced()||!node.animate){clear(node);return;}
  const animation=node.animate(frames,{duration:280,easing:'cubic-bezier(.2,.8,.2,1)',fill:'both'});settling.current={animation,node};
  animation.onfinish=()=>{if(settling.current?.animation!==animation)return;settling.current=null;animation.cancel();clear(node);};
 };
 const end=(event,cancelled=false)=>{
  const d=drag.current;if(!d||(!cancelled&&event.pointerId!==d.id))return;drag.current=null;
  if(event.currentTarget.hasPointerCapture?.(d.id))event.currentTarget.releasePointerCapture(d.id);
  if(!d.moved){clear(d.node);return;}
  skipClick.current=true;
  const dy=d.lastY-d.y,fast=dy>20&&d.velocity>.65&&event.timeStamp-d.time<100;
  if(!cancelled&&!d.expanded&&(dy>90||fast)){onClose();return;}
  const next=cancelled?d.expanded:dy< -40?true:dy>40||fast?false:d.expanded;
  setExpanded(next);settle(d.node,next?d.full:d.collapsed);
 };
 return {
  onPointerDown:event=>{
   if(!event.isPrimary||event.button!==0||drag.current||root.current?.closest('.motion-layer')?.dataset.phase!=='idle')return;
   const node=root.current;if(!node)return;
   // Preserve the visible state when a returning sheet is grabbed again.
   const rect=node.getBoundingClientRect(),transform=getComputedStyle(node).transform;
   const old=settling.current;if(old){settling.current=null;old.animation.cancel();}
   node.style.transition='none';node.style.removeProperty('height');node.style.removeProperty('transform');
   const was=node.classList.contains('expanded');node.classList.remove('expanded');const collapsed=node.getBoundingClientRect().height;node.classList.add('expanded');const full=node.getBoundingClientRect().height;node.classList.toggle('expanded',was);
   node.style.height=`${rect.height}px`;node.style.transform=transform;
   drag.current={node,id:event.pointerId,y:event.clientY,lastY:event.clientY,time:event.timeStamp,velocity:0,height:rect.height,offset:transform==='none'?0:new DOMMatrixReadOnly(transform).m42,collapsed,full,expanded,moved:false};
   skipClick.current=false;event.currentTarget.setPointerCapture(event.pointerId);
  },
  onPointerMove:event=>{
   const d=drag.current;if(!d||event.pointerId!==d.id)return;
   const dy=event.clientY-d.y;if(!d.moved&&Math.abs(dy)<6)return;d.moved=true;skipClick.current=true;
   const dt=event.timeStamp-d.time;if(dt>0)d.velocity=(event.clientY-d.lastY)/dt;d.lastY=event.clientY;d.time=event.timeStamp;
   d.node.dataset.dragging='true';
   const displacement=dy+d.offset;
   const height=Math.max(d.collapsed,Math.min(d.full,d.height-displacement));
   const offset=displacement>0?Math.max(0,displacement-(d.height-height)):Math.min(0,displacement+(height-d.height))*.12;
   d.node.style.height=`${height}px`;d.node.style.transform=`translateY(${offset}px)`;
  },
  onPointerUp:event=>{const d=drag.current;if(d&&!d.moved){clear(d.node);}end(event);},
  onPointerCancel:event=>end(event,true),
  onLostPointerCapture:event=>{if(drag.current)end(event,true);},
  onClick:()=>{if(skipClick.current){skipClick.current=false;return;}setExpanded(v=>!v);}
 };
}
