# Реестр находок — 01.11.2026

Область: production `544da11`, main `22b5818`, аудит `codex/full-product-audit-20261101`. **FIXED_LOCAL не означает исправление production.** Подтверждённых P0 в исследованной области не найдено; отсутствие находки не доказывает отсутствие всех критических ошибок. Итоги проверок: [readiness](RELEASE_READINESS.md), [протокол](evidence/verification.json).

## LC-01 · P1 · Неверное финальное округление — FIXED_LOCAL

- Файлы: `src/lib/pricing.ts`, `src/lib/upholstery.ts`, `estimate.tsx`, `upholstery-calculator.tsx`.
- Доказательство: до изменения regular 50 м² + linen = 6750 вместо 6800; regular 103 м² + linen + urgent = 13050 вместо 13100. `tests/crm/final-rounding.test.ts` сначала дал 2 FAIL, затем PASS.
- Причина: округление базы 100+ и срочной надбавки отдельно; отсутствие единого ceil итоговой суммы.
- Последствие: меньший и несогласованный итог, отличия сметы от правила RULE-GENERAL-008.
- Исправление: сырая площадь/допработы → 20% → одно округление итога вверх; явная roundingAdjustment в предварительном чеке. Исторические Order/Lead/payout snapshots и production данные не переписывались.
- Приёмка: независимый контрактный oracle, пограничные площади, quantities, срочность, сумма строк чека; ADDON без второго минимума. Действующие индивидуальные условия не округляются задним числом.

## LC-02 · P1 · Runtime AUTO не учитывает uncertified release — FIXED_LOCAL; активация BLOCKED

- Файлы: `src/lib/agent/readiness.ts`, `runner.ts`, `tools.ts`, `inbox.ts`.
- Доказательство: `effectiveMode` до исправления возвращал AUTO при server=true, DB=AUTO, WEBSITE=AUTO, `AI_VERIFIED_RELEASE=false`. Новый `runtime-admission.test.ts` сначала FAIL.
- Причина: release/readiness применялись при owner activation и финальном bookConfirmed, но не во всех путях ответа/Lead.
- Последствие: сохранённый AUTO переживает выпуск manual-only; после включения server flag возможны ответы и AI Lead до сертификации, хотя заказ защищён отдельным gate.
- Исправление: uncertified AUTO становится effective OFF при каждом runtime-check. SHADOW и ручное управление сохраняются.
- Приёмка: true/false/missing release flag, master OFF, mocked race/lease/takeover, isolated no model/Order/Lead при OFF. Полный native/live-booking gate пока не пройден.

## LC-03 · P1 · Main отстаёт от опубликованного кода — OPEN / решение подготовлено

- Доказательство: GitHub main `22b5818`; Vercel alias → deployment `dpl_3xJJgmzsGJG79fp2Jtsin7fKVEHH`, metadata SHA `544da11`; `git rev-list --left-right --count main...544da11` = 0/18.
- Причина: последовательные CLI production releases из release-ветки без обратной синхронизации main.
- Последствие: выпуск main вернёт старые API/chat/security/dependency/public изменения. Это не только визуальные отличия.
- Файлы: полная история в `artifacts/audit-20261101/production-commits.txt`, diff в `production-drift.txt`; затронуты API lead/upholstery, agent runner/tools/inbox, next.config, lockfile и страницы. Новых migration SQL в этом диапазоне нет; schema annotations менялись.
- Решение: отдельный baseline reconciliation PR, затем audit fixes; без cherry-pick дублирования истории. Приёмка: main содержит release ancestry, совпадают application inventory, 25 migration checksums и env requirements; только затем staged rollout.

## LC-04 · P1 · Автономный AI integration suite — FIXED_ISOLATED / native proof отдельно

- Исторический результат 8 PASS / 46 FAIL сохранён в legacy-ai-integration.log. Это 45 дочерних FAIL и FAIL родительского suite, а не 46 отдельных production bugs.
- Причины: source/readiness fixture не проходил настоящие admission gates; каскад отсутствующих claims/slots/orders; устаревшие даты и qualification/owner-resume contracts; неверные expectations handoff/content repair; permission notification channel. Полная привязка каждого старого FAIL: [ai-suite-reconciliation.json](evidence/ai-suite-reconciliation.json).
- Исправлены только tests/agent/integration.test.ts, isolated-readiness.ts и изолированный runner. Production AI gates ради тестов не менялись. Fixture разрешён владельцем, требует opt-in, точные loopback host/port/DB/PG18 directory, пустые Client/Order, запрещает внешнюю сеть и восстанавливает env/fetch.
- Приёмка: **57 PASS / 0 FAIL / 0 SKIP**, PostgreSQL 18.6; реальная БД/транзакции и MOCKED providers. Проверены uncertified source, server OFF, owner confirmation, tampered/stale proof, source change, permissions, kill switch, takeover, concurrency, provider outage, leases и idempotency.
- Синтетическая HMAC fixture не является native/live или production certificate. WEBSITE_AI_AUTO остаётся BLOCKED по независимым gates B.

