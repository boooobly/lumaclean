# LumaClean: технический аудит и релизная готовность — 01.11.2026

**Итог: полный release пока BLOCKED.** Подтверждённые локальные дефекты исправлены в отдельной ветке; production не изменён. Главные незакрытые области: main/release reconciliation, текущий native AI/booking proof, согласование duration/100+/holiday/crypto правил, изоляция remote Preview, live delivery и backup recovery. Этот отчёт не является «100% готово» или разрешением на deploy.

Артефакты: [реестр P0–P3](FINDINGS.md), [readiness](RELEASE_READINESS.md), [инфраструктура](INFRASTRUCTURE_MAP.md), [прайс](PRICING_PARITY.md), [rollout/rollback](RELEASE_PLAN.md), [финальный протокол](evidence/verification.json). Статусы и ограничения каждого теста важнее суммарного числа PASS.

## Baseline и метод

Непосредственное чтение GitHub/Vercel/Neon подтвердило main `22b58184e0fdb0242ec5d2ae9d0e3b8850411fa2`, production `544da114d0a129e9dd9c0f73c047a574af776fd6`, deployment `dpl_3xJJgmzsGJG79fp2Jtsin7fKVEHH`, release branch `codex/public-pages-release-20261027`. Alias lumacleanrs.com обслуживает этот READY deployment, а не main. Production опережает main на 18 коммитов; branch head `574d055` содержит ещё один отчёт/QA commit без изменения опубликованных application inputs.

Published release evidence дополнительно проверено через deployment file tree: SHA1 `release/ai-go-live.json` **ac65a68feb3def17522b7c7fd099dbd743474a84** совпал с опубликованным file ID. Fingerprint baseline `36854a1f22cbc51ed679ab4e50de403d4f7bfd9657e072c69be72f27b3d3de07`, profile WEBSITE_MANUAL_AI_OFF, aiAutoReady=false. Аудит меняет application source, поэтому прежнее evidence намеренно больше не сертифицирует его. Gate не переподписан для вида.

Выбрана копия `upholstery-premium`, новая ветка `codex/full-product-audit-20261101` от `574d055`. До работы были только три чужих untracked SEO артефакта; они не менялись и не входят в audit commits. В `lumaclean-release-candidate` есть большое незавершённое изменение других задач: его не переносили, не откатывали и не выдавали за проверенный production baseline.

Изучены 327 файлов src вне generated Prisma, 32 API routes, 45 Prisma models, 25 migrations, service/domain/agent modules, public/admin компоненты, тесты и release/deferred документы. Машиночитаемая карта всех routes/models/services — `evidence/inventory.json`. Статический просмотр не заменяет динамический тест каждого возможного состояния.

Skills использованы по назначению: systematic-debugging (red → root cause → small fix), verification-before-completion, lumaclean-site-qa и Playwright для выбранной копии/loopback server, React guidelines, SEO/schema/accessibility, точечная корректировка коммерческой оговорки. Для live metadata — GitHub/Vercel/Neon/Google Drive plugins. Настройки/установочные скрипты навыков не расширяли разрешённый scope.

## GitHub / Vercel / CI

Причина drift — последовательные CLI releases из release-ветки, а не незавершённый merge main. История восстановлена от f1972bf (estimate/chat), через SEO/consent/lead delivery и public-page refinements до dependency/security/Node24 выпуска 31 октября. Main release без reconciliation потеряет изменения не только интерфейса, но и Lead/upholstery API, agent burst/recovery, source evidence и security headers/dependencies. Migration SQL не добавлялись в этом диапазоне; schema annotations нужно сохранять.

GitHub main не защищён, required checks отключены. Подготовлен local Quality workflow с pinned actions и Node 24.22.2, без secrets/deploy. Enforcement требует фактического успешного GitHub check и настройки владельцем. Сам workflow не делает live/skip suites зелёными.

