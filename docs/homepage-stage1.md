# Главная LumaClean — этап 1

Дата: 26 октября 2026. Копия: `upholstery-premium`. Ветка: `codex/homepage-stage-1`.
Исходный commit: `882ea67`, чистая рабочая копия перед работой. Она содержит текущий remote `main` (`22b5818`) и последующие локальные улучшения формы/SEO. Remote main проверен через GitHub connector. Другие копии проекта не изменялись.

## Найденные проблемы и изменения

| Блок | До | После |
| --- | --- | --- |
| 01 | Основные карточки без переходов; те же услуги повторяются ниже | Ссылки в заголовках через `getServicePath(locale, serviceId)`, стрелки, hover/focus; в нижнем списке только move/Airbnb/office; меньше промежуток между карточками и списком |
| Форма | Большое скругление справа снизу | Только нижний левый угол общего контейнера: 90 px desktop, 64 px tablet, 48 px mobile; безопасные внутренние отступы |
| Раскрытие формы | Разные стрелки, рамки и интервалы | Согласованные summary, индикаторы, hover, focus, открытое состояние; мобильный счётчик выбранных позиций переносится на отдельную строку |
| 05 | Самостоятельная светлая подложка заголовка, карточки от 240 px | Заголовок на фактурном фоне; карточки `rgba(251,250,246,.65)`, 180 px на 1440 px и 160 px на 1024 px; на мобильных высота по содержимому |
| 06 | Список справа и пустое пространство слева | Сетка 5/7: локальное изображение кухни слева, вопросы справа; ниже 900 px последовательная композиция; асимметричное скругление изображения |

Для FAQ использован существующий `public/media/articles/regular-deep.webp`, просмотренный перед интеграцией. Добавлены описания изображения на RU/SR/EN. Размер ресурса учитывает вертикальный desktop crop; внешних картинок и новых коммерческих обещаний нет.

Семантика `details/summary` сохранена. В Chrome высота плавно меняется через `interpolate-size` и `::details-content`, проверены промежуточные высоты при открытии и закрытии. При `prefers-reduced-motion` переходы отключены. Доступная версия WebKit не поддерживает эту комбинацию CSS: используется надёжное нативное раскрытие без анимации высоты. Нативный select сохранён, значения вариантов и влияние на расчёт не менялись; системное выделение внутри OS-native меню не переопределяется.

Существующие состояния отправки, настоящая reference из ответа, защита от повторов, чекбоксы и выравнивание кнопок сохранены. `estimate.tsx`, цены, CRM, API, чат и архитектура бронирования не изменялись.

## Затронутые файлы

- `src/app/[locale]/page.tsx` — ссылки, локальная фильтрация списка, композиция FAQ.
- `src/app/styles/homepage-focused.css` — только стили внутри `.site-home`: карточки услуг, условия, FAQ.
- `src/app/styles/estimate-focused.css` — геометрия и состояния формы главной.
- `src/lib/homepage-ux-content.ts` — alt изображения RU/SR/EN.
- `tests/browser/estimate-chat.mjs` — существующая проверка геометрии перенесена на нижний левый угол.
- `tests/browser/homepage-stage1.mjs` — безопасная матрица, снимки до/после, сравнение контента и метаданных, ссылки, клавиатура, анимация и reduced motion.
- `docs/homepage-stage1.md` — этот отчёт.

Общие `site-base.css`, `site-production.css`, `seo-additions.css`, `seo-services.ts` и CSS химчистки были изучены, но не изменялись. Автоматическое изменение AGENTS.md командой Next dev удалено из diff.

## Проверки

Адрес: `http://127.0.0.1:3111`. Финальные снимки сняты с `next start` после production build. Во всех браузерных сценариях API и аналитика перехвачены до первой навигации. Это **UI mocked**, без реальных заявок или доставки сообщений.

| Язык | 1440×1000 | 1024×1000 | 768×1000 | 390×1000 | 320×1000 |
| --- | --- | --- | --- | --- | --- |
| RU | PASS | PASS | PASS | PASS | PASS |
| SR | PASS | PASS | PASS | PASS | PASS |
| EN | PASS | PASS | PASS | PASS | PASS |

Матрица пройдена в Chrome и WebKit. Проверены закрытые и раскрытые блоки, Enter/Space, отсутствие горизонтального скролла, загрузка фотографий и геометрия. Снимки контента подтверждают сохранность описаний/состава/цен двух карточек, условий, FAQ, FAQ JSON-LD, вариантов select и метаданных. Все 15 ссылок из карточек и сокращённого списка услуг возвращают HTTP 200. Вложенных интерактивных элементов не обнаружено.

