// Independent expected URLs: browser QA must not depend on ignored local artifacts.
const slugs={
 ru:{regular:'uborka-kvartir',deep:'generalnaya-uborka',move:'uborka-pri-pereezde',airbnb:'uborka-airbnb',office:'uborka-ofisov'},
 sr:{regular:'ciscenje-stanova',deep:'generalno-ciscenje',move:'ciscenje-pri-selidbi',airbnb:'ciscenje-airbnb-apartmana',office:'ciscenje-kancelarija'},
 en:{regular:'apartment-cleaning',deep:'deep-cleaning',move:'move-in-move-out-cleaning',airbnb:'airbnb-cleaning',office:'office-cleaning'},
};
export const servicePages=Object.entries(slugs).flatMap(([locale,services])=>Object.entries(services).map(([id,slug])=>({locale,id,path:`/${locale}/services/${slug}`})));
