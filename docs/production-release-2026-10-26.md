# LumaClean — production release, 26 октября 2026

Рабочая копия: `upholstery-premium`, ветка `codex/seo-lead-consistency`. **Production: DEPLOYED.** Выпущен commit `0f5cdeb79000071fd414cb5d49dbc08b8f448667`. Предыдущий этап: `docs/seo-audit/implementation-2026-10-26.md`.

Deployment: `https://lumaclean-92oerdk5f-vladislavs-projects-0eae0ea3.vercel.app`, ID `dpl_CLhZAxcsDPBSB7oFRPgAZS8uyZAT`, Vercel READY. Домен `lumacleanrs.com` переведён штатным `vercel promote`, alias отдельно подтверждён Vercel API. Коммит сохранён локально; push в GitHub не подтверждён (штатный Git не получил доступ к origin); существующая публикация выполнена через Vercel CLI, как предыдущая production-версия.

## Проверки после публикации

- `https://lumacleanrs.com/ru`, `/sr`, `/en` — HTTP 200; correct locale/canonical, оба публичных ID счётчиков присутствуют. В опубликованном JS подтверждены consent v2 и выключенные webvisor/accurateTrackBounce. Это доказательство установки, а не получения событий.
- Production SEO: 69 страниц / 19 проверок HTTP, **0 issues**. Семь historical 404 теперь дают **308 → эквивалентная страница 200**, проверены без цепочек.
- Пустое тело форм ordinary/upholstery отвергнуто HTTP 400. Анонимная CRM требует входа (307 на login), CRM и AI settings POST возвращают 401. Новые заявки этими негативными проверками не создавались.
- Replay того же TEST `4acbcbe1-7702-4961-ab89-61833351a8b6` после публикации: HTTP 200, прежний reference `UP-LEAD-364AD5AB`; Neon подтвердил **Lead 1 / Notification 1 / attempts 1 / DELIVERED / Telegram message 52**. sentAt остался `2026-10-26T14:15:32.298Z`; повторного сообщения нет.
- Счётчики Order 20, Client 10, Expense 4, CleanerPayout 27 совпали до/после. Production-миграции/seed не запускались, существующие клиенты/заказы не редактировались.
- Deployment собирался в Vercel с npm ci, Prisma generate, Next production build и TypeScript; READY без source-mismatch. Финальная подпись исходников `e204473deb1ee2b56c47c9baa311341f4c9827f6784b50002d89c803898e20cf`; release evidence 1136 PASS (1044 + 15 + 43 + 16 + 18), AI AUTO gate остаётся закрытым.
- Браузерная проверка опубликованной версии после promote не выполнена: Local browser use перестал работать. Пользователь попросил закончить доступное без браузера и продолжить кабинеты после перезагрузки. Последние локальные desktop/mobile проверки выполнялись на production-сборке, изменения после них касались точечных редиректов и закрытого AI-допуска.
- Полностью изолированная БД + реальный Telegram в одной среде отдельно не подтверждены: локальный PostgreSQL прошёл проверки с mocked транспортом, реальная Queue/Telegram проверена единственным разрешённым production TEST. Секреты административного бота не выгружались; невозможно заявить более широкий E2E scope.

## Продолжение после перезагрузки

1. Включить/восстановить Chrome browser use. Повторная публикация сайта и повторное разрешение деплоя не нужны.
2. В существующем GA4 resource 554368271 проверить `generate_lead`, phone_click, messenger_click через Realtime/DebugView. `generate_lead` уже key event, `form_type` создан; не создавать новый resource/stream. Только успешная подтверждённая заявка считается lead. Новое реальное сообщение не разрешено: выделенный лимит **одно TEST** уже использован. Можно проверить page_view и contact clicks без отправки и обсудить отдельное разрешение, только если понадобится ещё одна новая реальная заявка.
3. В существующей Метрике **113807461** создать JS-цели `generate_lead`, `phone_click`, `messenger_click`, проверить фактическое получение событий после согласия. Не создавать второй счётчик. Вебвизор, карты и формы оставить выключенными.
4. GSC: повторно отправить существующий sitemap, проверить exact URL Inspection коммерческих RU/SR/EN и canonical Google; для семи historical 404 запустить «Проверить исправление». Не объявлять запрос индексации результатом индексации.
5. Яндекс Вебмастер: после восстановления read-only сервиса переобойти sitemap (теперь 69 URL), связать созданный counter. Старый отчёт не равен текущим данным.
6. Яндекс Бизнес: закончить проверку дублей в Сербии, определить допустимость карточки выездного сервиса без клиентского офиса; не использовать домашний адрес/фиктивный офис. Публикация карточки пока не выполнялась.
7. Проверить production desktop/mobile в Chrome и при необходимости сохранить screenshots внешних изменений GA4/Метрики. Не трогать реальные заявки; TEST-reference выше оставить как явный след проверки.

