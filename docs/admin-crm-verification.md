# Проверка CRM core — 1 октября 2026

Исходная ветка `codex/admin-foundation`, commit `a07d4a4`. Реализация в `codex/admin-crm-core`: `81cfb05`; исправление последовательных PostgreSQL transaction queries: `881349c`. Существующие несвязанные untracked файлы не включались в commits. Секреты, credentials, cookies, fixtures и screenshots остаются вне Git и deployment.

## Автоматические проверки

| Проверка | Фактический результат |
| --- | --- |
| lint / TypeScript / Prisma validate | Успех |
| Local production build | Успех, 70 static pages и динамические ADMIN/API routes |
| Foundation tests | 5 passed, 0 failed, 0 skipped |
| CRM tests | 17 passed, 0 failed, 0 skipped |
| Additive migrations | Все четыре миграции применены на трёх disposable local DB; schema diff пуст |
| Foundation → CRM fixtures | Существующие client, lead, order, soil HEAVY и связи сохранены; backfill 2, повтор 0 |
| Shared pricing unit regression | 4000 комбинаций услуг/площади с extras и срочностью |
| Public pricing regression | 800 случаев, 18 price pages, 63 sitemap URLs, RU/SR/EN labels без изменений |
| Articles | 45 translations, 42 опубликованных и 3 draft; production draft isolation, metadata/images/sitemap |
| Public form / analytics | Validation/network/storage errors, стабильный UUID повторов, duplicate-click guard, отсутствие PII; Telegram только mock/отключён |
| SEO после первого CRM rollout | 63 страницы, 19 групп проверок, 0 issues |

Последний полный прогон выполнен после исправления драйвера, с пересозданием только трёх именованных loopback DB в контейнере `lumaclean-crm-verify`. Пройдены concurrent intake retries/conflict, Telegram success/failure, HTTP persistence, LOST reason, client duplicate/messenger search, адреса, fixed/flexible time, чужой и неактивный адрес, transactional rollback/convert, pricing snapshot, reschedule, completion/closed states, ADMIN/CLEANER/current-role/CSRF/invalid IDs. Реальная production БД не использовалась интеграционными тестами.

## Chrome verification

На 1440×900 и 390×844 проверены Leads/Clients/Orders, детали Lead/Client/Order и форма заказа. Горизонтального overflow документа нет; широкие реестры прокручиваются внутри подписанного region. Формы имеют labels, pending и сохранение ошибок/значений; mobile inputs используют 16 px, действия доступны с экрана 390 px.

Desktop workflow: website fixture → Lead → поиск совпадения телефона → существующий Client/Address → атомарное создание Order со скидкой. Предупреждение о дубле предлагает выбрать существующего клиента или явно разрешить нового.

Mobile workflow: создать Client → изменить условия → добавить Address → создать FLEXIBLE Order с двумя окнами и скидкой 5% → перенести окно 20 → 21 октября → DRAFT → CONFIRMED → SCHEDULED → EN_ROUTE → IN_PROGRESS → COMPLETED. Цена 6400 − 320 = 6080 RSD сохраняется при переносе; completedAt и выручка/средний чек клиента появляются; адрес деактивируется без удаления заказа. Выбор следующего статуса корректно обновляется после каждого перехода.

После PostgreSQL correction повторно проверены populated реестры, client/order details и dashboard. Browser error/warning logs пусты. Сервер с `--trace-deprecation` не воспроизводит предупреждение `client.query()`; ожидаемые negative intake/delivery test events имеют безопасный код/reference без контактов.

## Neon и preview

Миграции `20261001120000_crm_core` и `20261001121000_crm_search_indexes` сначала применены на отдельной preview branch `br-muddy-fire-b8q2d6uo`. Schema diff пуст, operational counts сохранены. Preview `dpl_8F6gkVhByHeK94XffVWxoc3cUPPc` проверен через Chrome: отдельный verifier login, dashboard, три реестра, logout, без browser ошибок и без demo CRM records. Verifier и его sessions/accounts удалены после проверки; immutable SYSTEM provisioning audit сохранён, preview ADMIN count снова 0.

Production migrations применены через DIRECT_URL на `main`, `br-noisy-bar-b8vmyqyi`, без reset/db push. Schema diff пуст; backfill 0. Counts до/после: Client 0, Lead 0, Order 0, ADMIN 1. Владелец и существующие Telegram/public env сохранены.

## Production rollout

Первый CRM deployment `dpl_2BdhJLtMDfBhPmauaZFvY1i13BgR` проверен с `--skip-domain`: owner login, три защищённых реестра HTTP 200, private/no-store/noindex, anonymous redirect 307, 63 public sitemap URLs; затем promoted. Наблюдение runtime logs обнаружило pg deprecation warning при HTTP 200 на Orders. Причина воспроизведена локально: параллельные Prisma relation queries в общей транзакции соединения. Независимые read queries переведены на pool, зависимые mutation reads выполняются последовательно. Business transactions и audit сохранены; журналы не подавлялись.

Финальный deployment и проверки после promotion приведены в release appendix [admin-crm.md](admin-crm.md).

## Ограничения

Telegram FAILED/PENDING не теряет Lead, но durable background retry/outbox ещё отсутствует. Расчётная длительность остаётся null; ручная хранится отдельно. Calendar, cleaner assignment, maps/routes, optimizer, inbox/AI, payouts/finance UI и Excel import намеренно не реализованы. Подробная архитектура и лимиты списков/истории: [admin-crm.md](admin-crm.md).
