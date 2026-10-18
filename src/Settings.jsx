import React,{useEffect,useState} from 'react';
import Icon from './Icon.jsx';
import CacheSettings from './CacheSettings.jsx';
export default function Settings({confirmForget,setConfirmForget,credentials,onCacheAction,onShowArea,cacheEpoch,currentAreaIds,cacheClearing,theme,setTheme,auto,setAuto,onApply,onForget,demo,onDemo,onReal}){
  const [editing,setEditing]=useState(false),[draft,setDraft]=useState('');
  useEffect(()=>{setEditing(false);setDraft('');setConfirmForget(false);},[credentials.key]);
  const submit=async e=>{e.preventDefault();if(await onApply(draft)){setDraft('');setEditing(false);}};
  return <div className="settings-panel screen-body">
    <section className="settings-group"><h2>Подключение к Wikimapia</h2>
      <div className="connection-card"><span className="connection-icon"><Icon name="key"/></span><div><strong>{credentials.key?(credentials.saved?'Ключ сохранён на устройстве':'Ключ действует в этой вкладке'):'Добавьте API-ключ'}</strong><p>{credentials.saved?'Будет восстановлен при следующем запуске.':credentials.key?'В браузере постоянное хранение отключено.':'Введите один раз, чтобы читать реальные объекты.'}</p></div>{credentials.saved&&<Icon name="check"/>}</div>
      {credentials.error&&<div className="error" role="alert"><p>{credentials.error}</p>{!credentials.key&&<button className="secondary" disabled={credentials.busy} onClick={onForget}>Удалить сохранённую запись</button>}</div>}
      {(!credentials.key||editing)&&<form className="credential-form" onSubmit={submit}><label htmlFor="api-key">API-ключ</label><input id="api-key" type="password" autoComplete="off" autoCapitalize="none" spellCheck="false" maxLength={4096} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Вставьте ключ Wikimapia"/><button className="primary" disabled={credentials.busy||!draft.trim()}>{credentials.busy?'Сохраняем…':'Сохранить и подключить'}</button>{editing&&<button type="button" className="text-button" onClick={()=>{setEditing(false);setDraft('');}}>Отмена</button>}</form>}
      {credentials.key&&!editing&&<div className="split-actions"><button className="secondary" disabled={credentials.busy} onClick={()=>{setConfirmForget(false);setEditing(true);}}>Заменить ключ</button><button className="danger-button" disabled={credentials.busy} onClick={()=>setConfirmForget(true)}><Icon name="trash" size={18}/>Удалить ключ</button></div>}
      {confirmForget&&<div className="confirm-delete" role="group" aria-label="Удаление API-ключа"><p>Удалить ключ с этого устройства? Для реальных данных потребуется ввести его снова. Избранное и кэш останутся.</p><div className="split-actions"><button className="secondary" autoFocus onClick={()=>setConfirmForget(false)}>Отмена</button><button className="danger-button" disabled={credentials.busy} onClick={onForget}>Удалить с устройства</button></div></div>}
      <p className="helper">{credentials.persistentSupported?'Ключ хранится зашифрованным только на этом устройстве. После удаления приложения его нужно ввести заново.':'В браузере ключ действует до закрытия страницы. Для сохранения используйте Android-приложение.'}</p>
      <a className="inline-link" href="https://wikimapia.org/api?action=create_key" target="_blank" rel="noreferrer">Получить API-ключ <Icon name="external" size={16}/></a>
    </section>
    <section className="settings-group"><h2>Карта</h2><label className="setting-row" htmlFor="auto-load"><span><strong>Автозагрузка области</strong><small>После остановки карты, с учётом лимита API</small></span><input id="auto-load" type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/></label><p className="helper">Объекты загружаются при перемещении карты. В плотных областях после первых трёх страниц появится кнопка «Догрузить область». Одно нажатие запустит последовательную загрузку с прогрессом.</p></section>
    <CacheSettings epoch={cacheEpoch} busy={cacheClearing} currentIds={currentAreaIds} demo={demo} onAction={onCacheAction} onShowArea={onShowArea}/>
    <fieldset className="settings-group theme-choice"><legend>Оформление</legend><div>{[['dark','Чёрная'],['light','Светлая'],['system','Как в системе']].map(([value,label])=><button key={value} aria-pressed={theme===value} onClick={()=>setTheme(value)}>{label}</button>)}</div></fieldset>
    <section className="settings-group"><h2>Демонстрация</h2><p className="helper">Вымышленные объекты для знакомства с карточками. Сохранённый ключ не удаляется.</p><button className="secondary" disabled={credentials.busy} onClick={demo&&credentials.key?onReal:onDemo}>{demo&&credentials.key?'Вернуться к реальным данным':'Открыть деморежим'}</button></section>
    <p className="about">WikiReader 0.7.1 · Неофициальный клиент<br/>Данные © участники Wikimapia</p>
  </div>;
}
