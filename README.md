# LumaClean

Production-сайт клинингового сервиса LumaClean в Белграде. Основная версия включает кинематографический scroll-journey по квартире, прозрачный прайс-калькулятор, форму заявки с отправкой в Telegram и локализации на русском, сербском и английском языках.

## Стек

- Next.js 16 и React 19;
- TypeScript;
- next-intl для локализованных маршрутов и метаданных;
- GSAP для scroll-анимации;
- Zod для серверной валидации заявок;
- Telegram Bot API для доставки заявок.

## Локальный запуск

Рекомендован Node.js 24 LTS; минимум — Node.js 22.13.

```bash
npm ci
```

Создайте `.env.local` на основе `.env.example`, затем запустите проект:

```bash
npm run dev
```

Сайт будет доступен по адресу [http://localhost:3000/ru](http://localhost:3000/ru).

## Переменные окружения

| Переменная | Назначение |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Публичный origin без завершающего `/`, используется в canonical URL, sitemap и JSON-LD. |
| `GOOGLE_SITE_VERIFICATION` | Код подтверждения Google Search Console для метатега. Не нужен при DNS-подтверждении. |
| `YANDEX_SITE_VERIFICATION` | Код подтверждения Яндекс Вебмастера для метатега. Не нужен при DNS-подтверждении. |
| `TELEGRAM_BOT_TOKEN` | Секретный токен Telegram-бота. Добавляется только на сервере. |
| `TELEGRAM_CHAT_ID` | Числовой ID чата или канала, куда бот отправляет заявки. |
| `DATABASE_URL` | Серверный PostgreSQL URL админки; для Neon использовать pooled endpoint. |
| `DIRECT_URL` | Прямой URL той же БД/branch для Prisma migrations. |
| `BETTER_AUTH_SECRET` | Серверный auth secret, минимум 32 случайных символа. |
| `BETTER_AUTH_URL` | Точный origin админки: локальный origin или production домен. |

Токен бота нельзя добавлять в переменные с префиксом `NEXT_PUBLIC_` или коммитить в Git. Для отправки в канал бот должен быть добавлен туда с правом публикации сообщений.

## Команды

```bash
npm run lint   # ESLint
npm run typecheck # Route types + TypeScript
npm run build  # production-сборка
npm run start  # запуск собранного приложения
```

## Маршруты

- `/ru`, `/sr`, `/en` — локализованные страницы;
- `/{locale}/services/{service}` — 15 локализованных SEO-страниц для пяти видов уборки;
- `/api/lead` — серверная отправка заявки в Telegram;
- `/sitemap.xml` и `/robots.txt` — SEO-файлы.
- `/admin/login` — закрытый вход владельца;
- `/admin` — рабочее пространство с реальными агрегатами PostgreSQL.

Старые адреса вида `/{locale}/v2` постоянно перенаправляются на основной локализованный адрес.

## Развёртывание на Vercel

1. Импортируйте GitHub-репозиторий в Vercel.
2. Добавьте рабочие переменные из `.env.example` в Project Settings → Environment Variables.
3. Выполните deployment без дополнительных build-настроек: Vercel автоматически определит Next.js.
4. После подключения домена обновите `NEXT_PUBLIC_SITE_URL` и повторно разверните проект.

Все необходимые медиа находятся в `public/media`. Активная прогулка journey-v5 содержит три ролика на формат: суммарно 27,2 МБ для desktop и 12,0 МБ для mobile; крупнейший ролик — 10,4 МБ. Нужный ролик загружается при движении по сцене; следующий подготавливается ближе к концу текущего. До начала движения все три ролика не скачиваются. Первый экран использует адаптивные изображения Next Image.

## SEO-аудит

Результаты проверки от 11 сентября 2026 года: [docs/SEO_AUDIT_2026-09-11.md](docs/SEO_AUDIT_2026-09-11.md).

После production-сборки запустите `npm run start -- --port 3100`, затем:

```bash
node docs/seo-audit/check-seo.mjs http://localhost:3100 docs/seo-audit/local-after.json
```

Проверка читает страницы и SEO-файлы; заявки не отправляет.

## Articles

Multilingual articles, draft previews and publication: [editor guide](docs/articles/README.md). Search Console and Yandex setup: [indexing](docs/articles/indexing.md).

## LumaClean Admin — фундамент

Prisma 7.10.0, Better Auth 1.7.7 и PostgreSQL добавлены в существующее приложение. Публичные локализации, калькулятор и `/api/lead` работают независимо от подключения админки. Основные разделы подготовлены как empty states; полноценная CRM вводится поэтапно. Website заявки пока продолжают поступать только в Telegram.

Подключите отдельную Neon БД через Vercel Marketplace к проекту `lumaclean`. Добавьте серверные env из таблицы выше. Production, preview и development должны использовать отдельные branches/credentials. Публичной регистрации нет.

```bash
npm ci                    # postinstall генерирует Prisma client, БД не требуется
npm run db:validate       # Проверка schema
npm run db:migrate        # migrate deploy; только аддитивные подготовленные migrations
npm run db:status
npm run db:seed           # Идемпотентный каталог услуг и настройки; без fake customers
npm run admin:bootstrap   # Интерактивное создание первого ADMIN; скрытый пароль
npm run dev
```

`admin:bootstrap` требует интерактивный терминал и рабочий `DATABASE_URL`. Имя/email/пароль вводятся во время запуска; пароль не передаётся через аргументы или Git. Повторное создание ADMIN отклоняется. `BETTER_AUTH_URL` локально должен соответствовать порту сервера.

`npm run build` генерирует Prisma client, но не применяет migrations. Миграции production — отдельный release step перед rollout; не использовать `migrate reset`, `migrate dev` или `db push` на production. Без admin env сборка и публичный сайт остаются доступны, а вход закрыт.

```bash
npm run test:admin        # DST/валидация; DB/auth интеграция требует test env
npm run lint
npm run typecheck
npm run build
npm audit
```

Подробные сущности, связи, роли, pooling, Neon env, migration workflow и следующие этапы: [admin-architecture.md](docs/admin-architecture.md). Реальные результаты проверок: [admin-verification.md](docs/admin-verification.md).
