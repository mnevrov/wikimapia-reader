import React from 'react';
export default function Startup(){
 return <main className="startup" aria-busy="true"><img className="startup-symbol" src="/brand.svg" alt=""/><h1>Wiki<span>Reader</span></h1><p className="startup-caption">Места и истории Wikimapia</p><div className="startup-status" role="status"><span className="startup-indicator" aria-hidden="true"/>Открываем карту…</div><p className="startup-note">Неофициальный клиент Wikimapia</p></main>;
}