- `npm run build` — PASS, 99 страниц сгенерированы.
- `npm run typecheck` — PASS.
- `npm run lint` — PASS, 0 ошибок; два прежних предупреждения `@next/next/no-img-element` в `website-chat.tsx`.
- 90 выбранных тестов pricing/SEO/analytics и mocked lead services/HTTP — PASS, 0 skipped.
- `tests/browser/homepage-stage1.mjs` — 15 сочетаний на каждом движке, ссылки, контент, клавиатура и проверка движения — PASS.
- `tests/browser/estimate-chat.mjs` — PASS: 21 сочетание языка/ширины, 13 групп сценариев, 25 перехваченных отправок; 0 неожиданных ошибок страницы. Проверены валидация, сумма, доплаты, срочность, mixed/upholstery/contact, ожидание, повторное нажатие, reference, 400/429/503/network/retry, reduced motion и открытие чата. Внутренние ссылки, robots и sitemap доступны.

Прайс сверялся с текущими `pricing.ts`, `appliance-catalog.ts`, `crm-pricing.ts` и независимыми approved-pricing tests. Источники: документ утверждения от 17 октября плюс последующие изменения окон, зафиксированные в `docs/seo-audit/implementation-2026-10-26.md`. Действующие окна 700/1 000 RSD; исторические 1 000/1 500 не использовались. Цены не менялись.

Команда выбранных тестов:

```powershell
node --conditions=react-server --import tsx --test tests/crm/approved-pricing.test.ts tests/admin/seo-consistency.test.ts tests/admin/pricing-sitemap.test.ts tests/admin/conversion-analytics.test.ts tests/admin/analytics-effect.test.ts tests/finance/upholstery-lead-mocked.test.ts tests/reliability/upholstery-http.test.ts
```

Для browser runner использовался уже доступный Playwright core, без установки зависимостей сайта. `PLAYWRIGHT_CORE_PATH` указывает на `../outputs/npm-cache/_npx/ef40dfadc1438043/node_modules/playwright-core/index.mjs`; `BASE_URL=http://127.0.0.1:3111`. Для WebKit: `BROWSER_ENGINE=webkit`, `BASELINE_PATH=artifacts/homepage-stage1/before.json`, `ARTIFACT_DIR=artifacts/homepage-stage1/webkit`.

## Скриншоты и логи

[Галерея до/после с выбором языка, ширины и блока](../artifacts/homepage-stage1/gallery.html). По 60 основных кадров до и после; отдельно сохранены раскрытая форма и состояния отправки. Для снимков секций скрыты только фиксированный header, launcher чата и dev tools, чтобы они не перекрывали контент.

| Пример | До | После |
| --- | --- | --- |
| Типы уборки RU 1440 | [до](../artifacts/homepage-stage1/before/ru-1440-scope.png) | [после](../artifacts/homepage-stage1/after/ru-1440-scope.png) |
| Форма RU 1440 | [до](../artifacts/homepage-stage1/before/ru-1440-estimate.png) | [после](../artifacts/homepage-stage1/after/ru-1440-estimate.png) |
| Условия RU 1440 | [до](../artifacts/homepage-stage1/before/ru-1440-terms.png) | [после](../artifacts/homepage-stage1/after/ru-1440-terms.png) |
| FAQ RU 1440 | [до](../artifacts/homepage-stage1/before/ru-1440-faq.png) | [после](../artifacts/homepage-stage1/after/ru-1440-faq.png) |
| FAQ RU 320 | [до](../artifacts/homepage-stage1/before/ru-320-faq.png) | [после](../artifacts/homepage-stage1/after/ru-320-faq.png) |

Отчёты: [Chrome](../artifacts/homepage-stage1/after.json), [WebKit](../artifacts/homepage-stage1/webkit/after.json), [финальные снимки Chrome](../artifacts/homepage-stage1/after-capture.json), [финальные снимки WebKit](../artifacts/homepage-stage1/webkit/after-capture.json), [формы](../artifacts/homepage-stage1/forms-production/report.json).

Логи: [build](../artifacts/homepage-stage1/build.log), [typecheck](../artifacts/homepage-stage1/typecheck.log), [lint](../artifacts/homepage-stage1/lint.log), [90 tests](../artifacts/homepage-stage1/unit-tests.log).

## Ограничения

Реальная CRM/Postgres, Queue, Telegram/WhatsApp, live AI и доставка уведомлений не проверялись отправкой. Физические iOS/Android и screen readers не проверялись; WebKit runner не заменяет реальные устройства. Полный аудит остальных страниц не выполнялся.

Существующий release gate сообщает `ai_release_source_mismatch` из-за изменённых файлов главной; safety gate и release evidence не обновлялись. Это не мешает успешной сборке, но прежняя сертификация live AI не переносится на изменённый исходный код автоматически.

Изменения локальные, без commit/push/merge/deploy. Работа остановлена на этапе 1.
