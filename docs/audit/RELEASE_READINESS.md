# Release readiness — 01.11.2026, продолжение

**A WEBSITE_MANUAL_AI_OFF: BLOCKED для выпуска. B WEBSITE_AI_AUTO: BLOCKED отдельно.** Подтверждённых P0:0; открытых P1:7, P2:7 после local fixes. Production не менялся. [Реестр](FINDINGS.md), [протокол](evidence/verification.json).

PASS относится только к указанной среде. ISOLATED — реальные PostgreSQL/HTTP с synthetic данными; MOCKED — внешний provider/transport заменён. SKIP/BLOCKED/INCONCLUSIVE не входят в PASS. Исторические провалы сохранены отдельно.

## Проверенная основа

| Проверка | Результат / граница |
|---|---|
| Baseline | main22b5818; production544da11 / dpl_3xJJgmzsGJG79fp2Jtsin7fKVEHH; release574d055 |
| Node / Next / React |24.22.2 /16.4.3 /19.2.4 |
| Unit regression | **1057 PASS /0 FAIL /34 SKIP**; environment suites запускаются отдельно |
| Client SSR | **16/16 PASS**, inactive duration draft/oven45/point50 |
| Types / ESLint / build / Prisma validate | PASS local; lint0 errors/2 существующих img warnings |
| Pricing / knowledge / quantities | PASS local: oracle760 комбинаций плюс area/boundary tests; final ceil100 один раз; linen integer0..100 RU/SR/EN. Crypto/holiday manual |
| Raw migration history | **25/25 PASS**, точный SHA256, без normalization allowance; исходные mixed EOL восстановлены, metadata/reset/resolve не менялись |
| PG18 replay / schema |25 migrations на5 fresh DB/zero drift;45table fingerprints и532schema objects равны read-only production |
| Admin/CRM/calendar/routing +3 preservation migrations | **43 PASS /0 FAIL /2 SKIP** (AI migration/ChatV2 требуют отдельного env). Clock-dependent urgent fixture исправлен, cutoff gate сохранён |
| Отдельные миграции / bootstrap | AI migration1/1, reliability migration1/1, first-admin bootstrap1/1 PASS PG18. ChatV2 native-Neon migration BLOCKED, guard не обходили |
| Finance | **15/15 PASS**, fresh synthetic DB, предыдущие fixtures сохранены |
| Reliability/intake/contact/upholstery/recovery | **18/18 PASS**, actual HTTP/PG18, controlled delivery transport;400/429/UNKNOWN/leases/idempotency/recovery |
| Chat HTTP | **14/14 PASS** PG18, server AI OFF |
| AI integration | **57/57 PASS ISOLATED/MOCKED**; [46 historical FAIL→причины](evidence/ai-suite-reconciliation.json), production gates не ослаблялись |
| Browser RU/SR/EN |75pages×3widths=225layouts PASS; формы13groups/21viewports; quantities0/1/2/100 PASS. API/external writes intercepted |
| Chat subscription | closed0/open1 streams, hidden/offline pause/reconnect restores history PASS MOCKED. Измерено5 SQLqueries/snapshot; открытый idle всё ещё≈200/min |
| Local staging | PostgreSQL18.6/lumaclean_staging_test; отдельные SCRAM runtime+migrator; noDDL/no metadata/cross-DB denied. Real HTTP auth/forms/drafts,1Lead/1pending outbox/0Orders, AI OFF |
| Backup restore | PASS_LOCAL_SYNTHETIC: native pg_dump→pg_restore,46tables full-row hashes,532objects,25checksums, immutable audit. Не production RPO/RTO |
| Dependency / secrets | Предыдущий audit0high/critical,11moderate; limited pattern scan без secrets, не forensic guarantee |
| SEO / performance | Исторический read-only SEO69URLs/19groups PASS ограниченный; LH home88/100,upholstery89/100 mobile/desktop — lab. CrUX/INP INCONCLUSIVE; physical Safari/screenreader NOT RUN |

## Gate A — WEBSITE_MANUAL_AI_OFF

