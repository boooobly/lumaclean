# LumaClean: AI-first experiment, 14 October 2026

**Рекомендация: оставить Luna и HYBRID. Эксперимент не доказал улучшения завершения консультаций; AI-first увеличивает число вызовов, стоимость и задержку. PR #18 остаётся draft, production не менялся.**

| Конфигурация | Успех / planned | INCONCL | Facts, paired | Повторы | Неверные tools | Hard/soft | Booking violations | p50/p95, с | Avg tokens/диалог | $/completed | Invocation errors |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A Luna / HYBRID | 11/32 | 2 | 78/100 (78.0%) | 8 | 43 | 1/12 | 0 | 15.6/24.3 | 25650 | 0.005279 | 1 |
| B Haiku / HYBRID | 9/32 | 2 | 78/100 (78.0%) | 6 | 27 | 1/11 | 0 | 16.4/24.8 | 42464 | 0.006682 | 1 |
| C Luna / LLM_FIRST | 10/32 | 4 | 78/100 (78.0%) | 11 | 90 | 2/12 | 0 | 21.6/38.4 | 77431 | 0.009684 | 3 |
| D Haiku / LLM_FIRST | 10/32 | 3 | 78/100 (78.0%) | 17 | 110 | 2/12 | 0 | 23.5/43.3 | 149401 | 0.013636 | 2 |

Planned N=32 на конфигурацию; запущен31 сценарий,124 owned fixtures очищены. Для сравнения фактов, повторов, tools, latency и tokens использованы только 28 одинаковых сценариев, завершённых во всех четырёх конфигурациях. Успехи/INCONCL показывают весь planned набор; 4 незапущенные конфигурации последнего сценария — INCONCLUSIVE. Hard/soft — число диалогов, а не повторное суммирование review на каждом ходе. Ошибки вызовов включают серверные отказы/unknown causes: ранний harness не сохранил errorCode, поэтому их нельзя честно приписать OpenRouter. Коды теперь сохраняются. Последующая read-only проверка daily guard не подтверждает исчерпание дневного лимита.

Неверные tools: schema/provenance/known-fact/forbidden-tool отказы; корректные NO_SLOTS/NO_DURATION_RULE не объявлены ошибкой выбора. Повторы: одинаковый повторный вопрос/clarification и backend known-fact detector; это нижняя граница семантических повторов. Latency — полный локальный runner против remote Preview DB, с concurrency4; не production HTTP SLA. Tokens включают reasoning один раз. Стоимость взята из actual usage.cost с cache reads/writes; $/completed — средняя для действительно успешных сценариев, затраты неуспешных сценариев отдельно в manifest. Ноль созданных Orders в консультационном corpus — запретный сценарий, а не доказательство автономного booking.

| Конфигурация | Blind paired N | Naturalness /4 | Relevance /4 | Useful /4 | No extra questions /4 | SR naturalness /4 | Female/neutral /4 |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 19 | 1.32 | 1.05 | 1.05 | 1.21 | 1.00 | 3.58 |
| B | 19 | 1.26 | 1.21 | 1.00 | 1.11 | 1.20 | 3.84 |
| C | 19 | 2.00 | 2.00 | 1.84 | 1.68 | 1.50 | 3.68 |
| D | 19 | 2.00 | 1.79 | 1.74 | 1.79 | 1.30 | 3.58 |

Независимый judge: google/gemini-3.8-flash-20260902, только анонимные тексты, фиксированный rubric0–4, без названий кандидатов и без права оценивать деньги/booking. 100/112 оценок прошли schema/ID validation; 12 — INCONCLUSIVE. Таблица использует 19 сценариев с оценками всех четырёх кандидатов. Стоимость пригодного judge-прогона $0.154342; первый прогон $0.170784 исключён из сравнений из-за потери mapping при подготовке human sample. Mapping теперь сохраняется в результате и подготовка human sample не перезаписывает его. Владелец делегировал текстовый выбор; B выбран за краткость и отсутствие анкеты, независимого human голоса нет. Это не разрешение менять production.

**Baseline.** На main-after17, в малой Preview-выборке: {"deterministic-only":13,"LLM-generated":0,"deterministic quote + LLM response":0,"fallback/recovery":2,"handoff":0}, 15 клиентских ответов. Полностью deterministic-only: 86.7%; ещё 2 recovery-ответа. Без единого model call прошли 7/15 ходов (46.7%); на остальных 8 ходах было 17 вызовов. Участие модели в решении не гарантирует её участие в клиентской формулировке: extraction/native decision может закончиться серверным шаблоном. Не переносить процент на весь production: историческая telemetry не фиксировала composition origin. Текущие HYBRID replay origins и все model calls есть в manifest.

**Архитектура.** LLM_FIRST передаёт natural-text turn существующему bounded native loop, объединяя понимание/предложения фактов и выбор шага; отдельного extraction call и pre-model FAQ/intake shortcut нет. Natural qualification question может быть частью того же native решения. Сервер проверяет provenance, факты, вопрос и все бизнес-операции. Confirmation/scope/slots/booking сохраняют точную серверную формулировку. HYBRID/default native wire, CRM, jobs, цены, outbox, audit, channel permissions и rollback через flag сохранены. Подробности: agent-llm-first-protocol.md.

