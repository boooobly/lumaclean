# LumaClean Admin: архитектура и запуск

Обновлено для этапа 2, CRM core, 1 октября 2026. Работающие Leads, Clients и Orders поверх фундамента диспетчерской и ERP. Подробные workflow, ограничения и результаты выпуска: [admin-crm.md](admin-crm.md).

## 1. Границы и стек

Публичные маршруты `/{locale}/...` сохраняют свой root layout, next-intl, SEO, аналитику, калькулятор и Telegram `/api/lead`. `/admin/...` имеет отдельный root layout с `lang="ru"`, Onest/Golos Text, общими brand tokens и собственным `admin.css`. Locale proxy исключает только `/admin` и его дочерние пути. Маркетинговые CSS в админку не импортируются.

Next.js 16.3.8, React 19.2.4, TypeScript, Zod 4, PostgreSQL, Prisma 7.10.0, Better Auth 1.7.7. Node.js 24 LTS рекомендован; минимальный заявленный runtime — 22.13. Prisma 8 на дату проверки имеет RC dist-tag, поэтому установлен стабильный 7.10.0. Better Auth заявляет совместимость с Prisma 7, Next.js 16 и React 19. Next.js обновлён с 16.3.5 патчем для устранения уязвимости.

Используется `@prisma/adapter-pg`: обычный PostgreSQL для локальной проверки и Neon pooled endpoint для Vercel. Никакого отдельного backend. Клиент создаётся лениво и переиспользуется в процессе; максимум 3 соединения на экземпляр, idle timeout 10 секунд, connect timeout 5 секунд. `attachDatabasePool` из `@vercel/functions` освобождает idle connections перед приостановкой Vercel Fluid. Для Neon pg clients явно применяется `sslmode=verify-full`: сертификат и hostname проверяются, прочие URL параметры сохраняются. Это сохраняет текущую безопасность pg 8 и убирает предупреждение об изменении aliases в pg 9. Prisma migration engine получает отдельный direct URL из провайдера. Neon и Vercel functions используют `iad1`.

## 2. Разделение кода

| Слой | Файлы / ответственность |
| --- | --- |
| Database | `prisma/schema.prisma`, SQL migrations, `prisma.config.ts`, `src/lib/database/client.ts` |
| Auth | `src/lib/auth/config.ts`, `session.ts`, `/api/auth/[...all]` |
| Domain | `src/lib/domain/time.ts`, `scheduling.ts`, `admin-navigation.ts`, `crm*.ts`; общий расчёт `src/lib/pricing.ts` |
| Services | `src/lib/services/admin-dashboard.ts`, `audit.ts`, `crm-commands.ts`, `crm-queries.ts`, `website-leads.ts`, `crm-backfill.ts` |
| Validation | `src/lib/validation/admin.ts`, `crm.ts`; строгие схемы команд и website intake |
| UI | `src/app/admin`, `src/components/admin` |
| Provisioning | CLI `scripts/admin/bootstrap.ts`, `provision.ts`; не импортировать в HTTP-код |

Основные экраны — Server Components. Клиентские компоненты отвечают за вход, выход и навигацию. Dashboard service сам вызывает `requireAdmin`, а каждый защищённый экран проверяет доступ независимо от layout. DB/auth/services закрыты `server-only`. В браузер не передаётся весь объект сессии, профиль клиента или финансовая выборка. Sidebar получает только имя владельца как серверный HTML.

CRM mutations: Route Handler → текущая ADMIN session + точный Origin + JSON Content-Type → строгий Zod parse → domain service → одна DB transaction с повторной проверкой роли и audit → `revalidatePath`. Формы сохраняют значения при ошибке и обновляют серверные экраны после успеха. Нельзя считать layout или cookie достаточным разрешением. Client Components не выполняют прямых DB-запросов.

## 3. Сущности и связи

Схема содержит 27 моделей. JSON предусмотрен только для ограниченного структурированного audit diff; контакты, услуги, расписание и финансы имеют самостоятельные поля и связи.

