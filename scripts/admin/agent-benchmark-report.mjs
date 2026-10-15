import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {sourceFingerprint} from '../../src/lib/agent/release-verification.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const folder='qa-output';
const find=prefix=>folder+'/'+readdirSync(folder).find(p=>p.startsWith(prefix)&&p.endsWith('.json'));
const benchmark=read(find('llm-first-locked-holdout-'));
const quality=read(folder+'/llm-first-blind-quality.json');
const modelA='openai/gpt-6-luna',modelB='anthropic/claude-haiku-5.5';
const configs=[['A',modelA,'HYBRID'],['B',modelB,'HYBRID'],['C',modelA,'LLM_FIRST'],['D',modelB,'LLM_FIRST']];
const ids=[...new Set(benchmark.rows.map(r=>r.id))];
const common=ids.filter(id=>configs.every(([,model,strategy])=>benchmark.rows.some(r=>r.id===id&&r.model===model&&r.strategy===strategy&&r.status!=='INCONCLUSIVE')));
const qmap=quality.mapping??[];
const qcommon=common.filter(scenario=>configs.every(([,model,strategy])=>qmap.some(m=>m.scenario===scenario&&m.model===model&&m.strategy===strategy&&quality.ratings.some(r=>r.id===m.id))));
const percentile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1]:null;
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
const money=turns=>turns.flatMap(t=>t.usage).reduce((n,u)=>n+(u.billedCostUsd??u.estimatedCostUsd??0),0);
const normalize=t=>t.toLowerCase().replace(/\s+/gu,' ').trim();
const prompt=t=>/\?|уточн|подскаж|da li|да ли|tell me|please specify|potvrd|потврд/iu.test(t);
const wrong=new Set(['INVALID_TOOL_ARGUMENTS','FACT_ALREADY_KNOWN','CUSTOMER_FACTS_REQUIRED','FACT_EVIDENCE_REJECTED','TOOL_NOT_ALLOWED','CUSTOMER_CORRECTION_REQUIRES_CURRENT_FACTS']);
const metrics=configs.map(([key,model,strategy])=>{
 const rows=benchmark.rows.filter(r=>r.model===model&&r.strategy===strategy),paired=rows.filter(r=>common.includes(r.id)),turns=paired.flatMap(r=>r.turns),usage=turns.flatMap(t=>t.usage),success=rows.filter(r=>r.status==='PASS');
 const qrows=qmap.filter(m=>m.model===model&&m.strategy===strategy&&qcommon.includes(m.scenario)).map(m=>({...quality.ratings.find(r=>r.id===m.id),scenario:m.scenario}));
 const repeated=paired.reduce((n,r)=>n+r.turns.filter((t,i)=>t.repeated||i>0&&prompt(t.answer)&&normalize(t.answer)===normalize(r.turns[i-1].answer)).length,0);
 const factCorrect=paired.reduce((n,r)=>n+r.factsCorrect,0),factTotal=paired.reduce((n,r)=>n+r.factsTotal,0);
 return {key,model,strategy,successful:success.length,paired:paired.length,planned:32,started:rows.length,inconclusive:rows.filter(r=>r.status==='INCONCLUSIVE').length+32-rows.length,factCorrect,factTotal,factAccuracy:factTotal?factCorrect/factTotal:null,repeatedPrompts:repeated,incorrectToolCalls:turns.flatMap(t=>t.tools).filter(t=>wrong.has(t.outcome)).length,rejectedToolsAll:turns.flatMap(t=>t.tools).filter(t=>t.outcome!=='OK').length,hardHandoffs:rows.filter(r=>r.turns.some(t=>t.hard)).length,softReviews:rows.filter(r=>r.turns.some(t=>t.soft)).length,bookingSafetyFailures:rows.filter(r=>!r.safe).length,p50Ms:percentile(turns.map(t=>t.latencyMs),.5),p95Ms:percentile(turns.map(t=>t.latencyMs),.95),providerP50Ms:percentile(usage.map(u=>u.latencyMs),.5),providerP95Ms:percentile(usage.map(u=>u.latencyMs),.95),averageTokens:mean(paired.map(r=>r.turns.flatMap(t=>t.usage).reduce((n,u)=>n+u.inputTokens+u.outputTokens,0))),modelCalls:usage.length,reasoningTokens:usage.reduce((n,u)=>n+(u.reasoningTokens??0),0),cachedInputTokens:usage.reduce((n,u)=>n+u.cachedInputTokens,0),averageCostCompleted:success.length?money(success.flatMap(r=>r.turns))/success.length:null,totalCost:money(rows.flatMap(r=>r.turns)),amortizedCostPerSuccess:success.length?money(rows.flatMap(r=>r.turns))/success.length:null,invocationFailures:rows.flatMap(r=>r.turns).reduce((n,t)=>n+t.providerErrors,0),providerErrorCauses:'NOT_RETAINED_IN_MEASURED_HARNESS',averageMessagesToQuote:mean(paired.filter(r=>r.turns.some(t=>t.quote)).map(r=>r.turns.findIndex(t=>t.quote)+1)),messagesToBooking:null,answerOrigins:turns.reduce((counts,t)=>{const origin=t.hard?'handoff':t.providerErrors?'fallback/recovery':t.route;counts[origin]=(counts[origin]??0)+1;return counts;},{}),blind:{pairedDialogues:qrows.length,naturalness:mean(qrows.map(r=>r.naturalness)),relevance:mean(qrows.map(r=>r.relevance)),clarity:mean(qrows.map(r=>r.clarity)),noUnnecessaryQuestions:mean(qrows.map(r=>r.noUnnecessaryQuestions)),usefulness:mean(qrows.map(r=>r.usefulness)),femalePersona:mean(qrows.map(r=>r.femalePersona)),serbianNaturalness:mean(qrows.filter(r=>r.scenario.includes('-sr-')).map(r=>r.naturalness))}};
});
const baseline=read(find('llm-first-baseline-'));
const baselineRoutes={'deterministic-only':0,'LLM-generated':0,'deterministic quote + LLM response':0,'fallback/recovery':0,handoff:0};
for(const row of baseline.rows)for(const t of row.turns){
 const modelText=t.usage.some(u=>u.text.trim()&&t.answer.includes(u.text.trim()));
 const recovery=!modelText&&t.usage.length>0&&!!t.quote&&!t.tools.some(p=>p.tool==='calculatePrice'&&p.outcome==='OK')&&!t.tools.some(p=>p.tool==='requestCustomerInput'&&p.outcome==='OK');
 const route=t.hard?'handoff':t.providerErrors||recovery?'fallback/recovery':modelText?'LLM-generated':'deterministic-only';baselineRoutes[route]=(baselineRoutes[route]??0)+1;
}
const manifest={...benchmark.manifest,catalog:benchmark.manifest.catalog.map(m=>({id:m.id,canonical_slug:m.canonical_slug,created:m.created,context_length:m.context_length,architecture:m.architecture,pricing:m.pricing,top_provider:m.top_provider,supported_parameters:m.supported_parameters,reasoning:m.reasoning})),measuredSourceNote:'All four configurations use the same measured prototype source. After evaluation started, HYBRID original tool wire was restored for default compatibility; final-source full holdout remains a gate. No model-specific prompt tuning.',coverage:{corpus:48,developmentDefined:16,holdoutDefined:32,developmentNativeUnique:8,holdoutStarted:31,pairedConclusive:common.length,pairedBlindScenarios:qcommon.length},holdoutStopped:'Three consecutive INCONCLUSIVE; exact invocation causes were not retained by v1. No quota counters were reset.',dailyGuardRead:read(folder+'/llm-first-budget-read.json'),quality:{model:quality.manifest.model,canonical:quality.manifest.canonical,ratings:quality.ratings.length,packets:qmap.length,errors:quality.errors,cost:quality.totalCost,initialUnmappedAttemptCost:read(folder+'/llm-first-blind-quality-initial-unmapped.json').totalCost,initialAttemptExcluded:true,humanReview:{status:'OWNER_DEFERRED_TO_AGENT',choice:'B',independentHumanVotes:0,note:'A excerpt was shortened; editorial sample only, not a release vote.'}},baseline:{source:baseline.manifest.source,rows:baseline.rows.length,turns:baseline.rows.reduce((n,r)=>n+r.turns.length,0),routes:baselineRoutes,scope:'Small Preview response-composition baseline; not a production traffic estimate. Baseline result status was affected by a report-only undefined-value hashing bug; no success-rate inference from it.'},metrics};
manifest.baseline.turnsWithModelCalls=baseline.rows.flatMap(r=>r.turns).filter(t=>t.usage.length).length;
manifest.baseline.modelCalls=baseline.rows.flatMap(r=>r.turns).reduce((n,t)=>n+t.usage.length,0);
manifest.productionReadOnly=read(folder+'/llm-first-production-readonly.json');
manifest.productionHttpReadOnly=read(folder+'/llm-first-production-http.json');
manifest.finalSourceFingerprint=sourceFingerprint();
const smoke=read(folder+'/llm-first-model-smoke.json');
manifest.compatibilitySmoke={at:smoke.at,rows:smoke.rows.map(r=>({id:r.id,canonical:r.canonical,settings:r.settings,status:r.status,calls:r.calls.map(c=>({tools:c.tools,usage:c.usage,latencyMs:c.latencyMs,finishReason:c.finishReason}))}))};
manifest.previewHttp=read(folder+'/llm-first-preview-http.json');
const proofFiles=['llm-first-native-booking-initial-inconclusive.json','llm-first-native-booking.json','llm-first-native-booking-haiku-confirmed.json'];
manifest.nativeBookingAttempts=proofFiles.map(file=>({file,...read(folder+'/'+file)}));
manifest.costLedger=[];
for(const prefix of ['llm-first-baseline-','llm-first-llm-first-development-','llm-first-development-v2-','llm-first-locked-holdout-']){const file=find(prefix);manifest.costLedger.push({file,cost:money(read(file).rows.flatMap(r=>r.turns))});}
for(const file of proofFiles)manifest.costLedger.push({file,cost:read(folder+'/'+file).reports.flatMap(r=>r.steps).reduce((n,s)=>n+(s.usage?.cost??0),0)});
for(const file of ['llm-first-blind-quality-initial-unmapped.json','llm-first-blind-quality.json'])manifest.costLedger.push({file,cost:read(folder+'/'+file).totalCost});
manifest.costLedger.push({file:'llm-first-model-smoke.json',cost:smoke.rows.flatMap(r=>r.calls).reduce((n,c)=>n+(c.usage.cost??0),0)});
manifest.costScope='Actual recorded baseline/development/holdout/native-booking/judge/adapter-smoke costs, including inconclusive attempts. Deployed PoYo HTTP smoke and persisted controlled-provider regression runs are separate; not an account invoice.';
manifest.recordedCostTotalUsd=manifest.costLedger.reduce((n,r)=>n+r.cost,0);
mkdirSync('docs/admin/agent-llm-first-benchmark',{recursive:true});
writeFileSync('docs/admin/agent-llm-first-benchmark/manifest.json',JSON.stringify(manifest,null,2)+'\n');
// Retain reviewable synthetic evidence without credentials, database identities or reasoning content.
const evidence={source:benchmark.manifest.source,scope:'Measured prototype, synthetic Preview conversations only; not final-source release evidence',rows:benchmark.rows.map(r=>({id:r.id,model:r.model,strategy:r.strategy,status:r.status,factsCorrect:r.factsCorrect,factsTotal:r.factsTotal,safe:r.safe,cleaned:r.cleaned,failure:r.failure,turns:r.turns.map(t=>({customer:t.customer,answer:t.answer,facts:t.facts,quote:t.quote,tools:t.tools,latencyMs:t.latencyMs,route:t.route,hard:t.hard,soft:t.soft,repeated:t.repeated,persona:t.persona,invocationFailures:t.providerErrors,safe:t.safe,usage:t.usage.map(u=>({inputTokens:u.inputTokens,cachedInputTokens:u.cachedInputTokens,outputTokens:u.outputTokens,reasoningTokens:u.reasoningTokens,billedCostUsd:u.billedCostUsd,estimatedCostUsd:u.estimatedCostUsd,latencyMs:u.latencyMs}))}))})),blindRatings:qmap.map(m=>({scenario:m.scenario,model:m.model,strategy:m.strategy,rating:quality.ratings.find(r=>r.id===m.id)??null}))};
writeFileSync('docs/admin/agent-llm-first-benchmark/evidence.json',JSON.stringify(evidence,null,2)+'\n');
const fmt=(n,d=2)=>n===null?'N/A':Number(n).toFixed(d);
const short=m=>m.key+' '+(m.model===modelA?'Luna':'Haiku')+' / '+m.strategy;
const table=['| Конфигурация | Успех / planned | INCONCL | Facts, paired | Повторы | Неверные tools | Hard/soft | Booking violations | p50/p95, с | Avg tokens/диалог | $/completed | Invocation errors |','|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',...metrics.map(m=>`| ${short(m)} | ${m.successful}/32 | ${m.inconclusive} | ${m.factCorrect}/${m.factTotal} (${fmt(100*m.factAccuracy,1)}%) | ${m.repeatedPrompts} | ${m.incorrectToolCalls} | ${m.hardHandoffs}/${m.softReviews} | ${m.bookingSafetyFailures} | ${fmt(m.p50Ms/1000,1)}/${fmt(m.p95Ms/1000,1)} | ${Math.round(m.averageTokens)} | ${fmt(m.averageCostCompleted,6)} | ${m.invocationFailures} |`)].join('\n');
const qt=['| Конфигурация | Blind paired N | Naturalness /4 | Relevance /4 | Useful /4 | No extra questions /4 | SR naturalness /4 | Female/neutral /4 |','|---|---:|---:|---:|---:|---:|---:|---:|',...metrics.map(m=>`| ${m.key} | ${m.blind.pairedDialogues} | ${fmt(m.blind.naturalness)} | ${fmt(m.blind.relevance)} | ${fmt(m.blind.usefulness)} | ${fmt(m.blind.noUnnecessaryQuestions)} | ${fmt(m.blind.serbianNaturalness)} | ${fmt(m.blind.femalePersona)} |`)].join('\n');
const lines=[
'# LumaClean: AI-first experiment, 14 October 2026',
'',
'**Рекомендация: оставить Luna и HYBRID. Эксперимент не доказал улучшения завершения консультаций; AI-first увеличивает число вызовов, стоимость и задержку. PR #18 остаётся draft, production не менялся.**',
'',
table,
'',
`Planned N=32 на конфигурацию; запущен31 сценарий,124 owned fixtures очищены. Для сравнения фактов, повторов, tools, latency и tokens использованы только ${common.length} одинаковых сценариев, завершённых во всех четырёх конфигурациях. Успехи/INCONCL показывают весь planned набор; 4 незапущенные конфигурации последнего сценария — INCONCLUSIVE. Hard/soft — число диалогов, а не повторное суммирование review на каждом ходе. Ошибки вызовов включают серверные отказы/unknown causes: ранний harness не сохранил errorCode, поэтому их нельзя честно приписать OpenRouter. Коды теперь сохраняются. Последующая read-only проверка daily guard не подтверждает исчерпание дневного лимита.`,
'',
'Неверные tools: schema/provenance/known-fact/forbidden-tool отказы; корректные NO_SLOTS/NO_DURATION_RULE не объявлены ошибкой выбора. Повторы: одинаковый повторный вопрос/clarification и backend known-fact detector; это нижняя граница семантических повторов. Latency — полный локальный runner против remote Preview DB, с concurrency4; не production HTTP SLA. Tokens включают reasoning один раз. Стоимость взята из actual usage.cost с cache reads/writes; $/completed — средняя для действительно успешных сценариев, затраты неуспешных сценариев отдельно в manifest. Ноль созданных Orders в консультационном corpus — запретный сценарий, а не доказательство автономного booking.',
'',
qt,
'',
`Независимый judge: ${quality.manifest.canonical}, только анонимные тексты, фиксированный rubric0–4, без названий кандидатов и без права оценивать деньги/booking. ${quality.ratings.length}/${qmap.length} оценок прошли schema/ID validation; ${qmap.length-quality.ratings.length} — INCONCLUSIVE. Таблица использует ${qcommon.length} сценариев с оценками всех четырёх кандидатов. Стоимость пригодного judge-прогона $${fmt(quality.totalCost,6)}; первый прогон $${fmt(manifest.quality.initialUnmappedAttemptCost,6)} исключён из сравнений из-за потери mapping при подготовке human sample. Mapping теперь сохраняется в результате и подготовка human sample не перезаписывает его. Владелец делегировал текстовый выбор; B выбран за краткость и отсутствие анкеты, независимого human голоса нет. Это не разрешение менять production.`,
'',
`**Baseline.** На main-after17, в малой Preview-выборке: ${JSON.stringify(baselineRoutes)}, ${manifest.baseline.turns} клиентских ответов. Полностью deterministic-only: ${fmt(100*(baselineRoutes['deterministic-only']??0)/manifest.baseline.turns,1)}%; ещё ${baselineRoutes['fallback/recovery']??0} recovery-ответа. Без единого model call прошли ${manifest.baseline.turns-manifest.baseline.turnsWithModelCalls}/${manifest.baseline.turns} ходов (${fmt(100*(manifest.baseline.turns-manifest.baseline.turnsWithModelCalls)/manifest.baseline.turns,1)}%); на остальных ${manifest.baseline.turnsWithModelCalls} ходах было ${manifest.baseline.modelCalls} вызовов. Участие модели в решении не гарантирует её участие в клиентской формулировке: extraction/native decision может закончиться серверным шаблоном. Не переносить процент на весь production: историческая telemetry не фиксировала composition origin. Текущие HYBRID replay origins и все model calls есть в manifest.`,
'',
'**Архитектура.** LLM_FIRST передаёт natural-text turn существующему bounded native loop, объединяя понимание/предложения фактов и выбор шага; отдельного extraction call и pre-model FAQ/intake shortcut нет. Natural qualification question может быть частью того же native решения. Сервер проверяет provenance, факты, вопрос и все бизнес-операции. Confirmation/scope/slots/booking сохраняют точную серверную формулировку. HYBRID/default native wire, CRM, jobs, цены, outbox, audit, channel permissions и rollback через flag сохранены. Подробности: agent-llm-first-protocol.md.',
'',
'**Где bottleneck.** На естественных RU/SR отрицаниях и soil-формулировках обе модели упираются в source validation/confirmation. Модель может понять смысл, но предложение не становится confirmed fact; повторяется clarification. Смена модели этот барьер не устраняет. Коррекции/rapid/resume также показывают лишние/повторные tool предложения. All-tools context большой; Haiku токенизирует тот же контракт объёмнее и использует больше reasoning. Цена/календарь при этом остаются серверными — безопасность не ослаблялась ради score.',
'',
'**Модели.** Преимущество понимания Haiku не доказано: confirmed-fact score почти одинаков, серверная валидация доминирует. Tool-calling оценивать по отказам и успешным действиям, а не числу вызовов: Haiku в AI-first не показал устойчивого преимущества. Naturalness/SR оценки приведены отдельно и не перекрывают плохое завершение сценариев. В этом эксперименте Luna дешевле; full-run latency у Luna ниже, но облачный SLA не измерен. Нет практически значимого основания менять production модель.',
'',
'**Settings.** Canonical versions: Luna20260922 и Haiku20261007; benchmark — max_tokens1600, reasoning effort low, reasoning content excluded, provider require_parameters. Обе модели реально выполнили native tools и короткий SR reply с этим cap. Production1200 не менялся. Image/file input заявлен текущим catalogue; отдельное vision end-to-end сравнение не выполнено. У Haiku больше reasoning usage в multi-turn runs; небольшой smoke не доказывает оптимальность1600 или достаточность1200 для всех случаев.',
'',
'**95% autonomy.** Блокируют semantic confirmation/negative-extras acceptance, устойчивость multi-turn planning и открытых вопросов, excess tool/context cost, unsupported duration/custom work/upholstery/equipment reviews, verified identity/address/calendar/routes и неполный final-source holdout. Направленный booking proof не является95% автономной продажей.',
'',
'**Native/QA.** Обе модели прошли connectivity/native-tool smoke. Направленная цепочка catalogue→facts→Lead→price→duration→verified public address→availability→recap→explicit nonce confirmation→synthetic Order прошла для обеих; два Orders очищены. Первые address/confirmation-context INCONCLUSIVE попытки сохранены, не объявлены PASS. Final source:619 agent unit +67 adjacent +1 LLM-first persisted +1 golden +10 domain +4 conversion +10 continuity =712 PASS; отдельные DB/HTTP skips не скрыты. TypeScript/build PASS; ESLint0 errors,2 source warnings (generated bundled assets excluded). Source-bound release/live proof не переписан.',
'',
`**Затраты.** Четырёхсторонний holdout: $${fmt(metrics.reduce((n,m)=>n+m.totalCost,0),6)}. Всего в сохранённом ledger baseline/development/holdout/booking/judge/adapter-smoke: $${fmt(manifest.recordedCostTotalUsd,6)}, включая неуспешные попытки. Это не account invoice: отдельный PoYo HTTP smoke и controlled-provider regression не включены. Стоимость неуспешных диалогов и total-cost-per-success есть в manifest.`,
'',
'**Release.** [Draft PR #18](https://github.com/boooobly/lumaclean/pull/18), [Preview](https://lumaclean-p0neh2zth-vladislavs-projects-0eae0ea3.vercel.app) — SHA47dea59, default HYBRID; protected HTTP2-turn smoke PASS, owned fixture cleaned, session revoked. Все четыре измерены на одной prototype source '+benchmark.manifest.source+'. После начала evaluation восстановлен первоначальный HYBRID wire contract; final-source full holdout остаётся отдельным gate. Production READY остаётся на main9516f29, без merge/deploy. Modes: WebsiteAUTO / WhatsAppAUTO / TelegramOFF / ViberOFF.',
'',
'Владелец может безопасно изучать trace/manifest и экспериментировать со стратегией только в изолированном Preview. Production оставлять HYBRID с текущими providers/models и modes; никакие исключения pricing/duration/identity/booking не включать ради метрики.',
'',
`**Повторная production-проверка ${manifest.productionReadOnly.at}.** Только чтение: режимы прежние, последние успешные вызовы Luna через OpenRouter/PoYo. Публичные GET /ru, /sr, /en вернули200. Новые production conversations/Orders не создавались. Typecheck сообщает ожидаемый ai_release_source_mismatch: старое подписанное release proof не подтверждает изменённый код, поэтому сборка сама по себе не разрешает rollout.`,
'',
'```text',
'Recommended model: current GPT-6 Luna',
'Recommended strategy: HYBRID',
'AI-first Preview ready: NO',
'Critical safety regressions: 0/124 observed consultations; incomplete cases are not release passes',
'Production model switched: NO',
'Production strategy switched: NO',
'```',
'',
'[Manifest and actual metrics](agent-llm-first-benchmark/manifest.json); [synthetic transcripts, tool outcomes and numeric usage](agent-llm-first-benchmark/evidence.json). Model capabilities/canonical IDs/rates were checked against [OpenRouter models API](https://openrouter.ai/api/v1/models); native smoke and billed usage are the implementation evidence.',
];
writeFileSync('docs/admin/agent-llm-first-benchmark.md',lines.join('\n')+'\n');
console.log(JSON.stringify({paired:common.length,pairedQuality:qcommon.length,baseline:manifest.baseline,metrics},null,2));
