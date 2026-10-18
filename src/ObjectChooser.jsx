import React,{useEffect,useRef} from 'react';
import Icon from './Icon.jsx';
export default function ObjectChooser({places,onPick,onClose}){
 const root=useRef(null);
 useEffect(()=>{if(places.length)root.current?.querySelector('button')?.focus({preventScroll:true});},[places]);
 if(!places.length)return null;
 return <section ref={root} className="object-chooser" role="dialog" aria-label="Объекты в этой точке"><header><div><p>На карте</p><h2>Выберите объект</h2></div><button className="icon-btn" aria-label="Закрыть выбор объектов" onClick={onClose}><Icon name="close"/></button></header><ul className="object-options">{places.map(place=><li key={place.id}><button onClick={()=>onPick(place)}><span>{place.title}</span><Icon name="arrow" size={18}/></button></li>)}</ul><p className="chooser-hint">Сначала небольшие объекты, затем территории вокруг них.</p></section>;
}