| Модели | Назначение |
| --- | --- |
| User, Session, Account, Verification, RateLimit | Better Auth, серверные сессии, password hash, подготовка verification, общий для serverless лимит запросов |
| Cleaner | Контакты, активность, домашняя точка, place ID, языки/навыки, рейтинг 0–5, индивидуальный процент, предпочтительный транспорт |
| CleanerAvailability | ISO weekday 1–7 и локальные минуты 0–1440 либо дата исключения; доступность/недоступность, включая весь день |
| Client, ClientAddress | Контакты и условия клиента; несколько объектов, координаты, домофон, этаж, комментарии |
| Lead, LeadExtra | Обращение, уникальный submissionId/hash, структурированные параметры и снимки extras, доставка Telegram; CONVERTED только атомарной конвертацией, LOST с причиной |
| Order, OrderCleaner, OrderExtra | Заказ; несколько назначенных исполнителей; количественные extras со снимком цены |
| Service, ServiceExtra, ServicePriceBand | Стабильные коды услуг и extras, диапазоны площади, версия прайса по сроку действия |
| DurationRule | Неактивные по умолчанию версионированные правила длительности; параметры без выдуманной формулы |
| RouteCalculation | Кеш маршрутов: точки, вид транспорта, дата отправления, секунды/метры, provider, рассчитано/годно до |
| Conversation, Message, HumanHandoff | Переписка, внешние thread/message IDs, автор CLIENT/ADMIN/AI/SYSTEM, причина и разрешение передачи человеку |
| Expense, CleanerPayout | Расходы по категориям, начисления с процентом и основанием, статус фактической выплаты |
| Notification | Один получатель: клиент, клинер или пользователь; канал, состояние, время, попытки |
| AuditLog | Actor USER/AI/SYSTEM, entity/action, ограниченный diff, время; записи только добавляются |
| BusinessSettings | Одна строка `default`: Europe/Belgrade, RSD, транспортный буфер 30 минут, nullable процент и рабочие часы |

`User → Cleaner` — необязательная one-to-one: карточка сотрудника может существовать до выдачи доступа. `Client → ClientAddress` и `Client → Order` — one-to-many. Compound FK заказа гарантирует, что выбранный адрес принадлежит его клиенту. `Order ↔ Cleaner` — many-to-many через отдельное назначение с принятием, началом, завершением и заметкой. Lead может существовать без Client; преобразование связывает заказ с исходным лидом, но не удаляет обращение.

Контакты по телефону индексированы, но телефон не уникален: семьи и компании могут использовать общий номер. Исторические заказы, прайс и назначения защищены `Restrict`; активность управляется флагом. SQL CHECK ограничивает проценты, координаты, рабочие периоды, положительные суммы/длительности, временные окна, причину ручной цены и обязательные поля завершённой уборки. CHECK и audit trigger нужно сохранять вручную в последующих SQL migrations — Prisma schema не описывает их.

## 4. Авторизация и роли

Публичная регистрация выключена `disableSignUp`. HTTP handler дополнительно допускает только `sign-in/email`, `sign-out`, `get-session`; остальные auth пути возвращают 404, включая signup и update-user. `role` и `active` объявлены `input: false`, default role — CLEANER. Cookie cache выключен. Сервер валидирует Better Auth session в БД и заново читает текущие role/active. Отключение аккаунта, изменение роли и удаление сессии действуют на следующий серверный запрос.

ADMIN видит рабочее пространство. CLEANER сможет получить отдельные ограниченные экраны с тем же auth; сейчас `/admin` ему закрыт. AI/SYSTEM не выдаются владельцу как пользовательские роли: это отдельные actor types для будущих command services. Обработчик входа не создаёт сессию отключённому пользователю. RateLimit хранится в PostgreSQL: 5 попыток входа за 60 секунд, общая политика 60 запросов за 60 секунд. Better Auth проверяет Origin/CSRF. Сессия живёт до 12 часов; вход с UI не включает remember-me.

Секреты и credentials не коммитятся, password не принимается через CLI flags и не выводится в логи. Ошибки UI не раскрывают наличие email или driver traces. Внутренние страницы имеют noindex/nofollow, private/no-store, запрет iframe и referrer policy. При отсутствии auth env публичный сайт и сборка работают, а вход закрыт. Сбой БД отображается отдельно от нулевых показателей.

## 5. Первый администратор

После миграции выполнить `npm run admin:bootstrap` в интерактивном терминале с `DATABASE_URL` нужного окружения. CLI спрашивает имя, email, скрытый пароль 12–128 символов и повтор пароля. Email считается подтверждённым, поскольку аккаунт создаёт доверенный оператор, имеющий серверный доступ. Better Auth формирует scrypt hash. User, credential Account и audit создаются атомарно.

Advisory transaction lock сериализует параллельные попытки. Если существует любой ADMIN, включая неактивного, повторный bootstrap отклоняется. Существующий пользователь не повышается и его пароль не перезаписывается. Никакого bootstrap HTTP endpoint или одноразового публичного token. Восстановление доступа и выдача новых ролей — отдельные будущие административные команды, с аудитом и отзывом сессий.

## 6. Маршруты и метрики

