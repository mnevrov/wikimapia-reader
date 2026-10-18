import {expect} from '@playwright/test';
export async function map(page){await page.getByRole('navigation').getByRole('button',{name:'Карта',exact:true}).click();}
export async function screen(page,name){await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();}
export async function connect(page,key='local-test'){
 await screen(page,'Настройки');await page.locator('#api-key').fill(key);await page.getByRole('button',{name:'Сохранить и подключить'}).click();await expect(page.locator('.app-screen')).toHaveCount(0);
}
export async function openId(page,id=55){await screen(page,'Поиск');await page.locator('.id-disclosure summary').click();await page.locator('#place-id').fill(String(id));await page.getByRole('button',{name:'Открыть по ID',exact:true}).click();}
export async function tiles(page){await page.route('https://tile.openstreetmap.org/**',r=>r.abort());await page.route('https://photos.wikimapia.org/**',r=>r.abort());}
export async function nativeVault(page,state){
 await page.exposeFunction('__nativeVault',async(method,args)=>{
  state.calls.push(method);
  if(method==='load'&&state.beforeLoad)await state.beforeLoad();
  if(state.fail===method)throw Error('mock vault unavailable');
  if(method==='load')return{key:state.key};
  if(method==='save'){state.key=args.key;return{};}
  if(method==='clear'){state.key=null;return{};}
 });
 await page.addInitScript(()=>{
  window.CapacitorCustomPlatform={name:'android'};
  const header=(name,names)=>({name,methods:names.map(n=>({name:n,rtype:n==='addListener'?'callback':'promise'}))});
  window.Capacitor={PluginHeaders:[header('CredentialsVault',['load','save','clear']),header('Appearance',['apply']),header('App',['addListener','removeListener','minimizeApp']),header('CapacitorHttp',['get'])],
   nativePromise:async(plugin,method,args)=>{
    if(plugin==='CredentialsVault')return window.__nativeVault(method,args);
    if(plugin==='CapacitorHttp'){const r=await fetch(args.url);return{status:r.status,data:await r.json()};}
    return{};
   },nativeCallback:()=> 'mock-callback'};
 });
}
export async function clickContour(page){
 const p=page.locator('path.leaflet-interactive').first();await expect(p).toBeVisible();const box=await p.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
 if(await page.locator('.object-chooser').isVisible())await page.locator('.object-options button').first().click();
}