Доказательства в `artifacts/release-readiness/`: build/deploy/promote logs, release-evidence-summary.json, production-seo.json, production-redirects.json, production-smoke.json, production-smoke-readonly.json, production-auth.json, четыре browser reports. Общий machine-readable итог также сохранён в `outputs/production-release-2026-10-26/` рабочего корня.

## План отката до публикации

- Production-проект Vercel: `lumaclean`, `prj_Q4nkQeWNwBIFz1AsthDvyEeJ5BeZ`, team `team_cwlPNVZFs6PwR6BhDE7gU1eq`.
- Проверенный alias `lumacleanrs.com` указывает на `dpl_9x7JQ4Rf8MNS4CgLRBa1bMQv6xiL`, `https://lumaclean-olq9fosag-vladislavs-projects-0eae0ea3.vercel.app`.
- Сначала собрать production deployment с `--skip-domain`; домен переводить только после READY и проверок. При критическом нарушении вернуть предыдущий deployment штатным `vercel rollback` / promote проверенного предыдущего deployment. Не откатывать и не мигрировать БД.
- `AI_AGENT_ENABLED=false`; новый допуск сайта НЕ разрешает AI AUTO. В manifest `aiAutoReady=false`, проверка `verifiedRelease` сохраняет AI gate закрытым даже при совпадении исходников. Не отключены проверки подписей, diagnostics или source-bound live proof.
- Production migrations, seed, массовые изменения данных не выполняются. Схема Prisma согласована с существующим SQL: defaults updatedAt и ON UPDATE NO ACTION; новые миграции отсутствуют.

## Подтверждённые проверки

- TypeScript PASS, ESLint 0 ошибок / 2 прежних предупреждения no-img-element, production build PASS.
- Общий набор: 1044 PASS, 33 SKIP (окружения). Client SSR: 15 PASS.
- Отдельный PostgreSQL в `artifacts/release-readiness/pgdata`, loopback `127.0.0.1:55449`; 25 миграций на пяти synthetic БД, schema diff без изменений. На тестовых БД установлен утверждённый каталог, включая актуальную химчистку; старый SQL seed химчистки сам по себе содержал прежние суммы.
- Интеграции: admin/CRM/scheduling/routing 43 PASS; finance 16 PASS; reliability/upholstery 18 PASS. Настоящие HTTP и PostgreSQL, внешний Telegram в этих наборах mocked. Проверены concurrent retries, outbox, 429, UNKNOWN, lease и ручное восстановление. Не изменена бизнес-логика ради старых фикстур.
- Старый AI AUTO integration: 28 PASS / 27 FAIL, отдельный отчёт `artifacts/release-readiness/ai-integration.log`. Причины включают устаревшие qualification/booking/readiness assumptions и фиксацию порта старого окружения. Этот набор не объявлен успешным, AI AUTO не допущен.
- Browser QA: RU/SR/EN, 93 layout-проверки desktop/mobile, 135 расчётов, формы/ошибки/повторы/переключение языков; writes mocked, внешняя аналитика перехвачена. 69 страниц, 19 HTTP проверок, SEO issues 0.
- Доступы: массовая выгрузка production secrets и хэши полных production-строк отклонены auto-review; обе операции НЕ выполнены. Использованы безопасные агрегаты и точечная проверка разрешённого TEST.