`/admin/login` — вход; `/admin` — реальные агрегаты и последние заявки. `/admin/leads`, `/admin/clients`, `/admin/orders` — серверные реестры с поиском, фильтрами, пагинацией, созданием и карточками; Orders имеют отдельный edit/reschedule. Остальные защищённые разделы (`calendar`, `cleaners`, `messages`, `finances`, `analytics`) пока объясняют будущий процесс. Настройки показывают основные значения read-only. Неизвестный раздел возвращает 404 после проверки доступа.

На главной: подтверждённые/текущие/завершённые уборки дня (draft/cancelled исключены), новые лиды, число клиентов и активных клинеров. Flexible window без выбранного старта учитывается, если пересекает бизнес-день. Выручка — finalPrice завершённых заказов по completedAt текущего месяца; это стоимость выполненной работы, не банковские поступления. Расходы — Expense по occurredAt. Обе суммы ограничены валютой BusinessSettings. Нулевые значения вычисляются из БД. Операционные fake records не создаются.

## 7. Дизайн и мобильная работа

Quiet Architecture: тёмный Ink sidebar, Paper и Bright Paper, Roomline logo, Onest для интерфейса, Golos Text для данных, тонкие линии и табличные реестры. Метрики — четыре колонки ledger с типографическими цифрами, финансы — один отдельный лист. Teal служит активному состоянию, фокусу и небольшим стрелкам. Radius 12 только у controls, никаких универсальных карточек с тенями, Tailwind/shadcn или GSAP в админке.

До 900 px sidebar превращается в раскрывающееся меню. На 390 px метрики образуют две колонки, финансы идут отдельным блоком, поля ввода имеют 16 px текст, ссылки меню и кнопка выхода — 44 px область. Есть skip link, focus-visible, reduced-motion и доступные labels/alerts. Общие design tokens переиспользуются без импорта public site CSS.

## 8. Scheduling engine

`DurationInput`, `DurationEstimate`, `SchedulingEngine` задают контракт будущего расчёта. Площадь, услуга, extras, загрязнение и число сотрудников — вход; результат либо UNCONFIGURED, либо minutes + rule ID/version. Никаких коэффициентов из приблизительных наблюдений не назначено, DurationRule не seed-ится.

Order хранит fixed start либо flexible window, nullable расчётную и отдельную ручную длительность, cleaning reserve, transport buffer и ссылку на правило. CRM service копирует business travel buffer при создании заказа; изменение default не переписывает старые договорённости. Время хранится как PostgreSQL timestamptz/UTC instant; рабочие минуты и исключения — в business timezone. Temporal строит полуоткрытые границы дня/месяца, включая дни DST на 23 и 25 часов. Несуществующее или неоднозначное локальное время отклоняется.

## 9. Маршрутизация

PUBLIC_TRANSIT — основной транспорт; WALKING, CAR, TAXI доступны в схеме. RouteCalculation cache key должен включать нормализованные координаты/place IDs, mode, provider и bucket времени отправления для общественного транспорта. Duration не фиксируется навсегда: записи имеют expiresAt. Для расписания длительность маршрута и reserve — отдельные величины. Google Maps/Routes сейчас не подключены; нет API ключей, платных вызовов и оптимизации маршрутов.

## 10. AI и коммуникации

Будущий AI agent не получает прямой unrestricted DB access. Он использует проверенные command services с отдельными permissions, типизированными inputs и транзакционным audit. Conversation связывает Client/Lead/Order, Message указывает автора, HumanHandoff хранит причину вмешательства и закрытие оператором. Внешние IDs позволяют дедупликацию сообщений. Сервис передачи человеку должен приостанавливать автоматические действия до явного разрешения оператора.

`/api/lead` сначала атомарно сохраняет Lead, LeadExtra и SYSTEM audit, затем отправляет уведомление Telegram. Успех сохранения возвращается и при сбое Telegram; карточка показывает SENT/FAILED/PENDING. Уникальный submissionId и hash защищают от повторов, изменённый payload с прежним ID возвращает conflict. Исторические Telegram заявки не импортируются. Фонового повторения доставки пока нет; следующий коммуникационный этап — durable outbox. Переписка Telegram/WhatsApp/Viber и AI пока не подключены.

## 11. Финансы и audit

Деньги — Decimal(12,2), проценты — Decimal(5,2), валюта явно хранится. OrderExtra сохраняет согласованную unitPrice. CleanerPayout содержит appliedPercent, basisAmount и amount: будущая команда использует индивидуальный процент, затем default; если оба null, начисление запрещается до решения владельца. Не придумывать split общей доли команды или точные проценты.

