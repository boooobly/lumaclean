import test from 'node:test';
import assert from 'node:assert/strict';
import {mandatoryHandoff} from '../../src/lib/agent/policy';
test('choosing crypto requires team confirmation of fee, asset and network',()=>{
 for(const text of ['Оплачу криптовалютой','Плачу криптой. Можно записаться?','I will pay with crypto. Can you book?','Platiću kriptovalutom'])assert.equal(mandatoryHandoff(text),'PAYMENT_REVIEW',text);
});
test('crypto availability questions remain ordinary business questions',()=>{
 for(const text of ['Можно оплатить криптовалютой?','Can I pay with crypto?','Da li primate kripto?'])assert.equal(mandatoryHandoff(text),null,text);
});
