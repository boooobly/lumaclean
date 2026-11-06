# LumaClean — SEO, цены и конверсия заявок
Проверено 26 октября 2026 года.

Рабочая копия: `C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium`. База: `e37c059`, документированный выпуск сайта от 25 октября. Ветка изменений: `codex/seo-lead-consistency`. Исходная копия была чистой. Незавершённые изменения в `lumaclean-release-candidate/` и других копиях не переносились и не изменялись.

## Результат и границы
Подтверждённые проблемы исправлены в коде. Тарифы, дизайн, Prisma-схема, существующая CRM, каналы связи и архитектура outbox/Queue сохранены. Новых зависимостей нет. Production не публиковался; миграции, seed, live AI benchmarks, реальные заявки, заказы и тестовые уведомления не запускались.

Тестовый адрес: `http://127.0.0.1:3137`, локальный `next start` после production build. Это сборка в режиме Next.js production, с локальным профилем окружения, пустым DATABASE_URL и AI_AGENT_ENABLED=false. Профиль не выдаётся за развёрнутый Vercel production. Браузерные API отправки и аналитика перехватывались. После проверки собственный сервер остановлен.

## Подтверждённые проблемы
| Приоритет | Проблема до исправления | Что сделано |
|---|---|---|
| P1 | На главных RU/SR/EN meta description обещал уборку от 4 000 RSD, при утверждённом минимуме 4 900 RSD | Текст теперь получает локализованную цену из priceMatrix.regular; тот же результат используют description, Open Graph и Twitter |
| P1 | Отдельный API химчистки публиковал общую очередь, но не подключал существующую резервную обработку после ответа при отказе Queue | Подключён тот же адресный publishWebsiteLead и notifyWebsiteLead через after, что у обычной заявки; публичный формат ответа сохранён |
| P2 | Форма химчистки не передавала страницу входа и источник в CRM | Добавлена необязательная атрибуция с проверкой опубликованных путей и фиксированного списка источников; поля сохраняются в Lead и попадают в существующее уведомление |
| P2 | Для химчистки не было событий формы, успеха и ошибок; клик по телефону не измерялся | Добавлены события, различение форм, безопасный phone_click; существующий messenger_click сохранён |
| P2 | На химчистке HTML x-default указывал на SR, sitemap — на RU | HTML приведён к RU, в соответствии с sitemap и остальным сайтом. Взаимные RU/SR/EN пары сохранены |
| Проверки | Старый SEO runner ожидал ровно 63 URL, требовал правовые страницы в sitemap и не учитывал Organization внутри Service.provider; клиентские SSR fixtures не имели router/pathname context | Исправлены проверочные инструменты и контекст fixtures. Проверки продолжают требовать доступность ссылок, правильную индексируемость и валидные альтернативы |

P0 в доступном объёме проверки не подтверждены. Это не заключение о недоступных внешних системах.

## Архитектура и путь заявки
Стек выбранной копии: Next.js 16.3.8, React 19.2.4, TypeScript, next-intl, Prisma/Postgres, Vercel Queue и Telegram. Перед изменениями прочитана документация установленного Next.js, в том числе Metadata API и sitemap.

Маршруты локализованы. Главные — /ru, /sr, /en; услуги имеют собственные slugs; химчистка — отдельные локализованные страницы. Статьи используют реестр публикаций. Правовые страницы существуют отдельно от поискового sitemap.

Обычная форма и краткий контакт идут в /api/lead. Детальный калькулятор мебели использует /api/upholstery/lead. В обоих направлениях данные валидируются на сервере, расчёт выполняется сервером. Lead и событие уведомления сохраняются транзакционно; submissionId и хэш защищают от повторного создания. Существующий worker использует lease, состояния доставки и повторные попытки. Неопределённый исход UNKNOWN не переводится автоматически в повторную отправку.

API химчистки теперь подключается к тому же существующему механизму публикации и резервного выполнения, без отдельного транспорта Telegram. Внутренний id Lead возвращается серверному обработчику для выбора события, но не добавляется в публичный HTTP-ответ.

На уровне браузера атрибуция фиксируется вместе с содержимым отправки. После 400/429/503 или сетевого отказа повтор неизменённой заявки сохраняет и payload, и submissionId; редактирование полей создаёт новый ключ. Событие generate_lead возникает после успешного HTTP-ответа с ok=true, а не по нажатию кнопки.

