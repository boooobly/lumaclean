import {parsePhoneNumberFromString} from 'libphonenumber-js/min';

// Match the server's accepted Serbian national and explicit international forms.
export function isWebsitePhoneValid(input: string) {
  const value = input.trim();
  if (!/^(?:\+|0)/.test(value)) return false;
  return parsePhoneNumberFromString(value.startsWith('00') ? `+${value.slice(2)}` : value, {defaultCountry: 'RS', extract: false})?.isValid() === true;
}
