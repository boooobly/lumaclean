import { Workbook } from "exceljs";
export function legacyFixture() {
  const b = new Workbook();
  const orders = b.addWorksheet("Заказы"),
    expenses = b.addWorksheet("Расходы"),
    investments = b.addWorksheet("Вложения");
  orders.getRow(4).values = [
    "Дата",
    "ID заказа",
    "Клиент",
    "Услуга",
    "Площадь, м²",
    "Район",
    "Доход, RSD",
    "Прямые расходы, RSD",
    "Резерв, %",
    "В резерв LumaClean",
    "Фонд оплаты труда",
    "Часы Владислава",
    "Часы партнёра",
    "Выплата Владиславу",
    "Выплата партнёру",
    "Статус",
    "Оплата получена",
    "Комментарий",
  ];
  expenses.getRow(4).values = [
    "Дата",
    "ID расхода",
    "ID заказа",
    "Категория",
    "Описание",
    "Кто оплатил",
    "Сумма, RSD",
    "Возмещено",
    "Комментарий",
  ];
  investments.getRow(4).values = [
    "Дата",
    "Кто вложил",
    "Покупка / назначение",
    "Категория",
    "Вложено, RSD",
    "Возвращено, RSD",
    "Остаток к возврату",
    "Комментарий",
  ];
  for (let n = 5; n <= 6; n++)
    orders.getRow(n).values = [
      new Date("2026-09-20T00:00Z"),
      "fixture-" + n,
      "Яна @yanatest007",
      "Поддерживающая уборка",
      70,
      "Белград",
      10000,
      0,
      0.15,
      1500,
      8500,
      3,
      3,
      4250,
      4250,
      "Выполнен",
      "Да",
      "Тестовая история",
    ];
  expenses.getRow(5).values = [
    new Date("2026-09-20T00:00Z"),
    "expense-5",
    "fixture-5",
    "Реклама",
    "Тестовая реклама",
    "Тест",
    100,
    "Да",
  ];
  b.addWorksheet("Дашборд").getRow(1).values = ["Не импортировать", 999999];
  return b;
}