### Какие части проверены реально
- Код, сборка, типы, линтинг и локальный сервер — реально.
- Каталог production-ветки Neon — SELECT-проверка, без записи.
- Состояния существующих уведомлений — агрегированный SELECT без чтения текстов, контактов, заявок или заказов.
- Сохранение заявки и атомарный outbox в изменённом сценарии — mocked Prisma tests.
- Отправка форм и ошибки в браузере — mocked HTTP.
- Новая заявка → реальный PostgreSQL → реальный Telegram с подтверждением получателя — не выполнялась.

## Полная сверка прайса
Проверены [src/lib/pricing.ts](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/src/lib/pricing.ts), [src/lib/appliance-catalog.ts](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/src/lib/appliance-catalog.ts), [src/lib/domain/crm-pricing.ts](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/src/lib/domain/crm-pricing.ts), [src/lib/upholstery.ts](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/src/lib/upholstery.ts), seed/updater, метаданные, видимые таблицы, FAQ, Service.offers, калькуляторы и серверные сервисы.

Утверждённый прайс подтверждён документом обновления от 17 октября, последующими изменениями окон, независимыми approved-pricing/window tests и текущим каталогом БД. Старые суммы в историческом отчёте не использовались для замены действующих тарифов.

| Услуга | До 39 м² | 40–59 | 60–79 | 80–99 | От 100 м², RSD/м² |
|---|---:|---:|---:|---:|---:|
| Поддерживающая | 4 900 | 6 000 | 8 200 | 9 800 | 98 |
| Генеральная | 9 900 | 11 400 | 14 200 | 17 000 | 180 |
| Въезд/выезд | 10 700 | 12 800 | 15 600 | 18 400 | 180 |
| Airbnb | 4 900 | 5 800 | 7 400 | 9 000 | 90 |
| Небольшой офис | 4 900 | 5 800 | 7 400 | 9 000 | 90 |

Текущие окна: стандартное 700 RSD, большое 1 000 RSD. Более ранние значения 1 000/1 500 из исторического документа уже заменены утверждённым изменением; отката не было. Сумма 4 000 RSD остаётся корректной для минимума отдельного выезда химчистки и двухместного дивана, поэтому глобальная замена числа была бы ошибкой.

Сверка production-ветки Neon `lumaclean-admin/main`: 25 диапазонов, 14 доплат и девять ключей каталога мебели совпали с кодом. Тарифы и единицы не менялись. Программная сверка: [catalog-comparison.log](C:/Users/vleko/Documents/ChatGPT/LumaClean/outputs/seo-implementation-2026-10-26/catalog-comparison.log); снимок только бизнес-каталога: [production-catalog-readonly.json](C:/Users/vleko/Documents/ChatGPT/LumaClean/outputs/seo-implementation-2026-10-26/production-catalog-readonly.json).

Сохранены утверждённые особенности границ и округления. Например, въезд/выезд на 99→100 м² меняется 18 400→18 000 RSD; это не исправлялось как ошибка. Срочность остаётся +20% с существующим округлением. Химчистка сохраняет индивидуальное согласование и human review; неопределённые услуги не получили выдуманный числовой тариф.

## Индексация и техническое SEO
Проверены все 69 URL sitemap и шесть дополнительных правовых страниц, 19 отдельных HTTP-проверок редиректов/ошибочных адресов/служебных файлов.

Результат: 0 ошибок в рамках автоматических правил [docs/seo-audit/check-seo.mjs](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/docs/seo-audit/check-seo.mjs). Подтверждены:
- robots.txt и sitemap.xml доступны, robots разрешает публичный обход;
- публичные URL возвращают 200, не содержат запрещающего noindex в HTML или X-Robots-Tag локального профиля;
- self-canonical, html lang, HTML/sitemap hreflang, взаимность и x-default согласованы;
- локализованные slugs не подменяются простым изменением префикса;
- redirects /v2 и завершающего slash работают; ошибочные slugs возвращают 404 с noindex;
- опубликованные страницы достижимы через внутренние ссылки; проверены якоря;
- JSON-LD разбирается, проверяемые Service/FAQ/Article/Breadcrumb URL и видимый текст согласованы;
- пустой alt у декоративных изображений не считался автоматической ошибкой.

