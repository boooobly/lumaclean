# LumaClean — химчистка, этап 3

Рабочая копия: `upholstery-premium`, ветка `codex/homepage-stage-1`, исходный HEAD `882ea6771098fa4f68c1ada9c95a48f019338bc6`. Изменения этапов 1–2 сохранены. Работа выполнена локально 26 октября 2026 года; commit, push, merge и deploy не выполнялись.

## Найдено и изменено

- Карточка SPOT показывала фактуру ткани вместо локальной обработки пятна. Создан отдельный кадр светлого дивана с небольшим пятном и насадкой экстрактора. Обновлены изображение карточки, миниатюра выбранной услуги и alt на RU/SR/EN. Название, цена, размеры карточки и обработчики выбора сохранены.
- В блоке 02 горизонтальный фрагмент ткани высотой 195 px оставлял пустое пространство под левой колонкой. Создан самостоятельный кадр проверки обивки белой салфеткой у шва. Изображение заполняет доступную высоту левой колонки и выровнено снизу с этапами справа. На мобильных высота ограничена 240–340 px.
- Кадрирование — `object-fit: cover` с заданной позицией. Асимметричное скругление нижнего правого угла — 56 px, на мобильных 36 px. Существующие анимации, reduced-motion и подписи сохранены; новых подписей об AI не добавлено.

## Файлы этапа 3

Продуктовый код:

- `src/app/[locale]/[upholstery]/page.tsx` — фото блока 02, отдельный alt и responsive sizes.
- `src/components/site/upholstery-calculator.tsx` — только источники изображений SPOT в галерее и миниатюре; логика калькулятора не менялась.
- `src/components/site/upholstery-premium.css` — кадрирование и геометрия двух затронутых областей, стили ограничены `.upholstery-page`.
- `src/lib/upholstery-premium-content.ts` — alt двух фотографий на RU/SR/EN.

Новые материалы:

| Asset | Размер | Вес |
| --- | --- | --- |
| `public/media/upholstery/spot-cleaning.webp` | 1000 × 800 | 101 998 байт |
| `public/media/upholstery/fabric-check.webp` | 1122 × 1402 | 188 728 байт |

Два самостоятельных изображения созданы встроенным imagegen, проверены визуально и оптимизированы через Sharp в WebP, quality 82, без увеличения исходного разрешения. Суммарно около 284 KiB. Используется существующий Next/Image с lazy loading и responsive sizes. Промпты и параметры: [upholstery-stage3-image-prompts.json](upholstery-stage3-image-prompts.json).

Добавлен `tests/browser/upholstery-stage3.mjs`: сравнение с исходным состоянием, геометрия, контент/SEO и сценарии SPOT. Тест ожидает регистрацию существующего обработчика выбора перед кликом; состояние продукта для подготовки теста не меняется.

## Проверки

Локальная production-сборка: `http://127.0.0.1:3113`. Все API перехвачены до навигации. Реальные заявки и сообщения не отправлялись.

| Проверка | Результат |
| --- | --- |
| `upholstery-stage3.mjs`, Chrome + WebKit | PASS: 30 сочетаний браузер × язык × ширина |
| Языки / ширины | RU, SR, EN / 1440, 1024, 768, 390, 320 px |
| SPOT, desktop + mobile | PASS: первый выбор, выбранное состояние, фокус, повторное добавление и ADDON совпали с исходным состоянием |
| Суммы SPOT | PASS: 4000 RSD standalone с учётом действующего минимума; два SPOT + регулярная уборка 55 м² — 8000 RSD, как до изменений |
| Контент и SEO | PASS: названия, цены, этапы работы, FAQ, title, description, canonical и JSON-LD совпали с исходной версией |
| Геометрия | PASS: размеры SPOT сохранены, горизонтального overflow нет; фото блока 02 выровнено с правой колонкой на desktop/tablet |
| `upholstery-polish.mjs` без изменений, production | PASS: 30 проверок адаптивной формы; выбор кресла/стула, несколько предметов, удаление, состояния ошибок/повтора/успеха — mocked |
| Анимации | PASS: stagger/reveal, reduced-motion, CLS < 0.01; контент доступен при отказе IntersectionObserver и отключённом JavaScript |
| Unit / mocked reliability | PASS: 94 теста, 0 ошибок, 0 пропусков |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS: 0 ошибок, 2 прежних предупреждения `no-img-element` в `website-chat.tsx:751,846` |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| Сохранность прежних изменений | PASS: все tracked diff этапов 1–2 побайтно совпали с сохранённым патчем после нормализации CRLF |

Команда unit-проверок:

```powershell
node --conditions=react-server --import tsx --test tests/finance/upholstery.test.ts tests/finance/upholstery-lead-mocked.test.ts tests/crm/approved-pricing.test.ts tests/reliability/upholstery-http.test.ts
```

Первый прогон расширенной регрессии на dev-сервере завершился таймаутом ожидания выбора/фокуса. Повторный полный прогон неизменённого `upholstery-polish.mjs` на production-сборке прошёл в обоих браузерах. Изменения бизнес-логики для обхода таймаута не вносились.

## Скриншоты и ограничения

[Галерея до/после](../artifacts/upholstery-stage3/gallery.html) содержит обе области, три языка и пять ширин. Сохранено 30 исходных и 30 итоговых снимков Chrome, итоговые снимки WebKit, состояния выбора и движения. Примеры:

- Блок 02, RU desktop: [до](../artifacts/upholstery-stage3/before-ru-1440-method.png) / [после](../artifacts/upholstery-stage3/after-ru-1440-method.png).
- SPOT, RU desktop: [до](../artifacts/upholstery-stage3/before-ru-1440-spot.png) / [после](../artifacts/upholstery-stage3/after-ru-1440-spot.png).
- Блок 02, RU mobile: [до](../artifacts/upholstery-stage3/before-ru-390-method.png) / [после](../artifacts/upholstery-stage3/after-ru-390-method.png).

Машинные отчёты и логи находятся в `artifacts/upholstery-stage3/`: `after.json`, `webkit/after.json`, `regression-production/polish-report.json`, `unit-tests.log`, `typecheck.log`, `lint.log`, `build.log`, `scope-check.json`.

Проверки выполнены в реальных браузерных движках с эмуляцией размеров viewport; физические устройства и экранные считыватели не проверялись. Проверки отправки mocked и не подтверждают доставку в CRM/Telegram. База данных отключена для локальных проверок; цены взяты из существующего локального каталога и сверены с исходным состоянием. Существующий release gate сообщает `ai_release_source_mismatch` для локальных изменений; его конфигурация и evidence не менялись. Перед будущим production deploy потребуется обычная отдельная процедура выпуска.

Цены, каталог, ограничения, логика выбора предметов, обработка заявок, API и административные инструменты не изменены. Этап 3 завершён; работа на другие области сайта не расширялась.
