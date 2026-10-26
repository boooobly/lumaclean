import assert from 'node:assert/strict';
import test from 'node:test';
import {contactClickEvent, eventNames, safeEventData} from '../../src/lib/analytics';

test('contact events include neither the telephone number nor messenger message text', () => {
  assert.deepEqual(contactClickEvent('tel:+381601234567', 'https://lumacleanrs.com'), {name: 'phone_click', data: {}});
  for (const [href, channel] of [['https://wa.me/381601234567?text=PRIVATE', 'whatsapp'], ['viber://chat?number=PRIVATE', 'viber'], ['https://t.me/private_user', 'telegram']]) {
    assert.deepEqual(contactClickEvent(href, 'https://lumacleanrs.com'), {name: 'messenger_click', data: {channel}});
  }
  for (const href of ['https://wa.me.attacker.example', 'https://example.com/t.me', 'javascript:alert(1)', '#estimate']) assert.equal(contactClickEvent(href, 'https://lumacleanrs.com'), undefined);
  assert.ok(eventNames.includes('phone_click'));
});

test('upholstery conversions accept fixed form/service values and discard free text', () => {
  assert.deepEqual(safeEventData({locale: 'sr', service: 'upholstery', form_type: 'upholstery', channel: '+381PRIVATE', destination: '/ru?phone=PRIVATE'}, ['/ru']), {locale: 'sr', service: 'upholstery', form_type: 'upholstery'});
  assert.deepEqual(safeEventData({form_type: 'PRIVATE', service: 'PRIVATE'}, []), {});
});
