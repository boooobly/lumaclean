// Historical mixed-language URLs actually reported as 404 in Search Console.
// Keep the requested locale; the unprefixed historical Serbian URL uses Serbian.
export const legacyServiceRedirects = [
  {source: '/en/services/uborka-airbnb', destination: '/en/services/airbnb-cleaning', permanent: true},
  {source: '/ru/services/ciscenje-kancelarija', destination: '/ru/services/uborka-ofisov', permanent: true},
  {source: '/ru/services/ciscenje-airbnb-apartmana', destination: '/ru/services/uborka-airbnb', permanent: true},
  {source: '/ru/services/office-cleaning', destination: '/ru/services/uborka-ofisov', permanent: true},
  {source: '/ru/services/ciscenje-pri-selidbi', destination: '/ru/services/uborka-pri-pereezde', permanent: true},
  {source: '/services/ciscenje-airbnb-apartmana', destination: '/sr/services/ciscenje-airbnb-apartmana', permanent: true},
  {source: '/ru/services/deep-cleaning', destination: '/ru/services/generalnaya-uborka', permanent: true},
];