PR [#18](https://github.com/boooobly/lumaclean/pull/18): draft, mergeable=false, 2 commits/20 files. Изучены runtime diff contracts/conversation strategy/providers/runner/tools и benchmark отчёт. LLM_FIRST opt-in не доказал выигрыша успешности, увеличил повторы/latency/cost; final-source holdout/native evidence неполны. Не merge, не переключать модель/strategy. Исторические benchmark цифры не являются текущим тестом production.

PR [#31](https://github.com/boooobly/lumaclean/pull/31): draft, mergeable=true, 3 commits/3 files, base main. Quote endpoint имеет bearer/schema/size checks; Lead endpoint Preview-only, consent boolean, deterministic submission hash, transactional duplicate check, общий outbox. Это staging prototype: нет authoritative provider consent/signature verification и полноценного rate-limit/E2E. Exception path может вернуть generic 500 вместо контролируемого unavailable. В prod не переносился; phone assignments/voice quality реального ElevenLabs account не проверены. Сначала устранить readiness/security gaps в отдельной задаче.

Два дополнительных проекта READY, live=false; metadata не даёт Git SHA. Их нельзя считать текущим staging только по имени. Ничего не удалено. Audit branch autodeploy отключён адресно до проверки exact env/recipients. Новый Preview URL не выдаётся за проверенный.

## Сайт, API и заявка

Stack: Next 16.4.3 / React 19.2.4 / TypeScript / next-intl / Prisma 7.10 + pg adapter, CSS/GSAP/media. Проверки выполнены на Node 24.22.2, совпадающем с production major. Установленная документация Next изучена для config env/route behavior; старое описание Next 16.3.8 в корневой памятке не использовано как факт.

Основной intake `/api/lead`: bounded JSON, strict schema/phone/consent/attribution allowlist, server quote, per-source rate limit, submissionId/hash conflict. PostgreSQL advisory lock и одна транзакция сохраняют Lead + extras + durable Notification + audit. API success означает сохранённую заявку, а не подтверждённую Telegram доставку или слот.

Queue publication отделена от transaction; publication failure оставляет outbox и безопасный after/fallback/recovery. Leased worker, event keys и conditional updates защищают concurrent workers; Telegram definite failure/429 отличаются от UNKNOWN после неоднозначного send. Автоматический повтор UNKNOWN не разрешается, чтобы не дублировать сообщения.

Проверены CLEANING, CONTACT_REQUEST, UPHOLSTERY, mixed request, старый upholstery HTTP path, consent, optional name, 400/409/429/503, retry/concurrency. Внешний транспорт в тестах mocked/disabled. Новых production Lead/Order/messages/calls не создавали. Read-only production агрегаты показывали отсутствие overdue/expired leases; это не новый live-proof.

Steam в БД active, но оборудование не подтверждено. Добавлены явная оговорка RU/SR/EN и обязательный humanReviewRequired для Website Lead. AI уже требовал steam review; это сохранено. Upholstery остаётся предварительной enquiry с human review, без автоматической записи и подмены условной цены.

## CRM / календарь / финансы / данные

Система использует один command/service слой, серверную проверку current actor role, optimistic version, advisory locks и audit. Нет добавленной второй CRM/очереди. Существующие tests проверяют admin/cleaner permissions, CSRF, import transaction rollback, concurrent commands, scheduling overlaps/crew, retries и calendar bounds/DST.

При order-update прежний scope сохраняет base/discount snapshot; изменение состава явно пересчитывается. Payout snapshot создаётся при завершении, существующий не переписывается новым тарифом/процентом. Повторяющиеся заказы сохраняют negotiated economics и ограничения, не копируют lifecycle/history. Действующие клиентские цены, audit и snapshots не массово изменялись.

Свежий финансовый прогон сначала воспроизвёл загрязнение общего тестового fixture после CRM suite: 24500 вместо ожидаемого 12000 в агрегате. Старая synthetic БД сохранена, отдельная чистая подготовлена; 15/15 financial checks прошли. Ошибка стенда не объявлена production bug и не скрыта. Аналогично старые AI fixtures не «исправлялись» снятием gates.

На локальных пяти БД replay всех 25 migrations и schema diff — zero drift. Отдельные preservation tests проверяют historical Lead/Order/finance/crew/time snapshots. Remote main: 25 finished migrations, 0 unfinished, только read-only. **Однако независимая проверка checksum выявила 2 неизвестных расхождения из 25**: foundation и ai_agent; одна другая разница объясняется CRLF. Применённые версии первых двух не найдены в fetched Git history. Это LC-21, новый P1: provenance и remote schema parity пока не сертифицированы, checksum rows не менялись. Локальный PG17 не заменяет deployment rehearsal на PG18 Neon.

DurationRule — важный открытый блокер AI: elapsed time в engine и person-minutes в Sheet не согласованы; regular/deep bands и oven 30/60 расходятся/противоречат источнику. Нельзя менять правила production без owner decision и versioned rollout. Неизвестные extras при zero uncertainty reserve корректно запрещают auto scheduling.

## AI: точный текущий режим и границы

Read-only БД: global AUTO, WEBSITE AUTO, Telegram/Viber/WhatsApp OFF, allowed services regular/deep, canary=true. Server flag не раскрывается Vercel sensitive env API. **Владелец прочитал dynamic production CRM hint: AI_AGENT_ENABLED выключен · AUTO. Следовательно effective Website mode сейчас OFF.** Это owner-observed runtime evidence, а не догадка по имени release-файла. После deployment не было AIInvocation; последнее model invocation 23 октября. Само отсутствие вызовов не доказывало OFF, потому и потребовалась проверка hint.

Обнаружена вводящая в заблуждение UI надпись: «AI-ответы включены» была статическим label даже при disabled server. Исправлена на «Режим AI»/«Сохранённый режим».

В старом коде server=true + DB/channel AUTO мог разрешить replies/Lead при manual-only release, хотя финальное бронирование отдельно проверяло readiness. Новый effectiveMode fail-closed при uncertified release применяется к claims, tool access, persistence и outbound checks. Owner kill switch, revision и leases сохранены. Без допуска нет автоматической записи; explicit recap confirmation, verified identity/slots/current price/duration, human review и readiness продолжают проверяться на booking boundary.

Изолированный smoke подтвердил: при OFF нет provider invocation/Order/Lead; исходное сообщение сохраняется. Mocked burst/race suite проверяет supersession, timeout/fallback, lease recovery и takeover. **Полный старый DB agent suite: 8 PASS / 46 FAIL** с каскадом отсутствующих contexts при текущих gates/contracts. Это реальный FAIL набора, не 46 независимых доказанных production exploits. Native providers, actual owner confirmation/live booking и current-source signed proof остаются BLOCKED. AI server flag не включался; owner authorization не заменяет readiness.

Knowledge обновлена из свежих 01–06: 530 entries, source version/hash, crypto +5% и порядок service surcharge/rounding. Обычный crypto FAQ отвечает фактом; явный выбор crypto создаёт PAYMENT_REVIEW без автоматической final-fee/asset/network confirmation. Автоматические holiday/crypto API поля отсутствуют — не объявлены реализованными. Новые alias packages из Sheet не превращаются в auto-enabled services.

## Chat / performance / UX / accessibility

Измерен реальный SQL workload на synthetic PostgreSQL: publicConversation делает 5 queries/snapshot; 40 snapshots ≈200 queries/min при 1500ms, без admission/reconnect overhead. Production browser с подставленной conversation начинает EventSource при закрытом widget во всех RU/SR/EN. Исправление отключает stream/fallback на closed/hidden/offline, а reopen/reconnect получает authoritative history и human control. Постоянный closed-widget polling устранён; открытый idle stream пока остаётся дорогим и требует отдельного adaptive/change-signal этапа.

QA выбранной копии на loopback: 75 страниц × 375/768/1440 =225 layouts, отсутствие horizontal overflow и page/console errors в проверенном объёме. Отдельно проверяются формы/ошибки/retry/языки и чат с intercepted writes. User data не отправляется в production analytics/messengers. Native physical Safari и полноценный screen-reader review не проведены, лабораторный accessibility score их не заменяет.

Performance серии сохранены в `artifacts/audit-20261101/`. Свежие четыре Lighthouse 13.6.0 прогона с видимой consent panel: RU home mobile **88**, desktop **100**; upholstery mobile **89**, desktop **100**; A/BP/SEO **100** во всех. Mobile LCP 3.188/3.629 s, TBT 157/100 ms, CLS 0. Это по одному lab run, без медиан; машина одновременно выполняла другие проверки. Первоначальный CLI browser connection failure сохранён, успешный повтор использовал управляемый Chrome. Это не CrUX/INP и не контролируемый localhost-before/production-after эксперимент. Исторические 95/88 от 31 октября не смешиваются с новыми числами. Сопоставимое before/after доказано для подписки/запросов чата; полного нового LCP optimization цикла не заявляем. [Google различает лабораторные и полевые данные](https://developers.google.com/speed/docs/insights/v5/about).

## Безопасность / SEO / consent

32 routes инвентаризированы по методам/guards. Protected command families используют session/current role и origin/content-type checks; Queue consumers — SDK handleCallback; customer channels — Telegram secret или WhatsApp/Viber HMAC и identity checks. Chat cookie HttpOnly/SameSite/path-scoped, conversation ownership проверяется по hash token. File/media пути используют bounded streams, MIME/размер, URL allowlist и redirect:error; Viber media tickets подписаны/ограничены временем. Отдельная проверка provider account connections/permissions/live receipts не выполнена.

В recovery устранён подтверждённый RangeError на multibyte Authorization: byte length проверяется до timingSafeEqual, ответ 401 без DB. Это исправление устойчивости auth rejection, а не обнаруженный auth bypass.

Production dependency audit: 11 moderate, 0 high/critical; major upgrades не делались. Full fetched refs проверены ограниченным набором high-confidence key/path regex, совпадений нет; неизвестные форматы/удалённые dangling objects не сертифицированы. Secret values/.env/customer data не входят в отчёт или PR.

Public headers включают nosniff, referrer policy, frame/base/object CSP; admin noindex/no-store. Полная script-src CSP пока не доказана — вводить через Report-Only и реальную регрессию, а не слепым запретом. PII retention неполна: linked CRM/messages/attachments требуют owner retention matrix и законного процесса удаления; cleanup закрытых unlinked chats не равен общей privacy policy.

Production SEO read-only: 69 sitemap URL, 19 групп checks, issues=[]. Проверены canonical/hreflang/language coverage, внутренние пути, robots/metadata/structured data в доступном объёме. Search Console index coverage/актуальная индексация, business profile ownership и независимый Rich Results consumer не подтверждены. Наличие Schema.org не обещает Google rich result. Реальные юридические реквизиты/ratings не выдумывались; существующие claims нуждаются в подтверждении владельцем.

## Надёжность инфраструктуры, мониторинг и recovery

Опубликованный cron **существует**: 06:00 UTC ежедневно. Пустой runtime log query не доказывает его отсутствие или успех. Для быстрой восстановления intake crash ежедневного SLA может быть недостаточно; выбирать расписание по действующему плану и business SLA, без автоматического апгрейда. Production drain list пуст; текущий error/fatal scan не обнаружил записей в доступном окне, но не является долговременной гарантией.

Neon main protected=false, при этом Vercel provider наложил delete/rw-endpoint restrictions. PITR history=6h; backup/rehearsal branches существуют, но свежий recovery test реального backup не выполнен. Parent-data test branches могут наследовать PII. Перед remote writes нужны exact endpoint/database/role и sanitized environment; только имя preview не доказывает изоляцию.

Billing API дал полный summary доступного окна 31.10 07:00Z–01.11 07:00Z: effective cost $0.860475 для **всей команды**, не LumaClean-only и не месячный invoice. Neon/AI/routing totals не доступны в этом доказательстве. Нельзя на этой основе обещать месячную стоимость. Минимальный monitoring plan использует existing Vercel observability, read-only public probe, приватные aggregate delivery/job/DB metrics и owner deadman notification; новый платный сервис не добавлен.

## Организационные вопросы владельца

Код не доказывает юридическое оформление и соблюдение законодательства. Владелец с местным бухгалтером/специалистом должен подтвердить:

- зарегистрированного поставщика услуг, реквизиты/PIB и сведения для сайта/договоров; [APR](https://www.apr.gov.rs/registri/preduzetnici.2047.html) — первичный источник регистрационных процедур;
- разрешённые способы оплаты, валютные коммерческие условия, crypto asset/network/fees, необходимые документы/чеки, возвраты и порядок претензий;
- controller/processor роли, цели/основания обработки, privacy/consent, subprocessors и трансграничные передачи, сроки CRM/chat/media хранения, исполнение запросов на доступ/удаление;
- необходимость специальных privacy/DPO процедур по фактическому масштабу и видам обработки; не утверждать обязанность DPO автоматически для малого клининга — [разъяснение Poverenik](https://poverenik.rs/pojasnjenje-i-obaveze-lica-za-zastitu-po/?script=lat);
- условия записи/транскрипции будущих звонков и информирование клиента до подключения voice;
- фактическое оборудование, исполнителей, допустимые работы/поверхности и правила длительности. Steam и химчистка требуют реального operational confirmation.

Это список открытых решений, не заключение о законности/незаконности деятельности.

## Что требуется для завершения

1. Review и согласование конкретных audit PR, затем отдельный baseline reconciliation без неожиданного auto-deploy.
2. Exact staging env identity и synthetic recipients; разрешённый bounded live delivery/native AI proof с бюджетом и cleanup.
3. Owner решения по source conflicts/duration/индивидуальным условиям/holiday/crypto, retention/RPO/RTO и мониторингу.
4. Полный current-source autonomous suite, source-bound evidence, проверенный staged production build и отдельное production rollout approval.

До этого Website AI остаётся OFF, а full release — BLOCKED. Подробные приёмочные тесты для каждого LC-ID находятся в FINDINGS; неразрешённые live операции не выполнялись для получения «зелёного» отчёта.
