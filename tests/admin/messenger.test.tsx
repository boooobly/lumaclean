import React, { Fragment } from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { daySeparator, groupedMessages, initials, matchesConversation } from '../../src/lib/domain/messenger';
import { ledgerRows } from '../../src/components/admin/responsive-ledger';
import { DisclosureSection } from '../../src/components/admin/disclosure';
import { Drawer } from '../../src/components/admin/drawer';
import { InboxList } from '../../src/components/admin/inbox-list';
import { MobileBottomNav } from '../../src/components/admin/mobile-bottom-nav';
import { MessengerControls } from '../../src/components/admin/messenger-controls';
import { MessengerBubble } from '../../src/components/admin/messenger-bubble';
import type { conversationData, inboxData } from '../../src/lib/agent/queries';
import { cleanerDay } from '../../src/lib/domain/cleaner-day';
import { Temporal } from '@js-temporal/polyfill';
import { clientSchema } from '../../src/lib/validation/crm';
import { MessengerHistory } from '../../src/components/admin/messenger-history';

test('latest action on an older history page navigates to the current conversation', () => {
  const markup=render(<MessengerHistory older latestHref="/admin/messages/chat-a">Old history</MessengerHistory>);
  assert.match(markup, /aria-label="К последним сообщениям" href="\/admin\/messages\/chat-a"/);
});

test('CRM discount boundaries remain intact and validation explains the allowed value', () => {
  const client={name:'QA',phone:'+381000000000'};
  assert(clientSchema.safeParse({...client,discountPercent:100}).success);
  const result=clientSchema.safeParse({...client,discountPercent:999});
  assert(!result.success);
  assert.equal(result.error.issues.find(issue=>issue.path[0]==='discountPercent')?.message,'Значение должно быть не больше 100');
  assert(!clientSchema.safeParse({...client,discountPercent:-1}).success);
});

