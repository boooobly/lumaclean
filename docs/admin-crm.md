# LumaClean CRM core

Рабочая ветка: `codex/admin-crm-core`, исходная: `codex/admin-foundation`. CRM реализует путь **Website → Lead → Client → ClientAddress → Order**. Доступ — только актуальный активный ADMIN. Публичная форма доступна без входа.

## Приём заявки и idempotency

`/api/lead` строго валидирует Zod payload: UUID submissionId, контакты, согласие, ru/sr/en, код услуги, площадь 25–180, extras, срочность, комментарий, текстовый snapshot и разрешённую attribution. Произвольные поля, отрицательные значения, неизвестные услуги и страницы входа отклоняются. Стоимость сервер считает через общий `calculatePrice` из `src/lib/pricing.ts`; клиент не может передать доверенную цену.

В транзакции берётся advisory lock на submissionId. Существующая запись с тем же UUID и SHA-256 канонического payload возвращает прежний reference; несовпадающий payload получает 409. Unique constraint — дополнительная защита. Параллельные retries проверены. Форма сохраняет UUID между повторами одного payload и блокирует одновременные клики; после изменения данных создаёт новый UUID. IP не используется.

Lead, LeadExtra и SYSTEM AuditLog создаются вместе. Telegram вызывается **после commit**, только первым запросом. Успешная запись возвращает `{ok:true,reference}` даже при недоступном или ненастроенном Telegram. Доставка проверяет HTTP status и Bot API `ok`; сохраняет SENT/FAILED. Уведомление содержит исходные контакты для владельца; журналы приложения — только код события и reference. Ошибки драйвера, токены и контакты не печатаются.

Поля Lead структурированы: original/normalized phone, locale, serviceId, area, estimatedPrice, urgent, entrySource, landingPage, comment, estimateText, internalNote, submissionId/hash, telegramStatus. LeadExtra хранит количество и unitPrice snapshot. Заявки из других каналов создаются через `/admin/leads/new` без Telegram-рассылки.

## Клиенты, телефоны и адреса

Используется `libphonenumber-js@1.13.14` с полной metadata (`/max`), `extract:false` и `isValid()`. Международный номер должен иметь `+` или `00`; национальный номер принимается для нормализации только с префиксом `0` и defaultCountry RS. Голые иностранные цифры и непроверенные номера сохраняются для отображения, normalizedPhone остаётся null. Поддержаны +381 / 06…, +7 и другие международные номера. Телефон **не unique**.

Создание клиента, включая быструю форму заказа, проверяет нормализованный телефон под advisory lock. При совпадении возвращаются максимум 10 кандидатов и обязательный выбор: существующий клиент либо явное `allowDuplicate`. Автоматического merge нет. Legacy contacts нормализует идемпотентный additive release helper `scripts/admin/backfill-phones.ts`, с SYSTEM audit без исходных телефонов.

Карточка хранит Telegram/WhatsApp/Viber как контакты, предпочтительный канал, заметки, скидку и условия. Это не интеграция переписки. Адресов несколько: label, полный адрес, квартира, этаж, домофон, комментарий. Изменение и деактивация аудируются; физического удаления через UI нет. Неактивный адрес нельзя выбрать для нового заказа, старые связи сохраняются. Координаты/placeId остаются пустыми.

Статистика клиента вычисляется из БД: число заказов, завершённых, сумма/средняя finalPrice в RSD, последнее completedAt. В карточке показаны последние 20 заявок/заказов, остальные доступны в соответствующем пагинированном реестре с clientId filter. Адресов на карточке максимум 100, результатов поиска клиента — 10, активных адресов в picker — 30.

## Заказы и атомарная конвертация

`/admin/orders/new` выбирает/создаёт клиента и адрес, услугу, площадь, контролируемый SoilLevel, extras, число требуемых клинеров, время, ручную длительность и цену. Клинеры не назначаются. Заказ создаётся как DRAFT со стабильным ORD reference. Отдельный unique requestId и advisory lock защищают повтор успешного submit формы заказа.

Конвертация открывает ту же форму с leadId и перенесёнными исходными данными. Commit одной транзакции: проверка Lead → выбор/создание Client → проверка/создание Address → создание Order и OrderExtra → Lead.clientId → Lead.status CONVERTED → все AuditLog. При любой ошибке откатываются также новый клиент, адрес и аудит. Повторная конвертация/конвертация LOST запрещены; LOST можно сначала вернуть в IN_PROGRESS. Параллельные изменения одной заявки/заказа сериализуются advisory locks. При редактировании заказа можно изменить активный адрес **того же клиента**.

