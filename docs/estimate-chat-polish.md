# LumaClean — форма заявки и полнота ответов чата

Дата: 25 октября 2026. Рабочая копия: `upholstery-premium`, ветка `codex/estimate-chat-polish`, база `22b5818` (объединённый PR #30). Копия была чистой до работы. Изменения из других копий не переносились. Production, push, deploy, миграции и seed не выполнялись.

Проверяемый сервер: `http://localhost:3107`. Сервер запущен без DATABASE_URL, с существующим локальным fallback каталога. Все browser API и внешняя аналитика перехвачены до навигации. Это UI mocked, а не подтверждение доставки в CRM/Telegram.

## 1. Аудит

| Недостаток | Причина и исправление |
| --- | --- |
| Фиктивный LC-026 до отправки | `editorialContent.estimate.calculation` содержал статичный номер на трёх языках. Теперь это предварительный расчёт; клиент читает настоящий `reference` успешного `/api/lead`. |
| Слишком округлые/неодинаковые элементы | Слои `site-base.css`, `site-production.css`, `homepage-focused.css` смешивали радиусы 12 px, круглые счётчики и нативные чекбоксы разных размеров. Стили главной формы собраны в отдельном scoped файле; устаревшие дубли главной удалены. |
| Текст переключателей выглядел смещённым | Базовый span был block, центрирование включалось только в отдельных responsive правилах. Теперь одинаковый flex, line-height и высота во всех состояниях. |
| Вопросы из пакета могли исчезнуть | `directBusinessQuestion` исключает персональный итог с площадью. Эта проверка всего объединённого текста также исключала независимые вопросы; `conversionIntake` возвращал следующий вопрос квалификации до вызова модели. |
| Недостаточная гарантия приветствия | Промпт запрещал повторное приветствие, но первая реплика могла поступить из deterministic intake/recovery, минуя модель. Теперь приветствие нормализуется при сохранении по всей истории AI/ADMIN, внутри conversation lock. |
| Пограничный порядок сообщений | `receivedAt` фиксировался до блокировки; одинаковые timestamps сортировались по случайному ID. Запрос, ожидавший lock, мог попасть перед уже сохранённым ответом. Теперь `sentAt` строго возрастает внутри lock; исходный receivedAt сохраняется для Website и transport. Относительные даты модели и повторного извлечения фактов используют это исходное время, в том числе при ожидании lock через полночь. |

Pipeline сохраняется: Website Chat → POST → `acceptMessage` → AgentJob → Queue → `claimJob` → `currentClientTurn` → модель/tools → `persistAnswer` → SSE. Debounce, revision, SUPERSEDED, lease, responseToMessageId и recovery остаются действующими. Перед tools и публикацией сохраняются проверки актуальности и режима управления.

Lead сохраняется через `/api/lead` → валидация → `saveWebsiteLead` → серверный пересчёт → транзакционный Lead/notification/audit. Защита submissionId сохраняется. Отдельно устранён сброс success при смене вида запроса: повторная отправка уже успешной формы не разрешается.

## 2. Изменения формы

- Единственный крупный угол: нижний правый, 100 px desktop, 72 px tablet, 48 px mobile. Остальные три — 0. Весь двухколоночный лист обрезает общий фон, включая тёмную правую часть.
- Геометрия сверена с `.up-hero-visual` страницы химчистки: исходный выразительный угол 100 px. Саму страницу не изменяли. В приложении к заданию был только текст; отдельные два референсных скриншота отсутствовали.
- Сетка 1.08/0.92, согласованные отступы, разделители, вторичный текст, компактные счётчики и строгие радиусы 2–3 px. На узких экранах одна колонка и 44 px кнопки счётчиков.
- Нативные checkbox 20×20 px, одинаковая обводка и отметка на светлом и тёмном фоне, focus-visible, disabled и forced-colors fallback.
- Ползунок сохраняет диапазон 25–180 и шаг 1; дорожка показывает заполнение. Формулы и доступные опции не изменены.
- Итог использует существующий AnimatedPrice (400 ms, отмена предыдущего requestAnimationFrame); accessible output и payload обновляются немедленно. Валюта отделена от цифр.
- Нативные details сохраняют клавиатурную семантику. Плавное раскрытие/закрытие через `::details-content` там, где браузер поддерживает interpolate-size; в остальных браузерах — нативное раскрытие. Reduced motion отключает новые переходы.
- Валидация связана с полями через aria-describedby, форма сообщает aria-busy. Номер заявки появляется исключительно в success из ответа сервера, без клиентского генератора и без обещания подтверждённой уборки.

Источник цен: текущие `src/lib/pricing.ts`, `appliance-catalog.ts`, серверный `domain/crm-pricing.ts`, утверждённые pricing/window tests. Документ `pricing-update-20261017.md` содержит более старые цены окон; последующее утверждённое изменение закреплено в `tests/agent/window-pricing.test.ts` и `tests/crm/approved-pricing.test.ts`: 700/1000 RSD. Старый документ не использован для замены текущих цен. Прайс, скидки, срочность и округление не менялись.

## 3. Изменения AI-чата

- Подписи RU, SR Latin, SR Cyrillic, EN заменены на указанные в задании нейтральные тексты. Имя, логотип, human-control indication и честный ответ о том, что ассистент — AI, сохраняются.
- Первое содержательное сообщение получает локализованное приветствие при persistence. Повторные приветствия в начале следующих ответов удаляются. Учитываются реальные предыдущие AI/ADMIN сообщения, в том числе вне последних 12 реплик; cancelled/failed/internal не считаются ответом. Retry/fallback используют тот же путь.
- Независимые вопросы не отправляются в короткий intake вместо ответа. Модель получает каждое сообщение текущего пакета отдельным user-сообщением, в правильном порядке. Инструкции требуют ответить на все вопросы до квалификации, использовать известные факты и получать недостающие сведения существующими tools.
- Устаревшая генерация по-прежнему не может выполнить tools/сохранить ответ при изменении revision или lease. OFF, SHADOW, HUMAN_CONTROL и подтверждение перед Order сохранены.
- Нет новой NLP-системы, провайдеров, миграций или автоматического сообщения в БД при открытии виджета.

## 4. Изменённые файлы

| Файл | Изменение |
| --- | --- |
| `src/app/styles/estimate-focused.css` | Scoped геометрия, сетка, controls, checkbox, range, details, responsive/reduced motion. |
| `src/app/styles/homepage-focused.css` | Удалены прежние дубли оформления формы. |
| `src/app/[locale]/site.css` | Подключён stylesheet формы. |
| `src/components/site/estimate.tsx` | Reference после success, точная анимация суммы, состояния и доступность. |
| `src/lib/site-content.tsx` | Удалён статичный LC-026 в RU/SR/EN. |
| `src/components/site/website-chat.tsx` | Подключена общая нейтральная подпись. |
| `src/lib/agent/persona.ts` | Локализованные подписи; AI transparency сохранена. |
| `src/lib/agent/response-context.ts` | Порядок времени, составной запрос, отдельные сообщения модели, greeting normalization. |
| `src/lib/agent/inbox.ts` | Монотонное время ingress под существующим lock. |
| `src/lib/agent/tools.ts` | Повторное извлечение фактов использует исходное receivedAt, а не время сортировки. |
| `src/lib/agent/runner.ts` | Полнота пакета, greeting при persistence/recovery, монотонное время ответа. |
| `tests/agent/response-completeness.test.ts` | Классификация составного запроса, языки, границы сообщений и времени. |
| `tests/agent/burst-pipeline-mocked.test.ts` | Реальные ingress/claim/runner/persistence с in-memory Prisma substitute и mock providers. |
| `tests/browser/estimate-chat.mjs` | Mocked UI regression Chrome/WebKit, screenshots и JSON evidence. |
| `docs/estimate-chat-polish.md` | Этот отчёт. |

## 5. Автоматические и браузерные проверки

| Команда | Результат |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, 0 errors; 2 прежних no-img-element warnings чата |
| `npm run build` | PASS |
| `npm run db:validate` | PASS |
| `npm run test:agent` | 798 PASS, 18 SKIP, 0 FAIL |
| `npm run test:crm` | 97 PASS, 3 SKIP, 0 FAIL |
| `npm run test:finance` | 40 PASS, 2 SKIP, 0 FAIL |
| `npm run test:scheduling` | 18 PASS, 2 SKIP, 0 FAIL |
| `node --conditions=react-server --import tsx --test tests/reliability/*.test.ts` | 2 PASS, 3 SKIP, 0 FAIL |
| Два новых agent test files отдельно | 18 PASS, 0 FAIL; входят в test:agent выше |
| `git diff --check` | PASS |

Итого перечисленных agent/CRM/finance/scheduling/reliability suites: **955 PASS, 28 SKIP, 0 FAIL**. Для npm test команд установлен `NODE_OPTIONS=--conditions=react-server`, поскольку suite импортирует server-only код.

Regression red/green подтверждён: при временном возврате прежнего intake-маршрута составной запрос вместо ответов на вопросы о средствах и оплате получал «Нужны ли дополнительные услуги…?». Новый тест падал; после восстановления исправления проходит. Лог: `artifacts/estimate-chat/regression-red.log`.

Mocked pipeline проверяет 3/5 сообщений, конкурентный ingress с одинаковым временем, same-ID retry, новый вопрос во время генерации, stale output, fallback/оба провайдера недоступны, recovery, expired lease, takeover, OFF и SHADOW. Это тест бизнес-пути на заглушке ORM, не PostgreSQL concurrency proof.

| Язык | Chrome: 375 / 768 / 1440 | WebKit: 375 / 768 / 1440 |
| --- | --- | --- |
| RU | PASS / PASS / PASS | PASS / PASS / PASS |
| SR Latin | PASS / PASS / PASS | PASS / PASS / PASS |
| EN | PASS / PASS / PASS | PASS / PASS / PASS |

Дополнительно оба движка проверены при 320, 390, 1024, 1280 px; высота 1000 px. Итого 42 начальных layout проверки; раскрытые/заполненные формы также не имеют overflow на всех семи ширинах. Скриншоты чата: 320/390/768/1440.

В каждом движке: 13 групп сценариев, 25 mocked отправок, 0 неожиданных console/page errors, 32 внутренних URL/robots/sitemap доступны. Проверены metadata главной RU/SR/EN, canonical/hreflang/html lang и fragment targets. Проверены валидация, все checkbox, area/service/extras, открытие/закрытие, pending/double click, 400/429/503/network/retry, submissionId, mixed/pure cleaning/standalone upholstery, реальный reference из mock response, mini CONTACT_REQUEST и недоступная срочность.

Существующий `tests/browser/upholstery-premium.mjs`: PASS, 18 layout проверок RU/SR/EN, quantity/corner seats/combined/unsafe fabric/validation/mocked submit, ошибки и retry, все шесть направлений переключения языка. Фото CTA открывает существующий чат; сообщения/фото не отправлялись.

## 6. Скриншоты

Все файлы локальные; `artifacts/` исключён из Git. После-снимки формы скрывают fixed header/chat/dev chrome только на время screenshot, чтобы они не перекрывали длинный лист. Исходные before сохранены до правок.

| Экран | До | После |
| --- | --- | --- |
| Desktop RU | [до](../artifacts/estimate-chat/before-ru-1440.png) | [после](../artifacts/estimate-chat/after-ru-1440.png) |
| Mobile RU | [до](../artifacts/estimate-chat/before-ru-390.png) | [после](../artifacts/estimate-chat/after-ru-390.png) |
| Desktop SR | — | [после](../artifacts/estimate-chat/after-sr-1440.png) |
| Mobile SR | — | [после](../artifacts/estimate-chat/after-sr-390.png) |
| Desktop EN | — | [после](../artifacts/estimate-chat/after-en-1440.png) |
| Mobile EN | — | [после](../artifacts/estimate-chat/after-en-390.png) |

Дополнительно: [референс дивана](../artifacts/estimate-chat/reference-upholstery.png), [раскрытые услуги](../artifacts/estimate-chat/expanded-filled-ru-1440.png), [валидация](../artifacts/estimate-chat/validation-ru.png), [отправка](../artifacts/estimate-chat/sending-ru.png), [успех](../artifacts/estimate-chat/success-ru.png), [чат desktop](../artifacts/estimate-chat/chat-ru-1440.png), [чат mobile](../artifacts/estimate-chat/chat-ru-390.png). Аналогичные состояния есть для SR/EN; отдельная папка `webkit/`.

## 7. Ограничения и регрессии

- PostgreSQL интеграции SKIP: изолированный сервер недоступен, Docker daemon не запущен; тестовые DATABASE_URL не заданы. Никакая другая БД не использовалась вместо тестовой.
- Реальные модели не вызывались. Полнота передачи контекста и маршрутизация подтверждены mocks; семантическая полнота реального LLM-ответа требует отдельной изолированной provider проверки.
- Live Queue/SSE delivery, Telegram/WhatsApp и реальная доставка уведомлений не подтверждены. Существующие тесты интерфейсов/границ проходят; внешние отправки не выполнялись.
- Проверка responsive Chrome/WebKit не заменяет физические iOS/Android, VoiceOver/NVDA, exhaustive accessibility audit или полевые CWV. SEO проверено на главной и доступности перечисленных внутренних ссылок; полноценный SEO-аудит всех статей не выполнялся.
- Новых подтверждённых UI регрессий в проверенной матрице нет. Цены, CRM schema, booking, provider config, видео, аналитика и SEO механизмы не менялись.

## 8. Готовность

Изменения реализованы и готовы к ревью кода и визуальному согласованию. Автоматического деплоя нет. Полная готовность к production/AUTO **не сертифицирована**: существующая проверка `ai_release_source_mismatch` закономерно сообщает об изменённом исходном коде. Release manifest и source-bound live booking proof не подменялись и не обновлялись без соответствующей проверки. Перед выпуском нужны доступная изолированная PostgreSQL, проверка реальных провайдеров/очереди/доставки и штатная повторная сертификация источника.
