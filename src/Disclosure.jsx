import React,{useState} from 'react';
import Motion from './Motion.jsx';
export default function Disclosure({className='',title,children}){
 const [open,setOpen]=useState(false),[nativeOpen,setNativeOpen]=useState(false);
 return <details className={`animated-disclosure ${className}`} open={nativeOpen}><summary aria-expanded={open} onClick={e=>{e.preventDefault();if(!open)setNativeOpen(true);setOpen(v=>!v);}}>{title}</summary><Motion open={open} kind="disclosure" onExit={()=>setNativeOpen(false)}><div className="disclosure-body">{children}</div></Motion></details>;
}