**Где bottleneck.** На естественных RU/SR отрицаниях и soil-формулировках обе модели упираются в source validation/confirmation. Модель может понять смысл, но предложение не становится confirmed fact; повторяется clarification. Смена модели этот барьер не устраняет. Коррекции/rapid/resume также показывают лишние/повторные tool предложения. All-tools context большой; Haiku токенизирует тот же контракт объёмнее и использует больше reasoning. Цена/календарь при этом остаются серверными — безопасность не ослаблялась ради score.

**Модели.** Преимущество понимания Haiku не доказано: confirmed-fact score почти одинаков, серверная валидация доминирует. Tool-calling оценивать по отказам и успешным действиям, а не числу вызовов: Haiku в AI-first не показал устойчивого преимущества. Naturalness/SR оценки приведены отдельно и не перекрывают плохое завершение сценариев. В этом эксперименте Luna дешевле; full-run latency у Luna ниже, но облачный SLA не измерен. Нет практически значимого основания менять production модель.

**Settings.** Canonical versions: Luna20260922 и Haiku20261007; benchmark — max_tokens1600, reasoning effort low, reasoning content excluded, provider require_parameters. Обе модели реально выполнили native tools и короткий SR reply с этим cap. Production1200 не менялся. Image/file input заявлен текущим catalogue; отдельное vision end-to-end сравнение не выполнено. У Haiku больше reasoning usage в multi-turn runs; небольшой smoke не доказывает оптимальность1600 или достаточность1200 для всех случаев.

**95% autonomy.** Блокируют semantic confirmation/negative-extras acceptance, устойчивость multi-turn planning и открытых вопросов, excess tool/context cost, unsupported duration/custom work/upholstery/equipment reviews, verified identity/address/calendar/routes и неполный final-source holdout. Направленный booking proof не является95% автономной продажей.

**Native/QA.** Обе модели прошли connectivity/native-tool smoke. Направленная цепочка catalogue→facts→Lead→price→duration→verified public address→availability→recap→explicit nonce confirmation→synthetic Order прошла для обеих; два Orders очищены. Первые address/confirmation-context INCONCLUSIVE попытки сохранены, не объявлены PASS. Final source:619 agent unit +67 adjacent +1 LLM-first persisted +1 golden +10 domain +4 conversion +10 continuity =712 PASS; отдельные DB/HTTP skips не скрыты. TypeScript/build PASS; ESLint0 errors,2 source warnings (generated bundled assets excluded). Source-bound release/live proof не переписан.

**Затраты.** Четырёхсторонний holdout: $1.013217. Всего в сохранённом ledger baseline/development/holdout/booking/judge/adapter-smoke: $1.634583, включая неуспешные попытки. Это не account invoice: отдельный PoYo HTTP smoke и controlled-provider regression не включены. Стоимость неуспешных диалогов и total-cost-per-success есть в manifest.

**Release.** [Draft PR #18](https://github.com/boooobly/lumaclean/pull/18), [Preview](https://lumaclean-p0neh2zth-vladislavs-projects-0eae0ea3.vercel.app) — SHA47dea59, default HYBRID; protected HTTP2-turn smoke PASS, owned fixture cleaned, session revoked. Все четыре измерены на одной prototype source 0b440392343bc0a84a40d11b57050b5a94cd4ed3e3a8f8436efabcc0e6bbebaf. После начала evaluation восстановлен первоначальный HYBRID wire contract; final-source full holdout остаётся отдельным gate. Production READY остаётся на main9516f29, без merge/deploy. Modes: WebsiteAUTO / WhatsAppAUTO / TelegramOFF / ViberOFF.

Владелец может безопасно изучать trace/manifest и экспериментировать со стратегией только в изолированном Preview. Production оставлять HYBRID с текущими providers/models и modes; никакие исключения pricing/duration/identity/booking не включать ради метрики.

**Повторная production-проверка 2026-10-15T14:00:11.430Z.** Только чтение: режимы прежние, последние успешные вызовы Luna через OpenRouter/PoYo. Публичные GET /ru, /sr, /en вернули200. Новые production conversations/Orders не создавались. Typecheck сообщает ожидаемый ai_release_source_mismatch: старое подписанное release proof не подтверждает изменённый код, поэтому сборка сама по себе не разрешает rollout.

```text
Recommended model: current GPT-6 Luna
Recommended strategy: HYBRID
AI-first Preview ready: NO
Critical safety regressions: 0/124 observed consultations; incomplete cases are not release passes
Production model switched: NO
Production strategy switched: NO
```

[Manifest and actual metrics](agent-llm-first-benchmark/manifest.json); [synthetic transcripts, tool outcomes and numeric usage](agent-llm-first-benchmark/evidence.json). Model capabilities/canonical IDs/rates were checked against [OpenRouter models API](https://openrouter.ai/api/v1/models); native smoke and billed usage are the implementation evidence.
