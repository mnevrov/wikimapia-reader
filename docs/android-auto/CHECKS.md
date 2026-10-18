# Результаты проверки Android Auto

Базовый main: `7338baf3c3c51415cc9ca9f4a6509475c89f35b3`, Next 0.7.3.
Ветка: `feat/android-auto`. [PR #12](https://github.com/mnevrov/wikimapia-reader/pull/12).
Изменения не сливаются в main. Версия стабильной Next не повышалась, новый
production release не выпускался; APK этой ветки — отдельные debug-артефакты.

## Автоматические проверки

| Команда / сценарий | Результат |
| --- | --- |
| Baseline `npm test` | PASS: 65 |
| Baseline `npm run test:probe` | PASS: 7 |
| Baseline `npm run test:browser` | PASS: 69 |
| `npm test` после интеграции | PASS: 68 |
| `npm run test:probe` | PASS: 7 |
| Playwright после интеграции | PASS: 69, mocked API/native bridge/tiles |
| `testMobileDebugUnitTest` | PASS: 3 |
| `testAutoDevDebugUnitTest` | PASS: 31 (включая те же 3 cipher-теста) |
| `assembleMobileDebug`, `assembleAutoDevDebug` | PASS |
| `lintMobileDebug`, `lintAutoDevDebug` | PASS: нет ошибок; предупреждения ниже |
| `scripts/check-auto-apks.py` | PASS: package, manifest, DEX isolation, подписи, SHA256 |
| Проверка изменений `git diff --check` | PASS |

Последний CI и APK находятся в **Checks → Android APK** в PR. CI выполняет те же
команды, сохраняет `WikiReader-mobile-<sha>`, `WikiReader-AutoDev-<sha>` и
`WikiReader-checks-<sha>`. Точные SHA256 APK и сертификаты находятся в SHA256SUMS.txt
и BUILD.txt соответствующего артефакта. Локальный APK и CI APK могут иметь разные
SHA из-за временной подписи; не смешивать результаты разных сборок.

Robolectric/app-testing проверяют создание сервиса, оба шаблона API1/7, непустой
fallback, loading поиска, восстановление viewport, cache pagination bbox/pages,
coalescing при движении и блокировку повторов после ошибки. JVM-тесты проверяют
Mercator, antimeridian, невыпуклый полигон, zoom anchor, несколько ограниченных bbox,
6-секундный gate/backoff и отсутствие расхода слотов отменёнными ожиданиями.

Контрактные тесты используют тот же Moscow fixture, что JS: longitude/latitude,
ошибки в HTTP200, неверный ID/bbox/ключ, search request, некорректные координаты,
исключение descriptions из кэша, миграцию namespace/dedup, идемпотентность replay,
car-first removal, retention7/pin/clear, приоритет свежих перекрывающихся контуров
и завершение отменённого callback ровно один раз.

Lint оставляет предупреждения о старых/неиспользуемых launcher resources, manifest
order, новых версиях зависимостей, private resource allowlist и намеренно exported
CarAppService. Debug Auto разрешает тестовые host для DHU; такую конфигурацию нельзя
считать готовой production-политикой доверия. Release branch/подпись и допуск host
проверяются отдельно перед интеграцией. Отсутствие lint errors не означает отсутствие
этих предупреждений.

## Что действительно не проверялось

| Проверка | Статус и причина |
| --- | --- |
| DHU, живой Android Auto host | NOT_RUN: `adb devices` пуст, подключённого телефона нет |
| Реальное GPS/follow, pan/zoom/tap на Surface | NOT_RUN на устройстве; JVM проверяет модели/шаблоны, а не реальные кадры |
| Live Wikimapia с личным ключом | NOT_RUN: ключ пользователя не передавался в эту среду |
| Реальные OSM tiles/HTTP cache на head unit | NOT_RUN end-to-end; политика реализована в HTTP transport и renderer |
| Дневной/ночной режим, portrait/wide, FPS, TalkBack, low memory на устройстве | NOT_RUN |
| Установка поверх основной Next | Не выполнялась: CI mobile имеет другой debug-сертификат |
| Play internal testing / PF-1 / approval | NOT_RUN; публикация не входит в этот PR |

## Ревью и исправленные дефекты

Независимое read-only ревью выполнено с приложенным ТЗ. Исправлены: titles в map
strip, fallback без browsable/DistanceSpan, незавершаемый cancel callback, потеря
предыдущих страниц кэша, decimation плотных контуров, фиксированный размер viewport,
replay старых favorites, потеря retention7/30, смешивание bbox страниц, приоритет
старой геометрии и loading-флаг при cached return. Добавлены regression tests.

Дополнительно API transport явно отключает глобальный HTTP cache (`useCaches=false`,
`Cache-Control: no-store`), чтобы URL с API key не попал в OSM disk cache. Ключ не
печатается в логах и артефактах. Защита Android Keystore на физическом устройстве,
установленное обновление и traffic/logcat inspection остаются частью ручной приёмки.

## Остаточные ограничения

- Ни DHU, ни JVM не доказывают допуск приложения к физическому head unit. Нужны
  проверка на телефоне и поддерживаемый канал установки templated POI.
- AndroidX 1.8.0-rc01 выбран по security-рекомендации Google; это RC, не stable.
- За один устойчивый viewport рассматривается максимум 3×3 области; на широком
  обзоре и высокой скорости покрытие неполное. Страницы догружаются явным «Ещё».
- Избранное/кэш AutoDev физически независимы от Next. Данные старого WebView в том
  же пакете импортируются при первом открытии телефона, не из фонового CarAppService.
- Offline поддерживает сохранённые контуры/названия/избранное. Нет гарантированного
  offline basemap, фотографий, комментариев или полных описаний.
- Маршрут требует совместимого навигатора. Открытие телефона зависит от ограничений
  фонового запуска; pending ID сохраняется для следующего открытия AutoDev.
- Протестирован код и артефакты; неподтверждённые аппаратные пункты ТЗ не объявляются
  выполненными. До ручной приёмки PR остаётся кандидатом на тестирование.
