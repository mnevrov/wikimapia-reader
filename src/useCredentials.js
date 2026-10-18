import {useEffect,useRef,useState} from 'react';
import {Capacitor,registerPlugin} from '@capacitor/core';
import {createCredentialStore} from './credentials.js';
const vault=Capacitor.isNativePlatform()?registerPlugin('CredentialsVault'):null;
const store=createCredentialStore(vault);
export function useCredentials(){
  const [state,setState]=useState({key:'',saved:false,ready:false,busy:false,error:''});
  const locked=useRef(false);
  useEffect(()=>{
    let alive=true;
    store.load().then(key=>{if(alive)setState({key:key||'',saved:!!key,ready:true,busy:false,error:''});})
      .catch(()=>{if(alive)setState({key:'',saved:false,ready:true,busy:false,error:'Не удалось восстановить ключ. Введите его заново или удалите сохранённую запись.'});});
    return()=>{alive=false;};
  },[]);
  async function change(action,value){
    if(locked.current||!state.ready)return false;locked.current=true;setState(s=>({...s,busy:true,error:''}));
    try{
      if(action==='clear'){await store.clear();setState({key:'',saved:false,ready:true,busy:false,error:''});}
      else{const saved=await store.save(value);setState({key:value.trim(),saved,ready:true,busy:false,error:''});}
      return true;
    }catch{setState(s=>({...s,busy:false,error:action==='clear'?'Не удалось удалить ключ. Повторите действие.':'Ключ не сохранён. Попробуйте ещё раз.'}));return false;}
    finally{locked.current=false;}
  }
  return {...state,persistentSupported:!!vault,apply:value=>change('save',value),forget:()=>change('clear')};
}
