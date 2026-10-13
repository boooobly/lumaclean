# Agent autonomy audit

Дата: 2026-10-13. База: актуальный `origin/main`, `dc93888`. Ветка: `codex/agent-autonomy-optimization`.

## Фактическая диагностика production

Read-only транзакция PostgreSQL; существующие conversations, orders и настройки не изменялись. Просмотрены все 7 записей HumanHandoff в 5 диалогах из 11 production conversations. 6 записей являются hard handoff, 1 — soft review. Orders, привязанных к этим conversations, нет. Подлинность обращений как независимого клиентского трафика не установлена; эти записи не дают основания заявлять production KPI. В публичный репозиторий не включены сообщения, телефоны, адреса или идентификаторы клиентов.

| Причина | Записей | Доказательство и вывод |
|---|---:|---|
| UNCERTAINTY | 3 | Включает вопрос о будущей стандартной уборке после FAQ о химчистке и запрос времени после успешных calculatePrice/estimateDuration. При отсутствии безопасного текста нужен recovery без выдуманной записи; по traces неизвестная мутация не зафиксирована. Один исход после смешанного языкового/временного контекста остаётся не полностью определённым. |
| SOFT:OPERATIONAL | 1 | FAQ о наличии химчистки ошибочно установил upholsteryInquiry и ограничил последующую стандартную консультацию. Ошибка определения намерения. |
| TOOL_ERRORS | 1 | Передача после уже полученного расчёта; traces содержат CUSTOMER_FACTS_REQUIRED и FACT_ALREADY_KNOWN, а не доказательство опасного результата мутации. Требуется сохранить факты и продолжить с недостающего шага. |
| ARRIVAL_REVIEW | 1 | Новый запрос времени уборки при отсутствии существующего Order был принят за проверку прибытия клинера. Подтверждённый false positive. |
| OUT_OF_SCOPE | 1 | Просьба помочь перемещать тяжёлую мебель. Человек действительно нужен; точная причина должна быть HEAVY_LIFTING, это не false-positive handoff. |

Production AIInvocation показывает реальные `poyo / gpt-6-luna` и `openrouter / openai/gpt-6-luna`; встречаются PROVIDER_MALFORMED и PROVIDER_TIMEOUT_OR_NETWORK у primary с успешным fallback. ShadowSuggestion присутствует в части исторических диалогов и не считается исполненным ответом. Наблюдения достаточны для исправления конкретных ошибок, недостаточны для достоверной оценки общей автономности или доли false positive. Ручная проверка handoff в Inbox теперь формирует отдельную проверенную выборку; ретроспективные production оценки автоматически не записывались.

## Полная классификация существующих reasons

Уровень определяется смыслом обращения и видом ошибки, а не наличием слова. `reasonLevel` используется в runner и инструментах; существующие reason identifiers сохранены для совместимости.

