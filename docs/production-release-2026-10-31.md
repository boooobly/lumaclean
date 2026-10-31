# Production release LumaClean — 31 октября 2026

## А. Развёртывание

**Статус: BLOCKED. Новый релиз не опубликован. Текущий production недоступен: HTTP 402 `DEPLOYMENT_DISABLED` на стороне Vercel.**

Повторный production deployment отклонён Vercel: `402 resource_creation_blocked`, «Your Team exceeded our fair use limits and has been blocked». Домен остаётся на прежнем deployment; новый код его не обслуживает. Точный исчерпанный ресурс и условия снятия блокировки из ответа API не установлены. Нельзя утверждать, что блокировку вызвал конкретный запрос или изменение кода.

- Рабочая копия: `upholstery-premium`.
- Ветка: `codex/public-pages-release-20261027`, исходное основание `523cad63886fbdd31772a5ac7fb419ebbf65da13`.
- Релизный commit: **`040abf4e0e8621028831fc9934b8742b2530466c`**, push подтверждён; предыдущий commit оптимизаций — `6ce33be0cb8e0ea0be2fa867cd2f85a7bbb090ac`. Последующее обновление этого отчёта не меняет application fingerprint.
- GitHub: `boooobly/lumaclean`, main `22b58184e0fdb0242ec5d2ae9d0e3b8850411fa2`; remote release-ветка совпадала с основанием. Последующие публичные релизы 27–28 октября сохранены.
- Vercel project: `prj_Q4nkQeWNwBIFz1AsthDvyEeJ5BeZ`, team `team_cwlPNVZFs6PwR6BhDE7gU1eq`, Node.js `24.x`.
- Next.js: **16.4.3**, React **19.2.4**. После обнаружения автоматического выбора Node 26 широкий engines заменён на **24.x**; unit/client и production build повторены на Node **24.22.2**.
- Предыдущий исправный deployment для отката: **`dpl_57x9rf1TQNZVCYSA4XjPY855qZX1`**, `https://lumaclean-c82jrn8hd-vladislavs-projects-0eae0ea3.vercel.app`. Привязка `lumacleanrs.com` подтверждена Vercel Alias API перед выпуском. Его application commit по предыдущему отчёту — `912435a`; deployment создан CLI и не хранит Git SHA. SHA1 опубликованного release evidence совпал с локальным исходным файлом.
- Переменные окружения проверены по именам/target/type, без вывода значений: production DATABASE_URL/DIRECT_URL/auth, Blob, Telegram, WhatsApp, routing, AI и аналитика присутствуют. Секреты/домены/DNS/настройки тарифов не изменялись. Само наличие ключа не доказывает исправность внешнего сервиса.

Первая попытка: `dpl_AFZEgWptYVPJ3xwCgh7pok9Rhjdh`, `https://lumaclean-jq2i1py3t-vladislavs-projects-0eae0ea3.vercel.app`, создана 31.10.2026 в 17:28:16 UTC. Сборка выбрала Node 26 из-за широкого package engines; deployment отменён до READY и переключения рабочего домена. После фиксации Node 24 и повторных проверок второй запрос в 17:32 UTC отклонён fair-use блокировкой, нового deployment ID не создано. **Времени успешной публикации нет.**

CLI fallback проверен в той же команде/project scope: сохранённых CLI credentials нет, начатый device-login отменён. Токены connector не извлекались. Billing/plan не изменялись, обход блокировки не предпринимался.

До попытки выпуска 15 безопасных GET/HEAD проверок production прошли. После блокировки повторные GET `/ru`, `/sr`, `/en`, `/api/booking-policy`, `/robots.txt` возвращают 402 с `x-vercel-error: DEPLOYMENT_DISABLED`; подтверждено в 17:33 и **17:36 UTC**. Alias API по-прежнему указывает на `dpl_57x9rf1TQNZVCYSA4XjPY855qZX1`; отменённая попытка имеет состояние CANCELED. Error/fatal runtime logs за последние 30 минут пусты; это не доказательство здоровья приложения, поскольку edge-блокировка не пропускает запросы к нему. Артефакты: `deployment-blocker.json`, `hosting-block.json`, `hosting-block-final.json`, `hosting-block.png`.

Откат кода не выполнялся: рабочий домен уже на прежнем deployment, а блокировку команды rollback не устраняет. После восстановления хостинга доступен штатный rollback на сохранённый deployment при подтверждённой регрессии нового релиза, без изменений БД.

Схема Prisma, все 25 миграций, API/CRM/агент/очереди/цены совпадают с предыдущим deployed inventory. **Production-миграции и seed не требуются и не выполнялись.** Локальный schema diff: No difference detected.

