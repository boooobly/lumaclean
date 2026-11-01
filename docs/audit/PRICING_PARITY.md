# Согласованность тарифов — 01.11.2026

Источник — live [Google Sheets](https://docs.google.com/spreadsheets/d/1Xua3GrAYAgYfcbYUEWrU6I6cMZEA0IULLdSuKrbW4DY/edit), листы 01–06. Получены bounded ranges A1:R400 (06 A1:R90), фактически 129/284/98/110/112/29 строк. Использованы рабочие project-price колонки, статусы и owner comments; старые ориентиры не заменяют тариф.

Компактный проверяемый контракт без внутренних норм труда: [pricing-contract.json](evidence/pricing-contract.json). Полный range export и input importer сохранены **только в ignored local artifacts**, потому что включают внутренние нормы и комментарии. Они не включаются в PR. AI snapshot источник: sourceHash `bd6a8796e18a3e4ce0658a9f513a2d8a8a7c3fa03b372abe6de5fad2efd39662`, version `2026-11-01.50167f823b9b`.

## Числа основных услуг

| Услуга | <40 | 40–<60 | 60–<80 | 80–<100 | 100+, RSD/м² |
|---|---:|---:|---:|---:|---:|
| regular | 4900 | 6000 | 8200 | 9800 | 98 |
| deep | 9900 | 11400 | 14200 | 17000 | 180 |
| move | 10700 | 12800 | 15600 | 18400 | 180 |
| airbnb | 4900 | 5800 | 7400 | 9000 | 90 |
| office | 4900 | 5800 | 7400 | 9000 | 90 |

Все 25 numeric bands совпали: live Sheet → priceMatrix → текущие 25 DB bands → package knowledge tariffs. Исторические DB bands закрыты validUntil, не удаляются. Код CRM quote делегирует shared calculatePrice. Public labels/таблицы используют те же значения.

**Противоречие источника:** deep на границе 100 увеличивается с 17000 до 18000, move уменьшается с 18400 до 18000. Комментарий «скачка нет» не согласован с H-значениями. Ни цена 170/184, ни сглаживание не выбраны агентом. Нужен ответ владельца; 100+ и нестандартный объём подтверждаются человеком.

## Допуслуги

| Runtime code | Цена RSD | Единица / статус |
|---|---:|---|
| standardWindow | 700 | окно; обе стороны/рамы/пазы/подоконник включены |
| largeWindow | 1000 | большое окно, нестандартный размер требует review |
| balcony | 1200 | пакет балкона/террасы; не дублировать включённые части |
| fridge / oven / microwave | 1000 / 1400 / 700 | прибор, внутри |
| hood / dishwasher / washingMachine | 1000 / 1000 / 1000 | прибор; scope/исключения по каталогу |
| cabinets | 500 | секция |
| ironing | 900 | 30 минут одного человека |
| linen | 750 | кровать, снятие/наволочки/застилание включены |
| petHair | 900 | согласованный пакет сильной шерсти |
| steam | 2800 | до 5 м², **по согласованию**, оборудование ещё требуется подтвердить |

14 runtime extras совпали с Sheets, ServiceExtra и appliance-catalog. Остальные строки большого каталога не превращаются в auto-priced extras: knowledge может объяснить scope, но manager review обязателен. Laundry included in residential deep и исключения двойной оплаты сохранены в knowledge; нельзя автоматически суммировать пакеты/компоненты по одному упоминанию модели. Linen UI пока выражает одну кровать; это LC-20, не новая единица цены.

## Арифметика

1. Сложить сырую стоимость площади и выбранных допработ.
2. Применить минимум заказа как floor, а не дополнительный сбор. При химчистке ADDON второго минимума нет.
3. При срочности **или** согласованном празднике применить одну надбавку 20%. Совпадение не даёт 40%.
4. Только при выбранной crypto оплате добавить 5% после service surcharge; ×1.20×1.05=×1.26.
5. Итоговую смету RSD округлить вверх до 100 один раз. Согласованные прежние цены/скидки/snapshots задним числом не пересчитывать.

| Сценарий | Старый runtime | Правильный результат | Проверка |
|---|---:|---:|---|
| regular 50 + linen | 6750 | 6800 | red → green regression |
| regular 39 + linen | 5650 | 5700 | runtime test |
| regular 103 + linen, urgent | 13050 | 13100 | red → green regression |
| regular 39, urgent | 5900 | 5900 | runtime test |
| regular 55 + SOFA3, urgent | 12700 | 12800 | upholstery shared rule |
| chair ADDON | 600 | 600 | без второго минимума |
| chair STANDALONE | 4000 | 4000 | минимум, не плюс 4000 |
| 6750, holiday+urgent+crypto | не поддерживается автоматически | ceil(6750×1.26 /100)×100 = 8600 | manual reference; **не API PASS** |

`tests/crm/pricing-contract.test.ts`: независимый oracle по 19 значениям площади × 5 услуг × 4 количества linen × 2 urgency = 760 комбинаций, дополнительные windows/oven, совпадение суммы строк. Отдельный существующий domain test проходит 800 площадей для каждой услуги. Approved pricing tests покрывают границы 39/40, 59/60, 79/80, 99/100, предметы химчистки и общую CRM/public функцию.

**Не реализовано автоматически:** payment method, календарь утверждённых праздников и финансовый crypto snapshot. Поэтому эти API-комбинации не объявлены PASS; команда согласует итог через ручную цену с причиной. Knowledge обновлена, явный выбор crypto требует PAYMENT_REVIEW; простые вопросы RU/SR/EN остаются FAQ.

## Условные услуги и длительность

Steam не удалён из запросов клиентов и не выдаётся за готовую технику. Website Lead получает manual review; форма показывает оговорку на трёх языках. AI activePrice уже требует review при steam. Upholstery всегда bookingRequiresHumanReview=true / autonomousBooking=false, материал/предмет/итог уточняет человек.

DurationRule использует elapsed minutes, таблица — person-minutes и crew. В БД regular=150 min на диапазон 1–100 и deep=480 min на 40–60; нельзя автоматически скопировать табличные 180/480 person-minutes. У oven конфликт 30 vs owner-comment 60. До owner reconciliation автоматический booking не сертифицирован. Старые Rule versions/Order snapshots не изменялись.

## Контроль версий

- Перед каждым release получить свежие read-only ranges 01–06; зафиксировать дату, точные ranges, sourceHash и компактный контракт. Изменение Sheet требует review diff по **цене, единице, статусу, scope и inclusion**, а не только хэша.
- CI сравнивает approved contract с runtime и knowledge. Обновлять fixture одновременно с кодом без owner review нельзя; raw Sheet export хранить вне публичного Git.
- `sync-business-knowledge.ts` принимает шесть bounded tabs и ограничивает auto capabilities пятью реализованными пакетами. Новые aliases не становятся услугами автоматически. Стабильные исходные code сохраняются.
- DB tariff update — отдельный reviewable dry-run, новая validFrom/version, закрытие прежних bands; без изменений negotiated prices, payouts, historical records. В этом аудите update script не запускался на production.
- После изменения source нужны pricing/unit/HTTP/browser QA, новое source-bound evidence и native/live gates. Хэш успешного manual-only build не даёт разрешения включить AUTO.
- Offline CI не узнаёт о самостоятельной правке Sheet до нового export: автоматический read-only freshness probe можно подключить только после выбора владельцем credentials/периодичности/получателя. Такое слепое пятно явно остаётся, а не скрывается словом «синхронизация».