Структурированные данные уже были реализованы. Не добавлялись фиктивный адрес, рейтинги, отзывы или обещания расширенных результатов. Проверка собственным runner не заменяет Google Rich Results Test и решение Google об индексировании.

Дубли / и /ru из прежнего аудита не подтвердились как две самостоятельные страницы: корень использует редирект. Замечание о малом количестве русского текста было связано с обработкой кириллицы; контент ради счётчика слов не дописывался.

GSC Wizard отказал с payment_required/subscription_required. Реальные показы, клики, исключённые страницы, выбранный Google canonical и каннибализация по запросам не получены. Низкая видимость OpenRush не использовалась как доказательство отсутствия страниц в индексе Google.

## Коммерческие страницы
Страницы уборки квартир и генеральной уже содержат конкретные локализованные title/H1, состав работ, ограничения, таблицу по площади, FAQ и переход к расчёту. Страница химчистки сочетает фирменный эмоциональный заголовок с конкретными метаданными, перечнем мебели, прайсом, проверкой ткани и заявкой на согласование. Подтверждённой необходимости переписывать эти компоненты или увеличивать объём текста не найдено.

Коммерческий интент сохранён: заказ и расчёт на услуге; объяснение стоимости и выбора — в соответствующих статьях со ссылками на услугу. Реальное перекрытие поисковых запросов между статьёй о стоимости и коммерческой химчисткой остаётся вопросом к GSC. Внутренние ссылки и достижимость страниц проверены; одинаковые районные страницы, новые отзывы и кейсы не создавались.

## Измерение конверсии
Публичный HTML содержит GA4 ID `G-K1KM379T2Q` и интерфейс согласия. Само наличие ID не подтверждает получение событий GA4.

| Событие | Когда отправляется | Данные |
|---|---|---|
| generate_lead | API ответил успехом | locale, service при наличии, form_type |
| phone_click | Нажат tel-ссылка | locale, без номера |
| messenger_click | Нажата ссылка Telegram/WhatsApp/Viber | locale, фиксированное имя канала |
| form_start | Первое взаимодействие с формой | locale, form_type и service при наличии |
| calculator_interaction | Изменены параметры расчёта | фиксированные значения, существующее ограничение частоты |
| lead_error | Валидация, ошибка API или сети | фиксированный error_type |

form_type различает estimate/contact/upholstery. В общей форме режим «только химчистка» больше не классифицируется в аналитике как regular. Полные messenger URL, query strings, имя, телефон, свободный комментарий и содержимое формы в события не передаются.

Consent gate сохранён: без разрешения GA не загружается, события не отправляются штатным Analytics, leadAttribution не читает сохранённый источник для формы. Отказ от аналитики не мешает заявке. Эффект Analytics, смена согласия, переходы и приватность проверены VM-тестом; компоненты форм отдельно проверены в реальном браузере с наблюдателем событий.

Источник и landing page связывают обращения с CRM, без нового идентификатора пользователя или передачи контактов в GA. Известная метка GBP поддерживается существующим способом; произвольные UTM в новую систему атрибуции не добавлялись.

## Telegram и внешняя инфраструктура
Read-only агрегат WEBSITE_LEAD за последние семь дней в production-ветке: три события DELIVERED, pending_due=0. Это сохранённые состояния существующих событий, а не новые тестовые отправки и не подтверждение получателем доставки из изменённой версии. Нет оснований объявлять текущий Telegram неработающим или заменять существующие токены.

Применение, lease и статусы worker не менялись. Проверены PENDING при отказе Queue, UNKNOWN и DELIVERED: резервный путь не начинает повторную прямую отправку для неопределённого или завершённого результата. [Снимок внешних проверок](C:/Users/vleko/Documents/ChatGPT/LumaClean/outputs/seo-implementation-2026-10-26/external-readonly-checks.json).

PageSpeed API вернул 429 RESOURCE_EXHAUSTED. Полевые Core Web Vitals не получены. Локальные Navigation/Paint timings записаны только как лабораторные наблюдения; они не выдаются за LCP/INP/CLS реальных пользователей. Производительность не объявляется исправленной или подтверждённой.

