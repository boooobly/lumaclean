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

## LC-04 · P1 · Полный AI booking suite не готов — FAIL / BLOCKED

- Доказательство: свежий isolated `tests/agent/integration.test.ts`: **8 PASS / 46 FAIL / 0 SKIP**. Артефакт `legacy-ai-integration.log`. Первый контекст не получает claim при uncertified release; последующие legacy assertions каскадно падают, завершение читает отсутствующий fixture.
- Это не 46 доказанных production-дефектов и не тест внешних моделей. Старые fixture/readiness предположения несовместимы с текущими gates и qualification API. Исторический отчёт также отмечал непроходящий автономный набор.
- Последствие: нельзя доказать безопасную автономную запись по текущему source. Gate не ослаблялся ради PASS; доказательство не переподписано.
- Решение: выделенные synthetic fixtures с актуальными фактами/ownership/consent, source-bound сертификация и native proof на независимом staging. Приёмка: полный набор, negative booking, concurrency, owner takeover, kill switch, provider failures — без skips и gate overrides в приложении.

## LC-05 · P1 · Live delivery нового source не подтверждена — BLOCKED_OWNER

- Файлы: `/api/lead`, `services/website-leads.ts`, `lead-notifications.ts`, `agent/notifications.ts`, `/api/queues/notifications`.
- Доказательство: isolated транзакции/дубликаты/outbox/429/UNKNOWN проходят; production агрегаты при чтении: 35 DELIVERED, 56 INTERNAL, 3 CANCELLED, нет overdue/expired leases. Это историческое состояние, не новый сквозной тест.
- Риск: сбой Queue/Telegram после локально успешного Lead остаётся непроверенным для финального release. Доставка 26 октября не доказывает новый source.
- Решение: согласованный synthetic recipient, изолированная БД, намеренно контролируемые queue/provider ошибки; отдельно разрешённый live-proof. Приёмка: один Lead → один durable event → Queue → worker → receipt → CRM SENT; повтор/timeout не удваивает доставку. UNKNOWN вручную выясняется, не пересылается автоматически.

## LC-06 · P1 · Preview DB/Blob/получатели не полностью доказаны — BLOCKED

- Доказательство: sensitive Vercel DATABASE_URL не возвращается даже при decrypt=true; BLOB_READ_WRITE_TOKEN имеет production/preview/development targets; CHAT_STORAGE_NAMESPACE задан для preview. Neon test branches имеют `init_source=parent-data`.
- Причина: inherited credentials и исторические ветки не являются документированной схемой staging isolation.
- Последствие: риск доступа к рабочим данным/общему storage при ошибке конфигурации. Само наличие общей Blob env записи не доказывает межсредовое удаление: namespace guard существует.
- Решение: подтвердить точные deployment host → Neon branch → database → role; schema-only/sanitized fixtures, отдельные recipients, AI OFF, явный storage namespace. Приёмка: denylist production endpoint, отсутствие PII, write canary только в synthetic БД, namespace boundary tests. Аудит-ветка не запускает автоматический Vercel deployment.

## LC-07 · P1 · Duration rules не соответствуют свежей бизнес-основе — PARTLY_RESOLVED / rollout BLOCKED

- Доказательство: live read-only DurationRule: regular 1–100 м² / 2 исполнителя / 150 минут; deep 40–60 м² / 480 минут. Sheets дают 180 чел.-мин для REG_1 и 480 чел.-мин для DEEP_2, а engine хранит elapsed minutes и не делит на команду. Oven в БД 30 минут; в строке Sheets труд=30, комментарий владельца=60 активных минут.
- Причина: различие единиц person-minutes/elapsed и противоречащие друг другу колонки; нельзя автоматически заменить правила или делить всё на два.
- Последствие: неверная оценка продолжительности/слотов, часть диапазонов не поддерживается. Не все расхождения ведут к недооценке: некоторые консервативны.
- Решение владельца 01.11: духовка **45 человеко-минут на единицу**, вместо противоречащих 30/60. В `appliance-catalog.ts` закреплена норма; CRM предлагает 45 в черновике нового правила/новой версии. Старые записи и snapshots сохраняются. Глобальные elapsed правила по команде и диапазонам ещё требуют согласования; автоматического деления на число клинеров нет. Приёмка: 2 духовки = 90 минут дополнений, старое правило с 30 остаётся читаемым, новая версия не активируется автоматически. Production rules не изменялись.

## LC-08 · P1 · Условный Steam не маркируется в Website Lead — FIXED_LOCAL

- Доказательство: ServiceExtra steam active=true / 2800; форма позволяла выбрать без отдельной оговорки, `humanReviewRequired` учитывал только upholstery/contact.
- Исправление: сохраняется humanReviewRequired=true для steam, RU/SR/EN показывают согласование оборудования/поверхности. AI activePrice уже запрещал автономное бронирование steam — это существующая защита, а не новая находка обхода.
- Приёмка: isolated saveWebsiteLead + outbox, флаг review, UI; не удалять запрос клиента и не превращать его в подтверждённый слот. Остаток: оборудование владелец должен подтвердить фактически; DB active не равно готовности.

## LC-09 · P1 · Crypto/holiday не являются автоматическими полями сметы — PARTLY_FIXED / MANUAL

