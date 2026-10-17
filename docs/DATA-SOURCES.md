# Источники данных и исследование открытых клиентов

Проверено 18.10.2026 по Москве. Это результаты чтения документации/исходников,
а не обещание доступности всех методов.

## Официальный путь

[Документация Wikimapia](https://wikimapia.org/api) описывает `place.getbyarea`
для ID, названий и полигонов области и `place.getbyid` для подробностей.
Ключ передаётся параметром `key`; документированный пример — `example`.
Свой ключ управляется через [личный кабинет](https://wikimapia.org/api?action=my_keys).

Живые HTTPS-запросы: деталь №55 подтверждена. `place.getbyarea` в Москве и Париже
вернул только `[]`; отдельно проверенный документированный deprecated `box`
вернул пять московских объектов с контурами. Затем `place.getbyid` для одного
из них (№5195049) вернул русское описание и 177 точек контура. Ответ без ключа содержит `debug.code=1000` / `Invalid key`; ограничение
частоты также приходит в `debug`, даже с HTTP 200. Значит, одного HTTP 200 мало.
Заголовок `Access-Control-Allow-Origin: *` получен с API, но реальный браузерный
CORS на пользовательском устройстве требует отдельной проверки.

## Nakarte

Прочитаны напрямую публичные исходники:

- [wikimapia-loader.js](https://github.com/wladich/nakarte/blob/master/src/lib/leaflet.layer.wikimapia/wikimapia-loader.js)
- [wm-utils.js](https://github.com/wladich/nakarte/blob/master/src/lib/leaflet.layer.wikimapia/wm-utils.js)
- [index.js](https://github.com/wladich/nakarte/blob/master/src/lib/leaflet.layer.wikimapia/index.js)
- [config.js](https://github.com/wladich/nakarte/blob/master/src/config.js)

Контуры: `WikimapiaLoader` загружает тайлы, учитывает родительские тайлы и кеш;
`wm-utils` строит путь `z1/itiles/...xy`, разбирает текстовые записи, декодирует
названия и дельты координат. Конфигурация направляет запросы на
`https://proxy.nakarte.me/wikimapia/`. При клике открывается отдельное окно
страницы объекта Wikimapia, а не карточка с описанием из официального JSON API.
Следовательно, работа контуров Nakarte сама по себе не доказывает работу
`place.getbyarea`, а открытый код не разрешает использование чужой инфраструктуры.
В [issue #1329](https://github.com/wladich/nakarte/issues/1329) владелец сообщил
об ограничении proxy для пользователей Nakarte из-за нагрузки сторонних клиентов.
Мы не обращались к этому proxy или itiles и не переносили их протокол.

## Другие открытые клиенты

[Wikimapia Export](https://github.com/martinedoesgis/wikimapia-export/blob/master/index.html):
ввод API key, запрос области через официальный deprecated `box` и экспорт полигонов в GeoJSON.
Исторический браузерный код использует JSONP и HTTP; в этот проект не переносился.
Это подтверждает принцип «границы карты → API → полигоны», но не текущую
работоспособность сервиса и не поддержку HTTPS всеми старыми клиентами.

[Python-клиент plandex/wikimapia-api-py](https://github.com/plandex/wikimapia-api-py),
его [tutorial](https://github.com/plandex/wikimapia-api-py/blob/master/docs/tutorial.rst):
операции inside/nearest/search/get и data_blocks — тоже обёртка официального API,
а не независимый источник геометрии. Исследована документация, библиотека не запускалась.

## Выбор без собственного сервера

| Способ | Оценка для этого проекта |
|---|---|
| Официальный HTTPS API + личный ключ + CapacitorHttp | Рекомендуемый документированный путь: box для области + place.getbyid для деталей; оба проверены |
| fetch в браузере | Для предпросмотра, зависит от CORS; не нужен свой proxy |
| Прокси Nakarte | Чужая инфраструктура и ограничения доступа; не используется |
| Внутренние itiles/скрейпинг страниц | Не реализовано: не соответствует условию о документированных механизмах |
| Открытие официального сайта | Ссылка в карточке; не заменяет мобильный слой объектов |

**Вывод:** документированный путь без своего сервера подтверждён для MVP:
HTTPS `box` + `place.getbyid`, в Android через CapacitorHttp. Устаревающий
`box` — риск поддержки; доступность нового `place.getbyarea` пока не подтверждена.
У `example` общий лимит, для регулярного использования нужен личный ключ.
Доказательств долгосрочной надёжности или SLA нет. Никаких автоматических
fallback на чужие proxy или внутренние тайлы в приложении нет.
