# LumaClean — Vercel Pro optimization and reliability

Дата: 1 ноября 2026. Ветка: `codex/vercel-pro-optimization-20261101`. Рабочая копия: `vercel-pro-optimization/`.

Первоначальный этап подготовлен локально; ниже сохранены его измерения. Продолжение release verification описано в разделах16–23: protected cloud Preview и отдельная synthetic DB подготовлены на существующих ресурсах. Production deployment/promotion, merge, изменения production DB/Firewall/Team budget/add-ons не выполнялись. Telegram сообщения не отправлялись.

## 1. Фактическая конфигурация и исходное состояние

| Объект | Подтверждённое состояние |
|---|---|
| Team | `vladislavs-projects-0eae0ea3`, `team_cwlPNVZFs6PwR6BhDE7gU1eq`, **Pro**, подтверждено Dashboard |
| Production | `prj_Q4nkQeWNwBIFz1AsthDvyEeJ5BeZ`, deployment `dpl_3xJJgmzsGJG79fp2Jtsin7fKVEHH`, READY |
| Production source | `544da114d0a129e9dd9c0f73c047a574af776fd6`, `codex/public-pages-release-20261027`; именно от него создана новая ветка |
| GitHub main | `22b58184e0fdb0242ec5d2ae9d0e3b8850411fa2`, проверено через GitHub connector; отличается от фактически опубликованного source |
| Runtime | Next.js **16.4.3**, React **19.2.4**, Prisma **7.10.0**, Queue SDK **0.7.0** в исходниках production; Node.js **24.x** в Vercel и package engines |
| Functions | Fluid Compute включён; **iad1**, Standard **1 vCPU / 2 GB**. В коде долгих workers maxDuration 180 s, visibility timeout notifications 240 s |
| Neon | `lumaclean-admin`, `patient-butterfly-42300600`, PostgreSQL 18, AWS **us-east-1**; main и отдельная RC-ветка подтверждены Neon API |
| DB pool | pg Pool max=3 / instance, idle 10 s, connect timeout 5 s, `attachDatabasePool`; Neon SSL `verify-full` |
| CDN | Flat Rate CDN включён: текущая ёмкость 1M requests / 1 TB. Image Optimization использует новую модель transformations/cache reads/writes |
| Protection | Vercel Authentication: `all_except_custom_domains`; password protection и Trusted IPs не включены |
| Build | Next.js preset, Node 24; Elastic, следующий build 4 vCPU / 8 GB; on-demand concurrent builds: all immediately; deployment checks отсутствуют, rolling releases выключены |
| Release safety | Production priority включён, deployment retention 30 дней; Git connection в Dashboard не подключён, production выпущен CLI |
| Cron до изменений | Только `/api/agent/recover`, `0 6 * * *` (UTC) |
| Queues | `lumaclean-notifications` и `lumaclean-agent` зарегистрированы `queue/v2beta` triggers; recent Queue view показывает agent: 2 queued / 2 received / 2 deleted / 0 redeliveries. Это не доказательство доставки Telegram |

Управляемый инструмент worktree отказался принимать вложенный repository как sourceRoot. Поэтому отдельный Git worktree создан штатной командой Git внутри разрешённого workspace. `upholstery-premium` остался на `codex/full-product-audit-20261101` с теми же тремя untracked SEO-файлами. Dirty release-candidate и чистая ветка Sofija не изменялись.

Предыдущая работа найдена в `docs/pagespeed-audit-2026-10-31.md`, commits `6ce33be`, `040abf4`, `544da11`. Next upgrade, WebP portrait hero, image priorities, lazy final frames, font preload и доступность **уже входят в production source**. Они не повторялись. Более поздние изменения полного аудита, включая idle SSE, pricing/duration и CI gates, в эту ветку не переносились.

## 2. Какие возможности Pro уже используются

Fluid Compute и pool integration, регион рядом с БД, CDN/image optimization, private Queue consumers, ежедневный Cron, deployment protection и observability доступны и используются. Увеличивать CPU, память, concurrency или число регионов по полученным данным не обосновано.

**Observability Plus уже включён в Team**, переключатель checked, `disabledProjects: []`. Это существующая настройка, не покупка в рамках работы. Billing показывает Included плюс тарификацию событий. Отсутствие дополнительной фиксированной платы не означает отсутствие usage charges.

## 3. Что не подключено и почему

- Speed Insights: сборщика в приложении нет, Dashboard Get Started / no events; Plus выключен. Подтверждённых полевых LCP/INP/CLS нет.
- Web Analytics: Dashboard no data, пакета `@vercel/analytics` нет. Уже существуют Google/Yandex с текущим consent. Новый платный сборщик не добавлен.
- Drains: не настроены; отдельный платный внешний сервис не внедрялся.
- Bot Protection: inactive; custom WAF rules: 0. Агрессивные правила без анализа по endpoint/IP не вводились.
- Function Failover в этом Dashboard — Enterprise, не возможность текущего Pro.
- Перенос DB/Functions в Европу не выполнен: обе серверные стороны сейчас в одной области США. Изменить только Functions на `fra1` означало бы добавить межконтинентальные DB round trips.

Бесплатный Speed Insights можно рассмотреть после проверки privacy disclosure: текущие тексты согласия называют Google/Yandex, а не Vercel. Механика согласия сохранена. Его бесплатный RES не заменяет отдельные p75 CWV.

## 4. Основные проблемы и приоритет