Fixed требует scheduledStart. Flexible требует windowFrom < windowTo, scheduledStart остаётся null. Temporal переводит локальную дату/время Europe/Belgrade в UTC instant; несуществующий и неоднозначный час DST отклоняются, без скрытого выбора смещения. Верхняя граница фильтра «до даты включительно» — начало следующего местного дня, учитывает DST. estimatedDurationMinutes не рассчитывается; manualDurationMinutes хранится отдельно. Transport buffer копируется из BusinessSettings при создании.

## Цена и snapshot

`calculatePrice` — общий источник расчёта public calculator и CRM: исходные диапазоны `basePrice`, минимум 4000, округление большого метража до 100 RSD, extras и срочность +20% с тем же округлением. Публичные цены не переключались на БД; Service/ServiceExtra нужны для FK и справочника.

Order.basePrice — полная рассчитанная сумма **с extras и срочностью до скидки**. discountPercent и discountAmount фиксируются из клиента при создании. finalPrice по умолчанию — расчёт после скидки; priceAdjustment — разница с этой суммой. Для ручного отклонения обязательно priceChangeReason. Денежные/процентные значения допускают максимум два десятичных знака. OrderExtra.unitPrice фиксируется по текущему общему прайсу, изменение справочника не меняет историю.

Редактирование времени/заметок/загрязнения/числа клинеров/ручной длительности сохраняет существующий денежный snapshot, если услуга, метраж, extras и срочность прежние. Изменение объёма работы создаёт новый согласованный snapshot и аудит. Скидка существующего заказа не меняется вслед за профилем клиента. Финальная цена может быть изменена владельцем; пустое поле возвращает расчёт после сохранённой скидки. Закрытые заказы доступны для просмотра.

## Статусы

Правила в `src/lib/domain/crm-types.ts`, проверка в domain. React отображает доступные переходы, сервер их перепроверяет.

| Lead | Допустимые следующие состояния |
| --- | --- |
| NEW | IN_PROGRESS, WAITING_CLIENT, READY_TO_BOOK, LOST |
| IN_PROGRESS | WAITING_CLIENT, READY_TO_BOOK, LOST |
| WAITING_CLIENT | IN_PROGRESS, READY_TO_BOOK, LOST |
| READY_TO_BOOK | IN_PROGRESS, WAITING_CLIENT, LOST |
| LOST | IN_PROGRESS |
| CONVERTED | Нет; устанавливается только конвертацией |

LOST требует причину. CONVERTED не возвращается в NEW обычным изменением статуса.

| Order | Допустимые следующие состояния |
| --- | --- |
| DRAFT | CONFIRMED, CANCELLED |
| CONFIRMED | SCHEDULED, CANCELLED |
| SCHEDULED | EN_ROUTE, IN_PROGRESS, CANCELLED, NO_SHOW |
| EN_ROUTE | IN_PROGRESS, CANCELLED, NO_SHOW |
| IN_PROGRESS | COMPLETED, CANCELLED |
| COMPLETED / CANCELLED / NO_SHOW | Нет |

CANCELLED/NO_SHOW требуют cancellationReason. COMPLETED требует finalPrice и выставляет completedAt в той же транзакции; dashboard учитывает эту сумму по дате завершения. Платежи, выплаты и расходы автоматически не создаются. Перенос времени — ORDER_RESCHEDULED, не статус RESCHEDULED. PAID отсутствует.

## Архитектура, audit и безопасность

`Route Handler → current ADMIN + origin/content-type + Zod → runCrmCommand → PostgreSQL transaction → writeAudit → revalidatePath → router refresh`.

`/api/admin/crm/[command]` принимает только allowlisted команды. Origin должен точно соответствовать BETTER_AUTH_URL, Content-Type — application/json. Роль/active перепроверяются в транзакции по session-derived userId. ClientAddress дополнительно проверяется по clientId/active, compound FK сохраняет инвариант БД. Public intake не предоставляет чтение CRM. Auth sign-up/role update по-прежнему закрыты; cookie/CSRF protections Better Auth сохранены.

