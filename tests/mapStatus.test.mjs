import test from 'node:test';
import assert from 'node:assert/strict';
import {areaMessage, areaCacheLabel, isMapErrorNotice, pickMapFeedback} from '../src/mapStatus.js';
test('only cold load speaks; background loading is silent',()=>{
 assert.equal(areaMessage({loading:true,background:false}),'Загружаем объекты…');
 assert.equal(areaMessage({loading:true,background:true,displayPlaces:[{}]}),'');
});
test('cancelled first request clears the old message and errors remain visible',()=>{
 assert.equal(areaMessage({loading:false,page:0,places:[]}), '');
 assert.equal(areaMessage({loading:false,error:'Ошибка'}),'Ошибка');
 assert.equal(areaMessage({loading:false,page:1,places:[],displayPlaces:[]}), 'Здесь пока нет объектов Wikimapia');
});
test('continuation budget is explained and errors take priority',()=>{
 assert.match(areaMessage({batchLimited:true}),/20 страниц/);
 assert.equal(areaMessage({batchLimited:true,error:'Ошибка'}),'Ошибка');
});

test('fresh, expired and incomplete cache are labeled without coordinates',()=>{
 const at=1000000;
 assert.equal(areaCacheLabel({page:1,places:[{}],found:1,more:false,complete:true,cacheUpdatedAt:at},at+1000),'Кэш · свежие данные');
 assert.match(areaCacheLabel({page:1,places:[{}],found:10,more:true,cacheUpdatedAt:at},at+300001),/могут устареть.*не полностью/);
 assert.equal(areaCacheLabel({page:0,displayPlaces:[]},at),'');
});

test('fresh network data is not presented as cache',()=>{
 assert.equal(areaCacheLabel({page:1,places:[{}],found:1,complete:true,dataSource:'network',cacheUpdatedAt:1000},1001),'Данные с сервера');
 assert.match(areaCacheLabel({page:0,displayPlaces:[{}],complete:false,dataSource:'cache',cacheUpdatedAt:1000},400000),/могут устареть.*не полностью/);
});

test('geo, quota and transport failures are top banners while loading stays below',()=>{
 for(const message of [
  'Местоположение недоступно. Проверьте разрешение и геопозицию.',
  'Местоположение недоступно · разрешите геолокацию.',
  'Низкая точность GPS · ожидаем сигнал',
  'Сервер не ответил вовремя. Повторите запрос позже.',
  'Не удалось получить данные из Wikimapia API.',
  'Исчерпан лимит API-запросов.',
  'Ключ API отклонён.'
 ]) assert.equal(isMapErrorNotice(message),true,message);
 for(const message of [
  '',null,'Загружаем объекты…','Местоположение определено',
  'Здесь пока нет объектов Wikimapia','Приблизьте карту для загрузки объектов',
  'Большая область: загружено ещё 20 страниц.'
 ]) assert.equal(isMapErrorNotice(message),false,String(message));
});

test('area loading failure outranks a paused GPS Follow hint and older notices',()=>{
  const message='Не удалось загрузить данные. Проверьте подключение.';
  assert.deepEqual(pickMapFeedback({areaError:message,notice:'Загружаем объекты…',gpsFollow:'paused'}),{
    message,source:'area',isError:true
  });
  assert.deepEqual(pickMapFeedback({areaError:message,gpsError:'Низкая точность GPS · ожидаем сигнал',gpsFollow:'paused'}),{
    message,source:'area',isError:true
  });
});
test('network failure takes priority over the paused follow hint even without area.error',()=>{
  const message='Не удалось загрузить данные. Попробуйте позже.';
  assert.deepEqual(pickMapFeedback({notice:message,gpsFollow:'paused'}),{
    message,source:'map',isError:true
  });
});
test('paused Follow is only a fallback; ordinary map progress also outranks it',()=>{
  assert.deepEqual(pickMapFeedback({notice:'Загружаем объекты…',gpsFollow:'paused'}),{
    message:'Загружаем объекты…',source:'map',isError:false
  });
  assert.match(pickMapFeedback({gpsFollow:'paused'}).message,/GPS Follow приостановлен/);
  assert.equal(pickMapFeedback({}),null);
});