| ID | Приоритет | Подтверждённая проблема | Решение |
|---|---|---|---|
| REL-01 | P1 | При потере Queue wake и post-response fallback следующий резервный проход мог быть только через сутки | Отдельный notification-only Cron каждые 5 минут |
| REL-02 | P1 | Неподписанный idle pg pool error может стать unhandled EventEmitter error и завершить процесс с другими запросами | Обработчик idle error с безопасным кодом лога |
| PERF-01 | P1 | Клиентский чат загружал полный маркетинговый словарь RU/SR/EN ради короткого booking recap; калькулятор химчистки также импортировал весь словарь | Малые сериализуемые props из Server Components |
| SEC-01 | P2 | Cron проверял длину JS-строк, затем сравнивал UTF-8 Buffer; специально подобранный не-ASCII header мог дать исключение вместо 401 | Сравнение длины байтов и timingSafeEqual |
| SEC-02 | P2 | Не все error/negative API ответы имели общую политику no-store | Общая private/no-store политика `/api/*` |
| OBS-01 | P2 | Логи не позволяли посчитать успешные сохранения и отделить новый Lead от idempotent replay | Структурированный `website_lead_saved`, created и durationMs |

Не обнаружено доказательств потери уже сохранённой заявки. Критическая гарантия существующей реализации — Lead и Notification создаются в одной транзакции; Telegram не является условием сохранения.

## 5. Изменения кода

- `src/lib/services/website-notification-recovery.ts`: выбирает только due WEBSITE_LEAD / ADMIN / TELEGRAM, связанные с Lead.channel=WEBSITE (исправлено при release verification), включая истёкшие SENDING lease; использует прежний `deliverNotification`. До 10 событий, порядок scheduledAt/id, 30 s на начало следующей обработки. Другие уведомления/AI jobs не запускает. Существующие CAS lease, retries, terminal states и согласие не заменены.
- `/api/notifications/recover`: `CRON_SECRET`, maxDuration 60 s, no-store, агрегаты выбранной партии без персональных данных. Cron `*/5 * * * *`; прежний AI Cron не учащается. Это резервный интервал, не SLA: backlog, DB outage и terminal UNKNOWN могут потребовать владельца.
- `cron-auth.ts`: общий byte-safe guard для нового и существующего recovery endpoints.
- `database/client.ts`: idle-error handler. Он не маскирует ошибки SQL-запросов и не меняет размеры пула.
- `chat-recap-copy.ts`, locale layout, `website-chat.tsx`: компактные подписи для всех языков диалога, включая отличающийся от страницы язык. Полный словарь остаётся на сервере.
- Upholstery page/calculator: передаются только localized serviceNames; расчёт, каталог, правила, цены и форма согласия сохранены.
- `next.config.ts`: private/no-store для API; immutable media/static и public rendering не менялись.
- `/api/lead`: лог после завершённой транзакции; без имени, телефона, reference, текста, ID, токенов или upstream error.
- Добавлены recovery PostgreSQL tests, negative HTTP tests, browser recap test и воспроизводимый summarizer Lighthouse.

Новых зависимостей, изменений schema, migrations, прайса, дизайна, коммерческих текстов или SEO URL нет.

## 6. Скорость: production baseline и сопоставимая локальная пара

Полные значения всех отдельных запусков, медианы, диапазоны, FCP/LCP/TBT/CLS/TTFB, передача JS/images/fonts, число запросов и unused JS: [машиночитаемые результаты](vercel-pro-optimization-2026-11-evidence.json). Raw JSON/HTML Lighthouse находятся в ignored `artifacts/vercel-pro-20261101/`.

Production baseline снят на настоящем `https://lumacleanrs.com`: главные RU/SR/EN, supporting/deep/upholstery во всех трёх языках, Mobile и Desktop. Для первых шести страниц по 3 запуска; для шести дополнительных SR/EN страниц по 2 запуска. Проверки read-only: `/api/*`, telemetry и любые writes перехвачены. Следовательно, это **лабораторная загрузка production assets с mocked API**, не измерение доставки, реального booking-policy или реальных посетителей.

| Production, медиана | Mobile Performance | Desktop Performance | Mobile LCP |
|---|---:|---:|---:|
| `/ru` | 97 (90–97) | 100 | 2.579 s |
| `/sr` | 95 | 100 | 2.877 s |
| `/en` | 95 (93–95) | 100 | 2.879 s |
| RU supporting | 95 (92–98) | 100 | 2.879 s |
| RU deep | 96 (94–96) | 100 | 2.734 s |
| RU upholstery | 88 (88–89) | 100 | 3.782 s |
| SR supporting | 92.5 | 100 | 3.184 s |
| SR deep | 96 | 100 | 2.735 s |
| SR upholstery | 87 | 100 | 3.860 s |
| EN supporting | 94 | 100 | 3.029 s |
| EN deep | 97 | 100 | 2.583 s |
| EN upholstery | 89.5 | 100 | 3.556 s |

Цель Mobile 90+ по медиане ещё не достигнута для химчистки во всех языках. Дробные баллы — медианы двух целочисленных запусков. Полевые p75 LCP <2.5 / INP <200 / CLS <0.1 не подтверждены. В одном cold-visitor production-прогоне химчистки LCP node — consent panel, который появляется после hydration; его не прятали и согласие не обходили ради балла.

Локальная пара: один компьютер, Chrome/Lighthouse 13.6.0, `http://127.0.0.1:3128`, Node 25.9.0 в обоих проходах, одинаковая production-mode конфигурация и fixture DB, 3 cold-cache запуска каждого устройства/маршрута до/после. Отдельная финальная проверка build/types/unit/recovery и браузера выполнена под целевым Node 24.22.2. Во время замеров не выполнялись build/unit/browser regression. Первый запуск сохранён, не выброшен. Аналитика локально выключена профилем окружения; production с consent panel и локальную пару напрямую сравнивать нельзя.

