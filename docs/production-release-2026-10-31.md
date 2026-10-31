# Production release LumaClean — 31 октября 2026

## А. Развёртывание

Статус на момент релизного commit: проверки завершены, публикация ещё не подтверждена. Итоговый статус и идентификатор нового deployment будут записаны после фактической публикации и smoke-проверки.

- Рабочая копия: `upholstery-premium`.
- Ветка: `codex/public-pages-release-20261027`, исходное основание `523cad63886fbdd31772a5ac7fb419ebbf65da13`.
- GitHub: `boooobly/lumaclean`, main `22b58184e0fdb0242ec5d2ae9d0e3b8850411fa2`; remote release-ветка совпадала с основанием. Последующие публичные релизы 27–28 октября сохранены.
- Vercel project: `prj_Q4nkQeWNwBIFz1AsthDvyEeJ5BeZ`, team `team_cwlPNVZFs6PwR6BhDE7gU1eq`, Node.js `24.x`.
- Next.js: **16.4.3**, React **19.2.4**. Локальные проверки выполнены Node.js 25.9.0; production remote build проверяет фактический runtime проекта.
- Предыдущий исправный deployment для отката: **`dpl_57x9rf1TQNZVCYSA4XjPY855qZX1`**, `https://lumaclean-c82jrn8hd-vladislavs-projects-0eae0ea3.vercel.app`. Привязка `lumacleanrs.com` подтверждена Vercel Alias API перед выпуском. Его application commit по предыдущему отчёту — `912435a`; deployment создан CLI и не хранит Git SHA. SHA1 опубликованного release evidence совпал с локальным исходным файлом.
- Переменные окружения проверены по именам/target/type, без вывода значений: production DATABASE_URL/DIRECT_URL/auth, Blob, Telegram, WhatsApp, routing, AI и аналитика присутствуют. Секреты/домены/DNS/настройки тарифов не изменялись. Само наличие ключа не доказывает исправность внешнего сервиса.

Схема Prisma, все 25 миграций, API/CRM/агент/очереди/цены совпадают с предыдущим deployed inventory. **Production-миграции и seed не требуются и не выполнялись.** Локальный schema diff: No difference detected.

Evidence обновлено штатно: fingerprint `9be8193cc5767a8e45d20f06aab92aedd3537cc1e7e1a81b6a8e44b30711914f`, 14 изменённых fingerprinted файлов явно проверены. `aiAutoReady: false`, профиль `WEBSITE_MANUAL_AI_OFF`, `AI_VERIFIED_RELEASE=false`. Совпадение fingerprint не активирует AUTO. Старые доказательства live-доставки/бронирования не выданы за новые.

## Б. PageSpeed и Lighthouse

Исходный публичный PSI 31.10.2026, `/ru`:

| Метрика | Mobile до | Desktop до | Production после |
|---|---:|---:|---|
| Performance | 83 | 100 | Ожидает публикации/измерения |
| Accessibility | 96 | 96 | Ожидает измерения |
| Best Practices / SEO | 100 / 100 | 100 / 100 | Ожидает измерения |
| FCP | 1,12 с | 0,268 с | Ожидает измерения |
| LCP | 4,501 с | 0,268 с | Ожидает измерения |
| TBT | 120 мс | 10 мс | Ожидает измерения |
| CLS | 0 | 0 | Ожидает измерения |

Все перечисленные показатели — лабораторные. В исходном PSI **CrUX нет данных**, полевой INP не установлен. Новый production Lighthouse и PSI будут записаны отдельно от локального baseline. Предыдущий локальный результат 84–86 Mobile / 100 Desktop не является production-показателем.

## В. Проверки перед релизом

Артефакты: `artifacts/production-release-2026-10-31/`; исторический baseline — `artifacts/pagespeed-2026-10-31/`.

| Проверка | Подтверждение |
|---|---|
| TypeScript / ESLint | PASS; 0 lint errors, 2 прежних предупреждения локальных blob-preview img в чате |
| Production build Next 16.4.3 | PASS; повторная сборка после evidence отдельно сохранена в `build-certified.log` |
| Unit | 1044 PASS / 0 FAIL / 33 первоначальных environment skips |
| Client SSR | 15 PASS |
| Реальные local PostgreSQL + HTTP admin/CRM/scheduling/routing | **43 PASS**: login, roles, CSRF, закрытая регистрация, серверные цены, транзакции, конкуренция, audit, calendar, protected endpoints |
| Local finance/import | **16 PASS**: duration, payout, агрегаты, transactional import, migration preservation на synthetic БД |
| Local lead/outbox/reliability | **18 PASS**: Lead + outbox атомарно, параллельный retry, rate limit, очередь недоступна, fallback, leased delivery, 429/UNKNOWN, химчистка HTTP; транспорта реальной доставки нет |
| Local public chat/Inbox HTTP | **14 PASS**: cookie scope/HttpOnly/SameSite, чужой token, payload limits, CSRF, idempotency, rate limit, manual reply, запрет включения AUTO |
| Публичные страницы локально | 75 страниц RU/SR/EN × 375/768/1440 = **225 PASS**; business copy/metadata сопоставлены с baseline; 0 page errors |
| Калькулятор/формы | 21 сочетание, 13 групп сценариев, 25 mocked отправок; 400/429/503/offline/retry/idempotency/смешанная заявка — PASS |
| Страницы услуг | 15 страниц × 5 ширин = 75 PASS, 30 переключений языка, FAQ/прайс/формы — PASS |
| Химчистка Chrome + WebKit | 30 сочетаний, multi-item/ADDON/ошибки/retry/успех/reduced motion/no-JS — PASS |
| Live до выпуска | GET/HEAD 15 публичных/API/admin URL; публичные 200, admin redirect 307, protected API 401; anonymous chat/session не раскрывают данные |
| Security dependencies | 0 high / 0 critical / 9 moderate в production graph |