## Изменённые файлы
- Метаданные и даты: [src/app/[locale]/page.tsx](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/src/app/[locale]/page.tsx), [messages/ru.json](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/messages/ru.json), [messages/sr.json](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/messages/sr.json), [messages/en.json](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/messages/en.json), [src/app/[locale]/[upholstery]/page.tsx](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/src/app/[locale]/[upholstery]/page.tsx), [src/lib/content-revisions.ts](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/src/lib/content-revisions.ts).
- Общая карта опубликованных путей и форма атрибуции: [src/lib/public-paths.ts](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/src/lib/public-paths.ts), [src/lib/validation/lead-attribution.ts](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/src/lib/validation/lead-attribution.ts), [src/lib/validation/crm.ts](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/src/lib/validation/crm.ts), [src/app/[locale]/layout.tsx](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/src/app/[locale]/layout.tsx), [src/app/api/lead/route.ts](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/src/app/api/lead/route.ts).
- Химчистка, CRM и резерв уведомления: [src/components/site/upholstery-calculator.tsx](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/src/components/site/upholstery-calculator.tsx), [src/lib/services/upholstery-leads.ts](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/src/lib/services/upholstery-leads.ts), [src/app/api/upholstery/lead/route.ts](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/src/app/api/upholstery/lead/route.ts), [src/lib/services/website-leads.ts](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/src/lib/services/website-leads.ts).
- События трёх форм и контактов: [src/lib/analytics.ts](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/src/lib/analytics.ts), [src/components/site/analytics.tsx](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/src/components/site/analytics.tsx), [src/components/site/estimate.tsx](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/src/components/site/estimate.tsx), [src/components/site/contact-request.tsx](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/src/components/site/contact-request.tsx).
- Проверочные инструменты: [docs/seo-audit/check-seo.mjs](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/docs/seo-audit/check-seo.mjs), [docs/seo-audit/check-attribution.mjs](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/docs/seo-audit/check-attribution.mjs).
- Целевые тесты: [tests/admin/seo-consistency.test.ts](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/tests/admin/seo-consistency.test.ts), [tests/admin/conversion-analytics.test.ts](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/tests/admin/conversion-analytics.test.ts), [tests/admin/analytics-effect.test.ts](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/tests/admin/analytics-effect.test.ts), [tests/admin/pricing-sitemap.test.ts](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/tests/admin/pricing-sitemap.test.ts), [tests/finance/upholstery-lead-mocked.test.ts](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/tests/finance/upholstery-lead-mocked.test.ts), [tests/reliability/upholstery-http.test.ts](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/tests/reliability/upholstery-http.test.ts), [tests/browser/seo-conversion.mjs](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/tests/browser/seo-conversion.mjs), [tests/browser/seo-navigation.mjs](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/tests/browser/seo-navigation.mjs).
- Клиентские SSR fixtures: [tests/admin/messenger.test.tsx](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/tests/admin/messenger.test.tsx), [tests/register-client.cjs](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/tests/register-client.cjs). Добавлены настоящий router/pathname context и test-only обработка CSS; поведение CRM не менялось.

## Выполненная проверка
| Проверка | Результат |
|---|---|
| Целевые проверки до исправлений | Воспроизведены старая цена, отсутствие атрибуции и отсутствие адресного recovery у API химчистки |
| Серверные/доменные Node-тесты, все *.test.ts | 1 043 PASS, 0 FAIL, 32 SKIP |
| Клиентские SSR fixtures *.test.tsx в отдельном профиле | 15 PASS, 0 FAIL |
| Общий результат Node | 1 058 PASS, 0 FAIL; 32 интеграционных теста без изолированной БД пропущены |
| npm run typecheck | PASS |
| npm run lint | 0 ошибок; два прежних no-img-element предупреждения в website-chat.tsx |
| npm run build | PASS: prisma generate + next build; без миграций и БД |
| Полный HTTP SEO runner | 69 страниц + 19 проверок + шесть правовых ссылок, 0 найденных ошибок |
| Browser estimate-chat | 21 проверка размеров, 13 групп сценариев, 25 mocked отправок, 0 page errors |
| Browser upholstery-premium | 18 проверок размеров, цены/материалы/согласие/ошибки/повторы/фото-CTA/смена языка, PASS |
| Browser seo-conversion | 18 проверок размеров, 135 независимых граничных расчётов, девять сценариев форм, 12 языковых переходов, PASS |
| Финальный smoke событий | Девять сценариев форм с form_type, отказами/повторами и атрибуцией, PASS |
| Browser seo-navigation | 36 проверок размеров статей и правовых страниц, 12 переходов home/article, PASS |

