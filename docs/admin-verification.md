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

В первоначальной локальной проверке реальные заявки не отправлялись: существующий runner проверяет Telegram upstream через mock, а live `/api/lead` получил только невалидный payload (400, до Telegram fetch). После подключения Neon опубликован новый admin release; существующие public/Telegram variables сохранены.

## Подключение Neon — 1 октября 2026

Создан отдельный Vercel-managed Neon project `lumaclean-admin`, Free, PostgreSQL 18, AWS US East 1. Production, preview и development используют разные branches. TLS encrypted/authorized подтверждены для direct и pooled connection. Сначала применены две миграции на preview, затем на production; migrate status up-to-date, schema diff пуст. Seed: 5 services, 25 price bands, 10 extras, без клиентов/заказов. Для удалённой БД увеличен seed transaction timeout до 60 секунд. Production ADMIN создан со случайным паролем; credentials вне Git, Windows ACL ограничен текущим владельцем и SYSTEM, в БД hash и immutable audit. Vercel environment variables настроены раздельно, auth secrets разные. Локальный development env сохранён без перезаписи Telegram/public variables.

## Проверка Vercel release

| Проверка | Результат |
| --- | --- |
| Preview production build | PASS, `dpl_2A8PiLNbsDmXCKMskFJrHpN2orwN`, Node 24, Next 16.3.8 |
| Chrome preview login → 10 sections → logout | PASS; настоящая серверная сессия в Neon, dashboard и настройки из БД |
| Preview TLS logs после fix | Нет error logs; Neon pg connection явно `sslmode=verify-full` |
| Staged production build | PASS, `dpl_AUCSFu3rPo4mZBXsFVYHkMGn6jWT`, production env, сначала `--skip-domain` |
| Production auth/API до переключения домена | Вход ADMIN 200, dashboard 200, logout 200; authenticated dashboard из production Neon |
| Публикация | `vercel promote` успешно; основной адрес `https://lumacleanrs.com/admin` |
| Chrome production login | PASS; владелец вошёл, реальные нулевые метрики; console errors/warnings: [] |
| Anonymous /admin и sign-up | 307 → /admin/login; sign-up endpoint 404; private/no-store и noindex headers |
| Production data | 1 ADMIN, 1 immutable bootstrap audit, 0 Clients, Orders, Leads; demo business data отсутствуют |
| Mobile/tablet | 390px / 820px, document width не превышает viewport; мобильное меню закрывается при переходе |
| Server runtime logs | Нет error logs при проверке production deployment |
| Public SEO после публикации | 63 pages, 19 checks, issues: [] |
| Pricing regression на основном домене | PASS: 800 cases, 3 languages, 18 public price pages, 63 sitemap URLs |
| Articles и lead regression | PASS: draft isolation, 45 translations, metadata; validation/server/network/duplicate-submit/mock Telegram paths. Реальные заявки не отправлялись |
| Lint / TypeScript / Prisma validate | PASS после final source fixes |
| npm audit | 0 vulnerabilities в Vercel builds |

Код production release: `546ef12`, branch `codex/admin-foundation`. Первоначальный preview выявил исключение `scripts/admin/provision` старым `.vercelignore`; исправлено исключением local-only scripts/tests из CLI deployment. Ошибка seed из-за default transaction timeout исправлена лимитом 60 секунд. Обе проблемы проверены повторным успешным build/seed. Временный preview verification account и локальные request/cookie files после проверки удалены.

Production screenshots в ignored `artifacts/admin`: `production-dashboard-desktop.png`, `production-dashboard-mobile.png`, `production-dashboard-tablet.png`; Neon branches — `neon-branches.png`. Read-only SEO отчёты: `public-before-neon-release.json`, `public-after-neon-release.json`.
