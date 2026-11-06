# LumaClean — блок 03, этап 2

26 октября 2026. Рабочая копия: `upholstery-premium`, ветка `codex/homepage-stage-1`, исходный commit `882ea67` плюс локальные изменения этапа 1. Этап 1 сохранён; его исходный diff записан в `artifacts/homepage-stage2/stage1-baseline.patch`.

## Результат

Три большие фотографии, их подписи и цены сохранены. У фотографии смесителя скруглён нижний правый угол: 80 px desktop, 48 px mobile. Новые карточки располагаются ниже этой композиции.

Все 14 существующих строк получили описания RU/SR/EN и отдельные тематические изображения. Порядок, названия и цены приходят из прежнего `extraKeys`, `content.calculator.labels` и `extrasPrices`; новые данные не управляют расчётом.

На desktop с мышью список расположен слева, для одной плавающей карточки зарезервировано место справа. Это позволяет сохранить текст всех строк открытым. Карточка выравнивается рядом с выбранной услугой и учитывает viewport и границы списка. Если у нижнего края недостаточно места без наложения на исходные фотографии, используется раскрытие под строкой, которое не меняет режим во время прокрутки.

На touch-устройствах и ширинах меньше 1000 px информация раскрывается под строкой. Повторное нажатие, крестик, Escape и нажатие снаружи закрывают её. Крестик/Escape возвращают фокус на соответствующую строку; Tab свободно проходит к следующим элементам. Кнопки имеют `aria-expanded`, активную связь с именованной областью и доступное описание. Полноценный screen-reader аудит не выполнялся.

При `prefers-reduced-motion` появление без анимации. В обычном режиме используется короткое изменение opacity и смещение на 4 px. Затемнение ограничено областью текста. Новых библиотек и зависимостей нет.

## Изображения

Созданы через встроенный `image_gen`, каждый сюжет отдельным вызовом. Все 14 результатов просмотрены: предмет, техника, контакт руки/инструмента, отсутствие видимых текстов и логотипов, кадрирование и соответствие общей стилистике. Это иллюстративные сцены услуг, а не фотографии клиентских работ.

Финальные файлы: WebP, **960×720**, quality 82, суммарно **937 192 bytes / 915,2 KiB**. Используется Next/Image с responsive sizes. Пока карточка не открыта, её изображение не монтируется и не запрашивается; одновременно отображается одна фотография.

| Ключ | Локальный asset | Размер |
| --- | --- | --- |
| standardWindow | [standard-window.webp](../public/media/extras/standard-window.webp) | 69,1 KiB |
| largeWindow | [large-window.webp](../public/media/extras/large-window.webp) | 81,5 KiB |
| balcony | [balcony.webp](../public/media/extras/balcony.webp) | 96,2 KiB |
| fridge | [fridge.webp](../public/media/extras/fridge.webp) | 41,7 KiB |
| oven | [oven.webp](../public/media/extras/oven.webp) | 65,8 KiB |
| microwave | [microwave.webp](../public/media/extras/microwave.webp) | 47,0 KiB |
| hood | [hood.webp](../public/media/extras/hood.webp) | 70,4 KiB |
| dishwasher | [dishwasher.webp](../public/media/extras/dishwasher.webp) | 74,5 KiB |
| washingMachine | [washing-machine.webp](../public/media/extras/washing-machine.webp) | 53,9 KiB |
| cabinets | [cabinets.webp](../public/media/extras/cabinets.webp) | 51,3 KiB |
| ironing | [ironing.webp](../public/media/extras/ironing.webp) | 44,1 KiB |
| steam | [steam.webp](../public/media/extras/steam.webp) | 41,6 KiB |
| petHair | [pet-hair.webp](../public/media/extras/pet-hair.webp) | 90,6 KiB |
| linen | [linen.webp](../public/media/extras/linen.webp) | 87,5 KiB |

[Полный набор prompts](homepage-stage2-image-prompts.json): общий prompt плюс индивидуальный scene prompt для каждого ключа. Исходные PNG и точные пути генерации записаны в локальном `artifacts/homepage-stage2/image-prompts.json`. Внешних горячих ссылок нет.

## Изменённые файлы относительно этапа 1

- `src/app/[locale]/page.tsx` — подключение интерактивного списка и класс фотографии смесителя.
- `src/app/styles/homepage-focused.css` — стили только блока 03 внутри `.site-home`.
- `src/components/site/extras-ledger.tsx` — новая логика показа/закрытия, размещения и фокуса.
- `src/lib/extras-info.ts` — 42 коротких фактических описания, пути к изображениям, локализованные подсказка и закрытие.
- `tests/browser/extras-ledger.mjs` — безопасные браузерные проверки и скриншоты.
- `public/media/extras/*.webp` — 14 новых assets.
- Этот отчёт и `docs/homepage-stage2-image-prompts.json`.

Калькулятор, `pricing.ts`, `content.ts`, CRM, API, чат, общие CSS и инфраструктура не изменялись. [Проверка границ diff](../artifacts/homepage-stage2/scope-audit.json) подтверждает сохранность файлов этапа 1 вне двух целевых файлов страницы/CSS. Снимки DOM подтверждают неизменность блоков 01/05/06 и метаданных.

