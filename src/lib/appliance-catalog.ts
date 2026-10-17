/** Owner-authorized prospective tariff. Existing order/finance snapshots are immutable. */
export const applianceCodes = ['fridge','oven','microwave','hood','dishwasher','washingMachine'] as const;
export type ApplianceCode = typeof applianceCodes[number];
export const appliancePrices: Record<ApplianceCode, number> = {
 fridge:1000, oven:1400, microwave:700, hood:1000, dishwasher:1000, washingMachine:1000,
};
export const applianceLabels: Record<'ru'|'sr'|'sr-Cyrl'|'en',Record<ApplianceCode,string>> = {
 ru:{fridge:'Холодильник изнутри',oven:'Духовка изнутри',microwave:'Микроволновка изнутри',hood:'Вытяжка внутри',dishwasher:'Посудомоечная машина внутри',washingMachine:'Стиральная машина внутри'},
 sr:{fridge:'Frižider iznutra',oven:'Rerna iznutra',microwave:'Mikrotalasna iznutra',hood:'Aspirator iznutra',dishwasher:'Mašina za sudove iznutra',washingMachine:'Mašina za veš iznutra'},
 'sr-Cyrl':{fridge:'Фрижидер изнутра',oven:'Рерна изнутра',microwave:'Микроталасна изнутра',hood:'Аспиратор изнутра',dishwasher:'Машина за судове изнутра',washingMachine:'Машина за веш изнутра'},
 en:{fridge:'Inside fridge',oven:'Inside oven',microwave:'Inside microwave',hood:'Inside extractor hood',dishwasher:'Inside dishwasher',washingMachine:'Inside washing machine'},
};
export const applianceScope = {
 ru:'Очистка доступных внутренних поверхностей без демонтажа и ремонта.',
 sr:'Čišćenje dostupnih unutrašnjih površina, bez demontaže i popravki.',
 'sr-Cyrl':'Чишћење доступних унутрашњих површина, без демонтаже и поправки.',
 en:'Cleaning accessible inside surfaces, without disassembly or repairs.',
};