| Reason | Поведение | Ограничения |
|---|---|---|
| CLIENT_REQUEST | C: hard | Явный запрос человека; продолжение только после resume. |
| COMPLAINT | C: hard | Повреждение, компенсация, жалоба; никаких обещаний возмещения или признания ответственности. |
| HAZARDOUS_CLEANING | C для реальной опасной работы; A для общего FAQ | Общий вопрос об исключённой работе получает отказ; опасную работу не выполнять. |
| MOLD, RENOVATION | C для конкретной запрещённой/опасной работы; A для общего FAQ | Отказ от услуги не означает разрешение на booking. |
| HEAVY_LIFTING | C для реальной просьбы; A для общего FAQ | Не обещать перенос тяжёлой мебели. |
| OUT_OF_SCOPE | C для доступа к чужим данным, секретам, инъекций | Отказ; никакого раскрытия данных. |
| IDENTITY_REQUIRED | C при невозможности безопасно проверить операцию | Имя/телефон не являются проверкой личности. |
| CANCELLATION | C для фактической отмены; A для вопроса о порядке | Автоматическая отмена не добавлена. |
| ARRIVAL_REVIEW | C для существующего/пропавшего клинера | Проспективный вопрос о времени не означает запрос ETA. |
| PRICE_REVIEW | B | Сильное загрязнение, индивидуальная цена; известный subtotal, booking blocked. |
| DISCOUNT | A для общего FAQ, B для конкретного исключения | Только server-verified discount из CRM; никаких выдуманных процентов. |
| CREW_PREFERENCE | B | Предпочтение не меняет рассчитанную команду и Duration Rules. |
| ACCESS_REVIEW | A для обычного FAQ, B для дополнительных обязательств | Не обещать неподтверждённое хранение ключей. |
| PAYMENT_REVIEW | A для FAQ, B для конкретного исключения | Каталог подтверждает наличные после уборки без предоплаты; карта не обещается. |
| OUTSIDE_SERVICE_AREA | B | Не обещать обслуживание вне подтверждённой зоны. |
| NO_DURATION_RULE | B | Продолжать консультацию; длительность и booking не выдумывать. |
| ROUTING_UNRELIABLE | B | Продолжать intake; маршрут и координаты не подтверждать. |
| NO_SLOTS | A: уточнение | Новый реальный поиск после выбора другой даты/интервала; никаких придуманных альтернатив. |
| AMBIGUOUS | A: уточнение | Неоднозначность сама по себе не выключает AI. |
| TOOL_ERRORS | Recovery для известных поправимых ошибок; C для критических | Два неверных аргумента не равны двум критическим ошибкам. |
| UNCERTAINTY | Recovery текста/фактов; C при реальной потере безопасности | Модель не получает право отправлять неподтверждённые суммы, слоты и claims. |

## Runtime errors, не входящие в enum reasons

| Ошибки | Действие |
|---|---|
| INVALID_TOOL_ARGUMENTS, INVALID_PHONE, CONTACT_REQUIRED, CUSTOMER_FACTS_REQUIRED, FACT_ALREADY_KNOWN, WINDOW_QUANTITIES_REQUIRED и другие отсутствующие данные | Correction или один точный вопрос в рамках существующих step/model limits. |
| STALE_SLOT, SLOT_NO_LONGER_AVAILABLE | Новый поиск и новая explicit confirmation; старый recap не использовать. |
| ADDRESS_NOT_FOUND, AMBIGUOUS | Уточнить написание, район или ориентир; не выбирать случайный дом. |
| TOOL_READ_TEMPORARY | Один retry только getBusinessInfo/findClient при распознанной transient read error. |
| TOOL_EXECUTION_UNCERTAIN | C; неизвестную бизнес-мутацию не повторять. |
| PROVIDERS_UNAVAILABLE | Без повторения бизнес-инструментов сохранить state и безопасный ответ; успешную уже сохранённую booking не отрицать. |
| PERSONA_REPAIR_FAILED / исправимая форма и длина ответа | Одна текстовая repair; возвращённые tools не исполняются. Неудача — ответ из достоверного state или безопасное уточнение. |
| Неподтверждённая сумма, процент скидки, слот или booking claim | Не отправлять; recovery из server state. Калькулятор не изменять. |
| CONTEXT_LIMIT, MODEL_CALL_LIMIT, CONVERSATION_COST_LIMIT, DAILY_BUDGET_LIMIT | C; защитные квоты сохранены. |
| AGENT_CONTROL_CHANGED, JOB_LEASE_LOST | Superseded; не отправлять устаревший ответ и не выполнять инструменты. |

## Continuity и review

FAQ о генеральной/окнах/допах не меняет уже подтверждённые предпочтения и не уничтожает quote. Конкретные поправки продолжают инвалидировать зависимые quote/slots/recap. Сохраняются rapid-message coalescing, картинки, human factual reconciliation, unique responseToMessageId, explicit confirmation, перепроверка маршрута/выезда каждого клинера, cutoff 17:00 и +20% same-day.

