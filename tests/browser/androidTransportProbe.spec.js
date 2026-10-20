import {test,expect} from '@playwright/test';
import {nativeVault,screen,tiles} from './helpers.js';

test('explicit Android transport diagnostics make only two spaced requests and never copy secrets',async({page})=>{
  await tiles(page);
  await nativeVault(page,{key:'test-transport-private-key',calls:[]});
  await page.addInitScript(()=>{
    localStorage.setItem('wikimapia-reader-auto','false');
    window.__copiedTransportReport='';
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedTransportReport=text;}}});
  });
  const calls=[];
  const polygon=[{x:37.617,y:55.751},{x:37.619,y:55.751},{x:37.619,y:55.753}];
  await page.route('https://api.wikimapia.org/**',r=>{
    calls.push({time:Date.now(),url:r.request().url()});
    return r.fulfill({json:{folder:[{id:77,title:'Test',polygon}],found:1}});
  });
  await page.goto('/');
  await screen(page,'Настройки');
  const panel=page.getByLabel('Проверка сетевого подключения Android');
  const run=panel.getByRole('button',{name:'Проверить два HTTP-транспорта'});
  await expect(run).toBeVisible();
  await expect(panel).not.toContainText('test-transport-private-key');
  await run.click();
  await expect(panel.getByText('Android HTTP:',{exact:false})).toBeVisible({timeout:25000});
  await expect(panel.getByText('WebView:',{exact:false})).toBeVisible({timeout:25000});
  expect(calls).toHaveLength(2);
  expect(calls[1].time-calls[0].time).toBeGreaterThanOrEqual(5700);
  for(const call of calls) {
    const url=new URL(call.url);
    expect(url.searchParams.get('function')).toBe('box');
    expect(url.searchParams.get('count')).toBe('5');
    expect(url.searchParams.get('bbox')).toBe('37.616,55.751,37.625,55.756');
  }
  await panel.getByRole('button',{name:'Скопировать результат проверки'}).click();
  const copied=await page.evaluate(()=>window.__copiedTransportReport);
  const report=JSON.parse(copied);
  expect(report.results.map(x=>x.outcome)).toEqual(['ok','ok']);
  expect(report.requestCount).toBe(2);
  expect(copied).not.toContain('test-transport-private-key');
  expect(copied).not.toContain('37.616');
  expect(copied).not.toContain('api.wikimapia.org');
  await expect(panel).not.toContainText('test-transport-private-key');
});
