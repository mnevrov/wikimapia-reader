import {Capacitor,registerPlugin} from '@capacitor/core';
const bridge=registerPlugin('WikiReaderTransfer');
export async function saveLibraryText(text){
  if(!Capacitor.isNativePlatform())return false;
  await bridge.save({content:text,name:'wikireader-library-'+new Date().toISOString().slice(0,10)+'.json'});
  return true;
}
export async function pickLibraryText(){
  if(!Capacitor.isNativePlatform())return null;
  const result=await bridge.open();
  return result.content;
}
export async function nativeShareUrl(url){
  if(!Capacitor.isNativePlatform())return false;
  await bridge.share({url});
  return true;
}
export function isNativeTransfer(){return Capacitor.isNativePlatform();}