FAQ о химчистке не устанавливает booking intent. Реальная заявка устанавливает upholsteryInquiry, сохраняет Lead и точечный soft review, продолжает FAQ; автономный booking химчистки остаётся запрещён. Техническая анкета мебели не добавлена.

requestReview дедуплицируется по conversation/reason. Inbox показывает review, известные факты и решение. APPROVED/REJECTED/NEEDS_INFO фиксируются с заметкой, отменяют уведомления только решённой детали и не забирают AI_CONTROL. Approval не меняет цены, Duration Rules, identity, координаты, explicit confirmation, custom-item и upholstery guards. Rejected detail остаётся блокирующей. Hard takeover сохраняется до явного resume; последующие сообщения и вложения сохраняются.

## Метрики

Компактная таблица /admin/analytics за 7/30 дней разделяет содержательные обращения, AI-only consultation, full automation, soft review и human-touched. Greetings не засчитываются. Успешная консультация требует сохранённого полезного ответа по успешному инструменту и последующей благодарности либо реальной AI-записи. Такой критерий консервативен и не заменяет ручную оценку качества. Неполученный финальный ответ клиента означает unknown, пауза >24 часов помечается незавершённой. Full automation требует фактического AI Order без review/human touch. Старые ответы без outcome marker не объявляются успешными.

Предотвращённые попытки повторного вопроса считаются по FACT_ALREADY_KNOWN; показатель явно отделён от реально отправленных повторных вопросов. Средние шаги до quote/booking используют logical jobs, исключая SUPERSEDED bursts. Tool failure, primary→fallback и false-positive handoff имеют отдельные знаменатели; false-positive rate показывается только по явно проверенным hard handoffs. Ограничение выборки — последние 1000 conversations, известные synthetic namespaces исключены. Нет утверждения, что production достиг 95%.

## Проверки и выпуск

- Regression corpus: 112 разных RU / SR Latin / SR Cyrillic / EN сценариев, 28 категорий; policy, facts и domain actions проверяются отдельно от native LLM.
- Одинаковый rule corpus, main → branch: unnecessary hard handoffs **19 → 0** из 96 случаев без ожидаемого hard handoff; 12 обязательных hard cases сохранены, исправлены две ранее пропущенные SR safety cases.
- Targeted units: 428 PASS, 0 FAIL, 21 DB-only SKIP. TypeScript, affected ESLint и optimized build прошли. Расширенный routing suite: два Google opt-in assertions не проходят и на неизменённом main dc93888; это не регрессия этой ветки и не входит в targeted PASS count.
- Preview DB: шесть autonomy domain scenarios, девять continuity scenarios, отдельный HTTP burst/retry и реальный поиск NO_SLOTS прошли. Проверен один ответ, сохранение фото/фактов, repeated takeover/resume, soft review dedup/approval и запреты booking. Existing behavior/conversion suite: 16 PASS.
- Повтор полного autonomy DB suite после расходования суточной квоты: два provider-dependent synthetic checks остановлены DAILY_BUDGET_LIMIT. Их предыдущий прогон прошёл; повтор не объявлен PASS. Суточный счётчик не сбрасывался.
- Production modes прочитаны: WEBSITE AUTO, WHATSAPP AUTO, TELEGRAM OFF, VIBER OFF. Они не менялись.
- Native success нельзя выводить из rule classification; недоступный provider/квота означает INCONCLUSIVE. Synthetic fixtures не отправляются production клиентам; production test Orders не создаются.
- Merge/deployment допускаются после проверки acceptance и readiness; ни source verification, ни live booking proof не подменяются.

### Одинаковый native OpenRouter корпус

88 односообщенческих сценариев без injected events; 60 ожидают AI_HANDLES. Проверяется реальное сохранение фактов, Lead, AI/HUMAN control, handoff/review, наличие ответа и successful getBusinessInfo для FAQ. Это проверка первого полезного шага, а не доказательство завершённой консультации или полной автоматизации заказа.