| Локально, медианы | До | После | Интерпретация |
|---|---:|---:|---|
| `/ru` Mobile | 84 (84–86) | 86 (84–86) | Диапазоны перекрываются; сильный speed gain не доказан |
| `/ru` Desktop | 100 | 100 | Без изменения |
| `/ru` Mobile LCP | 4.257 s | 4.174 s | −84 ms, лабораторное значение |
| `/ru` CLS | 0 | 0 | Без изменения |
| `/ru` Mobile Initial Transfer | 503,276 B | 492,448 B | −10,828 B (−2.15%) |
| `/ru` Mobile JS transfer | 234,325 B | 223,122 B | −11,203 B (−4.78%) |
| `/ru` decoded JS | 740,515 B | 713,873 B | −26,642 B |
| `/ru` Mobile requests | 35 | 34 | −1 |
| RU upholstery Mobile | 84 | 84 | Без подтверждённого роста |
| RU upholstery LCP | 4.467 s | 4.474 s | +7 ms; в пределах разброса |
| RU upholstery transfer | 648,923 B | 638,648 B | −10,275 B |
| INP / field CWV | N/A | N/A | Не заменять TBT лабораторным INP |

Проверены existing AVIF/WebP, responsive hero/preload, offscreen lazy frames, next/font/self-hosting, Onest/Golos и disabled Geist preload. MapLibre динамически импортируется только в admin routing map; на публичных страницах не найден. Публичная motion сохранена. Home searchParams и DB-backed upholstery остаются dynamic; service/article routes используют существующую статическую генерацию. Общий HTML/DB pricing cache не вводился.

## 7. Стабильность backend и PostgreSQL

Vercel Production Functions Dashboard, окно Last 12 hours около 19:56 GMT+1: 675 invocations, error 0%, timeout 0%, Active CPU p75 745 ms, memory average 296 MB / 2.05 GB, CPU throttle p75 5.8%, TTFB p75 381 ms, cold starts 5.2%. Эти разные показатели не являются Function duration p95. Достоверного p95 экспорта не получено: **N/A**.

Среди затрат CPU: `/api/chat/events` — 179 invocations, 2 min CPU, duration p75 46 s; это длительный SSE, не TTFB. У homepage и booking-policy виден duration p75 около 10 s, требующий отдельной корреляции trace/after work. Idle SSE уже исправлялся в отдельном full-product audit commit `268e9c9`; повторная реализация здесь не делалась. Перед общим релизом согласовать ту работу отдельно.

Region DB и Functions совпадает; pool max 3 сохранён. Production DB не опрашивалась SQL и не изменялась. Число SQL-запросов/реальный SQL p95 по production не установлены; статический анализ пула и localhost-тесты не выдаются за DB telemetry. Неизвестные значения — N/A.

## 8. Проверки CRM / Telegram

Существующий путь: save transaction → Lead + Notification + audit → publish opaque notificationId → Queue → leased worker → Telegram. Retry того же submissionId возвращает прежний Lead, conflicting payload отвергается. Queue имеет at-least-once semantics; бизнес-идемпотентность обеспечивается БД.

Новый PostgreSQL recovery test подтверждает 12 конкурентных одинаковых отправок → один Lead/Notification; Telegram 429 сохраняет Lead и backoff; два конкурентных recovery не дублируют отправку; expired SENDING → UNKNOWN; terminal/future/другие kind не отправляются; выбор ограничен 10. Telegram delivery в тесте — injected stub.

Существующие isolated intake tests подтверждают queue outage fallback, durable AI/outbox, неконфликтующие replay, 429, UNKNOWN, CRM authorization для ручного retry. Доставка реальному Telegram и внешний Vercel Queue broker **не тестировались синтетическими клиентскими заявками**. UNKNOWN означает неопределённый исход: автоматически повторять его нельзя. FAILED/UNKNOWN видны в прежней CRM, сам Lead остаётся доступен менеджеру.

## 9. Security / WAF

Dashboard за Past Day: Firewall active, system mitigations active, около 4.1k allowed, **284 denied DDoS**, custom rules 0, bot protection inactive, no recent alerts. Top paths: `/_next/image` 364, `/api/chat/events` 229, `/ru` 110, `/api/booking-policy` 86. В top User Agents есть HeadlessChrome и node; это также собственный QA, само по себе не доказательство злоупотребления. IP-адреса и сырые клиентские данные в отчёт не включены.

9 local negative HTTP checks: unauthorized admin/recovery, invalid/oversize lead, malformed Queue callbacks и no-store. Новая Cron-проверка byte-safe. Existing lead rate limit в транзакции после idempotency: 20/10 min, 100/day на HMAC bucket; IPv6 /64. У chemical intake отдельный existing limiter 6; wholesale замены на WAF нет. Auth/CRM используют прежние role/session/origin guards, webhooks — прежние секреты/подписи. Voice API отсутствует в production baseline; он относится к отдельной Sofija-ветке.