## LC-05 · P1 · Live delivery нового source не подтверждена — BLOCKED_OWNER

- Файлы: `/api/lead`, `services/website-leads.ts`, `lead-notifications.ts`, `agent/notifications.ts`, `/api/queues/notifications`.
- Доказательство: isolated транзакции/дубликаты/outbox/429/UNKNOWN проходят; production агрегаты при чтении: 35 DELIVERED, 56 INTERNAL, 3 CANCELLED, нет overdue/expired leases. Это историческое состояние, не новый сквозной тест.
- Риск: сбой Queue/Telegram после локально успешного Lead остаётся непроверенным для финального release. Доставка 26 октября не доказывает новый source.
- Решение: согласованный synthetic recipient, изолированная БД, намеренно контролируемые queue/provider ошибки; отдельно разрешённый live-proof. Приёмка: один Lead → один durable event → Queue → worker → receipt → CRM SENT; повтор/timeout не удваивает доставку. UNKNOWN вручную выясняется, не пересылается автоматически.

## LC-06 · P1 · Remote staging DB/Blob/получатели не доказаны — PARTLY_FIXED / BLOCKED_REMOTE

- Новый локальный staging: PostgreSQL 18.6, 127.0.0.1:55449, lumaclean_staging_test, пустой replay 25 миграций и только synthetic records. Старые базы сохранены; production clients не копировались.
- scripts/release-readiness/audit-staging.mjs создаёт отдельные SCRAM runtime/migrator roles без superuser/createDB/createRole/bypassRLS; runtime не имеет DDL или доступа к _prisma_migrations. Другие БД и неверный пароль отвергаются. Сервер не получает migration credential.
- Приёмка: [staging-local.json](evidence/staging-local.json), [staging-smoke.json](evidence/staging-smoke.json): реальный HTTP + app-role DB, RU/SR/EN, auth, два неактивных duration draft, идемпотентная заявка/linen=2/7500 RSD/один PENDING outbox, 0 Orders; server/global/channels AI OFF.
- Remote BLOCKED: точные host/branch/role/deployment, отдельные test bot/chat и Blob store/token permissions ещё не подтверждены. Namespace не является границей прав общего Blob token. Production analytics credentials в local runner очищены, hostname guard дополнительно запрещает их на localhost. Native Blob upload и внешняя отправка не заявлены PASS.
- Приёмка remote: schema-only empty PG18 без parent-data PII, least-privilege role, отдельные получатели/storage credentials, env attestation и bounded smoke после согласования.

## LC-07 · P1 · DurationRule: точка 50 м² подтверждена, широкие диапазоны нет — PARTLY_RESOLVED / B BLOCKED

- Владелец подтвердил 50 м²/обычное загрязнение/без допуслуг/без дороги/два человека: regular 120 elapsed, deep 360 elapsed; oven 45 person-min. Повторного решения по этим значениям не требуется.
- src/components/admin/finance-forms.tsx предлагает только неактивную точку min=max=referenceArea=50, crew=2, 120/360 минут, oven45. SSR проверяет min/max, default и отсутствие активирования. Исторические rules и Order snapshots не переписаны.
- [PRICING_PARITY.md](PRICING_PARITY.md) разделяет исходные person-min, capacity команды, elapsed, последовательные extras и календарные/route буферы. Пропорциональные другие диапазоны — предложения, не факты или активные правила.
- Для B нужны утверждённые интервалы/soil/extras/parallel constraints либо согласованный canary строго 50 м²; versioned prospective DB update и signed proof. Ручной A не должен обещать автоматический слот/длительность; это не самостоятельный blocker A.

## LC-08 · P1 · Условный Steam не маркируется в Website Lead — FIXED_LOCAL

- Доказательство: ServiceExtra steam active=true / 2800; форма позволяла выбрать без отдельной оговорки, `humanReviewRequired` учитывал только upholstery/contact.
- Исправление: сохраняется humanReviewRequired=true для steam, RU/SR/EN показывают согласование оборудования/поверхности. AI activePrice уже запрещал автономное бронирование steam — это существующая защита, а не новая находка обхода.
- Приёмка: isolated saveWebsiteLead + outbox, флаг review, UI; не удалять запрос клиента и не превращать его в подтверждённый слот. Остаток: оборудование владелец должен подтвердить фактически; DB active не равно готовности.

