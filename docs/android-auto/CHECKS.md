# Проверки Android Auto

Baseline main: `7338baf3c3c51415cc9ca9f4a6509475c89f35b3` (Next 0.7.3).
Исходная ревизия ТЗ: `570b69e`; актуальный main содержит последующую автоматизацию
и документацию релиза. Разработка ведётся только в `feat/android-auto`.

| Проверка | Состояние на первом checkpoint |
| --- | --- |
| Baseline npm test | PASS, 65 тестов |
| Baseline npm run test:probe | PASS, 7 тестов |
| Baseline npm run test:browser | PASS, 69 тестов |
| Текущий npm test | PASS, 68 тестов |
| Geo / Viewport / RequestGate JVM | PASS, 7 тестов |
| Gradle обеих сборок | IN_PROGRESS, итог ниже после CI |
| Car app-testing / Robolectric | IN_PROGRESS |
| DHU / физический телефон / автомобиль | NOT_RUN: нет подключённого телефона/host |
| Live Wikimapia API с личным ключом | NOT_RUN: ключ пользователя не предоставлялся |
| Google Play / PF-1 approval | NOT_RUN |

Первая компиляция выявила отсутствие генерации BuildConfig — включена явно.
Повторный запуск выявил изменение assets одновременно со сборкой — синхронизация
теперь выполняется до Gradle; это не дефект APK. Независимое read-only ревью нашло
ошибки map-action titles, fallback rows, cancellation callback, cache pagination,
simplification и replay операций. Исправления проверяются дальнейшими прогонами.

Окончательные результаты, ссылки и SHA APK дополняются после завершения проверок.