Аудируются создание/статус/заметка/связь Lead, создание/редактирование Client, добавление/редактирование/доступность Address, создание/редактирование/время/цена/статус/отмена/завершение Order. Diff allowlisted также в runtime: status, schedule, цены/скидка, безопасные IDs, active, названия changedFields. Контакты, адреса и свободный текст заметок не дублируются в AuditLog. Immutable trigger остаётся. Карточки показывают последние 50 событий, автора, время и понятные статусные/ценовые/временные изменения.

Все реестры серверные, по 20 записей: select нужных колонок, count, stable sort + id tie-break, bounded search. Клиентские суммы — один groupBy на IDs текущей страницы; detail aggregate не загружает все заказы. B-tree indexes покрывают даты/статусы/каналы/услуги/normalizedPhone; pg_trgm GIN — подстрочный поиск имени, телефонов, мессенджеров и reference. Пустые/не найденные состояния, загрузка и безопасная ошибка БД реализованы. Forms сохраняют значения при ошибке, используют labels, field errors и pending state; status формы пересоздаются после перехода, чтобы не выбирать отмену по умолчанию.

## Проверки и release

`npm run lint`, `npm run typecheck`, `npm run db:validate`, `npm run build`, `npm run test:admin`, `npm run test:crm`.

Полный интеграционный прогон принимает только `ADMIN_TEST_BASE_URL=http://localhost:3100` и `ADMIN_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55439/lumaclean_admin_test`. `scripts/admin/prepare-test-db.cjs` пересоздаёт **только** три именованные disposable local DB в контейнере `lumaclean-crm-verify`, проверяя loopback binding. Он также мигрирует foundation fixtures в новую схему и проверяет отсутствие drift. `scripts/admin/test-server.cjs` запускает production build на этой БД с отключёнными delivery credentials. Production не принимается тестами и не содержит fixtures.

Сценарии: concurrent website retries, payload conflicts, Telegram success/failure mock, реальный HTTP persistence, LOST/status/audit/filter, клиент/контакты/адреса/дубликаты, manual/flexible/lead order, полный rollback, чужой/неактивный адрес, extras/discount snapshot, reason, перенос, completion/closed states, current role/CSRF/invalid IDs, сохранение legacy records и idempotent phone backfill. Unit price regression сравнивает 4000 combinations (5 services × 800 areas), исходный public regression — ещё 800 случаев и 18 RU/SR/EN price pages. SEO/articles/forms regressions выполняются без реальных Telegram сообщений.

Миграции: `20261001120000_crm_core` и `20261001121000_crm_search_indexes`. Soil меняет тип через USING cast, не DROP COLUMN; неизвестный legacy soil останавливает migration для ручной проверки. Legacy references заполняются без удаления записей. Release сначала preview Neon, затем после всех проверок production `migrate deploy` через DIRECT_URL, phone backfill и schema diff. Никаких reset/db push. Развёртывание только в существующий Vercel project.

Чтение независимых агрегатов и реестров использует pool через `Promise.all`, без общей транзакции соединения. Business mutations остаются в одной транзакции; зависимые чтения заказа, extras и service внутри неё выполняются последовательно. Это устраняет воспроизведённое предупреждение pg 8.23 о параллельных запросах на одном client, не подавляя журналы.

## Ограничения следующего этапа

Нет автоматического фонового retry Telegram: FAILED/PENDING видны в карточке, Lead сохранён. При остановке процесса между commit и доставкой остаётся PENDING; повтор submission не отправляет уведомление заново. Exactly-once внешняя доставка не обещается; дальнейший этап — durable outbox с контролируемым retry.

Нет merge клиентов, удаления Lead/Client/Order, пересоздания закрытого заказа, истории платежей, календаря, назначения клинеров, карт/маршрутов, формулы длительности, оптимизации, inbox/AI, выплат/finance UI и Excel import. Контакт клиента в существующем заказе берётся из текущей CRM-карточки; адрес можно редактировать в профиле, отдельный исторический адресный snapshot пока не введён. Финансовый snapshot заказов сохраняется независимо от будущего прайса.

Документация библиотеки телефона: [libphonenumber-js](https://github.com/catamphetamine/libphonenumber-js). Next.js 16 server/routing APIs проверены по локальным `node_modules/next/dist/docs`.