## LC-09 · P2 · Crypto/holiday остаются ручными условиями — MANUAL / feature gap

- Автоматических holiday/calendar/crypto полей в смете нет. Public UI/AI не должны подтверждать окончательный итог, валюту или сеть. Явный выбор crypto ведёт в PAYMENT_REVIEW, неподтверждённые условия — к оператору; нет скрытого автоматического списания или скидки.
- Это P2 для manual A при сохранённом handoff; для B запрещено автоматически бронировать такой запрос до реализации и проверки утверждённого правила. Автономный обычный RSD canary не требует включать crypto/holiday.
- Приёмка: pricing golden tests, knowledge/tools parity и AI negative payment/discount/contamination scenarios; расширение полей только отдельной согласованной задачей.

## LC-10 · P1 → P2 · Граница 100+ подтверждена; комментарий Sheets устарел — RESOLVED_OWNER / source text pending

- Доказательство: DEEP_4=17000, DEEP_5=180/м² → 100 м²=18000 при пояснении «скачка нет»; MOVE_4=18400, MOVE_5=180/м² → 18000. Числа runtime и действующих DB bands совпадают с H-колонкой Sheets.
- Причина: ставки и текст метода расчёта не согласованы. Старые DB bands с другими ценами закрыты validUntil и не являются активным дублем.
- Решение владельца 01.11: **скачок остаётся**, числовые тарифы менять не нужно. Deep 99.99/100/100.01 = 17000/18000/18100 RSD, move = 18400/18000/18100 RSD после финального округления. Закреплено отдельным regression test и owner decision в контракте. P1 решения закрыт; комментарий Sheets «скачка нет» остаётся устаревшим и должен быть исправлен при отдельной редактуре источника. Live Sheet и production не менялись.

## LC-11 · P2 · Closed/hidden SSE исправлен; открытый idle stream дорогой — PARTLY_FIXED

- Файлы: `website-chat.tsx`, `/api/chat/events`, `inbox.publicConversation`.
- Доказательство: browser на production с API mock открывает EventSource уже при закрытом виджете во всех трёх языках; isolated 40 snapshots = 200 SQL queries, 5 на snapshot; интервал 1500 ms ≈200/min плюс admission/reconnect.
- Причина: effect зависел от наличия conversation, не от open/visibility/online.
- Исправление: закрытие/скрытие/offline отключают stream и fallback; reopening/reconnect получает authoritative snapshot. Сообщения не удаляются и handoff восстанавливается. В закрытом состоянии badge узнаёт о новых сообщениях при открытии; постоянных background обновлений больше нет.
- Приёмка: RU/SR/EN subscription/reconnect browser test; локально closed=0 против production closed=1. Открытый idle stream пока сохраняет 1500ms и полные snapshots: дальнейшая адаптация — P2.

## LC-12 · P2 · Recovery существует, но только ежедневно; execution proof отсутствует — OPEN

- Доказательство: **опубликованный** vercel.json содержит `0 6 * * *`, `/api/agent/recover`. Поэтому исходное предположение «cron нет» опровергнуто. Источник и deployment file совпадают. Runtime log query не дал записей; пустая выборка не доказывает, что cron не запускался.
- Риск: crash window после commit/до publish может ждать почти сутки. Source config не доказывает регистрацию, Authorization и успешный вызов scheduler.
- Решение: подтвердить scheduler/config/logs, выбрать SLA и расписание в пределах текущего плана, queue-age/failed/UNKNOWN monitoring. Не менять тариф и не вызывать live recovery без разрешения. Приёмка: isolated crash/recovery + production scheduler receipt без клиентских отправок.

## LC-13 · P2 · Не-ASCII bearer вызывает 500 в recovery — FIXED_LOCAL

- Файл: `src/app/api/agent/recover/route.ts`.
- Воспроизведение: одинаковая JS string length, разная UTF-8 byte length в Authorization → timingSafeEqual бросал RangeError до auth reject.
- Исправление: Buffer.byteLength перед constant-time comparison. `recover-auth.test.ts`: сначала FAIL, затем 401 PASS без обращения к БД. Не является обходом авторизации.

## LC-14 · P1 · Production recovery / RPO / RTO не подтверждены — PARTLY_FIXED / BLOCKED_OWNER