Expense может однозначно ссылаться на выплату через unique payoutId: учёт начисления и фактического расхода различаются. При переводе выплаты в PAID будущий сервис должен создать единственный Expense категории PAYOUT в той же транзакции, чтобы не удваивать расходы.

Audit записывается в той же транзакции, что и изменение бизнес-данных. `writeAudit` принимает actor и ограниченный diff: status, schedule, finalPrice, cleaner IDs, active. Не включать пароли, токены, полный адрес, телефон или текст сообщений. Actor USER ссылается на User; AI/SYSTEM используют технический actorKey. PostgreSQL trigger запрещает UPDATE/DELETE audit. Пользователи с историей действий деактивируются; hard-delete требует отдельного процесса хранения/обезличивания и не относится к текущему UI.

## 12. Environment, Neon и миграции

| Env | Назначение |
| --- | --- |
| DATABASE_URL | Neon pooled URL с `-pooler` hostname, server runtime |
| DIRECT_URL | Прямой URL той же БД/branch для Prisma CLI; если отсутствует, CLI использует DATABASE_URL |
| BETTER_AUTH_SECRET | Не менее 32 случайных символов, серверный секрет |
| BETTER_AUTH_URL | Точный origin приложения: `http://localhost:3000` или `https://lumacleanrs.com` |

`prisma.config.ts` загружает `.env.local` через Next env loader. Generate/validate/build не требуют настоящего URL. DB-команды требуют рабочий URL. Новые переменные не имеют префикса NEXT_PUBLIC. Существующие Telegram/SEO env остаются как есть.

Порядок подключения:

