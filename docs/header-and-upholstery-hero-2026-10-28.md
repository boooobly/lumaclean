# Шапка и главное фото химчистки

Рабочая копия `upholstery-premium`, ветка `codex/public-pages-release-20261027`, исходный commit `80b3385`.

## Шапка

Изменения ограничены `.site-page .site-header` в `site-production.css`, общей шапкой публичных страниц. Пункты меню и языки получили подчёркивание через `transform:scaleX`, пункты меню — плавную смену цвета. CTA меняет фон/границу в существующей палитре; стрелка смещается на 2 px по диагонали. Длительности 180–220 мс, без теней и смещения сетки. Hover-движение доступно только с fine pointer/hover. Клавиатурный фокус остаётся видимым; reduced motion отключает движение стрелки и переходы. На светлом фоне используется тёмный teal, поверх hero — светлый акцент. URL и логика общей шапки не менялись.

## Изображение

Через встроенный `image_gen` создано отдельное фото экстракционной чистки светлого тканевого дивана в нейтральной жилой гостиной. Проверены форма дивана, фактура ткани, хват руки, контакт прозрачной насадки с обивкой, отсутствие надписей/логотипов. Это иллюстрация услуги, без выдачи за клиентскую работу.

Asset: `public/media/upholstery/hero-extraction.webp`, **1254×1254 px, 218576 bytes (~213 KiB)**, Sharp WebP quality 82, effort 6, без увеличения исходника. Исходник `exec-197572bf-eadb-480d-93ef-245be7aefcb3.png` сохранён инструментом в `.codex/generated_images/01a17973-cb86-77a2-b7b4-5339dc199592/`.

Сюжет промпта: premium editorial photograph, warm residential living room, oatmeal woven three-seat sofa, single grey-gloved hand holding one plausible transparent upholstery extraction nozzle flush against the seat, single dark suction hose, natural daylight, neutral beige/stone/charcoal palette, square crop; no text, logos, watermarks, excessive foam, spray clouds, comparison panels or anatomy artifacts.

Фото подключено только к hero и его Open Graph; старое `sofa.webp` сохранено в каталоге. Обновлены alt-тексты RU/SR/EN и responsive `sizes` с верхним пределом 670 px. Сохранены Next/Image, preload, `object-fit:cover`, кадрирование и нижний правый скруглённый угол. Цены, каталог и калькулятор не менялись.

## Проверки

- Chrome и WebKit, локальный production build `http://127.0.0.1:3112`: 11 страниц (главная RU/SR/EN, химчистка RU/SR/EN, пять услуг RU) × 2265/1440/1024/768/390/320 = 66 сочетаний в каждом браузере. Нет горизонтального скролла; ссылки, title, canonical и таблицы цен совпадают с before-снимком.
- Hover меню, языков, CTA; движение стрелки; отсутствие сдвига ссылок; focus-visible; reduced motion; светлая шапка и шапка поверх hero — PASS в обоих браузерах.
- Hero успешно загружается, имеет локализованный alt; desktop/mobile просмотрены визуально.
- Регрессия химчистки `upholstery-stage3.mjs`: RU/SR/EN × пять ширин, SPOT, повторный выбор и ADDON, старые цены и содержание — PASS, 0 ошибок.
- TypeScript, production build — PASS. ESLint — 0 ошибок, два прежних предупреждения `<img>` в чате.
- Unit — 1044 PASS, 33 SKIP (нужно отдельное окружение); client SSR — 15 PASS.

API в браузере перехвачены, реальные заявки/уведомления не отправлялись. Физические устройства, screen reader и живая доставка отдельно не проверялись. Скриншоты до/после, состояния шапки и JSON: `artifacts/header-hero/`.