Evidence обновлено штатно: fingerprint `36854a1f22cbc51ed679ab4e50de403d4f7bfd9657e072c69be72f27b3d3de07`, 14 изменённых fingerprinted файлов явно проверены. `aiAutoReady: false`, профиль `WEBSITE_MANUAL_AI_OFF`, `AI_VERIFIED_RELEASE=false`. Совпадение fingerprint не активирует AUTO. Старые доказательства live-доставки/бронирования не выданы за новые.

## Б. PageSpeed и Lighthouse

Исходный публичный PSI 31.10.2026, `/ru`:

| Метрика | Mobile до | Desktop до | Mobile после | Desktop после |
|---|---:|---:|---|---|
| Performance | 83 | 100 | NOT RUN: hosting 402 | NOT RUN: hosting 402 |
| Accessibility | 96 | 96 | Не проверено | Не проверено |
| Best Practices / SEO | 100 / 100 | 100 / 100 | Не проверено | Не проверено |
| FCP | 1,12 с | 0,268 с | Не проверено | Не проверено |
| LCP | 4,501 с | 0,268 с | Не проверено | Не проверено |
| TBT | 120 мс | 10 мс | Не проверено | Не проверено |
| CLS | 0 | 0 | Не проверено | Не проверено |

Все перечисленные показатели — лабораторные. В исходном PSI **CrUX нет данных**, полевой INP не установлен. Новый production PSI для RU/SR/EN, услуги и химчистки, а также три сопоставимых Lighthouse-прогона главной **не выполнены**: измерение страницы ошибки 402 не характеризует сайт LumaClean. Скрипты подготовлены для повторения после разблокировки.

Предыдущая сопоставимая локальная пара: Mobile 78–79 → 84–86, Desktop 100, Accessibility 100, Best Practices 100, SEO 100; медианный Mobile LCP 5,681 → 4,378 с, начальный трафик 751 → 491 КиБ. Это не production-показатели. Дополнительный локальный запуск этого релизного цикла дал Mobile 81 / Desktop 100 (LCP 4,49 с, TBT 209 мс) одновременно с другими браузерными проверками. Он сохранён отдельно как измерение с конкуренцией за ресурсы, для сравнения до/после не используется. Цели Mobile 90+ и LCP <2,5 с не подтверждены.

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
| Production после попытки | FAIL: 402 DEPLOYMENT_DISABLED на пяти повторно проверенных URL; функциональный smoke/E2E заблокирован хостингом |
| Security dependencies | 0 high / 0 critical / 9 moderate в production graph |

Суммарно **1150 успешных unit/client/local integration assertions**. В 33 первоначальных SKIP изучены причины; разрешённые localhost-наборы запущены дополнительно. Наборы, жёстко привязанные к удалённым disposable Neon-hosts, приватному Blob, живым routing/providers, native AI AUTO или отдельным owner fixtures, не переносились на production и не обходились. Их успех не заявляется. Идентичность agent/API-кода и закрытый AUTO gate сохранены.

Тестовые БД: только `127.0.0.1:55449`, data_directory проверен на `upholstery-premium/artifacts/release-readiness/pgdata`. Старые synthetic БД сохранены переименованием, не удалены. Чистые БД получили копию существующей схемы и текущий synthetic каталог; production-БД не использовалась. Migration-preservation tests создают только локальные synthetic схемы/БД. Внешние токены в тестовых процессах очищены.

**Mocked ≠ live:** браузерные отправки перехвачены; isolated integration использует реальное PostgreSQL-сохранение, а transport/Queue publication контролируются заглушками или delivery-disabled конфигурацией. Реальная цепочка production CRM → Vercel Queue → Telegram в этом выпуске не запускалась, фиктивные production Lead/Order не создавались.

## Г. Безопасность

В локальном/GitHub release-коде обновлены Next/@next/env/eslint-config-next до 16.4.3; Zod до 4.6.6, включая OIDC-цепочку; undici 6.29.1, source-map-js 1.2.2, fast-uri 3.1.9. Добавлены CSP base-uri/object-src/frame-ancestors, nosniff, Referrer-Policy, XFO и COOP. Для admin сохраняются DENY, no-store и noindex. Строгая script-src/Trusted Types не включались вслепую. **Эти исправления ещё не опубликованы на production.** При 402 актуальные заголовки приложения после релиза проверить нельзя.

