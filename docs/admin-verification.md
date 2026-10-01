# Проверка Admin foundation

Дата: 1 октября 2026. Ветка: `codex/admin-foundation`, базовый commit `005a78c`. Рабочий репозиторий: `C:/Users/vleko/Documents/Codex/2026-07-11/ns/outputs/lumaclean` (origin `boooobly/lumaclean`). Папка чата `Documents/ChatGPT/LumaClean` содержала материалы прошлых этапов, а не Next.js приложение.

## Итог

| Проверка | Результат |
| --- | --- |
| `npm run lint` | PASS, без ошибок и предупреждений |
| `npm run typecheck` | PASS: Next route typegen и TypeScript |
| `npm run build` | PASS: Next.js 16.3.8 production build, 69 static pages; admin/auth dynamic |
| Build без DATABASE_URL / auth secret | PASS; без подключения к production БД |
| `npm run db:validate` | PASS: Prisma 7.10.0 schema |
| `prisma migrate deploy` | Обе миграции применены на изолированном PostgreSQL 17 |
| `prisma migrate status` | Database schema is up to date |
| `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | No difference detected |
| `prisma db seed`, два последовательных запуска | PASS; бизнес-настройки/каталог, без дублей и клиентов/заказов |
| `npm run test:admin` с полным test env | 5 PASS, 0 failed, 0 skipped |
| `npm audit` | 0 vulnerabilities |
| `git diff --check` | PASS |

Изолированная БД работала в контейнере `lumaclean-admin-verify`, порт только loopback `127.0.0.1:55439`. Проверка не подключалась к production PostgreSQL и не создавала production администратора. Test fixture credentials создавались случайно в runtime, временно использовались браузером и удалены после проверки. Контейнер и локальные test servers остановлены.

## Auth, роли и реальные данные

Проверены все десять защищённых маршрутов без сессии (307 на `/admin/login`) и после входа (200). Неизвестный раздел после авторизации — 404. Поддельный session cookie не открывает главную. Удаление серверной сессии, отключение аккаунта и изменение ADMIN → CLEANER блокируют следующий серверный запрос. Вход по настоящему Better Auth password hash успешен, выход удаляет серверную сессию. Public signup и update-user недоступны; запрос входа с чужим Origin получает 403. Шестая неправильная попытка входа получает 429, rate limit хранится в БД.

На пустой операционной БД главная показывает нули. Временные Client/Lead/Cleaner/Order/Expense записи проверили настоящие показатели `1 / 1 / 2 / 1`, выручку `10 300 RSD` и расход `700 RSD`; записи удалены после проверки. В настройках читаются Europe/Belgrade, буфер 30 минут и незаданный процент. Compound FK запрещает заказ по чужому адресу; CHECK запрещает процент 101 и отрицательный буфер.

Bootstrap service проверен на новой отдельной тестовой БД: две конкурентные попытки создают ровно одного ADMIN, один credential Account и audit event. Password не равен исходному secret, `verifyPassword` подтверждает hash. Повторное создание администратора отклоняется. PostgreSQL запрещает изменение и удаление созданного audit record.

Temporal tests проверили 23-часовой день весеннего DST, 25-часовой день осеннего DST, смену месяца на границе UTC и nullable payout settings. Точные формулы длительности и проценты не назначались.

Отдельный production server без admin env: public `/ru` — 200, login — 200 с disabled fields и ясным сообщением, `/admin` — redirect, auth API — 503. Ошибка конфигурации не маскируется фиктивными DB нулями.

## Browser

Проверка реальным Chrome через agent-browser: `/admin/login` и `/admin`, 1440 px desktop, 820 px tablet, 390 px mobile. Проверены browser login/logout, повторная попытка открыть `/admin` после выхода, mobile disclosure navigation и переход в Clients. После выбора раздела мобильное меню закрывается. На ширине 390 px document scrollWidth = 390; таблица Clients = 354. Browser console и page errors пусты, Next error overlay отсутствует.

Скриншоты локально в ignored `artifacts/admin/`:

- `dashboard-desktop.png`, `dashboard-tablet.png`, `dashboard-mobile.png`;
- `login-desktop.png`, `login-mobile.png`;
- `navigation-mobile.png`, `clients-mobile.png`;
- `public-home-mobile.png`.

Применён React quality checklist: минимальные Client Components, session checks у сервисов/страниц, async Next params/headers, семантические labels, alerts, skip link, focus-visible, reduced motion и ограниченная передача данных в браузер. Public и admin root layouts/style scopes изолированы.

## Регрессии публичного сайта

| Runner | Результат |
| --- | --- |
| `docs/seo-audit/check-seo.mjs` | 63 public pages, 19 checks, issues: [] |
| `docs/check-pricing.cjs` | 800 area/service cases; прежний прайс/extras, 3 языка, 18 price pages, 63 sitemap URLs |
| `docs/articles/check-articles.cjs` | Draft isolation, 45 переводов, 45 article URLs + 3 indexes, 246 internal links/anchors, metadata/sitemap |
| `docs/articles/check-seo-events.cjs` | Валидность формы, success/error/network paths, duplicate-submit guard, безопасная analytics/logging, mock Telegram delivery и missing configuration |

Визуально открыт public `/ru` на телефоне, проверена консоль. Исходники public pages/components/styles, `pricing.ts`, `src/i18n` и `/api/lead` не менялись. Из общей конфигурации изменены только исключение `/admin` из locale proxy, заголовки новых admin/auth paths, tooling/scripts и security patch Next.js.

Реальные заявки не отправлялись: существующий runner проверяет Telegram upstream через mock, а live `/api/lead` получил только невалидный payload (400, до Telegram fetch). Production website/deployment и его env не изменялись.

## Подключение Neon — 1 октября 2026

Создан отдельный Vercel-managed Neon project `lumaclean-admin`, Free, PostgreSQL 18, AWS US East 1. Production, preview и development используют разные branches. TLS encrypted/authorized подтверждены для direct и pooled connection. Сначала применены две миграции на preview, затем на production; migrate status up-to-date, schema diff пуст. Seed: 5 services, 25 price bands, 10 extras, без клиентов/заказов. Для удалённой БД увеличен seed transaction timeout до 60 секунд. Production ADMIN создан с случайным паролем; credentials вне Git, в БД hash и immutable audit. Vercel environment variables настроены; deployment/runtime проверяются следующим шагом.