| Показатель | Main dc93888 | Первичный After |
|---|---:|---:|
| Все сценарии | 88 | 88 |
| PASS с native моделью | 18 | 58 |
| DOMAIN_PASS без необходимости LLM | 30 | 28 |
| FAIL | 40 | 2 |
| Hard handoff | 34 | 12 |
| Успешные eligible AI_HANDLES | 28/60 (46,7%) | 58/60 (96,7%) |

Два After FAIL были FAQ о передаче ключей на SR Latin/Cyrillic: модель придумывала способ передачи и создавала лишний review. Добавлены authoritative access facts, запрет обещать неподтверждённый приём/хранение ключей и узкий catalog FAQ path.

На финальном source все 12 payment/discount/access FAQ проверены реальными domain tools на Preview: 12 DOMAIN_PASS, ни одного handoff/review или вызова модели. Targeted native FAQ replay: 18 PASS, 12 DOMAIN_PASS, 2 INCONCLUSIVE из-за DAILY_BUDGET_LIMIT. Нельзя подменять эти два повторных результата предыдущими PASS без указания разных прогонов. Совокупное покрытие исходных 88 cases с успешными targeted corrections: 47 native PASS + 41 DOMAIN_PASS; eligible 60/60. Это составное покрытие, **не новый полный native After run**.

### Native PoYo, booking и браузер

PoYo Responses фактически возвращает object-valued native arguments и null content. Несовместимость подтверждена структурными Preview logs, без клиентских текстов/значений аргументов. Поддержаны ограниченные native object arguments; пустые/неверные бизнес-аргументы всё ещё отклоняются. Текстовый pseudo-tool JSON не исполняется. Diagnostic теперь проверяет parsed schema, не буквальное написание `{}`.

На промежуточной Preview `y3w3c50bt` primary PoYo: NATIVE_TOOL_ARGUMENTS_INVALID; native qualification: NATIVE_QUALIFICATION_INVALID. Этот прогон был INCONCLUSIVE для полноценной native консультации PoYo. Fallback OpenRouter успешно создал настоящий synthetic Order после всех восьми штатных проверок, batch очищен; исторический PoYo failure и успешный fallback сохранены отдельно. После исправления SDK union выполнен новый финальный прогон, описанный ниже.

Chrome /admin/analytics: desktop/mobile 390px, таблицы 7/30 дней отображаются, horizontal overflow отсутствует, console errors/warnings 0. Synthetic Inbox: NEEDS_INFO и APPROVED сохранены через UI, AI_CONTROL сохранён. Существующие production conversations не изменялись.

Финальная Preview `h1ed1gek9`, source fingerprint `47c9351f62581d181a6d0d5ae961f4c31f95c1079d0c6eb8a0322840ce6fa8f8`: **PoYo native booking PASS без fallback**, все восемь steps пройдены, batch очищен. Цена 4600 RSD, duration 150 минут, cleaning reserve 30 минут, travel buffer 30 минут, required/assigned cleaners 2/2. Primary и fallback diagnostics READY; маршрутизация с действующим подтверждённым резервом DEGRADED. Серверная страница readiness: 5/5 обязательных систем, технических блокировок нет. Signed proof относится к этому fingerprint; secrets и подпись не опубликованы.

Дополнительно: прямая повторная qualification question модели запрещена для известных фактов, разрешена одна text-only repair. Full-source ADMIN corrections проверяются на точные значения, не только на совпадение excerpt; native DB case отклоняет 30 окон при исходных 3 и принимает 3 с сохранением остальных фактов. Конкурирующие значения SDK union не выбираются; цена/площадь в исходной строке остаются неизменными. PoYo upstream SDK representation подтверждена структурными synthetic logs и [типом официального SDK](https://github.com/openai/openai-go/blob/main/responses/response.go).

PR: https://github.com/boooobly/lumaclean/pull/16. Merge/main/production выполняются после этих gates; фактический результат rollout и production readiness фиксируется в итоговом отчёте задачи. Нельзя заявлять production KPI на основании Preview.
