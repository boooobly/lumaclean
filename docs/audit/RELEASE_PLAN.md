# План выпуска и rollback — 01.11.2026

Этот документ — подготовленная процедура, **не разрешение на production write или rollout**. Production/server AI/домены/DNS/secret values/рабочая БД не менялись. Владелец разрешил включить Website AI, если он выключен; эффективный режим действительно OFF, но технические AUTO gates пока не пройдены.

## 1. Зафиксировать baseline и сохранить историю

1. Непосредственно перед работой перечитать alias lumacleanrs.com → deployment → metadata SHA, GitHub main и release branch. Сейчас это `544da11`, `22b5818`, branch head `574d055` соответственно. Последний — исторический отчёт поверх production inputs.
2. Не выпускать main до reconciliation. Production содержит 18 отсутствующих в main коммитов; release branch содержит ещё один отчёт. Приёмка baseline PR: main содержит ancestry release, нет потери API/chat/security/pricing/контента; все 25 migration SQL checksums сверены.
3. Подготовлен [draft PR33](https://github.com/boooobly/lumaclean/pull/33): `codex/production-baseline-sync-20261101 → main`, head7758faa, release ancestry574d055 + один CI/config commit. Quality#3 PASS. Vercel Dashboard подтверждает Git disconnected / Production no branch configuration. Сейчас Git push не вызывает основной production autodeploy; подключение Git/branch отдельно согласовывается. Merge не выполнялся. Сохранять ancestry обычным merge commit, не squash всей release цепочки.
4. Audit fixes находятся в `codex/full-product-audit-20261101`, основание `574d055`. Их draft PR целесообразно review относительно release-ветки, после baseline merge retarget на main. Не cherry-pick всей уже опубликованной истории и не включать незавершённую работу других копий.

Readonly `git merge-tree` выявил ровно один ожидаемый add/add conflict: `.github/workflows/quality.yml`. Приложение/SQL/guard JSON конфликтов не имеют. При owner-approved объединении сохранить audit-версию workflow (quality неизменен, добавлен независимый ai-integration), проверить diff обоих jobs и заново запустить exact-head CI. Никакой merge/index/worktree mutation этой проверкой не выполнялась. Локальная ветка main старее remote main; сравнения выполняются по явному remotely verified22b5818, не по локальному имени main.

## 2. CI / защита main

Подготовлен `.github/workflows/quality.yml`, status `Quality / quality`: pinned actions, Node 24.22.2, npm ci, Prisma validate, ESLint, unit, client SSR, Next types/tsc, реальный production build с worker copy/Prisma generate, production dependency audit high threshold. Нет credentials и deploy step.

Quality PR32#2 и PR33#3 реально PASS. Подготовлен API payload `.github/main-protection.json`, remote enforcement не применялся. Владелец/администратор после review применяет protection/ruleset:

- main: prohibit force-push и deletion, PR required, минимум один независимый review, dismiss stale approval;
- required status `quality` / exact GitHub check context из фактического run, strict up-to-date head;
- запрет обхода для обычных push; отдельная документированная emergency procedure;
- секреты production только в защищённом production environment с required reviewer, без pull_request_target execution непроверенного кода.

Дополнительный ai-integration job использует ephemeral PostgreSQL18.6 и явно opted-in synthetic readiness; отдельный результат не равен native/live proof. Exact check quality обязателен для A; AI job и native acceptance обязательны для B, не подменяют друг друга. Для required independent review нужен доступный reviewer, автор не может одобрить свой PR. CI с environment SKIP не является полноценным release gate. Для release дополнительно обязательны isolated integration и браузерная матрица, а для AI — dialogue/native/live proof. Remote enforcement пока не применяется автоматически.

## 3. Независимый staging

Перед любым remote test/write зафиксировать **точные** Vercel project/deployment/Git SHA и Neon project/branch/endpoint host/database/role. Sensitive env API сейчас не позволяет подтвердить host. Проверку выполняет владелец в Dashboard либо разрешённый серверный диагностический код, который выводит только нормализованный host/DB/branch, никогда URL/password.

Требования:

- schema-only branch/отдельная пустая БД; synthetic каталог и fixtures, без real PII;
- runtime role без DDL/role management, отдельный migration role; pooled app / direct migration URL;
- отдельные Telegram test recipient/bot и customer identities, AI server OFF, WhatsApp/Viber/Telegram AUTO OFF;
- отдельные Blob store/token permissions плюс namespace; namespace сам по себе не запрещает читать/удалять production prefix общим токеном;
- cron и Queue не должны обрабатывать родительские клиентские jobs;
- noindex/SSO, отсутствие индексации preview и отсутствие production analytics events.

Audit и baseline-sync branch auto deployment отключены адресно в vercel.json до завершения проверок; остальные branches не отключены. Локальный least-privilege PG18 staging уже PASS: staging-local.json/staging-smoke.json; remote identity/storage/recipient всё ещё BLOCKED. Тестовые Vercel/Neon проекты не удалять. Называть READY deployment проверенным Preview нельзя без smoke.

## 4. Данные, тарифы, длительность

Для данного исправления **нет новой schema migration**. Проверки миграций — только локально; production migrations/seed не запускаются при build.

1. LC-21 закрыт: восстановлены точные исходные EOL bytes трёх SQL;25/25 raw SHA256 совпадают с read-only applied history. .gitattributes предотвращает повторную нормализацию. Не менять checksum rows и не использовать resolve/reset. Нормализованные SQL команды не менялись;532 schema objects/45table fingerprints равны independent PG18 replay. Полная процедура: original-bytes evidence→raw hashes→Git index hashes→fresh replay→schema parity→synthetic restore. Новая baseline migration не нужна.
2. Получить свежие Sheets 01–06, review компактного контракта и knowledge diff. Не копировать internal economics в публичный репозиторий/промпты.
3. Если owner разрешит исправление DB tariff/duration, dry-run с old/new/version/validFrom; открыть новую version и закрыть прежние bands. Существующие цены/Order/Lead/payout/audit/snapshots не backfill.
4. До применения снять разрешённый backup и выполнить restore rehearsal **в независимую среду**, сверить schema/checksums/record counts и synthetic canary. История Neon сейчас 6 часов; выбрать RPO/RTO и срок хранения по доступному плану без автоматической покупки.

## 5. Матрица приёмки

Локальный runner очищает provider secrets и проверяет loopback/cluster перед fixture changes. Сохранять прежние synthetic базы; finance aggregate suite запускать на чистом fixture, не после CRM tests с остатками.

Обязательны:

- unit/TypeScript/lint/build/Prisma; pricing oracle, quantities, receipt sum, границы, minimum/ADDON;
- real PostgreSQL HTTP auth/roles/CSRF/idempotency; CRM/calendar/financial snapshot/import preservation;
- Lead + Notification в одной транзакции; 400/409/429/503, concurrent retry, Queue crash, stale lease, Telegram 429/UNKNOWN с контролируемым transport;
- RU/SR/EN × 375/768/1440, все направления language switch, ordinary/contact/upholstery/mixed forms, offline/timeout/double click;
- closed/hidden/offline chat, reopen/reconnect с authoritative history/handoff, takeover/OFF races;
- accessibility/SEO/security headers, реальный consent banner; отдельный сопоставимый lab performance и честный CrUX status.

Нативные/платные API и любые внешние отправки пока BLOCKED. Протокол для отдельного owner approval: synthetic test destination, максимум запросов/стоимости, точный branch/DB, перечень сообщений, критерий успеха/cleanup, запрет реальных контактов. Один успешный notification proof не сертифицирует AI booking и наоборот.

## 6. Website AI: включение после устранения блокеров

Current effective OFF: owner прочитал «Серверный AI_AGENT_ENABLED выключен · AUTO». Одной смены server flag недостаточно. Existing source с `aiAutoReady=false` не имеет права на AUTO.

1. Legacy fixtures исправлены:57/57 PASS на PG18/controlled providers; genuine negative gates сохранены. Исторические8PASS/46FAIL остаются в отдельном логе. Синтетическая fixture разрешена владельцем исключительно loopback и не является production сертификатом.
2. Проверить primary/fallback native tools, malformed output/timeout/failover/cost limits в согласованном бюджете на staging. Не запускать live benchmarks автоматически.
3. Подтвердить owner-approved duration/scope/crew, pricing parity и manual-only special/payment scenarios. Сначала только реализованные regular/deep; upholstery/steam/праздник/crypto — review.
4. Выполнить signed Preview booking proof на том же source/config, synthetic records, проверяемый cleanup. Свежая диагностика <1 часа, live proof <7 суток и совпадающая конфигурация; release fingerprint должен совпасть.
5. Сертификацию формировать из фактических PASS результатов; `aiAutoReady=false` нельзя просто заменить на true. Текущий audit evidence не переподписывает AI release.
6. В контролируемом canary включить только WEBSITE. Customer channel AI остаются OFF; ручной takeover и kill switch проверить. Разрешение владельца на включение уже есть, повторное формальное разрешение не требуется, если scope/расход/технические предпосылки не меняются. Однако разрешения на реальные сообщения клиентам и платные тесты не было.

## 7. Production rollout — только после отдельного разрешения

Владелец рассматривает конкретные PR head SHA, текущий readiness, результаты staging и открытые findings. После approval:

1. Зафиксировать исправный rollback deployment и DB restore point. Предыдущий baseline `dpl_3xJJgmzsGJG79fp2Jtsin7fKVEHH` сейчас READY; старый резерв из исторического отчёта не считать проверенным без нового чтения.
2. Если schema changes появятся отдельно — expand/contract и обратная совместимость, direct migration, отдельное подтверждение; их нет в текущем patch.
3. Собрать **staged production** с production env и без назначения доменов; Preview build не равен production build. Smoke не должен создавать реальные заказы/клиентские сообщения.
4. Продвигать ровно проверенный staged build; verify alias/commit/fingerprint/security/SEO/readonly public/API/auth. Локальный PASS не означает, что production env корректен.
5. Контролировать доступность/5xx, oldest pending notification/job, UNKNOWN, model failures/cost, DB connections и lease age. Не логировать тексты/телефоны/token URLs.

## 8. Rollback

Триггеры: потеря заявок, повторные sends/orders, неправильные цены, auth/PII regression, массовые 5xx, недостоверные AI подтверждения. При AI проблеме сначала owner emergency OFF/SHADOW по установленной процедуре; сохранить исходные Message/Lead/outbox/audit, не удалять evidence.

Application rollback — на заранее проверенный deployment после owner approval; проверить фактический alias и Git SHA. Это не DB rollback. Не делать down-migration, seed, массовое исправление клиентских цен или retry UNKNOWN. При повреждении данных восстанавливать в отдельную ветку, сравнивать и принимать адресный recovery plan с владельцем. Изменение production auto-assignment после rollback требует отдельной проверки.

## 9. Минимальное наблюдение без нового платного сервиса

Подготовлен manual `monitor-readonly.mjs`: GET RU/SR/EN, booking-policy, robots, sitemap; status/latency без cookie/PII. Он не проверяет Telegram receipt и не включает recovery. Периодический запуск и уведомления включать после выбора владельцем расписания/получателя.

Использовать имеющиеся Vercel logs/alerts и защищённые агрегаты БД: overdue PENDING/SENDING, UNKNOWN count, failed jobs, DB availability, queue lag, model failures, daily spend. Deadman для cron нужен отдельно от проверки наличия vercel.json. Drains необязательны, но без внешнего хранения ограничено окно расследования. До подключения нового сервиса выяснить retention/стоимость текущего плана. Billing summary API дал только окно одних суток для всей команды — не выдавать его за месячную смету LumaClean.

## 10. Внешние проверки — отдельное согласование до запуска

Ничего из таблицы не запускалось. Тестовая БД должна быть пустой PG18, получатель отдельным synthetic test chat, storage отдельно разрешённым. При ошибке identity/budget/recipient — остановка, никаких retry UNKNOWN. Клиентам не писать.

| Шаг | Цель и точный лимит первого прогона | Стоимость / риск / условие |
|---|---|---|
| A: native Queue→Telegram |3 разных synthetic intake (cleaning/contact/upholstery), по1 duplicate: **6POST /3uniqueLead /3outbox /не более3Queue publishes /не более3Telegram sendMessage attempts**. Между отправками сверить eventKey/status; дополнительные worker retries при429 запрещены в этом bounded proof, отдельный controlled transport тест уже PASS | Telegram API обычно не тарифицирует обычные сообщения; hosting/Queue/DB оплачиваются по аккаунту. Текущая marginal цена не подтверждена. Предлагаемый общий жёсткий бюджет≤$1 после проверки тарифов; это потолок, не котировка. Риск ошибочного recipient снимается отдельным bot/chat; заявки только synthetic staging |
| B: native diagnostics | **1diagnostics invocation**: primary1LLM POST + fallback1LLM POST + Places autocomplete1request + GoogleRoutes matrix1request при выбранном Google provider. Другой routing provider требует нового точного плана; не переключать production |2LLM+2Maps billable requests, без messages/orders. Цена зависит от утверждённых provider/model/SKU; достоверной суммы сейчас нет. До разрешения предъявить model IDs/current price и token ceiling. Предлагаемый total cap≤$1; timeout не ретраить автоматически |
| B: signed booking proof |1синтетический booking+verified cleanup на **том же source/config**. Сейчас **BLOCKED, не предлагается к исполнению**: сначала измерить точное число Places/route matrix requests на зафиксированных50м²/crew fixtures и составить счётчик/budget; текущий planner зависит от числа slots/cleaners | Native LLM/Maps могут тарифицироваться. Нельзя обещать фиксированное количество/цену до dry-run плана; один book не равен одному внешнему запросу. ctx.previewTestId должен подавлять реальные notifications;1syntheticClient/Lead/Order, cleanup обязан доказать сохранность чужих records |

По A нужны test bot/chat и разрешение максимум3внешних сообщений. По B сначала provider/models/rates и отдельное разрешение расходов; live booking запросить только после готового bounded счётчика, не по общему разрешению на AI. Production writes и клиентские сообщения не разрешены этой таблицей.

## 11. Независимый порядок выпуска

A: закрыть hosting operational confirmation/LC22 → подтвердить remote synthetic identity/storage/recipient → bounded live delivery → подтвердить recovery SLA/cron receipt → включить main protection с независимым reviewer → review/merge PR33 с сохранением ancestry → retarget PR32 наmain → CI exacthead + safe Preview smoke → owner approval staged production/promotion. **Native AI/duration broad bands не добавлять в блокеры A** при manualAIoff и отсутствии automatic promises.

B: послеA подтвердить prospective versioned DurationRule (либо согласованный50м²canary), native diagnostics, bounded signed proof и source-bound certification, затем контролируемое WEBSITE-only включение. Исторические финансовые snapshots/длительности не backfill. Владелец уже дал elapsed120/360 и oven45 — повторно их не спрашивать.