Матрица обязательных ширин, высота 1000 px:
| Локаль | 375 px | 768 px | 1440 px |
|---|---|---|---|
| RU | PASS | PASS | PASS |
| SR, латиница | PASS | PASS | PASS |
| EN | PASS | PASS | PASS |

Покрыты главные, уборка квартир, генеральная уборка, химчистка, индекс/страница статьи, privacy/data-deletion. Всего 93 записи геометрии в основных browser-отчётах, без прибавления повторного smoke. Есть дополнительные проверки 320/390/1024/1280 px.

Проверены 400/429/503, сетевой отказ/таймаут через перехват, состояние ожидания, повторное нажатие, retry с тем же ключом и запрет повторной отправки после успеха. Намеренно созданные ошибки ресурсов в отрицательных сценариях отдельно помечены; они не маскируются как ошибки приложения. Фото-CTA только открывал чат и input файла, без загрузки и сообщений. Смена языка сохраняет прежнее поведение сброса заполненной формы.

Машиночитаемый итог: [verification-summary.json](C:/Users/vleko/Documents/ChatGPT/LumaClean/outputs/seo-implementation-2026-10-26/verification-summary.json). Логи: [final-tests.log](C:/Users/vleko/Documents/ChatGPT/LumaClean/outputs/seo-implementation-2026-10-26/final-tests.log), [messenger-tests.log](C:/Users/vleko/Documents/ChatGPT/LumaClean/outputs/seo-implementation-2026-10-26/messenger-tests.log), [typecheck-final.log](C:/Users/vleko/Documents/ChatGPT/LumaClean/outputs/seo-implementation-2026-10-26/typecheck-final.log), [lint-final.log](C:/Users/vleko/Documents/ChatGPT/LumaClean/outputs/seo-implementation-2026-10-26/lint-final.log), [build-final.log](C:/Users/vleko/Documents/ChatGPT/LumaClean/outputs/seo-implementation-2026-10-26/build-final.log), [seo-final.json](C:/Users/vleko/Documents/ChatGPT/LumaClean/outputs/seo-implementation-2026-10-26/seo-final.json). Browser evidence и screenshots: [каталог артефактов](C:/Users/vleko/Documents/ChatGPT/LumaClean/upholstery-premium/artifacts/seo-2026-10-26). Мобильные screenshots калькулятора и hero химчистки просмотрены.

Команды Node-профилей из корня выбранной копии:
```powershell
# Не задавать реальные тестовые DATABASE_URL/BASE_URL без подтверждения изоляции.
$files = Get-ChildItem tests -Recurse -File |
  Where-Object Name -Match '\.test\.ts$' | ForEach-Object FullName
node --conditions=react-server --import tsx --test @files
node --require ./tests/register-client.cjs --import tsx --test tests/admin/messenger.test.tsx
npm run typecheck
npm run lint
npm run build
node docs/seo-audit/check-seo.mjs http://127.0.0.1:3137 report.json
```
В фактическом запуске удалены test DATABASE_URL/BASE_URL из окружения; DATABASE_URL указывал на заведомо недоступный локальный synthetic адрес для Node-тестов. Перед сборкой и сервером DATABASE_URL был пустым. Недоступность настоящего persistence не маскировалась как PASS.