## Реальное уведомление

Владелец отдельно разрешил одно TEST в существующий административный чат. Synthetic upholstery submission `4acbcbe1-7702-4961-ab89-61833351a8b6`, reference `UP-LEAD-364AD5AB`, цена 4600 RSD, humanReviewRequired=true. Для теста использован публичный телефон компании с явной пометкой DO NOT CALL / не создавать заказ.

Neon read-only подтверждение: 1 Lead, 1 event `website-lead:cmvpc9sfl000008l5s6n99mw3:telegram`, publishedAt `2026-10-26T14:15:29.733Z`, sentAt `2026-10-26T14:15:32.298Z`, deliveryState DELIVERED, attempts 1, Telegram message ID 52. После публикации повторяется только ТОТ ЖЕ payload/submissionId, без второго уведомления.

Безопасные production-агрегаты перед релизом: Order 20, Client 10, Expense 4, CleanerPayout 27. Это проверка количества, не доказательство побайтовой неизменности всех строк. Данные клиентов не выгружались.

## Google и Яндекс

- Search Console: существующий подтверждённый URL-prefix ресурс `https://lumacleanrs.com/`; sitemap успешно обработан 21 октября, 69 URL. Данные 25 июля–24 октября: 37 кликов, 565 показов, CTR 6,5%, средняя позиция 21,3. Отчёт индексации обновлён 23 октября: 31 indexed / 47 excluded (7 historical mixed-locale 404, 2 redirect, 37 discovered not indexed, 1 crawled not indexed). Добавлены ровно 7 подтверждённых постоянных редиректов на существующие эквивалентные услуги. Индексация не обещана; запросы переобхода и URL Inspection отмечаются отдельно по факту.
- GA4: существующий resource 554368271, stream 15783331464, `G-K1KM379T2Q`; дубли отсутствуют, подключённых дополнительных тегов 0, enhanced measurement выключен. generate_lead уже key event. Создан event-scoped form_type; locale, entry_source, landing_page, service, channel, error_type уже были. Фактическое получение новых событий после публикации ещё проверяется.
- Google Business: существующая подтверждённая карточка LumaClean, residential cleaning, 065 3470308, Белград, ежедневно 09:00–22:00, клиентского офиса нет / адрес скрыт; сайт с согласованной GBP UTM уже установлен. Изменять исправную карточку не потребовалось.
- Яндекс Вебмастер: ресурс существует; sitemap найден в robots.txt, статус «ок», последняя доступная загрузка 2 октября / 63 URL. Сам сервис объявил read-only и остановку обновления части данных; добавить/переобойти sitemap невозможно до восстановления сервиса. Не выдавать старые числа за текущие.
- Метрика: создан бесплатный counter 113807461 по отдельно подтверждённому соглашению; lumacleanrs.com only, Белград, RSD, Вебвизор/аналитика форм выключены. Production env NEXT_PUBLIC_YM_COUNTER_ID добавлен. В коде явные defer/manual hits, фиксированные reachGoal, отключены link/click maps, ecommerce и запись форм. Новый consent v2 для Google и Яндекса; consent v1 не расширен автоматически. Цели/поступление требуют фактического подтверждения, кабинет настройки временно зависает.
- Яндекс Бизнес: в аккаунте LumaClean не найден; Сербия присутствует в поиске регионов. Проверка дублей и допустимости выездного формата ещё не завершена; карточка не создана, вымышленный адрес не использован.

Управление Chrome затем было отключено настройками Work; запрос владельцу включить Local browser use отправлен. Это ограничение внешних кабинетов не блокирует независимый релиз сайта.

## Приватность

Счётчики загружаются только после явного согласия на production hostname. События ограничены allowlist, без имени/телефона/сообщения/произвольных URL. Политика RU/SR/EN сообщает о Google/Yandex и возможной обработке вне Сербии (США/Россия), согласие можно отозвать. Ни Webvisor, ни формы, ни карты кликов не включены. Это техническая проверка минимизации данных; отдельное юридическое заключение о договорных основаниях международной передачи не выдавалось.