- Main protected:false, но provider запрещает delete/delete-rw-endpoint/move-rw-endpoint для Vercel production branch. PITR history 21600s — срок хранения 6ч, **не гарантированный RPO 6ч**. Owner application role не аттестован.
- Новый scripts/release-readiness/audit-backup-rehearsal.mjs: native PG18 pg_dump custom → новая isolated DB → pg_restore single transaction. Все 46 таблиц (включая metadata) совпали count/full-row hash; 532 schema objects и 25 raw migration checksums совпали; AuditLog immutable trigger реально отклонил UPDATE.
- [backup-rehearsal.json](evidence/backup-rehearsal.json): PASS_LOCAL_SYNTHETIC. Первое сравнение timestamp rendering выявило разные session timezone; исправлен SET TIME ZONE UTC в обеих hash queries, поля не исключались. Неуспешная test DB сохранена.
- Малый synthetic restore за секунды не является production RTO. Production backup не копировали, PII в staging не переносили. Нужны подтверждение владельцем текущего retention/SLA/ответственного и согласованная процедура production recovery в отдельную защищённую цель. Никаких платных настроек не меняли.

## LC-15 · P1 · Required checks main отсутствуют — PREPARED

- GitHub branch API: protected=false, checks enforcement off. В выбранном baseline нет `.github/workflows`.
- Добавлен `Quality / quality`: pinned checkout/setup-node, Node 24.22.2, least-privilege contents:read, validate/lint/unit/typecheck/build/dependency threshold; без production secrets/deploy. CI explicitly не сертифицирует skipped integration/live.
- Приёмка: реальный успешный Actions run, затем owner enforcement на main, запрет force/deletion, обязательный review и проверка нового head. Remote policy не включалась автоматически.

## LC-16 · P2 · Неполные retention/observability/cost evidence — OPEN

- Drains=[]; актуальное окно runtime error/fatal пусто, но постоянного оповещения нет. Attachments cleanup: 24h orphans и default 90d для закрытых unlinked диалогов; связанная CRM/переписка не покрыта общей политикой удаления.
- Billing API вернул фактическое окно 31.10 07:00Z–01.11 07:00Z, effective cost $0.860475 **для всей команды**, а не месячный счёт LumaClean; Neon/routing/AI invoice не подтверждён.
- Решение: monitoring public/API и приватных агрегатов delivery lag/DB/jobs, owner notification destination, retention matrix и месячная разбивка расходов. Приёмка: fault injection в staging с единственным alert и read-only dashboard; без PII в логах.

## LC-17 · P2 · Moderate dependencies и ограниченная CSP — OPEN

- npm audit production graph: 0 high / 0 critical / 11 moderate. Перечень в `evidence/security-summary.json`; high-confidence secret scan по всем загруженным refs не нашёл выбранных паттернов. Это не доказательство отсутствия любых секретов.
- CSP задаёт base-uri/object-src/frame-ancestors, но не полную script-src политику. Major upgrades/несовместимые transitive overrides вслепую не выполнялись.
- Приёмка: рассмотрение каждого достижимого advisory, совместимый patch и regression; строгая CSP сначала Report-Only с проверкой Next/analytics/media. Не ослаблять текущую защиту ради баллов.

## LC-18 · P2 · Performance/physical accessibility/field metrics — OPEN

- Свежая browser/SEO проверка не находит массовой поломки. Исторические LH 95/88 относятся к 31.10. Новая laboratory серия сохраняется отдельно; consent banner не скрывается.
- Остаток: нет доказанных текущих CrUX/INP, не выполнено независимое физическое Safari/screen-reader обследование. Нельзя заменить INP величиной TBT.
- Приёмка: сопоставимый before/after на одинаковом source/профиле; проверка consent/keyboard/focus/zoom, реальный Safari. Отсутствие CrUX samples — INCONCLUSIVE, не плохой INP.

## LC-19 · P2 · Надпись CRM ложно утверждает включение AI — FIXED_LOCAL

- `src/components/admin/inbox-controls.tsx`: label «AI-ответы включены» был безусловным. Владелец сначала принял его за статус; отдельный dynamic hint подтвердил `AI_AGENT_ENABLED выключен · AUTO`.
- Исправлено на «Режим AI» и «Сохранённый режим». Фактический production effective mode — OFF, основание: владелец прочитал серверный hint и проверена его привязка к env в коде.
- Приёмка: enabled=false не утверждает, что ответы включены; owner/master/channel/release gates отображаются отдельно. Production label исправится только после разрешённого rollout.

