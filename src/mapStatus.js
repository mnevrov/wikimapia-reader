export function areaMessage(state){
 if(state.error)return state.error;
 if(state.batchLimited)return 'Большая область: загружено ещё 20 страниц. Можно продолжить догрузку.';
 if(state.loading)return state.background?'':'Загружаем объекты…';
 if(state.page&&!state.places?.length&&!state.displayPlaces?.length)return 'Здесь пока нет объектов Wikimapia';
 return '';
}

export function areaCacheLabel(state, now = Date.now()) {
 if (!state || (!state.page && !state.displayPlaces?.length)) return '';
 const partial = state.more || state.complete === false || (state.found != null && (state.places?.length ?? 0) < state.found);
 const fresh = Number.isFinite(state.cacheUpdatedAt) && state.cacheUpdatedAt <= now && now - state.cacheUpdatedAt < 300000;
 const source = state.cacheUpdatedAt != null ? (fresh ? 'Кэш · свежие данные' : 'Кэш · данные могут устареть') : 'Данные области';
 return partial ? source + ' · загружено не полностью' : source;
}
