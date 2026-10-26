# LumaClean — production release, 26 октября 2026

Рабочая копия: `upholstery-premium`, ветка `codex/seo-lead-consistency`. Статус выпуска: проверка перед публикацией. Предыдущий этап: `docs/seo-audit/implementation-2026-10-26.md`.

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