- Доказательство: RULE-PAY-017/018/022 подтверждают crypto +5% после одной service surcharge 20%; runtime quote имеет urgent boolean, но не payment method/holiday calendar. Старые AI docs отрицали подтверждение crypto.
- Исправлено: актуальная knowledge version 2026-11-01, три правила оплаты и rounding; явный crypto-choice создаёт PAYMENT_REVIEW во всех каналах через существующую policy, обычный FAQ не передаётся человеку. Тест выбора сначала FAIL, затем PASS RU/SR/EN.
- Остаток: автоматическое начисление holiday/crypto не реализовано. Эти суммы требует подтвердить человек с явной причиной price adjustment; нельзя выдать базовый calculator total за окончательную crypto смету.
- Приёмка будущей автоматизации: один 20% при urgent+holiday, затем 5%, один ceil; выбранный asset/network, provenance и финансовый snapshot. Нельзя тестом арифметической формулы объявить PASS отсутствующий API flow.

## LC-10 · P1 → P2 · Граница 100+ подтверждена; комментарий Sheets устарел — RESOLVED_OWNER / source text pending

- Доказательство: DEEP_4=17000, DEEP_5=180/м² → 100 м²=18000 при пояснении «скачка нет»; MOVE_4=18400, MOVE_5=180/м² → 18000. Числа runtime и действующих DB bands совпадают с H-колонкой Sheets.
- Причина: ставки и текст метода расчёта не согласованы. Старые DB bands с другими ценами закрыты validUntil и не являются активным дублем.
- Решение владельца 01.11: **скачок остаётся**, числовые тарифы менять не нужно. Deep 99.99/100/100.01 = 17000/18000/18100 RSD, move = 18400/18000/18100 RSD после финального округления. Закреплено отдельным regression test и owner decision в контракте. P1 решения закрыт; комментарий Sheets «скачка нет» остаётся устаревшим и должен быть исправлен при отдельной редактуре источника. Live Sheet и production не менялись.

## LC-11 · P2 · Closed/hidden widget продолжает SSE polling — FIXED_LOCAL

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

## LC-14 · P1 · Backup/protection/restore не сертифицированы — BLOCKED_OWNER

- Доказательство: main `protected:false`, но есть provider restrictions delete/delete-rw-endpoint/move-rw-endpoint (Vercel production). Поэтому «никакой защиты нет» было бы неверно. history_retention_seconds=21600 (6 часов); backup branches существуют.
- Риск: provider delete restrictions не заменяют роли приложения, PITR/SLA и доказанное восстановление; parent-data previews могут содержать PII. Приложен `neon-protection.json`.
- Решение: подтвердить доступный план/права, RPO/RTO и срок истории; отдельный минимальный runtime role; restore в изолированный branch и сверка checksums/counts. Synthetic migration preservation PASS не равен восстановлению production backup. Не включались платные настройки, защита или миграции.

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

## LC-20 · P2/P3 · Ограничения интерфейса количества и оставшийся долг — OPEN

- `estimate.tsx`, `quantityExtras`: linen по прайсу за кровать, UI toggle выражает только одну; counts могут выйти за API limit=100, запрос затем отвергается. Не менять тариф/единицу ради обхода ограничений.
- Решение: отдельная небольшая UX задача — quantity для белья, согласованный max и local validation, сохранение payload совместимости. Приёмка: 0/1/2/100/101, RU/SR/EN, idempotent retry.
- P3: 2 img-warning для локальных photo-preview; косметику не смешивать с release blockers.

## LC-21 · P1 · Два checksum migration history не соответствуют Git — OPEN / BLOCKED

- Доказательство: read-only `_prisma_migrations` и SHA-256 25 локальных SQL. 22 совпали raw/LF; ещё одна миграция совпала после явного CRLF normalization. `20261001090000_admin_foundation` и `20261001210000_admin_ai_agent` не совпали ни с текущими файлами, ни с найденными историческими версиями всех fetched refs, ни с проверенными BOM/EOL/trailing-newline вариантами.
- Файлы: `evidence/deployed-migrations.json`, `migration-parity.json`, `migration-history.json`; воспроизведение `node scripts/release-readiness/audit-migrations.mjs` возвращает exit 1 и 23/25 совпадений.
- Причина не установлена: возможны применённые до commit SQL или ручное baselining. Read-only comparison 45 таблиц подтвердил совпадение columns/defaults/nullability/precision, indexes и ограничений с independent replay. PG18 NOT NULL catalog entries сопоставлены через column nullability, поскольку local PG17 хранит их иначе. Functions/triggers/enum labels/privileges в этом сравнении не покрыты. Это не доказательство повреждения данных; совпадение исследованной схемы не объясняет remote history.
- Последствие: нельзя сертифицировать воспроизводимость production migration baseline и безопасно считать историю main/DB идентичной.
- Решение: найти точные применённые SQL/initial deploy artifacts, сравнить read-only production schema с independent replay, документировать owner-approved baseline/recovery. **Не изменять checksum rows, не делать migrate resolve/reset/seed ради зелёного статуса.**
- Приёмка: provenance для всех 25 checksums, понятный schema diff и restore rehearsal; только после согласования корректирующая процедура, если она понадобится. Production metadata не менялись.

## Неверные предварительные подозрения, снятые проверкой

- Cron отсутствует — **опровергнуто**, он есть в опубликованном source; исполнение ещё не доказано.
- Дубли активных price bands — **не подтверждено**: старые bands имеют validUntil, действующих 25 и они совпадают с кодом/Sheets.
- Steam автоматически бронируется AI — **не подтверждено**: activePrice требует review; дефект был в маркировке Website Lead/UI.
- Доставка сейчас зависла — **не подтверждено**: read-only агрегаты не показывали overdue/expired leases; новый live-proof всё равно отсутствует.
- Все finance tests падают из-за приложения — **не подтверждено**: загрязнённый fixture дал неверный aggregate; свежая независимая БД прошла 15/15.