9 moderate относятся к Queue и ExcelJS/archiver/glob/minimatch/rimraf. Глобальный несовместимый override minimatch и downgrade Vercel/ExcelJS не выполнялись. В изученных вызовах не найден пользовательский glob с optimizationLevel >=2; отсутствие эксплуатируемости всех путей не доказано.

## Д. Ошибки стенда и исправления при выпуске

1. Первые integration-прогоны воспроизвели загрязнение старого synthetic стенда и срочную заявку после cutoff. Подготовлены чистые локальные БД с сохранением старых; только у тестового разрешённого сценария cutoff установлен 23:59. Отдельные temporal/reliability tests сохраняют проверку отказа после настоящего cutoff. Бизнес-код не изменён.
2. При восстановлении schema-only отсутствовали начальные строки UpholsterySettings/услуги, которые в проекте создавались миграциями. В fixture восстановлены только эти две конфигурации; повтор admin/CRM полностью прошёл. Это не дефект production.
3. В старом chat HTTP test поле locale для message противоречило текущей strict schema. Тест приведён к действующему API; ожидание запрета AI привязано к реально выключенному AI_AGENT_ENABLED. Защитные проверки не ослаблены.
4. Gallery browser test иногда нажимал SSR-карточку до регистрации calculator-effect. Проверка теперь наблюдает готовность настоящего обработчика; no-JS сценарий отдельно сохраняет проверку видимого контента. Runtime и события продукта не подменяются.
5. `ai_release_source_mismatch` устранён обновлением evidence по свежим проверкам и явно проверенному набору файлов. Финальный certified build прошёл с совпадающим fingerprint; AUTO остался выключен. Старое evidence не скопировано как будто оно подтверждает новые исходники.
6. Автоматический выбор Node 26 остановлен до публикации; engines закреплён на 24.x, unit/client/build повторены на Node 24.22.2.
7. Внешняя блокировка команды Vercel — не устранена: deployment creation 402 и текущий домен 402. Код, DNS, секреты, тариф и production-данные ради обхода не менялись.

## Е. Оставшиеся задачи P0–P3

- **P0:** действующий сайт и API недоступны из-за Vercel fair-use/DEPLOYMENT_DISABLED. Владелец команды должен проверить Usage/Billing и уведомления Vercel, установить точную причину ограничения и снять блокировку через предусмотренный Vercel процесс/поддержку. Смена тарифа сама по себе не объявляется гарантированным решением. После разблокировки сначала повторить безопасный smoke прежней версии.
- **P1:** повторить deployment commit `040abf4` в существующий project/team с Node 24.x, дождаться READY, подтвердить domain → новый deployment, провести production smoke/log review, затем PSI пяти URL Mobile/Desktop и три Lighthouse-прогона главной с медианой. Новые изменения кода потребуют повторной сертификации evidence.
- **P1:** Mobile LCP/Performance ниже ориентиров локально. Финальные production-замеры должны определить фактическую причину; рискованные дополнительные изменения требуют нового цикла тестов.
- **P1:** production live-delivery/внешние providers не сертифицированы этим выпуском; требуется предусмотренная изолированная среда с контролируемым получателем. Старые положительные evidence не заменяют текущую проверку.
- **P2:** 9 moderate зависимостей; ограниченная CSP; реальные физические устройства/screen reader и полевой INP не проверены.
- **P3:** 2 старых img-warning локальных preview фотографий чата; лабораторный шум и необязательные рекомендации framework JS.

## Ж. Итог

1. **Сайт обновлён на production? Нет.** Код и evidence сохранены в GitHub; успешной публикации нет, домен остался на старой версии.
2. **Сайт работает корректно? Сейчас нет:** подтверждена недоступность хостинга 402. Локальные проверки релиза прошли; они не заменяют post-deploy проверку.
3. **Есть ли подтверждённые проблемы CRM/заявок?** Публичные API сейчас недоступны из-за edge-блокировки. Отдельный дефект CRM-кода не установлен; реальные isolated PostgreSQL/HTTP проверки прошли. Live Queue/Telegram доставка не подтверждена и не объявляется исправной.
4. **Какие показатели PageSpeed достигнуты?** Новых production-показателей нет. Исторические public PSI и локальные результаты разделены в таблицах выше и основном аудите.
5. **Нужны ли дополнительные действия? Да:** владелец снимает ограничение команды Vercel, затем требуется повторная публикация и полный post-deploy цикл. До этого статус **BLOCKED**, а не SUCCESS.

Официальное описание ошибки и восстановления: [Vercel DEPLOYMENT_DISABLED](https://vercel.com/docs/errors/deployment_disabled). Платные настройки автоматически не менялись. Небольшие колебания Lighthouse не являются основанием для rollback.