## Что осталось и действия владельца
1. **GSC:** восстановить доступ GSC Wizard через [подписку](https://tool.gscwizard.com/settings/subscription) либо предоставить отчёты напрямую из Search Console. Проверить sitemap, индексирование и URL Inspection для RU/SR/EN: квартиры, генеральная и химчистка; выгрузить запросы/страницы за 28 и 90 дней. До этих данных каннибализация и причины исключения неизвестны.
2. **GA4:** в свойстве G-K1KM379T2Q проверить DebugView/Realtime после разрешения аналитики, отметить generate_lead ключевым событием; phone_click и messenger_click учитывать как вспомогательные действия. При необходимости зарегистрировать event dimensions form_type/service/locale/entry_source. Успех приёмника GA4 этим аудитом не подтверждён.
3. **БД/HTTP:** 32 теста требуют отдельных guarded fixtures. Для reliability-профиля предусмотрены RELIABILITY_TEST_DATABASE_URL с loopback БД lumaclean_reliability_test и RELIABILITY_TEST_BASE_URL на 127.0.0.1. Другие suites имеют собственные ограничения; нельзя подставлять одну случайную базу или production. Создание fixtures, миграции и seed ради этой проверки не выполнялись.
4. **Telegram:** существующие токены не требуют замены по полученным данным. Для подтверждения доставки изменённой версии нужен отдельно разрешённый тест в изолированной среде/согласованном канале: один submissionId, один Lead/event, подтверждённый message_id и получение оператором. При UNKNOWN сначала сверять канал, не нажимать retry вслепую.
5. **CWV:** повторить PageSpeed после снятия квоты либо измерить в собственном доступном инструменте. Отделять Lighthouse lab от CrUX field; отсутствие CrUX на небольшом сайте не означает нулевые показатели.
6. **Допуск релиза:** source fingerprint изменился, поэтому прежний release/ai-go-live.json больше не удостоверяет эти исходники. Штатный AI release guard показывает ai_release_source_mismatch. Файл допуска не переподписывался и gate не обходился; перед публикацией нужен отдельный review и действительная релизная верификация точного источника. Live provider/booking проверки и публикация в текущую задачу не включались.

## Google Business Profile
На сайте уже есть единое имя LumaClean, основной телефон +381 65 347 0308, отдельный номер WhatsApp +381 65 347 0309, Белград как зона обслуживания, часы приёма обращений 09:00–22:00, ограничения языков и ссылки на карту/отзывы. JSON-LD описывает Organization и территорию услуг без вымышленного адреса.

Прямого управления профилем не было. Для владельца:
- оставить название LumaClean без вставки поисковых ключей;
- использовать формат выездного сервиса: если клиентов по адресу не принимают, скрыть адрес; указать реально обслуживаемые районы Белграда, не создавать дубликаты профиля по районам;
- выбрать доступную категорию уборки жилья и дополнительную категорию химчистки мебели только при соответствии реальной услуге;
- сверить основной телефон, фактические часы и услуги. Часы приёма обращения не равны обещанию уборки круглосуточно;
- использовать сайт `https://lumacleanrs.com/sr?utm_source=google&utm_medium=organic&utm_campaign=google_business_profile`;
- поддерживать реальные фотографии работ и подлинные отзывы. Иллюстрации с сайта не выдавать за выполненные клиентские кейсы;
- цены услуг сверять с утверждённым каталогом, не добавлять уборку после ремонта, гарантии удаления любых пятен или неподтверждённые рейтинги.

Основание: [правила Google для выездных сервисов](https://support.google.com/business/answer/9157481), [достоверное представление бизнеса](https://support.google.com/business/answer/3038177).

## План на 30 дней
| Срок | Приоритет и действие | Проверяемый результат |
|---|---|---|
| Дни 1–7 | Review этих исправлений, отдельный релизный допуск и согласованная публикация; восстановить GSC, проверить GA4 | Метаданные без старой цены; GSC baseline; события в реальном DebugView; одобренный релиз |
| Дни 8–14 | По фактическим GSC данным усилить существующие квартиры/генеральную/химчистку: полезные ответы, ограничения, подтверждённые примеры | Карта запрос → страница, точечные изменения вместо дубликатов; корректные переходы к расчёту |
| Дни 15–21 | Google Business Profile, реальные фотографии/отзывы и релевантные местные партнёрства | Согласованные контакты и услуги, переходы с GBP с известной меткой; без массовых случайных ссылок |
| Дни 22–30 | Сравнить страницы и запросы с закрытым исходным периодом; проверить качество заявок в CRM | Показы, небрендовые клики, успешные заявки, подтверждённые записи и выполненные заказы как разные ступени |

Не суммировать варианты запросов с диакритикой и без неё без проверки методики. Не создавать районные doorway pages или новый SEO-блог ради количества публикаций. Не обещать позиции или число заказов по модельным данным OpenRush.
