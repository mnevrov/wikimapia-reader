export function areaMessage(state){
 if(state.error)return state.error;
 if(state.loading)return state.background?'':'Загружаем объекты…';
 if(state.page&&!state.places?.length&&!state.displayPlaces?.length)return 'Здесь пока нет объектов Wikimapia';
 return '';
}