1. В Vercel project **lumaclean** открыть Storage/Marketplace и подключить [Neon](https://vercel.com/marketplace/neon/neon) к существующему проекту. Использовать отдельную БД LumaClean и отдельные development/preview branches. Не подключать preview к production данным.
2. Проверить автоматически добавленные env. Установить DATABASE_URL pooled, DIRECT_URL direct той же branch. Некоторые интеграции называют прямой URL DATABASE_URL_UNPOOLED — скопировать его в DIRECT_URL либо явно сопоставить при настройке.
3. Добавить auth secret отдельно для каждого окружения и точный BETTER_AUTH_URL. Для preview использовать точный deployment/branch origin, не wildcard trusted origins. Сохранить Vercel Deployment Protection.
4. Локально установить Node 24 LTS, выполнить `npm ci`, заполнить `.env.local` подходящими URL и auth env, не стирая существующие Telegram переменные.
5. Выполнить `npm run db:validate`, `npm run db:migrate`, `npm run db:status`, `npm run db:seed` на выбранной branch. Seed идемпотентно добавляет default settings, 5 услуг, 25 диапазонов прайса и 10 extras; настройки и существующие цены не перезаписываются.
6. Выполнить интерактивный `npm run admin:bootstrap` с URL production только из доверенного терминала. Credentials задаёт владелец; никаких demo credentials на production.
7. Проверить preview login/logout, protected routes, public site; затем развернуть подготовленную ветку в существующий Vercel project. Результаты реальных выпусков приведены ниже и в документации CRM.

Миграции: `20261001090000_admin_foundation` — schema, indexes, FK, CHECK и default BusinessSettings; `20261001100000_audit_immutable` — append-only guard; `20261001120000_crm_core` — структурированные leads, телефоны, order snapshots/reference и SoilLevel; `20261001121000_crm_search_indexes` — pg_trgm GIN. В production использовать только `migrate deploy`, не `migrate dev/reset` и не `db push`. Build генерирует client без migrations. Применение migrations — отдельный release step перед rollout admin.

ServicePriceBand зеркалит диапазоны `pricing.ts`; это подготовка каталога. Публичный калькулятор и CRM используют одну функцию `calculatePrice` в `pricing.ts`, сохраняя текущие минимальные цены, округление и срочность. Заказ фиксирует полный расчёт до скидки, скидку, ручную разницу с причиной, финальную цену и unitPrice каждого extra. Изменение только времени сохраняет согласованный прайс. Редактируемый источник расчёта в DB bands относится к будущему этапу.

1 октября 2026 подключён отдельный Vercel-managed Neon project `lumaclean-admin` (`patient-butterfly-42300600`), Free, AWS US East 1, PostgreSQL 18. Production использует `main` (`br-noisy-bar-b8vmyqyi`); preview — `preview` (`br-muddy-fire-b8q2d6uo`); development — `development` (`br-sweet-flower-b8e9l9ut`). Ветки созданы до owner provisioning и не содержат production клиентов, заказов или сессий. Runtime использует pooled URL, migrations — DIRECT_URL. Реальное TLS-соединение и проверка сертификата подтверждены Node pg; обе миграции применены, schema diff пуст, справочник заполнен (5 services, 25 price bands, 10 extras). Seed transaction timeout 60 секунд учитывает задержку удалённой БД.

DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET и BETTER_AUTH_URL настроены отдельно для трёх Vercel environments; auth secrets различаются. Production URL — `https://lumacleanrs.com`, preview URL — `https://lumaclean-admin-preview.vercel.app`, development — `http://localhost:3000`. Локальный `.env.local` использует development, существующие Telegram/public variables сохранены. Реальный владелец создан через CLI-only provisioning helper; credentials сохранены в приватном локальном файле вне репозитория, в БД только password hash. Публичной регистрации нет.

Admin foundation опубликован: `https://lumacleanrs.com/admin`. Сначала проверен preview deployment `dpl_2A8PiLNbsDmXCKMskFJrHpN2orwN`, затем production build `dpl_AUCSFu3rPo4mZBXsFVYHkMGn6jWT` с `--skip-domain`: настоящий вход владельца, dashboard, logout, sitemap. После успешных проверок production deployment promoted на основной домен. Код релиза — `546ef12` в `codex/admin-foundation`; отчёт сохранён отдельным последующим commit. Local-only `scripts`, `tests`, artifacts и env files исключены из CLI deployment, остаются доступны в Git для проверки/CLI provisioning. Временный preview administrator после проверки удалён; production owner не копируется в development/preview.

## 13. Проверки и следующие этапы

Команды: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run db:validate`, `npm run test:admin`. Без test env интеграционные тесты явно пропускаются; timezone/validation tests продолжают работать. Для полного прогона нужны local application `http://localhost:3100`, DATABASE_URL на `postgresql://postgres@127.0.0.1:55439/lumaclean_admin_test` и новая пустая БД `lumaclean_admin_bootstrap_test` с применёнными миграциями. Seed нужен основной БД. Установить ADMIN_TEST_BASE_URL и ADMIN_TEST_DATABASE_URL в тестовом терминале. Тесты специально проверяют эти loopback адреса и имя БД; production URL не принимается. Bootstrap test рассчитан на новую тестовую БД на каждый прогон. Test fixture credentials появляются только в ignored `artifacts/admin`; уничтожить тестовый контейнер и файлы после проверки.

Отчёт foundation: [admin-verification.md](admin-verification.md). CRM core и финальный production release: [admin-crm.md](admin-crm.md), [admin-crm-verification.md](admin-crm-verification.md). На 1 октября 2026 все четыре миграции применены в production Neon; финальный deployment `dpl_GxwVkNagcY1uoxcU3L48WYKYdjxk` опубликован на основном домене. Credentials и test fixtures в Git/deployment не включены.

Следующие этапы:

1. Neon, migrations, реальный владелец и production release уже готовы. Перед следующим этапом сверить [admin-verification.md](admin-verification.md).
2. CRM core готов: Leads/Clients/Orders, website intake, конвертация и транзакционный audit. Проверки и ограничения: [admin-crm.md](admin-crm.md).
3. Карточки клинеров/расписания и назначения; согласовать формулы длительности и выплаты.
4. Календарь и scheduling engine с конфликтами/буферами и корректным DST.
5. Транспортный provider и route cache; затем оптимизация маршрутов.
6. Finance workflow, payments/expenses/payouts и ограниченный кабинет клинера.
7. Каналы сообщений, notifications, human handoff и только затем AI command layer с отдельными permissions.

### Проверенная документация

- [Better Auth + Next.js](https://better-auth.com/docs/integrations/next)
- [Better Auth Prisma adapter](https://better-auth.com/docs/adapters/prisma)
- [Better Auth options](https://better-auth.com/docs/reference/options)
- [Prisma / Better Auth / Next.js](https://www.prisma.io/docs/guides/authentication/better-auth/nextjs)
- [Prisma migrate v7](https://www.prisma.io/docs/cli/v7/migrate)
- [Vercel PostgreSQL Marketplace](https://vercel.com/docs/postgres)
- Локальные Next.js 16 guides в `node_modules/next/dist/docs`: root layouts, authentication, Route Handlers.

Prisma tooling использует явно зафиксированные overrides `@prisma/config → deepmerge-ts 8.0.2` и `prisma → mysql2 3.24.5` для устранения advisories транзитивных зависимостей. Deepmerge v8 меняет глубокое слияние Map; Prisma config здесь использует обычные объекты. Generate/validate/migrate/build проверены с overrides. `npm audit` после установки сообщает 0 vulnerabilities. При обновлении Prisma перепроверить необходимость overrides.
