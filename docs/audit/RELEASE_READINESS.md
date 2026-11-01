# Release readiness — 01.11.2026

**Полный production-релиз: BLOCKED. AI AUTO: BLOCKED.** Исправления подготовлены в audit-ветке; в production не опубликованы. Сохранённые AUTO в БД и название переключателя не являются доказательством работающего/готового AI.

Статусы: PASS — выполненная проверка в указанной среде; MOCKED — заменён внешний транспорт/браузерный API; FAIL — воспроизведённое отклонение; BLOCKED — нужен доступ, решение или разрешённый внешний тест; NOT RUN — проверка не запускалась. Unit skips не входят в PASS.

| Gate | Статус | Доказательство / граница |
|---|---|---|
| Фактический production baseline | PASS | Vercel alias/deployment `dpl_3xJJgmzsGJG79fp2Jtsin7fKVEHH`, SHA `544da11`; main `22b5818` |
| Согласованность main и production | FAIL | Production на 18 коммитов впереди; merge не выполнен |
| Безопасная локальная ветка | PASS | `codex/full-product-audit-20261101` от `574d055`; чужие изменения сохранены |
| Node / Next / React | PASS | Проверки на Node 24.22.2; Next 16.4.3, React 19.2.4 |
| Unit / regression | PASS с SKIP | 1053 PASS / 0 FAIL / 33 environment SKIP; окончательный протокол в `evidence/verification.json` |
| Client SSR | PASS | 15/15; CSS/navigation substitutes только внутри тестового SSR процесса |
| ESLint | PASS с предупреждениями | 0 errors; 2 существующих предупреждения локальных preview img чата |
| TypeScript / build / Prisma validate | PASS | Логи `artifacts/audit-20261101/`; финальный протокол фиксирует повтор после последних правок |
| Replay миграций / Prisma schema | PASS isolated | 25 миграций на пяти loopback БД, zero drift; production read-only: 25 finished, 0 unfinished |
| Production migration history parity | FAIL / BLOCKED | 23/25 совпадений с учётом CRLF; foundation и ai_agent checksum не найдены в Git. LC-21; production metadata не исправлялись |
| Admin / CRM / scheduling / routing | PASS isolated | 40 проверок; реальные PostgreSQL и HTTP, внешние routing/providers не сертифицированы |
| Финансы / snapshots / импорт | PASS isolated | 15 проверок на свежей БД; первый прогон на загрязнённом общем fixture упал и сохранён отдельно |
| Intake / outbox / CONTACT_REQUEST / upholstery | PASS isolated + MOCKED | Финальный объединённый прогон 17/17; транспорт доставки контролируемый |
| Химчистка HTTP / сохранность миграций | PASS isolated | 2 проверки; Lead/outbox, concurrent retry, старые snapshots |
| Chat HTTP / auth / CSRF | PASS isolated | 14 проверок; server AI выключен, внешняя доставка отключена |
| Старый автономный AI integration suite | FAIL | `legacy-ai-integration.log`: несовместимые fixtures/readiness; не подменён ручной установкой release gate |
| Округление и core price parity | PASS local | `final-rounding`, `pricing-contract`, domain tests; 25 bands и 14 extras |
| Праздник / crypto в автоматическом расчёте | BLOCKED / manual | Автоматических полей/праздничного календаря нет. Условия и итог согласует команда; crypto-choice открывает review |
| Условные услуги | PASS local / production pending | Steam сохраняет humanReviewRequired; upholstery autoBook=false; в production steam всё ещё active |
| RU/SR/EN, mobile/desktop | PASS MOCKED | 75 страниц × 375/768/1440 = 225 проверок, 0 page/console errors; отдельные формы и reconnect |
| Production SEO read-only | PASS ограниченный | 69 sitemap URL, 19 групп проверок, issues=[]; Search Console фактическая индексация не подтверждена |
| SSE closed/hidden/reconnect | PASS MOCKED + isolated measurement | Production closed-widget подписывается; локально нет подписки. 5 queries/snapshot, около 200/min для открытого чата |
| Lighthouse production lab | PASS как измерение, OPEN performance | 4 run: home 88/100, upholstery 89/100 mobile/desktop; A/BP/SEO 100. По одному прогону, consent panel видима; это не before/after улучшение |
| Core Web Vitals / CrUX | INCONCLUSIVE | Лабораторный Lighthouse не является полевым INP; свежие полевые samples не получены |
| Dependencies | PASS по high/critical, OPEN P2 | 0 high / 0 critical / 11 moderate; без major upgrades |
| История секретов | PASS ограниченный | По выбранным regex/path-паттернам совпадений нет; это не полная forensic-проверка |
| Live Website → Queue → Telegram | BLOCKED | Новых реальных заявок/сообщений не создавали; нужен согласованный synthetic recipient и отдельное разрешение |
| Effective production AI | PASS: установлен OFF | Owner прочитал dynamic server hint: AI_AGENT_ENABLED выключен · AUTO. Код подтверждает связь hint с server env; `evidence/effective-ai.json` |
| Native providers / live booking proof | BLOCKED | Диагностика 25.10 устарела; финальная сборка не сертифицирована для AUTO; платные вызовы не запускались |
| Preview isolation / remote smoke | BLOCKED | Sensitive DATABASE_URL не раскрывается API; нельзя доказать точные host/branch/DB и безопасных получателей |
| Backup / restore | BLOCKED для production recovery | Neon retention 6 часов; synthetic migrations проверены, восстановление рабочего backup не подтверждено |
| Main required checks / protected branch | PREPARED | Локальный Quality workflow; remote enforcement не включён |
| Rollout / rollback | PREPARED | Порядок в RELEASE_PLAN; production не выпускался |

Разрешение владельца на включение Website AI получено в этом чате. Оно **не снимает** обязательные технические gates и запрет подменять BLOCKED/PASS. Для включения нужны точный runtime flag, исправленный и проверенный source, независимый staging, native proof, согласованные duration/payment/holiday правила и явная процедура включения только WEBSITE.

Финальный источник результатов текущего запуска: [verification.json](evidence/verification.json). Исторический отчёт `docs/production-release-2026-10-31.md` нельзя использовать вместо свежего live-proof.
