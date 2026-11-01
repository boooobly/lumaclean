# План выпуска и rollback — 01.11.2026

Этот документ — подготовленная процедура, **не разрешение на production write или rollout**. Production/server AI/домены/DNS/secret values/рабочая БД не менялись. Владелец разрешил включить Website AI, если он выключен; эффективный режим действительно OFF, но технические AUTO gates пока не пройдены.

## 1. Зафиксировать baseline и сохранить историю

1. Непосредственно перед работой перечитать alias lumacleanrs.com → deployment → metadata SHA, GitHub main и release branch. Сейчас это `544da11`, `22b5818`, branch head `574d055` соответственно. Последний — исторический отчёт поверх production inputs.
2. Не выпускать main до reconciliation. Production содержит 18 отсутствующих в main коммитов; release branch содержит ещё один отчёт. Приёмка baseline PR: main содержит ancestry release, нет потери API/chat/security/pricing/контента; все 25 migration SQL checksums сверены.
3. Подготовить отдельный **draft baseline PR** `codex/public-pages-release-20261027 → main`. Не merge автоматически: сначала установить реальную production-branch/auto-assignment политику Vercel, чтобы merge не стал неразрешённым deploy.
4. Audit fixes находятся в `codex/full-product-audit-20261101`, основание `574d055`. Их draft PR целесообразно review относительно release-ветки, после baseline merge retarget на main. Не cherry-pick всей уже опубликованной истории и не включать незавершённую работу других копий.

## 2. CI / защита main

Подготовлен `.github/workflows/quality.yml`, status `Quality / quality`: pinned actions, Node 24.22.2, npm ci, Prisma validate, ESLint, unit, client SSR, Next types/tsc, реальный production build с worker copy/Prisma generate, production dependency audit high threshold. Нет credentials и deploy step.

После первого реального успешного run владелец/администратор применяет branch protection или ruleset:

- main: prohibit force-push и deletion, PR required, минимум один независимый review, dismiss stale approval;
- required status `quality` / exact GitHub check context из фактического run, strict up-to-date head;
- запрет обхода для обычных push; отдельная документированная emergency procedure;
- секреты production только в защищённом production environment с required reviewer, без pull_request_target execution непроверенного кода.

CI с environment SKIP не является полноценным release gate. Для release дополнительно обязательны isolated integration и браузерная матрица, а для AI — dialogue/native/live proof. Remote enforcement пока не применяется автоматически.

## 3. Независимый staging

Перед любым remote test/write зафиксировать **точные** Vercel project/deployment/Git SHA и Neon project/branch/endpoint host/database/role. Sensitive env API сейчас не позволяет подтвердить host. Проверку выполняет владелец в Dashboard либо разрешённый серверный диагностический код, который выводит только нормализованный host/DB/branch, никогда URL/password.

Требования:

- schema-only branch/отдельная пустая БД; synthetic каталог и fixtures, без real PII;
- runtime role без DDL/role management, отдельный migration role; pooled app / direct migration URL;
- отдельные Telegram test recipient/bot и customer identities, AI server OFF, WhatsApp/Viber/Telegram AUTO OFF;
- отдельный Blob namespace и доказанная невозможность читать/удалять production prefix;
- cron и Queue не должны обрабатывать родительские клиентские jobs;
- noindex/SSO, отсутствие индексации preview и отсутствие production analytics events.

Audit branch auto deployment отключён адресно в vercel.json до завершения этих проверок; остальные branches не отключены. Тестовые Vercel/Neon проекты не удалять. Называть READY deployment проверенным Preview нельзя без smoke.

## 4. Данные, тарифы, длительность

Для данного исправления **нет новой schema migration**. Проверки миграций — только локально; production migrations/seed не запускаются при build.

1. Закрыть LC-21: найти исходный SQL двух применённых миграций и согласовать восстановление достоверной истории. Не менять checksums, не выполнять migrate resolve/reset ради зелёного статуса. Проверенные определения 45 таблиц совпадают, но это не объясняет provenance. Решение по границе 100 м² получено: сохранить скачок и numeric bands. Для oven утверждены 45 человеко-минут; при rollout создать новую DurationRule version, сохранив историю. Ещё требуется утвердить базовый elapsed duration по crew/диапазонам, праздник/crypto и существующие индивидуальные скидки. Источник Sheets обновлять отдельно по OWNER_DECISIONS.
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

1. Исправить legacy integration fixtures под текущие contracts; пройти полный negative/booking/race/dialogue suite без ослабления gates. Сейчас 8 PASS / 46 FAIL, каскадные fixture/readiness failures.
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