Согласно [официальным Queue concepts](https://vercel.com/docs/queues/concepts#consumer-function-security), queue/v2beta consumers приватны на платформе. Локальный malformed JSON 400 не является доказательством edge-защиты Vercel. SDK/triggers сохранены; IP allowlist, универсальные challenge и правила на Queue/webhook не добавлялись.

Рекомендуемый следующий WAF шаг: только наблюдение за POST `/api/lead` и `/api/upholstery/lead`, без body/query/PII логирования; 7 дней оценивать частоту, ложные срабатывания и NAT. Затем отдельно согласовать узкое правило, соответствующее существующему приложению. Не ограничивать site-wide GET, Googlebot, auth/Queue/provider callbacks тем же правилом. WAF Rate Limiting на Pro тарифицируется по использованию, это не безусловно бесплатная функция.

## 10. Расходы: последние 30 дней и бюджет

Источник: Team Usage, **Last 30 Days, Oct 2 – Nov 1**, All Projects. API billing charges ответил `costs_not_found`; вывод основан на Dashboard, не на нулевом API результате. Поскольку Team перешла на Pro 31 октября, график содержит доступную тарифицируемую историю после перехода; полнота данных предыдущего Hobby-периода не доказана. Данные могут отставать до часа. Это **Team totals**, не LumaClean-only invoice.

| Ресурс | Usage / charge в Dashboard |
|---|---|
| CDN requests / Fast Data Transfer | 11.66k / 440 MB, $0.00 / $0.00, Flat Rate CDN |
| CDN additional CPU | 7.63 s, $0.00 |
| Functions memory | 9.53 GB-hours, $0.10 |
| Functions active CPU | 9 min, $0.02 |
| Function invocations | 4.42k, $0.00 rounded |
| Fast Origin Transfer | 86 MB, $0.01 |
| Image transformations / writes / reads | 130 / 460 / 548; transformations $0.01, остальное rounded $0.00 |
| ISR reads / writes | 3.58k / 268, rounded $0.00 |
| Blob storage / transfer | 52 MB / 28 MB, rounded $0.00 |
| Observability events | около 13.99k, rounded $0.00 |
| Build CPU | 28 min, $0.08 |
| Function / Deployment storage | 304 / 241 MB-months, $0.03 / $0.02 |
| Queue send / delete / receive / notify | 4 / 2 / 2 / 2, rounded $0.00 |
| Infrastructure subtotal | **$0.29**; строки округлены, вручную их не суммировать |

В Current Billing Cycle: $0.29 / $20 included credit, $0.29 credit applied, subscription $20, current total $20. Pro subscription в произвольном 30-day view отображается prorated $1.33; это не новая цена тарифа.

Spend Management уже настроен: **$200 Team budget, pause Off, webhook Off, current on-demand $0**; alerts при 50/75/100%. Безопасное предложение владельцу: уменьшить on-demand notification budget до $20 на первый месяц (alerts $10/$15/$20 после included credit), сохранить pause/webhook Off. Это уведомления, не жёсткий spending cap. Учитывать всю Team, add-ons, seats и отдельные Neon/AI счета. Настройка в этой работе не изменялась.

Новый Cron добавляет 288 вызовов/сутки, до 8,640 за 30 дней, обычно одну небольшую indexed выборку без Telegram при пустой очереди. Он не бесплатен независимо от тарифа: расход Functions/DB нужно проверить через неделю. При обнаружении DB backlog >10 новые партии обрабатываются в следующие тики. Повышать batch/concurrency без измерений не требуется.

## 11. Рекомендуемые настройки Dashboard

1. Сохранить iad1, Standard CPU/memory и Fluid Compute.
2. После выпуска убедиться, что оба Cron появились, `CRON_SECRET` задан именно в production, и новый endpoint не имеет внешнего успешного unauthenticated вызова.
3. Сохранить pause Off в Spend Management; согласовать меньший notification-only бюджет.
4. Для шумных веток рассмотреть one build per branch вместо all immediately. Изменение не сделано: частота реальных конкурирующих builds не установлена.
5. Подключать deployment checks после анализа существующего `codex/production-baseline-sync-20261101` / full-product CI, не дублировать незавершённые pipelines и не связывать эту ветку с авто-production.
6. Настроить штатные error/timeout/deployment-failed и Queue retry-depth alerts, если интерфейс текущего плана поддерживает нужный фильтр. Получатель — владелец через существующие email/in-app каналы; не создавать Telegram-сообщение для каждой ошибки.
7. При мониторинге использовать только `website_lead_saved`, `website_notification_recovery`, `website_notification_recovery_failed`, `database_idle_connection_failed`; created=true отдельно от replay. Warn failed/unknown — агрегат обработанной партии, не общий размер backlog.
8. Для recovery_failed: уведомление после 2 последовательных ошибок/10 минут; для terminal UNKNOWN/FAILED — одно сгруппированное уведомление и ручная проверка CRM. Для 5xx intake — несколько ошибок за 5 минут; для скорости — p75 за устойчивый период, не одиночный Lighthouse.

## 12. Что бесплатно, включено или оплачивается отдельно

Условия проверены по официальной документации 1 ноября; перед покупкой повторно проверить Billing.

| Возможность | Модель / решение |
|---|---|
| Pro | $20/month platform, 1 deploying seat, $20 usage credit; [Pro plan](https://vercel.com/docs/plans/pro-plan) |
| CDN | Базовая ёмкость Flat Rate CDN включена; более высокий capacity tier может изменить счёт следующего периода |
| Fluid Functions / images / Queue | Usage-based, расходуют credit; Queue отдельно считает операции и Function compute. [Queue pricing](https://vercel.com/docs/queues/pricing) |
| Cron | Расписание доступно, выполнения потребляют Function/DB ресурсы |
| Base Observability | Доступен без отдельной платы; Plus **уже включён**, $1.20 / million events. [Observability Plus](https://vercel.com/docs/observability/observability-plus) |
| Speed Insights free | RES, 10,000 events / rolling 30 days на Team, без overage; при лимите приостанавливается сбор, сайт работает |
| Speed Insights Plus | $10/project/month + $0.65/10k events, нет включённой Pro event quota; подробные CWV. Выключен, не покупался. [Pricing](https://vercel.com/docs/speed-insights/limits-and-pricing) |
| Web Analytics | На Pro usage $0.03/1k events; Plus дополнительно $10/Team/month. Не подключён. [Pricing](https://vercel.com/docs/analytics/limits-and-pricing) |
| WAF Rate Limiting | Pro usage-based, пример регионального тарифа $0.50/million allowed requests; не включён новым правилом. [Limits/pricing](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) |

## 13. Проверки и результаты

Тестовая среда: локальный production-mode Next server `http://127.0.0.1:3128` и отдельный intake server `http://127.0.0.1:3129`. PostgreSQL 18 слушает только `127.0.0.1:55461`, отдельный новый data directory этой ветки. Env очищен от live credentials, AI off. Это **не cloud Vercel Preview**.

| Проверка | Результат |
|---|---|
| Production build 16.4.3 | PASS; без credentials |
| TypeScript | PASS |
| ESLint | PASS, 0 errors, 2 прежних img warnings для локальных chat photo previews |
| Unit/domain/admin/CRM/pricing/queue/security | Финальный Node 24: 1,046 PASS, 34 SKIP; DB-dependent suites запускались дополнительно там, где указано ниже |
| Client SSR, штатный CSS hook | 15 PASS |
| Новые recovery tests, настоящий localhost PostgreSQL | 7 PASS, 0 SKIP |
| Existing isolated intake/reliability | 15 PASS, 0 SKIP |
| Admin/CRM/scheduling integration | 27 PASS, 0 SKIP |
| Finance integration на отдельной чистой fixture | 15 PASS, 0 SKIP |
| Migration rehearsal | Все существующие migrations применились в новых пустых локальных БД; production DB не подключалась |
| HTTP security/cache | 9 negative/unauthorized PASS; отдельно authenticated local recovery вернул 200/private-no-store, сохранив retry PENDING при отсутствующих Telegram credentials |
| Estimate/contact forms | RU/SR/EN × 7 widths, 13 сценарных групп, 25 mocked submissions, 0 page errors |
| Upholstery | Chrome + WebKit, 30 layout combinations, errors/retries/idempotency/combined price/reduced motion/no-JS; 0 unexpected errors |
| Публичный обход | 75 страниц × 375/768/1440, title/canonical/hreflang/JSON-LD/links/overflow; PASS |
| axe | RU/SR/EN upholstery × 375/1440, WCAG 2/2.1 A/AA; PASS |
| Booking recap | 4 chat locales, включая sr-Cyrl и язык диалога, отличающийся от страницы; mocked PASS |
| Lighthouse | Production baseline и локальная пара сохранены полностью, без удаления неудачных запусков |

Финальный проход после изменений props: 75 страниц / 225 viewport checks / 75 внутренних URL, 0 page/console errors; все metadata, JSON-LD, hreflang и ссылки совпали с исходным браузерным обходом. У 66 страниц main text совпал точно. На 9 страницах с live upholstery prices выявлены только числовые отличия из-за исправления собственного синтетического каталога; это не изменение кода прайса. Точное соответствие сумм проверено отдельными approved-pricing и калькуляторными сценариями. Повторные формы, химчистка, axe и recap прошли под Node 24.

Для повторения базовых проверок использовать Node 24, `npm ci`, затем:

```sh
npm run typecheck
npm run lint
npm run build
node --conditions=react-server --import tsx --test tests/admin/*.test.ts tests/crm/*.test.ts tests/scheduling/*.test.ts tests/routing/*.test.ts tests/finance/*.test.ts tests/agent/*.test.ts tests/reliability/*.test.ts
node --import tsx --require ./tests/register-client.cjs --test tests/admin/messenger.test.tsx
```

DB suites требуют только собственных localhost fixtures и соответствующих `*_TEST_DATABASE_URL` / `*_TEST_BASE_URL`; новый test дополнительно требует `PRO_RECOVERY_TEST_DATABASE_URL` с базой `lumaclean_pro_recovery_test` или `_v2`. Не направлять эти переменные в production. Браузерные скрипты принимают `BASE_URL`, `PLAYWRIGHT_CORE_PATH`, для axe — `AXE_CORE_PATH`; `vercel-pro-http.mjs` принимает только local `PRO_HTTP_TEST_URL`. `vercel-pro-summary.mjs` заново строит JSON из сохранённых Lighthouse-файлов, не выполняя сетевых запросов.

Источники прайса: `pricing.ts`, `appliance-catalog.ts`, `domain/crm-pricing.ts`, `upholstery.ts`, независимые `tests/crm/approved-pricing.test.ts`, документ 17 октября с последующими утверждёнными окнами в `docs/seo-audit/implementation-2026-10-26.md`. Цена в коде не менялась.

Исправлены только тестовые условия, проверки не ослаблялись: initial db push в первой пустой experimental fixture остановился на отсутствующем pg_trgm; создана другая свежая fixture с extension. Historical upholstery migration оставляет старый каталог, поэтому собственная синтетическая fixture приведена к текущим defaults. Finance first run обнаружил данные предыдущих CRM тестов; прежняя synthetic DB сохранена переименованием, suite повторён на новой чистой БД, затем возвращена исходная benchmark fixture. Client SSR требует существующий `tests/register-client.cjs` для CSS, это не app fix.

## 14. Оставшиеся задачи и ограничения

- Cloud Preview **не выпущен**: Vercel CLI не авторизован; обычная Preview production project имеет общий Blob token с production/development. Раздельные DB env entries подтверждены по metadata, равенство самих DB credentials/endpoint не раскрывалось и не проверено. Ни RC, ни Sofija не использовались как автоматически безопасная тестовая среда.
- Перед cloud integration test подтвердить schema-only/synthetic DB, отдельные Blob/notification/AI настройки и запрет внешних отправок. Metadata scope сама по себе не доказывает изоляцию значений.
- Actual live Queue dispatch, Telegram receipt, CrUX/field CWV и Function p95 после выпуска — N/A. Синтетическая локальная доставка не заменяет эти доказательства.
- Старый `release/ai-go-live.json` не соответствует новому source fingerprint. AI release gate не обходился, AUTO не разрешён. Перед выпуском требуется обычная source-bound manual release verification; AI AUTO остаётся отдельным процессом.
- Согласовать production/main drift и будущую интеграцию более позднего full-product audit отдельно; не выпускать его изменения цен/длительностей, Sofija или whole-branch merge как побочный эффект этого PR.
- Свежий `npm audit --json`: **24 moderate, 0 high, 0 critical** (с учётом транзитивных и dev dependencies). Это отличается от исторических 9 moderate: затронуты также dev lint/minimatch цепочки. Предлагаемые audit автозамены включают downgrade Queue до 0.1.1, ESLint до 4.0.0 и eslint-config-next до 0.2.4; они не совместимы с текущим проектом. Нужны проверенные upstream fixes; глобальный несовместимый override ради счётчика не применялся. JSON сохранён в `artifacts/vercel-pro-20261101/dependency-audit.json`.
- Дополнительная локальная P75/physical mobile/assistive-tech проверка и долгосрочное наблюдение ещё нужны; Mobile химчистки не объявлен 90+.
- Упомянутые thresholds WAF/spend/alerts — подготовленные рекомендации, настройки не изменены.

## 15. План безопасного production release

1. Review diff этой ветки относительно точного production SHA; повторно получить текущий deployment и проверить отсутствие более свежего выпуска. Согласовать production/main drift с владельцем.
2. Проверить final source fingerprint и результаты CI; обновить **manual** release evidence по штатной процедуре, сохранив отдельный AI gate. Проверить отсутствие новых schema/migration файлов и изменение `vercel.json` с одним дополнительным notification-only Cron.
3. Подготовить защищённый cloud Preview с доказанной изоляцией и заглушками. Повторить public RU/SR/EN / headers / forms / Queue registration. Не переиспользовать production DB/Blob для тестовых заявок.
4. После отдельного разрешения владельца собрать staged production build без назначения доменов. До promotion проверить его настройки, закрытость Queue consumers, Cron registration, source/Node/region и public read-only checks. Не считать promotion Preview тождественным проверенному production artifact.
5. По отдельному разрешению выполнить production promotion. В первый час проверить logs/5xx/unauthorized API/Queue redeliveries/new recovery completion и CRM terminal states. Синтетическую live-заявку/Telegram test выполнять только по явному отдельному разрешению; обычные реальные обращения не использовать как разрушительный тест.
6. При регрессии вернуть предыдущий deployment. Новых DB migrations нет; зафиксировать сохранённые заявки и уведомления, не сбрасывать UNKNOWN и не инициировать массовую повторную доставку. После rollback учитывать состояние assignment/auto-promote Vercel.
7. Повторить тот же production Lighthouse suite и отслеживать реальные CWV после накопления данных. Через 7 дней проверить цену нового Cron, DB usage, queue age и расходы всей Team.

Состояние результата: локальная ветка с ограниченными улучшениями и доказательствами; разрешение на production и завершённая cloud release verification остаются отдельным решением.

## 16. Продолжение release verification — статус BLOCKED

Работа продолжена строго из6d9ef0f в той же ветке. Production повторно подтверждён544da11/dpl_3xJJgmzsGJG79fp2Jtsin7fKVEHH; main22b5818 отстаёт на18production commits. Ветка Pro содержит только один первоначальный commit поверх production. Audit094ae45, Sofija10625b2, RC5c4e98d и release574d055 изучены read-only, массового merge нет. Source SQL/schema/pricing/duration/SEO/agent runtime идентичны production; общий byte-safe guard существующего agent recovery — первоначальная инфраструктурная правка Pro, не смена AI-политики. Readonly merge-tree с release574d055 не выявил конфликта; это не разрешение на merge. Выпускать явный SHA Pro, не main/latest и не произвольную локальную папку.

Новый подтверждённый дефект: Sofija staging route использует enqueueLeadReview и тот же kind=WEBSITE_LEAD, но Lead.channel=OTHER. Старый recovery обработал voice fixture (red:5PASS/2FAIL, включая parent). Исправление website-notification-recovery.ts связывает Notification.payload.leadId с Lead и фильтрует channel=WEBSITE **до LIMIT10**. После исправления7/7PG18 PASS; voice event остаётся PENDING, чужой HANDOFF/terminal/future event и AI jobs не запускаются. Действующий deliverNotification/CAS/lease/UNKNOWN/retry не заменён. Изменений Sofija не переносили.

## 17. Фактическая изоляция cloud Preview

CLI авторизован официальным device flow, владелец подтвердил вход. Token не запрашивался сообщением, не печатался и не вошёл в Git. CLI cache/config находятся в ignored artifacts. Новые проекты/branches/compute/Blob stores/add-ons не создавались.

В существующем Neon RC branch br-rough-bread-b8y7ehd6 / compute ep-icy-smoke-b8pu84zj создана **новая пустая** lumaclean_vercel_pro_20261101, PostgreSQL18.6. Production branch br-noisy-bar-b8vmyqyi не менялся. Первичный public_tables=0, Client/Lead/Order/Message=0; parent-data в эту БД не копировались. Runtime lumaclean_pro_runtime_20261101: NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS, не member neon_superuser, DDL denied. Metadata privileges на neondb проверены без чтения records: SELECT Client/Lead/Order=false. App получает только собственную pooled connection; direct/migration credentials в deployment не передавались.

Neon API создал managed роли lumaclean_pro_migrator_20261101 и lumaclean_pro_app_20261101 с расширенными provider privileges. Обычный SQL не разрешил снять их; runtime использует отдельно созданную SQL-роль без этих прав. Managed app-role не используется. Обе managed роли/пустая test DB сохранены, ничего автоматически не удалялось; владельцу передан точный inventory для последующего cleanup. Их пароли не опубликованы/не переданы приложению.

Cloud Windows Prisma schema engine не установил соединение (FAIL сохранён). Поэтому cloud схема получена явным исполнением25 неизменённых SQL через pg с TLS, затем synthetic catalogue seed. Это **SQL replay, не Prisma migrate-deploy PASS**; metadata production не изменялась, resolve/reset не использованы. Локально те же25 миграций проходят штатный Prisma deploy+zero drift на3 fresh PG18 DB.

В Preview нет Blob token: upload намеренно disabled, отсутствие доступа — граница изоляции, не PASS загрузки. Telegram/admin/customer bot/chat и WhatsApp/Viber/AI/Maps credentials blank; AI server=false и все DB channels/global OFF. Production analytics IDs blank, внешняя аналитика блокировалась браузером. Deployment Vercel Authentication сохраняется. В source есть2cron definitions, но scheduler исполняет production deployments, **не эти Preview**; private config попытка crons=[] не изменила build-derived definitions, поэтому не заявляем, что definitions отсутствуют. Production config cron5min сохранён отдельно SHA256 в release evidence.

## 18. Cloud и локальные результаты

Первый protected Preview nadvzh9tv: RU/SR/EN/booking-policy PASS, auth503 из-за отсутствия BETTER_AUTH_URL. Ошибка окружения сохранена, не названа PASS. Далее g7cibwox0: actual UI формы3locale PASS, auth/session/login/admin/leads/clients/calendar PASS. Конфиг origin исправлен только для deployment; исходный auth-код уже использует фактический VERCEL_URL в Preview.

На первой фактической API серии6POST (3видa×повтор) созданы3Lead/3outbox; browser серия добавила3syntheticLead. 0Orders/0AIInvocation/0AgentJob, никакого client messaging. Recovery с правильным test CRON_SECRET возвращает200 и агрегаты, без авторизации401/no-store. Но sent=0, pending/errors>0 при отключённом Telegram — это не delivery PASS.

Native Queue пока **не подтверждён**: приложение попыталось публикацию, затем сработал существующий QUEUE_UNAVAILABLE fallback; publishedAt=null, успешный callback не доказан. Локальный дополнительный SDK probe отказался выполняться, потому что официальный env pull выдаёт development OIDC, а цель Preview; environment guard не обходился. Нельзя считать ручной recovery или after() доказательством Queue.

Финальный Preview после Website/voice scope fix: [protected Preview](https://lumaclean-release-candidate-oizippdef.vercel.app). Его окончательный smoke/source identity фиксируется в vercel-pro-release-readiness-2026-11.json; предыдущий PASS не переносится автоматически на новый source.

Локально после scope fix:1049unit PASS/0FAIL/34SKIP;15SSR;40admin/CRM/calendar/routing;15finance;17intake/reliability;7Website recovery. Types/lint/build/Prisma validate PASS, lint2img warnings.9negativeHTTP;7healthy/concurrent recovery checks;4actualDB-down checks (валидный bearer503, неправильный401), повтор после DB restart200.225layouts/75pages,13formgroups,30upholstery layouts,4recap locales,6axe cases PASS с mocked API/external transport. Старые guard fixtures и failed runs сохранены; исправлены test-only env empty/unset и отсутствующий recipient, gates не ослаблялись. Нового масштабного performance аудита нет; исходные Lighthouse медианы раздела6 сохраняют первоначальный scope.

## 19. Source-bound release evidence

Предусмотренный механизм sourceFingerprint/sourceInventory применён через vercel-pro-evidence.mjs с явным allowlist12 application paths, fresh logs и исходным production baseline. Pricing/duration/SEO/AI/schema/migration hashes не менялись. release/ai-go-live.json обновлён как **WEBSITE_MANUAL_AI_OFF**, aiAutoReady=false, verifiedRelease().verified=false. Нет fingerprint mismatch после обновления; это совпадение проверенного source, а не AI certificate. Source fingerprint: 3299f1e5e735dc13e2dd87ff57db4650dac01d56c51fc2bdc7b51cd952453d4a. vercel.json hash закреплён отдельно, поскольку build platform его преобразует. Native/cloud ограничения перечислены явно; productionReady=false.

## 20. Все24moderate зависимости

Свежий npm audit --json:24moderate/0high/0critical, --omit=dev:9moderate. Это24 dependency records одного root advisory [minimatch globparts amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249), не24независимых CVE. Полная per-package классификация: [dependency evidence](vercel-pro-dependencies-2026-11.json).

Runtime graph9: @vercel/queue, exceljs, archiver, archiver-utils, glob, minimatch, readdir-glob, rimraf, zip-stream. Queue SDK minimatch использует repository-controlled function patterns в dev mapping; публичный arbitrary glob в просмотренных callsites не найден. ExcelJS доступен через ADMIN+origin+2MB XLSX+1000ZIPentries/20MB expansion guards; приложение читает workbook, archive-glob export не используется в просмотренном пути. Это анализ достижимости, не доказательство полной неэксплуатируемости transitive code.

Dev-only15: @eslint-community/eslint-utils, @eslint/config-array, @eslint/eslintrc, @next/eslint-plugin-next, @typescript-eslint/eslint-plugin/parser/type-utils/typescript-estree/utils, eslint, eslint-config-next, eslint-plugin-import/jsx-a11y/react, typescript-eslint. Нужны upstream-compatible fixes и отдельная regression. Предложенные audit downgrades Queue0.1.1/ESLint4/config-next0.2.4 не применялись, major override/force fix не выполнялись. Lockfile и зависимости этого scope неизменны.

## 21. Цена Cron5min

288invocations/day;8640за30дней или8928за31день. При текущем iad1 тарифе [Vercel Fluid](https://vercel.com/docs/functions/usage-and-pricing): CPU$0.128/hour, memory$0.0106/GB-hour, invocation$0.60/M. Формула gross до credit: N×0.60/1e6 + CPU_seconds/3600×0.128 + memory_GB_seconds/3600×0.0106. Иллюстрация, **не измеренная котировка**:8640empty ticks по10msCPU/200mslife/2GB≈$0.0184; при20msCPU/1slife≈$0.0622. Cold starts/нагрузка/backlog увеличивают значения; CPU/memory instance pooling требует фактического Usage.

Более существенный риск — Neon: запрос каждые5мин может мешать scale-to-zero. В API suspend_timeout_seconds=0; точное effective provider default не предполагается. При условно постоянном0.25CU получается180CU-hours/30days; это может быть до$19.08наLaunch или$39.96наScale до credits, либо исчерпать Free quota. Это worst-case относительно полностью спящей БД, не обещание такого прироста: production уже активен и другие workload могут держать compute awake. См. [Neon scale-to-zero](https://neon.com/docs/introduction/scale-to-zero) и [plans](https://neon.com/docs/introduction/plans). Подтвердить фактический plan/active hours до approval и сравнить через24ч/7дней. Периодичность/compute/Team budget не менялись в production, новых add-ons нет.

## 22. Точный порядок выпуска и rollback

1. Зафиксировать exact commit этой ветки и fingerprint, повторно проверить lumacleanrs.com→deployment→544da11. Diff только production544da11→Pro; не собирать main22b5818, audit, Sofija или RC source по названию папки. Не запускать migrations/seed в production: schema не меняется и исторические checksum discrepancies не исправляются этим релизом.
2. Проверить final protected Preview на отдельной БД/role, source hashes, auth/forms/idempotency/outbox/recovery. Закрыть native Queue block. Для Telegram сначала отдельные bot/chat, exact recipient proof и явное разрешение максимум3synthetic messages; 0реальных клиентов/звонков.
3. Передать владельцу commit+readiness+cloud evidence+cost assumptions. **Отдельное разрешение A**: staged production build без назначения доменов, CLI --prod --skip-domain (не выполнялся), с production env AI_AGENT_ENABLED=false и тем же config hash. Preview promotion не заменяет проверку production artifact/env.
4. Проверить staged identity/Node24/iad1/headers/auth/read-only public pages/source evidence; не вызывать valid recovery на рабочейБД как read-only smoke. Зафиксировать eligible rollback dpl_3xJJgmzsGJG79fp2Jtsin7fKVEHH и существующий backup/SLA, без копирования PII в тест.
5. **Отдельное разрешение B**: promotion конкретного staged deployment. Проверить alias, GitSHA, manual release profile и enabled Cron definitions, новый5min path и прежнийdaily agent. Только после одобренной тестовой отправки подтверждать Telegram receipt.
6. Rollback при потере/дублировании заявок/отправок, auth/PII regression, неверном source, устойчивых5xx или DB outage: owner-approved Instant Rollback на зафиксированный deployment. [Vercel](https://vercel.com/docs/instant-rollback) восстанавливает cron definitions target, но Disable Cron Jobs flag сохраняется; проверить обе вещи, а не предполагать cron состояние. Запущенные/pinned Queue deliveries могут завершаться отдельно: сохранить rows/leases, не reset attempts/publishedAt/UNKNOWN и не делать массовый retry. Новых schema changes нет; приложение rollback не означает DB rollback. Заявки/уведомления/audit не удалять.

## 23. Наблюдение60мин /24ч /7дней

| Окно | Проверка | Действие/порог |
|---|---|---|
|0–60мин|Сразу после promotion и каждые5мин: HTTP5xx, APIp95/latency, notification oldestPENDING/lease/UNKNOWN, Queue receive/delete/redeliveries, Cron status, database_idle_connection_failed|Любая потеря/дубликат/PII — stop/rollback review; UNKNOWN>0 — ручное расследование, без retry; backlog age>10мин или два ожидаемых тика без успешного Cron — owner alert; p95>2×baseline15мин — расследовать|
|24ч|Сравнить created=true/false и реальный Lead/outbox counts,6языковыхpublic/mobile checks,5xxrate, Queue backlog/terminalstates,≈288cron requests, DBactivehours/connections и Usage|Ручные сохранённые заявки не чистить. Проверить обработку каждого FAILED/UNKNOWN; сопоставить Function/Neon compute с baseline, не месяц Team subtotal|
|7дней|Недельный Cron success ratio/lag, DB connection errors, Queue duplicates/retry caps, Vercel/Neon costs, mobile lab на тех же конфигурациях, CrUX при наличииsamples|Не подменять INP величинойTBT; при cost росте из-за autosuspend предложить cadence/архитектуру отдельно, без автоматического budget/add-on изменения|

У пустой партии приложение сейчас не пишет success console log: для Cron deadman использовать provider request/status logs, а не отсутствие application messages. HTTP200 summary.errors>0 не означает доставку; наблюдать pending/failed/unknown/errors раздельно. Логи новых обработчиков содержат только counters/static event codes, без contacts/IDs/текста/секретов.

### Финальный readback продолжения

Final protected Preview **dpl_6kFF76oAiBYzJQup4cUXwmy8jk1B**, READY, Node24/iad1. **365/365 immutable application/migration inputs и manual release evidence совпали byte-for-byte по deployment file SHA1; differences=[]**.24унаследованных optimized assets совпали SHA256 с production evidence. Финальный cloud smoke PASS_SCOPED:RU/SR/EN, auth/CRM, concurrent GET recovery; synthetic OTHER/voice event остаётся PENDING/attempts0. Всего7syntheticLeads (6Website+1OTHERscope),0Orders/0AIinvocations/0AgentJobs. Native Queue и Telegram остаются BLOCKED, не входят в PASS_SCOPED.

Source-bound mismatch устранён штатным обновлением manual evidence после actual проверок; исходники и release JSON финального Preview совпали. AI_AUTO admission=false сохранён. Повторное production чтение:544da11/dpl_3xJJgmzsGJG79fp2Jtsin7fKVEHH READY; main22b5818, protection off. Staged production/production promotion не выполнялись.

**Итог: BLOCKED**, а не READY FOR PRODUCTION APPROVAL: нужен successful native Queue publish+consumer на RC с правильным Preview OIDC (не development-token), согласованный test recipient и отдельное разрешение до≤3Telegram messages. Оба production этапа требуют раздельного approval после review конкретного commit и стоимости Neon. Exact commit фиксируется в передаче результата; документы/дополнительный release-summary после Preview не меняют его проверенные365immutable inputs.