| Критерий | Статус | Что осталось |
|---|---|---|
| Сайт/формы/прайс/CRM/ручной чат | PASS local | Remote smoke на том же source |
| AI гарантированно OFF | PASS local / production owner hint OFF | Release serverflag=false; uncertified AUTO→effectiveOFF; DB AUTO не активировать |
| Сохранить опубликованную историю | PREPARED, merge BLOCKED | [Draft PR33](https://github.com/boooobly/lumaclean/pull/33), Quality#3 PASS; main ещё старый |
| Required checks / защита main | PREPARED, не enforced | .github/main-protection.json; exact context quality; независимый reviewer; без потери merge ancestry |
| Remote staging identity/storage/recipient | BLOCKED | Точные host/branch/DB/role/deployment, отдельные Blob store/token и test bot/chat. Namespace не ограничивает права общего token |
| Новый Queue→Telegram live proof | BLOCKED | Отдельное разрешение bounded synthetic сообщений; доставка26.10 не proof нового source |
| Recovery Cron | PARTIAL | Dashboard enabled/0 6 * * * UTC; local HTTP recovery PASS, external execution/SLA не доказаны |
| Recovery capability / owner SLA | PARTIAL / BLOCKED_OWNER | Synthetic restore PASS; подтвердить retention/RPO/RTO/ответственного.6h retention не равно RPO |
| Hosting operational confirmation | BLOCKED_OWNER | LC-22: действие владельца по account warning; детали переданы приватно, billing/plan не менялись |
| Rollout/rollback | PREPARED | Owner approval на конкретные SHA/deployment; staged production без domain promotion, затем controlled promotion |

Блокировки B не используются, чтобы автоматически задерживать A. Native AI, signed booking proof и автоматические длительности не нужны ручному A при отсутствии автоматических обещаний/записи. Открытые инфраструктурные P1 A не считаются согласованными из-за наличия плана.

## Gate B — WEBSITE_AI_AUTO

| Дополнительный критерий | Статус | Граница |
|---|---|---|
| Весь Gate A | BLOCKED | Безопасная инфраструктура обязательна |
| Autonomous suite / negative gates | PASS ISOLATED/MOCKED |57/57: uncertified source/serverOFF/owner/proof/permissions/kill switch/races, не native proof |
| DurationRule / crew / calendar | PARTIAL | Owner50м²/2человека/normal/noextras: regular120/deep360 elapsed,oven45person-min. Draft min=max50 не активен; другие bands/soil/parallel extras не утверждены. Либо согласовать диапазоны, либо отдельный point50canary |
| Native providers / tools / places / routes | BLOCKED | Diagnostics25.10 устарели; требуется согласованный budget/env; paid calls не делали |
| Signed source-bound booking proof | BLOCKED | Настоящий isolated Preview proof+cleanup+config fingerprint, diagnostics<1h/proof<7days, не synthetic HMAC |
| Certified source release | BLOCKED | aiAutoReady=false сохранён; нельзя переписать true или просто включить env |
| Canary / ручное управление | PREPARED | Только WEBSITE после gates; messenger AI OFF; owner confirmation/takeover/kill switch |

Владелец уже разрешил synthetic readiness только loopback и подтвердил oven45, скачок100м², elapsed120/360 на50м². Эти вопросы повторно не задаются. Production Order, сообщения клиентам, звонки, AI activation и deployment не выполнялись.

## GitHub и внешние проверки

[PR32](https://github.com/boooobly/lumaclean/pull/32) — исправления; [PR33](https://github.com/boooobly/lumaclean/pull/33) — baseline sync. Предыдущий опубликованный PR32: [Quality#2 PASS](https://github.com/boooobly/lumaclean/actions/runs/41327934603). PR33: [Quality#3 PASS](https://github.com/boooobly/lumaclean/actions/runs/41333250402). Новый head/CI фиксируется в evidence/ci-current.json после публикации; старый PASS не сертифицирует новый head.

Vercel Git disconnected, production branch отсутствует. Адресный git.deploymentEnabled=false для audit/baseline branches сохранён на случай подключения Git. Новых проверенных Preview deployments нет. [RELEASE_PLAN](RELEASE_PLAN.md) содержит порядок и bounded внешние проверки до разрешения.