## LC-20 · P2 · Количества белья / API limits — FIXED_LOCAL; P3 косметика

- src/components/site/estimate.tsx: linen переведён с toggle на число кроватей; все counters ограничены 0..100, plus disabled на100. src/lib/domain/crm-pricing.ts: linen quantity integer0..100, binary extras остаются max1. Тариф750 RSD/кровать сохранён.
- Приёмка: pricing-contract valid0/1/2/100, invalid -1/1.5/101; browser RU/SR/EN actual UI 0/1/2/100, over100 disabled, mocked POST quantity2; staging real HTTP/DB хранит quantity2 и итог7500 без двойного Lead.
- tests/browser/estimate-chat.mjs обновлён под явное linen=1, прежние итоговые21300/25500 сохранены. Публичные 225 layouts и13 сценариев форм проходят с intercepted transport.
- P3 остаются два lint img-warning для локальных chat photo previews; это не утверждение ошибки внешней доставки.

## LC-21 · P1 · Migration checksums — FIXED_LOCAL / 25 из25 raw PASS

- Причина восстановлена: Git нормализовал смешанные окончания строк первоначально применённых SQL. Foundation имеет LF body + final CRLF; ai_agent — CRLF только у последнего внутреннего и конечного separator; coordinate_confirmation — CRLF полностью.
- [migration-original-bytes.json](evidence/migration-original-bytes.json) содержит SHA256 и рецепты. Foundation также совпал raw SHA1 с file UID первоначального Vercel deployment dpl_8F6gkVhByHeK94XffVWxoc3cUPPc. Исторический Git search сам по себе совпадений не дал; source viewer нормализует строки, payload connector усечён и не использовался как raw доказательство.
- Восстановлены только EOL bytes трёх migration.sql, нормализованные SQL команды неизменны. .gitattributes -text сохраняет именно эти bytes. tests/admin/migration-integrity.test.ts и audit-migrations.mjs требуют **точного raw SHA256 всех25**, без LF/CRLF allowance.
- Независимый PG18 replay: zero Prisma drift; read-only production parity45 таблиц и дополнительно532 объектов (477constraints,16enum fingerprints,35functions,4triggers; views/policies0), diff=[]. См. schema-objects-parity.json.
- Процедура reconciliation: restore exact SQL bytes → raw SHA256 → Git index raw SHA256 → fresh PG18 replay/schema parity/backup rehearsal → review. Новой baseline history не требуется. Production _prisma_migrations не изменялась; migrate resolve/reset не применялись.

## LC-22 · P1 · Hosting operational confirmation — BLOCKED_OWNER

- Dashboard требует операционного действия владельца до безопасного релиза. Детали аккаунта и финансов не публикуются в публичном репозитории; владельцу сообщены отдельно.
- Не менялись billing/payment settings, plan, domains или deployment. Приёмка: владелец устраняет предупреждение и подтверждает устойчивую доступность текущего hosting account; затем повторная read-only проверка.

## Открытые находки и независимые gates

**P0: 0 подтверждённых; P1: 7; P2: 7.** Это остаток после local fixes, а не число production-исправлений (production не менялся).

- P1: LC-03,05,06,07,14,15,22. LC-07 относится к B, остальные требуют инфраструктурной/операционной проверки и для A.
- P2: LC-09,10,11,12,16,17,18. LC-10 business-решение принято, остался комментарий Sheets; LC-11 closed/hidden исправлен, open-idle оптимизация отложена.
- LC-20 local P2 закрыт, остаток P3 cosmetic. LC-04 isolated suite и LC-21 bytes закрыты; native certification не скрыта внутри их PASS.
- Общие acceptance/исключения и residual risk: [RELEASE_READINESS.md](RELEASE_READINESS.md). Ни одна открытая P1 не считается автоматически согласованной только потому, что есть план.

## Неверные предварительные подозрения, снятые проверкой

- Cron отсутствует — **опровергнуто**, он есть в опубликованном source; исполнение ещё не доказано.
- Дубли активных price bands — **не подтверждено**: старые bands имеют validUntil, действующих 25 и они совпадают с кодом/Sheets.
- Steam автоматически бронируется AI — **не подтверждено**: activePrice требует review; дефект был в маркировке Website Lead/UI.
- Доставка сейчас зависла — **не подтверждено**: read-only агрегаты не показывали overdue/expired leases; новый live-proof всё равно отсутствует.
- Все finance tests падают из-за приложения — **не подтверждено**: загрязнённый fixture дал неверный aggregate; свежая независимая БД прошла 15/15.
