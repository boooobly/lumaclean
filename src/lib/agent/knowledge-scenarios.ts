/** Synthetic clients, no contacts, addresses or confirmation: never an Order. */
export const knowledgeScenarios={
 packages:{locale:'ru',texts:['Что входит в поддерживающую уборку?','Чем генеральная отличается?','Нужно 80 квадратов. А окна в генеральную входят?','А стирка, глажка и смена белья?']},
 goldenA:{locale:'ru',texts:['У вас генеральная уборка, 65 квадратов, духовка и холодильник изнутри. Обычное загрязнение, больше ничего. Сколько?','Я же написал, что духовка нужна. Сколько всего?']},
 goldenB:{locale:'ru',texts:['Два санузла, поддерживающая, 75 квадратов. Обычное загрязнение, больше ничего.','Второй санузел сколько стоит?','А окна входят?']},
 goldenC:{locale:'ru',texts:['Нужно только диван почистить. Трёхместный.','Как работает минимальный выезд?','Каким оборудованием чистите?']},
 boundaries:{locale:'ru',texts:['Чистите квартиры после ремонта?','А плесень удаляете?','Можно оплатить картой?','В Airbnb входит смена постельного белья?']},
 serbian:{locale:'sr-Latn',texts:['Treba mi generalno čišćenje i pranje prozora. Šta ulazi u cenu?','Da li perete roletne?','Da li je rerna uključena u cenu?','Koliko košta pranje troseda?','Kako mogu da platim?']},
 cyrlKnowledge:{locale:'sr-Cyrl',texts:['Шта укључује генерално чишћење?','Да ли перете комарнике?','Колико кошта прање двоседа?','Да ли могу платити картицом?']},
 englishKnowledge:{locale:'en',texts:['Do you clean the inside of kitchen cabinets?','What is included in office cleaning?','How much is a single mattress, one side?','Do you remove all stains?','What is your cancellation and quality complaint policy?']},
 custom:{locale:'ru',texts:['Есть ролеты на всех окнах, хочу их помыть вместе с уборкой.','Мне нужно отмыть душевую от сильного налёта.','Хочу оплатить только картой.','Можете рассказать про регулярные уборки?']},
 rules:{locale:'en',texts:['Do you bring equipment and cleaning supplies?','How many cleaners come?','Can you come today?','Is there a weekend surcharge?','What discounts do regular clients get?']},
} as const;
