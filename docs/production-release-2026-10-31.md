# Production release LumaClean — 31 октября 2026

## А. Развёртывание

**Статус production deployment: SUCCESS. Новый релиз опубликован; домен обслуживает новый deployment.** Независимый Google PSI и production WebKit имеют описанные ниже ограничения. Live-доставка CRM → Queue → Telegram не сертифицирована этим выпуском.

После сообщения владельца об оплате подписки повторная проверка подтвердила восстановление прежней версии (15 безопасных smoke checks). Повторный deployment принят Vercel, сборка завершена, Alias API подтвердил переключение обоих доменов. Платные настройки агент не менял.

- Рабочая копия: `upholstery-premium`.
- Ветка: `codex/public-pages-release-20261027`, исходное основание `523cad63886fbdd31772a5ac7fb419ebbf65da13`.
- Опубликованный Git commit: **`544da114d0a129e9dd9c0f73c047a574af776fd6`**, application-код соответствует `040abf4e0e8621028831fc9934b8742b2530466c`; разница между ними — отчёт о первой блокировке. Предыдущий commit оптимизаций — `6ce33be0cb8e0ea0be2fa867cd2f85a7bbb090ac`. Последующие обновления отчёта и QA-скриптов не меняют опубликованный application fingerprint.
- Новый deployment: **`dpl_3xJJgmzsGJG79fp2Jtsin7fKVEHH`**, [deployment URL](https://lumaclean-9n6g1f3u3-vladislavs-projects-0eae0ea3.vercel.app), состояние **READY**, target **production**.
- Создан: **31.10.2026 18:21:41 UTC**; READY: **18:23:51 UTC** (19:23:51 Europe/Warsaw). `lumacleanrs.com` и `www.lumacleanrs.com` указывают на новый ID; www сохраняет redirect 308.
- GitHub: `boooobly/lumaclean`, main `22b58184e0fdb0242ec5d2ae9d0e3b8850411fa2`; remote release-ветка совпадала с основанием. Последующие публичные релизы 27–28 октября сохранены.
- Vercel project: `prj_Q4nkQeWNwBIFz1AsthDvyEeJ5BeZ`, team `team_cwlPNVZFs6PwR6BhDE7gU1eq`, Node.js `24.x`.
- Next.js: **16.4.3**, React **19.2.4**. После обнаружения автоматического выбора Node 26 широкий engines заменён на **24.x**; unit/client и production build повторены на Node **24.22.2**.
- Предыдущий исправный deployment для отката: **`dpl_57x9rf1TQNZVCYSA4XjPY855qZX1`**, `https://lumaclean-c82jrn8hd-vladislavs-projects-0eae0ea3.vercel.app`. Привязка `lumacleanrs.com` подтверждена Vercel Alias API перед выпуском. Его application commit по предыдущему отчёту — `912435a`; deployment создан CLI и не хранит Git SHA. SHA1 опубликованного release evidence совпал с локальным исходным файлом.
- Переменные окружения проверены по именам/target/type, без вывода значений: production DATABASE_URL/DIRECT_URL/auth, Blob, Telegram, WhatsApp, routing, AI и аналитика присутствуют. Секреты/домены/DNS/настройки тарифов не изменялись. Само наличие ключа не доказывает исправность внешнего сервиса.

История первой попытки: `dpl_AFZEgWptYVPJ3xwCgh7pok9Rhjdh` создан в 17:28:16 UTC. Сборка выбрала Node 26 из-за широкого package engines; deployment отменён до READY и переключения рабочего домена. После фиксации Node 24 и повторных проверок запрос в 17:32 UTC отклонён fair-use блокировкой, нового deployment ID тогда не создано. Vercel сообщил `402 resource_creation_blocked`, «Your Team exceeded our fair use limits and has been blocked». Точный ресурс/причина ограничения не установлены; причинная связь с конкретным запросом не заявляется.

CLI fallback проверен в той же команде/project scope: сохранённых CLI credentials нет, начатый device-login отменён. Токены connector не извлекались. Billing/plan не изменялись, обход блокировки не предпринимался.

Историческая недоступность: GET `/ru`, `/sr`, `/en`, `/api/booking-policy`, `/robots.txt` возвращали 402 `DEPLOYMENT_DISABLED` в 17:33 и 17:36 UTC, при старом Alias ID. После сообщения владельца в 18:22 UTC прежняя версия снова прошла smoke; в 18:24 UTC новый deployment прошёл те же проверки. Исторические артефакты сохранены: `deployment-blocker.json`, `hosting-block*.json/png`; восстановление и публикация — `public-restored-before-release.json`, `public-after.json`, `deployment-retry.json`, `production-assets.json`, `vercel-build.log`.

Rollback не потребовался: критической регрессии нового релиза в проверенном объёме не обнаружено. Сохранён штатный rollback на `dpl_57x9rf1TQNZVCYSA4XjPY855qZX1` при подтверждённой регрессии, без изменений БД. Предыдущая версия отдельно проверена после восстановления хостинга и до публикации.

Схема Prisma, все 25 миграций, API/CRM/агент/очереди/цены совпадают с предыдущим deployed inventory. **Production-миграции и seed не требуются и не выполнялись.** Локальный schema diff: No difference detected.

Evidence обновлено штатно: fingerprint `36854a1f22cbc51ed679ab4e50de403d4f7bfd9657e072c69be72f27b3d3de07`, 14 изменённых fingerprinted файлов явно проверены. `aiAutoReady: false`, профиль `WEBSITE_MANUAL_AI_OFF`, `AI_VERIFIED_RELEASE=false`. Совпадение fingerprint не активирует AUTO. Старые доказательства live-доставки/бронирования не выданы за новые.

## Б. PageSpeed и Lighthouse

Исходный публичный PSI 31.10.2026, `/ru`:

| Метрика | Mobile до | Desktop до | Mobile после | Desktop после |
|---|---:|---:|---|---|
| Performance | 83 | 100 | PSI не вернул отчёт | PSI не вернул отчёт |
| Accessibility | 96 | 96 | Не проверено в PSI | Не проверено в PSI |
| Best Practices / SEO | 100 / 100 | 100 / 100 | Не проверено в PSI | Не проверено в PSI |
| FCP | 1,12 с | 0,268 с | Не проверено в PSI | Не проверено в PSI |
| LCP | 4,501 с | 0,268 с | Не проверено в PSI | Не проверено в PSI |
| TBT | 120 мс | 10 мс | Не проверено в PSI | Не проверено в PSI |
| CLS | 0 | 0 | Не проверено в PSI | Не проверено в PSI |

Все показатели PSI — лабораторные. В исходном PSI **CrUX нет данных**, полевой INP не установлен. После READY сделана реальная отправка пяти URL через обычную форму pagespeed.web.dev: для каждого Google вернул «Не удалось перейти по адресу…», без Mobile/Desktop отчёта. Сохранены полный текст и URL ошибки каждого анализа в `public-psi/summary.json` и `*-error.txt`. Прямой API дополнительно вернул **429 RESOURCE_EXHAUSTED** по дневной квоте (`public-psi-api.json`). Причина отказа frontend PSI не установлена и не приравнивается к API-квоте или неисправности сайта. Firewall read API вернул 404 Seawall Config not found; правила защиты не менялись. Требуется повторить публичный PSI из другого доступного сеанса или с собственным разрешённым API-ключом. Результат PSI не подменялся локальным Lighthouse.

**Lighthouse 13.6.0 против опубликованного `https://lumacleanrs.com`, запущенный из локального Chrome:** новые профили, одинаковые настройки device/throttling внутри серии, API/telemetry intercepted, без передачи реальных заявок. Это отдельный лабораторный источник. Сравнение его баллов с исходным удалённым PSI не является контролируемым before/after экспериментом. До/после в одинаковой локальной среде остаётся в основном аудите.

| URL | Mobile Performance (все запуски) | Desktop Performance | A / BP / SEO, оба устройства | Mobile LCP | Mobile TBT | CLS Mobile |
|---|---|---|---|---|---|---|
| `/ru` | **91, 96, 95 → медиана 95** | **100, 100, 100 → 100** | **100 / 100 / 100** | **2,884 с** | 46 мс | 0 |
| `/sr` | 90, 90, 88 → медиана **90** | 100 (1 запуск) | 100 / 100 / 100 | 3,629 с | 93 мс | 0 |
| `/en` | 95 (1 запуск) | 100 (1 запуск) | 100 / 100 / 100 | 2,878 с | 31 мс | 0 |
| `/ru/services/uborka-kvartir` | 96 (1 запуск) | 100 (1 запуск) | 100 / 100 / 100 | 2,738 с | 41 мс | 0 |
| `/ru/himchistka-mebeli` | 88, 89, 88 → медиана **88** | 100 (1 запуск) | 100 / 100 / 100 | 3,633 с | 110 мс | 0 |

Итого **18 прогонов**, все JSON/HTML сохранены: `production-lighthouse-home/` (6), `production-lighthouse-pages/` (8), `production-lighthouse-repeat/` (4). Сводка — `production-measurements.json`. Для SR/химчистки повторены низкие результаты; все запуски сохранены. Desktop CLS услуги/химчистки <0,00004, остальных 0.

Медианы `/ru`: FCP 1,155 с Mobile / 0,309 с Desktop; Speed Index 1,162 / 0,376 с; TBT 46 / 0 мс; LCP 2,884 / 0,309 с; response-time audit 20 мс; начальный трафик 543 776 / 584 152 байта. Это laboratory TTFB audit, а не распределение реального TTFB. TBT не выдаётся за INP. Новых полевых CrUX/INP нет.

Причины остаточного Mobile LCP: на RU LCP — приоритетное hero-изображение; Lighthouse подтверждает discovery в исходном HTML, eager/high, без замечаний image delivery, но моделируемая медленная сеть всё ещё даёт >2,5 с. На SR и химчистке LCP-кандидатом стал текст панели согласия `#lc-privacy-panel`, появляющейся после гидратации; химчистка также имеет ~48 КиБ unused JS и 15 КиБ unused CSS по оценке Lighthouse. Панель и её тексты не скрывались ради оценки. Перестройка initial rendering согласия и дробление calculator/общих стилей требуют отдельного before/after цикла и регрессии согласия/аналитики; в уже проверенный релиз эти изменения не добавлялись.

Историческая сопоставимая локальная пара: Mobile 78–79 → 84–86, Desktop 100, Accessibility 100, Best Practices 100, SEO 100; медианный Mobile LCP 5,681 → 4,378 с, трафик 751 → 491 КиБ. Дополнительный локальный запуск до публикации дал 81 / 100 (LCP 4,49 с, TBT 209 мс) при параллельных браузерных проверках; он сохранён отдельно. Эти localhost-результаты не смешиваются с измерениями публичного домена.

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
| Production после публикации | **PASS**: те же 15 безопасных GET/HEAD проверок, новые security headers, две новые картинки совпали с локальными SHA-256; HTTPS прошёл стандартную TLS-валидацию |
| Production страницы RU/SR/EN | **75 страниц / 225 сочетаний / 75 внутренних маршрутов PASS**; сравнение business copy/metadata с baseline, 0 console/page/hydration errors; home CLS 0 при 375/1440 |
| Production формы/калькулятор/чат | **13 групп / 21 viewport сочетание / 25 mocked отправок PASS**, языки RU/SR/EN, ошибки/retry/idempotency, цены/допуслуги, мини-форма и чат; 0 page errors |
| Production переключение языка | **42 реальных перехода PASS** при ширине 375: все 6 направлений RU/SR/EN на главной, химчистке и 5 услугах; независимые ожидаемые slugs, lang/H1/отсутствие overflow, 0 console/page errors |
| Production химчистка | Chrome: **15 сочетаний + ошибки/retry/no-JS/reduced-motion PASS**. WebKit production **BLOCKED** по TLS тестового движка; localhost Chrome/WebKit 30 сочетаний прошли до публикации |
| Production Lighthouse | **18 прогонов / 5 URL / оба устройства**; A/BP/SEO 100 во всех; JSON/HTML и медианы сохранены |
| Security dependencies | 0 high / 0 critical / 9 moderate в production graph |

Суммарно **1150 успешных unit/client/local integration assertions**. В 33 первоначальных SKIP изучены причины; разрешённые localhost-наборы запущены дополнительно. Наборы, жёстко привязанные к удалённым disposable Neon-hosts, приватному Blob, живым routing/providers, native AI AUTO или отдельным owner fixtures, не переносились на production и не обходились. Их успех не заявляется. Идентичность agent/API-кода и закрытый AUTO gate сохранены.

Тестовые БД: только `127.0.0.1:55449`, data_directory проверен на `upholstery-premium/artifacts/release-readiness/pgdata`. Старые synthetic БД сохранены переименованием, не удалены. Чистые БД получили копию существующей схемы и текущий synthetic каталог; production-БД не использовалась. Migration-preservation tests создают только локальные synthetic схемы/БД. Внешние токены в тестовых процессах очищены.

**Mocked ≠ live:** браузерные отправки перехвачены; isolated integration использует реальное PostgreSQL-сохранение, а transport/Queue publication контролируются заглушками или delivery-disabled конфигурацией. Реальная цепочка production CRM → Vercel Queue → Telegram в этом выпуске не запускалась, фиктивные production Lead/Order не создавались.

Мониторинг после публикации: финальный повтор всех 15 HTTP/HTTPS checks — **PASS в 18:35:37 UTC**. Доступный Vercel runtime error/fatal scan с 18:23:51 UTC по время проверки — пустая таблица; публичный browser audit — 0 console/page errors. Подтверждённых 5xx в проверенных HTTP ответах и ресурсах нет. Это ограниченное окно наблюдения, а не гарантия долговременной стабильности. Artifact `production-deployment-verified.json` сохраняет ID/READY/alias/log evidence. Постоянный внешний мониторинг и drains этим выпуском не настраивались. Все запущенные одноразовые браузеры закрываются в finally; локальные тестовые серверы/PostgreSQL остановлены.

## Г. Безопасность

На production опубликованы Next/@next/env/eslint-config-next 16.4.3; Zod 4.6.6, включая OIDC-цепочку; undici 6.29.1, source-map-js 1.2.2, fast-uri 3.1.9. Новые CSP base-uri/object-src/frame-ancestors, nosniff, Referrer-Policy, XFO и COOP **подтверждены ответами публичного домена**. Admin сохраняет DENY, no-store и noindex; protected API отвечают 401, anonymous session/chat не раскрывают данные. HSTS — max-age=63072000. Сертификат Let's Encrypt YR2 для lumacleanrs.com валиден 17.09–16.12.2026; Node TLS authorized=true, Chrome принимает сертификат. Строгая script-src/Trusted Types не включались вслепую.

9 moderate относятся к Queue и ExcelJS/archiver/glob/minimatch/rimraf. Глобальный несовместимый override minimatch и downgrade Vercel/ExcelJS не выполнялись. В изученных вызовах не найден пользовательский glob с optimizationLevel >=2; отсутствие эксплуатируемости всех путей не доказано.

## Д. Ошибки стенда и исправления при выпуске

1. Первые integration-прогоны воспроизвели загрязнение старого synthetic стенда и срочную заявку после cutoff. Подготовлены чистые локальные БД с сохранением старых; только у тестового разрешённого сценария cutoff установлен 23:59. Отдельные temporal/reliability tests сохраняют проверку отказа после настоящего cutoff. Бизнес-код не изменён.
2. При восстановлении schema-only отсутствовали начальные строки UpholsterySettings/услуги, которые в проекте создавались миграциями. В fixture восстановлены только эти две конфигурации; повтор admin/CRM полностью прошёл. Это не дефект production.
3. В старом chat HTTP test поле locale для message противоречило текущей strict schema. Тест приведён к действующему API; ожидание запрета AI привязано к реально выключенному AI_AGENT_ENABLED. Защитные проверки не ослаблены.
4. Gallery browser test иногда нажимал SSR-карточку до регистрации calculator-effect. Проверка теперь наблюдает готовность настоящего обработчика; no-JS сценарий отдельно сохраняет проверку видимого контента. Runtime и события продукта не подменяются.
5. `ai_release_source_mismatch` устранён обновлением evidence по свежим проверкам и явно проверенному набору файлов. Финальный certified build прошёл с совпадающим fingerprint; AUTO остался выключен. Старое evidence не скопировано как будто оно подтверждает новые исходники.
6. Автоматический выбор Node 26 остановлен до публикации; engines закреплён на 24.x, unit/client/build повторены на Node 24.22.2.
7. После оплаты подписки владельцем fair-use блокировка снята; восстановление подтверждено, релиз опубликован. Код, DNS, секреты, тариф и production-данные ради обхода не менялись.
8. Production WebKit завершается TLS-ошибкой до загрузки страницы. Диагностика воспроизвела ту же ошибку на `https://example.com`, при успешной валидации Node/Chrome LumaClean. Это ограничение локального WebKit; `ignoreHTTPSErrors` не включался, ошибка не скрыта. Артефакты `production-upholstery/polish-report.json`, `webkit-tls.json`. Проверка реального Safari остаётся непроведённой.
9. Автоматизация PSI была исправлена на обычное заполнение `input[name=url]` и нажатие «Анализировать». Реальные ошибки пяти анализов сохранены; ожидание отсутствующих вкладок не считается измерением.

Изменения приложения и их файлы перечислены в `docs/pagespeed-audit-2026-10-31.md` (раздел «Изменённые файлы»). В повторной попытке исходники приложения не менялись. Дополнительно обновлены `scripts/release-readiness/pagespeed-public-psi.mjs` (реальный submit и раннее сохранение ошибок), `tests/browser/pagespeed-audit.mjs` (явно разрешённый production origin и отдельный каталог артефактов), добавлен `tests/browser/production-navigation.mjs` (42 безопасных перехода), обновлён этот отчёт. Evidence приложения остаётся прежним и совпадает с опубликованным исходным набором.

## Е. Оставшиеся задачи P0–P3

- **P0:** активных подтверждённых критических регрессий в проверенном объёме нет. Историческая hosting 402 устранена до нового выпуска.
- **P1:** Mobile LCP 2,7–3,6 с и химчистка Performance 88: исследовать ранний рендер панели согласия и уменьшение JS/CSS без скрытия текста, изменения согласия или отключения функциональности. Нужны отдельные before/after измерения, unit/privacy/UI regression, новое evidence и build перед следующим выпуском.
- **P1:** повторить независимый публичный PSI для 5 URL из рабочего Google-сеанса/API-квоты; проверить внешнюю доступность Google fetch без ослабления firewall. Причина текущего отказа Google не доказана.
- **P1:** production live-delivery/внешние providers не сертифицированы этим выпуском; требуется предусмотренная изолированная среда с контролируемым получателем. Старые положительные evidence не заменяют текущую проверку.
- **P2:** 9 moderate зависимостей; ограниченная CSP; реальные физические устройства/screen reader и полевой INP не проверены.
- **P3:** 2 старых img-warning локальных preview фотографий чата; лабораторный шум и необязательные рекомендации framework JS.

## Ж. Итог

1. **Сайт обновлён на production? Да.** Vercel READY, рабочие домены привязаны к новому ID, новые assets и security headers подтверждены.
2. **Сайт работает корректно? В проверенном публичном объёме — да:** 75 страниц, формы/калькуляторы/чат с mocked отправкой, auth guards, HTTP/HTTPS и ресурсы прошли. Полная исправность внешних интеграций этим не доказана.
3. **Есть ли подтверждённые проблемы CRM/заявок?** Новый дефект CRM-кода не установлен. Реальные isolated PostgreSQL/HTTP проверки прошли; production API доступны и защищены. Live Queue/Telegram доставка не проверялась; лишние реальные заявки/уведомления не создавались.
4. **Какие показатели достигнуты?** Lighthouse публичного `/ru`: медиана Mobile **95**, Desktop **100**, A/BP/SEO **100**, CLS **0**, Mobile LCP **2,884 с**. Химчистка Mobile **88**. Новый публичный Google PSI/полевой INP получить не удалось; источники не смешаны.
5. **Нужны ли дополнительные действия? Да:** независимый PSI, изолированная live-интеграционная сертификация, реальный Safari и отдельный цикл Mobile LCP/химчистки. **Production deployment SUCCESS**, ограничения и оставшиеся задачи сохранены.

Официальное описание ошибки и восстановления: [Vercel DEPLOYMENT_DISABLED](https://vercel.com/docs/errors/deployment_disabled). Платные настройки автоматически не менялись. Небольшие колебания Lighthouse не являются основанием для rollback.
