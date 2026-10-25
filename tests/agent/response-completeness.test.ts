import assert from 'node:assert/strict';
import test from 'node:test';
import {directBusinessQuestion} from '../../src/lib/agent/knowledge/search';
import {responseGreeting,turnNeedsModel,turnMessages,nextMessageTime,messageReceivedTime} from '../../src/lib/agent/response-context';
import {resolveCustomerDate} from '../../src/lib/agent/temporal';

test('a personalized total must not swallow an independent FAQ in a client burst',()=>{
  const turn=[{text:'Нужна генеральная уборка 60 м². Сколько стоит всё вместе?'},{text:'Вы привозите свои средства?'},{text:'Как можно оплатить?'}];
  assert.equal(directBusinessQuestion(turn.map(m=>m.text).join('\n')),false);
  assert.equal(turnNeedsModel(turn),true);
  assert.equal(turnNeedsModel([{text:'Нужна генеральная уборка'},{text:'60 м²'},{text:'Без допов'}]),false);
  assert.equal(turnNeedsModel([{text:'How much is everything for cleaning 60 m²? Do you bring supplies?'}]),true);
});

test('five independent messages reach the model in order without collapsing their boundaries',()=>{
  const turn=['Нужна уборка 60 м²','Что входит?','Свои средства?','Как оплатить?','Когда можно?'].map(text=>({text}));
  assert.deepEqual(turnMessages(turn),turn.map(m=>({role:'user',content:m.text})));
});

for(const [locale,greeting] of [['ru','Здравствуйте!'],['en','Hello!'],['sr-Latn','Zdravo!'],['sr-Cyrl','Здраво!']] as const){
  test(`first substantive response greets exactly once, including deterministic/recovery output: ${locale}`,()=>{
    assert.equal(responseGreeting('Answer.',locale,true),`${greeting} Answer.`);
    assert.equal(responseGreeting(`${greeting} Answer.`,locale,true),`${greeting} Answer.`);
    assert.equal(responseGreeting(`${greeting} Answer.`,locale,false),'Answer.');
    assert.equal(responseGreeting('Answer.',locale,false),'Answer.');
  });
}

test('locked timeline preserves every same-millisecond/concurrently delayed message',()=>{
  const first=new Date('2026-10-25T10:00:00Z');
  const second=nextMessageTime(first,first),third=nextMessageTime(first,second);
  assert.equal(second.getTime(),first.getTime()+1);
  assert.equal(third.getTime(),first.getTime()+2);
  const reply=new Date(first.getTime()+3000);
  assert.equal(nextMessageTime(first,reply).getTime(),reply.getTime()+1);
  assert.equal(nextMessageTime(reply,first).getTime(),reply.getTime());
});

test('greeting normalization preserves words which merely begin with Hi',()=>{
  assert.equal(responseGreeting('High ceilings need review.','en',false),'High ceilings need review.');
});

test('a request waiting across Belgrade midnight keeps the customer date for tomorrow',()=>{
  const receivedAt=new Date('2026-10-25T22:59:59.999Z');
  const sentAt=nextMessageTime(receivedAt,new Date('2026-10-25T23:00:01Z'));
  assert.equal(resolveCustomerDate('Завтра',messageReceivedTime({receivedAt,sentAt}),'Europe/Belgrade'),'2026-10-26');
  assert.equal(resolveCustomerDate('Завтра',sentAt,'Europe/Belgrade'),'2026-10-27');
  assert.equal(messageReceivedTime({sentAt}),sentAt);
});
