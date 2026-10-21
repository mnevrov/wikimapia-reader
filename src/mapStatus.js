export function areaMessage(state){
 if(state.error)return state.error;
 if(state.batchLimited)return 'Большая область: загружено ещё 20 страниц. Можно продолжить догрузку.';
 if(state.loading)return state.background?'':'Загружаем объекты…';
 if(state.page&&state.complete===false&&!state.more)return 'Контуры загружены частично · сайт не подтвердил полное покрытие';
 if(state.page&&!state.places?.length&&!state.displayPlaces?.length)return 'Здесь пока нет объектов Wikimapia';
 return '';
}

export function areaCacheLabel(state, now = Date.now()) {
 if (!state || (!state.page && !state.displayPlaces?.length)) return '';
 const partial = state.more || state.complete === false || (state.found != null && (state.places?.length ?? 0) < state.found);
 const cached = state.dataSource === 'cache' || (state.dataSource == null && state.cacheUpdatedAt != null);
 const fresh = Number.isFinite(state.cacheUpdatedAt) && state.cacheUpdatedAt <= now && now - state.cacheUpdatedAt < 300000;
 const source = cached ? (fresh ? 'Кэш · свежие данные' : 'Кэш · данные могут устареть') : state.source==='site'?'Сайт Wikimapia':state.source==='hybrid'?'Сайт Wikimapia и API':'Данные с сервера';
 return partial ? source + ' · загружено не полностью' : source;
}

/** Only warnings/failures move above the map. Progress and guidance stay below.
 * This function receives already-sanitized UI text, never raw API responses. */
export function isMapErrorNotice(message) {
 if (typeof message!=='string') return false;
 return /недоступ|не удалось|не ответил|ошибк|тайм.?аут|лимит|квот|отклон|нет подключен|низкая точность|истекло время|превышен|повторите позже/i.test(message);
}