Суммарно **1150 успешных unit/client/local integration assertions**. В 33 первоначальных SKIP изучены причины; разрешённые localhost-наборы запущены дополнительно. Наборы, жёстко привязанные к удалённым disposable Neon-hosts, приватному Blob, живым routing/providers, native AI AUTO или отдельным owner fixtures, не переносились на production и не обходились. Их успех не заявляется. Идентичность agent/API-кода и закрытый AUTO gate сохранены.

Тестовые БД: только `127.0.0.1:55449`, data_directory проверен на `upholstery-premium/artifacts/release-readiness/pgdata`. Старые synthetic БД сохранены переименованием, не удалены. Чистые БД получили копию существующей схемы и текущий synthetic каталог; production-БД не использовалась. Migration-preservation tests создают только локальные synthetic схемы/БД. Внешние токены в тестовых процессах очищены.

**Mocked ≠ live:** браузерные отправки перехвачены; isolated integration использует реальное PostgreSQL-сохранение, а transport/Queue publication контролируются заглушками или delivery-disabled конфигурацией. Реальная цепочка production CRM → Vercel Queue → Telegram в этом выпуске не запускалась, фиктивные production Lead/Order не создавались.

## Г. Безопасность

Обновлены Next/@next/env/eslint-config-next до 16.4.3; Zod до 4.6.6, включая OIDC-цепочку; undici 6.29.1, source-map-js 1.2.2, fast-uri 3.1.9. Добавлены CSP base-uri/object-src/frame-ancestors, nosniff, Referrer-Policy, XFO и COOP. Для admin сохраняются DENY, no-store и noindex. Строгая script-src/Trusted Types не включались вслепую.

9 moderate относятся к Queue и ExcelJS/archiver/glob/minimatch/rimraf. Глобальный несовместимый override minimatch и downgrade Vercel/ExcelJS не выполнялись. В изученных вызовах не найден пользовательский glob с optimizationLevel >=2; отсутствие эксплуатируемости всех путей не доказано.

## Д. Ошибки стенда и исправления при выпуске

1. Первые integration-прогоны воспроизвели загрязнение старого synthetic стенда и срочную заявку после cutoff. Подготовлены чистые локальные БД с сохранением старых; только у тестового разрешённого сценария cutoff установлен 23:59. Отдельные temporal/reliability tests сохраняют проверку отказа после настоящего cutoff. Бизнес-код не изменён.
2. При восстановлении schema-only отсутствовали начальные строки UpholsterySettings/услуги, которые в проекте создавались миграциями. В fixture восстановлены только эти две конфигурации; повтор admin/CRM полностью прошёл. Это не дефект production.
3. В старом chat HTTP test поле locale для message противоречило текущей strict schema. Тест приведён к действующему API; ожидание запрета AI привязано к реально выключенному AI_AGENT_ENABLED. Защитные проверки не ослаблены.
4. Gallery browser test иногда нажимал SSR-карточку до регистрации calculator-effect. Проверка теперь наблюдает готовность настоящего обработчика; no-JS сценарий отдельно сохраняет проверку видимого контента. Runtime и события продукта не подменяются.

## Е. Оставшиеся задачи P0–P3

- **P0:** подтверждённых новых критических регрессий в проверенном объёме нет; окончательное состояние зависит от post-deploy smoke.
- **P1:** Mobile LCP/Performance ниже ориентиров локально. Финальные production-замеры должны определить фактическую причину; рискованные дополнительные изменения требуют нового цикла тестов.
- **P1:** production live-delivery/внешние providers не сертифицированы этим выпуском; требуется предусмотренная изолированная среда с контролируемым получателем. Старые положительные evidence не заменяют текущую проверку.
- **P2:** 9 moderate зависимостей; ограниченная CSP; реальные физические устройства/screen reader и полевой INP не проверены.
- **P3:** 2 старых img-warning локальных preview фотографий чата; лабораторный шум и необязательные рекомендации framework JS.

## Ж. Итог

Итоговые ответы о production deployment, доменном smoke, PageSpeed и мониторинге дописываются после реальной публикации. До этого момента статус SUCCESS не заявляется. План отката: штатный Vercel rollback на `dpl_57x9rf1TQNZVCYSA4XjPY855qZX1` при подтверждённой критической регрессии релиза, без отката/изменения БД. Малые колебания Lighthouse не являются причиной rollback.