test('day separators use business day across UTC midnight and DST', () => {
  assert.equal(daySeparator('2026-10-05T22:30:00Z', new Date('2026-10-06T08:00:00Z')), 'Сегодня');
  assert.equal(daySeparator('2026-10-25T21:30:00Z', new Date('2026-10-25T23:30:00Z')), 'Вчера');
  assert.match(daySeparator('2025-12-31T20:00:00Z', new Date('2026-01-01T08:00:00Z')), /Вчера/);
});
test('message groups stop at author/day/interval boundaries and out-of-order history', () => {
  const a = {author:'CLIENT',sentAt:'2026-10-05T21:58:00Z'};
  assert(groupedMessages(a,{...a,sentAt:'2026-10-05T21:59:00Z'}));
  assert(!groupedMessages(a,{...a,author:'ADMIN'}));
  assert(!groupedMessages(a,{...a,sentAt:'2026-10-05T22:00:00Z'}));
  assert(!groupedMessages(a,{...a,sentAt:'2026-10-05T21:57:00Z'}));
  assert(!groupedMessages(a,{...a,sentAt:'2026-10-05T22:03:00Z'}));
});
test('search and avatars accept long Serbian names and phone-only conversations', () => {
  assert.equal(initials('Željka Đorđević Petrović'), 'ŽĐ');
  assert.equal(initials(''), '?');
  assert(matchesConversation({name:'Željka',phone:'+381641234567',lastMessage:'Generalno čišćenje',channel:'WHATSAPP'}, '  ČIŠĆENJE '));
  assert(matchesConversation({name:'Željka',phone:'+381641234567',lastMessage:'',channel:'WEBSITE'}, '641234'));
});
test('responsive ledger preserves a single form and column labels through fragments', () => {
  const markup = render(<table><tbody>{ledgerRows(<Fragment><tr><td>Клиент</td><td><form><input name="amount" defaultValue="1250" /></form></td></tr></Fragment>, ['Имя','Оплата'])}</tbody></table>);
  assert.equal((markup.match(/<form/g)??[]).length,1);
  assert.match(markup,/data-label="Оплата"/);
  assert.match(markup,/name="amount"/);
});
test('disclosures hide technical content by default and dialogs have a labelled close control', () => {
  const markup=render(<><DisclosureSection title="Технические детали"><code>provider-id</code></DisclosureSection><Drawer title="Клиент и заказ"><p>Контакт</p></Drawer></>);
  assert(!markup.includes('open=""'));
  assert.match(markup,/<dialog[^>]*aria-labelledby=/);
  assert.match(markup,/aria-haspopup="dialog"/);
  assert.match(markup,/aria-label="Закрыть"/);
});
const row={id:'chat-a',name:'+381641234567',phone:'+381641234567',channel:'WHATSAPP',mode:'AUTO',control:'AI_CONTROL',stage:'DISCOVERY',owner:null,unread:3,needsAttention:true,lastMessage:'Duga poruka o čišćenju prozora i kuhinje.',lastMessageAt:'2026-10-06T08:00:00Z',orderReference:null,shadow:false,failedDelivery:true};
test('selected conversation keeps unread, channel, attention and delivery failure visible', () => {
  const data={rows:[row],next:null,mode:'AUTO',enabled:true,telegram:false,attention:1} as Awaited<ReturnType<typeof inboxData>>;
  const markup=render(<InboxList data={data} selected="chat-a" compact />);
  assert.match(markup,/<a[^>]*aria-current="page"[^>]*href="\/admin\/messages\/chat-a"/);
  assert.match(markup,/3 непрочитанных/);
  assert.match(markup,/Нужен ответ/);
  assert.match(markup,/Не доставлено/);
  assert(!markup.includes('DISCOVERY'));
  assert(!markup.includes('AUTO'));
});
test('bottom navigation exposes four primary destinations, more sheet and capped unread', () => {
  const markup=render(<MobileBottomNav unread={120} />);
  for(const path of ['messages','calendar','orders','leads','clients','cleaners','finances','settings']) assert(markup.includes(`/admin/${path}`));
  assert.match(markup,/99\+/);
  assert.match(markup,/120 непрочитанных/);
  assert.match(markup,/Другие разделы/);
  assert.match(markup,/Выход|Выйти/);
});
const props={id:'chat-a',identityVerified:false,name:'Željka Đorđević Petrović',channel:'WEBSITE',context:<Drawer title="Клиент и заказ">Контекст</Drawer>,children:<p>История</p>};
test('AI composer is read-only with takeover while human has resume and send action', () => {
  const ai=render(<MessengerControls {...props} control="AI_CONTROL" />), human=render(<MessengerControls {...props} control="HUMAN_CONTROL" />);
  assert.match(ai,/readOnly=""/);
  assert.match(ai,/Забрать/);
  assert.match(human,/Вернуть AI/);
  assert.match(human,/aria-label="Ответ клиенту"/);
  assert(!human.includes('readOnly=""'));
  assert.match(human,/aria-label="Прикрепить фото"/);
});
test('SHADOW suggestion stays outside history with send edit hide and close confirmation', () => {
  const markup=render(<MessengerControls {...props} control="AI_CONTROL" shadow={{id:'suggestion-a',text:'Predlog odgovora'}} />);
  assert.match(markup,/AI предлагает/);
  assert.match(markup,/Забрать и отправить/);
  assert.match(markup,/Изменить/);
  assert.match(markup,/Скрыть/);
  assert.match(markup,/Закрыть диалог/);
});
test('closed conversations offer reopen without a sending composer', () => {
  const markup=render(<MessengerControls {...props} control="CLOSED" />);
  assert.match(markup,/Открыть и вернуть AI/);
  assert(!markup.includes('aria-label="Отправить сообщение"'));
});
type Message=NonNullable<Awaited<ReturnType<typeof conversationData>>>['messages'][number];
const message:Message={id:'message-a',author:'CLIENT',customerVisible:true,text:'Tekst',sentAt:'2026-10-06T08:00:00Z',deliveryStatus:'DELIVERED',attachments:[],deliveryError:null,providerId:null,receivedAt:null,providerSentAt:null,deliveryUpdatedAt:null,deliveredAt:null,readAt:null,replyTo:null,rejectedAttachments:[]};
test('bubbles align by author, group labels and distinguish unknown delivery from failure', () => {
  const client=render(<MessengerBubble message={message} grouped={false} alias="Anna" />);
  const human=render(<MessengerBubble message={{...message,author:'ADMIN',deliveryStatus:'UNKNOWN'}} grouped={false} alias="Anna" />);
  const grouped=render(<MessengerBubble message={{...message,author:'AI'}} grouped alias="Anna" />);
  assert.match(client,/is-incoming/);
  assert.match(human,/is-outgoing/);
  assert.match(human,/Доставка не подтверждена/);
  assert(!grouped.includes('messenger-author'));
});
test('media uses lazy thumbnails and compact protected PDF links without storage metadata', () => {
  const photo={id:'photo-a',mimeType:'image/jpeg',width:600,height:400,byteSize:1024,aiAnalysisStatus:'PENDING'},pdf={id:'pdf-a',mimeType:'application/pdf',width:0,height:0,byteSize:2048,aiAnalysisStatus:'PENDING'};
  const markup=render(<MessengerBubble message={{...message,text:'[Вложение]',attachments:[photo,pdf]} as Message} grouped={false} alias="Anna" />);
  assert.match(markup,/loading="lazy"/);
  assert.match(markup,/photo-a\?thumb=1/);
  assert.match(markup,/\/api\/chat\/attachments\/pdf-a/);
  assert.match(markup,/PDF-документ/);
  assert(!markup.includes('[Вложение]'));
});
test('cleaner daily summary respects dated overrides, inactivity and missing hours', () => {
  const today=Temporal.PlainDate.from('2026-10-06'),weekly={kind:'WEEKLY' as const,weekday:2,date:null,startMinute:540,endMinute:1020};
  assert.equal(cleanerDay(true,[weekly],today),'Сегодня 09:00–17:00');
  assert.equal(cleanerDay(true,[weekly,{...weekly,kind:'UNAVAILABLE',date:new Date('2026-10-06'),startMinute:null,endMinute:null}],today),'Сегодня выходной');
  assert.equal(cleanerDay(false,[weekly],today),'Неактивен');
  assert.equal(cleanerDay(true,[],today),'График не задан');
});