Описания сверены с текущими публичными названиями и scope: FAQ окон, `applianceScope`, действующий прайс и утверждённый документ `docs/pricing-update-20261017.md` с последующими изменениями окон. Разборка, ремонт, дезинфекция, стирка постельного белья или гарантии результата не добавлялись. Глажка сохраняет единицу 30 минут; для белья используется подготовленный чистый комплект.

## Найденные и устранённые дефекты

- Стационарный курсор мог заменить карточку при прокрутке к клавиатурному фокусу. Различаются реальное перемещение мыши и смена строки под неподвижным курсором; фокусируемая строка сначала показывается в видимой области.
- Таймер закрывал карточку при медленном переходе через промежуток. Область перехода теперь остаётся доступной. Проверка воспроизведена до исправления и прошла после него.
- WebKit мог сбросить фокус в body при клике по крестику и удалить кнопку до click. Закрытие отслеживает фактический следующий фокус, возврат выполняется после удаления карточки.
- WebKit растягивал узкую карточку из-за сочетания aspect-ratio/min-height. Размеры сделаны явными; изменение области справа отслеживается ResizeObserver, обновление позиции объединяется через requestAnimationFrame без observer-loop ошибок.

## Проверки

Среда: локальный `http://127.0.0.1:3112`, Next.js 16.3.8. Итоговая проверка и скриншоты выполнены на `next start` после production build. API и внешние запросы перехвачены до навигации; реальные заявки не создавались.

| Язык | 1440×1000 | 1024×1000 | 768×1000 | 390×1000 | 320×1000 |
| --- | --- | --- | --- | --- | --- |
| RU | PASS | PASS | PASS | PASS | PASS |
| SR | PASS | PASS | PASS | PASS | PASS |
| EN | PASS | PASS | PASS | PASS | PASS |

Матрица пройдена в Chrome и WebKit. Для каждого языка проверены все 14 услуг отдельно на desktop и mobile: первый/последний пункт, быстрое переключение, медленный переход на карточку, отсутствие нескольких карточек, отсутствие наложения на строки/верхние фотографии, края viewport, длинные заголовки, Escape, крестик, возврат фокуса и закрытие снаружи. Дополнительно проверены повторные реальные touch-tap в отдельном контексте, touch на ширине 1440 px и reduced motion. На старте проверено отсутствие запросов всех 14 новых изображений; после просмотра всех пунктов присутствуют ровно 14 уникальных путей.

- `npm run build` — PASS, 99 страниц.
- `npm run typecheck` — PASS.
- `npm run lint` — PASS, 0 ошибок; два прежних предупреждения `<img>` в `website-chat.tsx`.
- 90 существующих тестов approved pricing, SEO/analytics и mocked lead services/HTTP — PASS, 0 skipped.
- `node tests/browser/extras-ledger.mjs` — PASS в Chrome и WebKit; 0 ошибок страницы/консоли.
- `git diff --check` и проверка сохранности этапа 1 — PASS.

Команда тестов использует `node --conditions=react-server --import tsx --test` и те же семь безопасных наборов, перечисленных в отчёте этапа 1. Браузерный runner использует уже доступный Playwright core через `PLAYWRIGHT_CORE_PATH`, без установки зависимостей сайта. Для WebKit задаются `BROWSER_ENGINE=webkit`, `ARTIFACT_DIR=artifacts/homepage-stage2/webkit`, `BASELINE_PATH=artifacts/homepage-stage2/before.json`.

## Скриншоты и доказательства

[Галерея состояний, до/после и всех 14 assets](../artifacts/homepage-stage2/gallery.html).

- Desktop: [окно](../artifacts/homepage-stage2/desktop-standardWindow.png), [духовка](../artifacts/homepage-stage2/desktop-oven.png), [стиральная машина](../artifacts/homepage-stage2/desktop-washingMachine.png), [бельё](../artifacts/homepage-stage2/desktop-linen.png).
- Mobile: [большое окно](../artifacts/homepage-stage2/mobile-largeWindow.png), [вытяжка](../artifacts/homepage-stage2/mobile-hood.png), [пар](../artifacts/homepage-stage2/mobile-steam.png), [SR 320 px](../artifacts/homepage-stage2/sr-320-linen.png).
- Блок целиком RU 1440 px: [до](../artifacts/homepage-stage2/before-ru-1440.png) / [после](../artifacts/homepage-stage2/after-ru-1440.png).
- JSON: [Chrome](../artifacts/homepage-stage2/after.json), [WebKit](../artifacts/homepage-stage2/webkit/after.json), [assets](../artifacts/homepage-stage2/assets.json).
- Логи: [build](../artifacts/homepage-stage2/build.log), [typecheck](../artifacts/homepage-stage2/typecheck.log), [lint](../artifacts/homepage-stage2/lint.log), [90 tests](../artifacts/homepage-stage2/unit-tests.log), [Chrome](../artifacts/homepage-stage2/browser-production.log), [WebKit](../artifacts/homepage-stage2/webkit-production.log).

## Ограничения

Проверка браузеров подтверждает локальный интерфейс с mocked API. Реальная CRM/Postgres, AI, Queue и внешняя доставка не проверялись; их код не изменялся. Физические iOS/Android и VoiceOver/NVDA не проверялись. Изображения сгенерированы и не представляют клиентские кейсы.

Существующий `ai_release_source_mismatch` ожидаемо сообщает изменение исходников; release gate и его evidence не обновлялись. Production deploy, push, merge и commit не выполнялись. Работа остановлена на этапе 2.
