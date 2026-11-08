import {test,expect} from '@playwright/test';
import {screen,tiles} from './helpers.js';

async function nativeCarTiles(page){
 await page.addInitScript(()=>{
  window.CapacitorCustomPlatform={name:'android'};
  window.__mockCarTiles={configured:false,provider:'osm',key:null,nightPolicy:'auto'};
  const plugin=(name,methods)=>({
   name,methods:methods.map(method=>({name:method,rtype:method==='addListener'?'callback':'promise'}))
  });
  window.Capacitor={
   PluginHeaders:[
    plugin('CredentialsVault',['load','save','clear']),
    plugin('Appearance',['apply']),
    plugin('App',['addListener','removeListener','minimizeApp']),
    plugin('CarData',['tilesStatus','tilesSaveKey','tilesSelect','tilesSelectNightPolicy','tilesClearKey','gpsStatus','sync','areas'])
   ],
   nativePromise:async(name,method,args)=>{
    if(name==='CredentialsVault')return method==='load'?{key:null}:{};
    if(name==='CarData'){
     const state=window.__mockCarTiles;
     switch(method){
      case 'tilesStatus':return{configured:state.configured,provider:state.provider,nightPolicy:state.nightPolicy};
      case 'tilesSaveKey':state.key=args.key;state.configured=true;return{};
      case 'tilesSelect':
       if(args.provider==='yandex'&&!state.configured)throw Error('No Tiles API key');
       state.provider=args.provider;return{};
      case 'tilesSelectNightPolicy':state.nightPolicy=args.policy;return{};
      case 'tilesClearKey':state.key=null;state.configured=false;state.provider='osm';return{};
      case 'gpsStatus':return{running:false};
      case 'sync':return{favorites:[]};
      case 'areas':return{entries:[]};
      default:return{};
     }
    }
    return{};
   },
   nativeCallback:()=> 'mock-callback'
  };
 });
}

async function assertLayout(page){
 const section=page.locator('.car-tiles-settings');
 const label=section.locator('label[for="car-tiles-api-key"]');
 const input=section.locator('#car-tiles-api-key');
 const save=section.getByRole('button',{name:/Сохранить ключ/});
 await input.scrollIntoViewIfNeeded();
 const [outer,a,b,c]=await Promise.all([section.boundingBox(),label.boundingBox(),input.boundingBox(),save.boundingBox()]);
 expect(a).toBeTruthy();expect(b).toBeTruthy();expect(c).toBeTruthy();
 expect(a.y+a.height+3).toBeLessThanOrEqual(b.y);
 expect(b.y+b.height+3).toBeLessThanOrEqual(c.y);
 for(const rect of [a,b,c]){
  expect(rect.x).toBeGreaterThanOrEqual(outer.x+3);
  expect(rect.x+rect.width).toBeLessThanOrEqual(outer.x+outer.width-3);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(
  await page.evaluate(()=>window.innerWidth+1));
}

test('Android Auto key controls stay separated and responsive before and after saving',async({page})=>{
 await tiles(page);await nativeCarTiles(page);
 await page.goto('/');await screen(page,'Настройки');
 const section=page.locator('.car-tiles-settings');
 await expect(section).toBeVisible();
 await expect(section.getByText('Для Яндекса нужен отдельный ключ Tiles API')).toBeVisible();
 await expect(section.getByRole('button',{name:'Яндекс Карты'})).toBeDisabled();
 for(const width of [320,390]){
  await page.setViewportSize({width,height:760});
  await assertLayout(page);
 }
 const fakeKey='test-only-tiles-key-123456789012';
 await section.locator('#car-tiles-api-key').fill(fakeKey);
 await section.getByRole('button',{name:'Сохранить ключ'}).click();
 await expect(section.getByText(/Ключ сохранён/).first()).toBeVisible();
 await expect(section.getByRole('button',{name:'Удалить сохранённый ключ'})).toBeVisible();
 await section.getByRole('button',{name:'Яндекс Карты'}).click();
 await expect(section.getByRole('button',{name:'Яндекс Карты'})).toHaveAttribute('aria-pressed','true');
 const nightSelect=section.locator('#car-night-policy');
 await expect(nightSelect).toHaveValue('auto');
 await nightSelect.selectOption('keep_yandex');
 await expect(nightSelect).toHaveValue('keep_yandex');
 await expect(section.getByText(/Яндекс остаётся светлым/)).toBeVisible();
 await nightSelect.selectOption('auto');
 await expect(nightSelect).toHaveValue('auto');

 await expect(section.locator('#car-tiles-api-key')).toHaveValue('');
 for(const width of [320,390]){
  await page.setViewportSize({width,height:760});
  await assertLayout(page);
 }
 // Simulate Android users with enlarged accessibility text and a narrow viewport.
 await page.setViewportSize({width:320,height:700});
 await page.addStyleTag({content:'.car-tiles-settings button,.car-tiles-settings label,.car-tiles-settings summary{font-size:20px!important}'});
 await assertLayout(page);
 await section.locator('.car-tiles-help summary').click();
 await expect(section.getByText(/JavaScript API 3.0/)).toBeVisible();
 await section.getByRole('button',{name:'Удалить сохранённый ключ'}).click();
 await expect(section.getByRole('button',{name:'Яндекс Карты'})).toBeDisabled();
 await assertLayout(page);
});
