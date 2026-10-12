import assert from "node:assert/strict";
import test from "node:test";
import { assertRecordVersion, calendarOrderVisible } from "../../src/lib/domain/crm-lifecycle";
import { commandSchemas } from "../../src/lib/validation/crm";
import { assertTransition, CrmError } from "../../src/lib/domain/crm";
import { bookConfirmed, type ToolContext } from "../../src/lib/agent/tools";

test("cancelled and no-show Orders leave the active calendar; history toggle includes them", () => {
  for (const status of ["CANCELLED", "NO_SHOW"]) {
    assert.equal(calendarOrderVisible(status, false), false);
    assert.equal(calendarOrderVisible(status, true), true);
  }
  for (const status of ["DRAFT", "SCHEDULED", "IN_PROGRESS", "COMPLETED"])
    assert.equal(calendarOrderVisible(status, false), true);
});

test("status forms support optimistic versions without breaking legacy callers", () => {
  const id="lifecycle-test-order", at="2026-10-12T08:00:00.000Z";
  assert.equal(commandSchemas["order-status"].parse({id,status:"CANCELLED",reason:"Клиент отказался",expectedUpdatedAt:at}).expectedUpdatedAt,at);
  assert.equal(commandSchemas["lead-status"].parse({id,status:"LOST",reason:"Отказ",expectedUpdatedAt:at}).expectedUpdatedAt,at);
  assert.equal(commandSchemas["order-status"].parse({id,status:"CANCELLED",reason:"Отказ"}).expectedUpdatedAt,undefined);
  assert.equal(commandSchemas["lead-status"].safeParse({id,status:"LOST",expectedUpdatedAt:"not a timestamp"}).success,false);
});

test("a stale confirmation cannot close a changed Order or Lead", () => {
  const current=new Date("2026-10-12T09:00:00.000Z");
  assert.doesNotThrow(()=>assertRecordVersion(current,current.toISOString()));
  assert.doesNotThrow(()=>assertRecordVersion(current));
  assert.throws(()=>assertRecordVersion(current,"2026-10-12T08:00:00.000Z"),(e:unknown)=>e instanceof CrmError&&e.code==="STALE");
});

test("closing one record does not reopen terminal orders; a closed enquiry can be taken back into work", () => {
  assert.doesNotThrow(()=>assertTransition("Order","SCHEDULED","CANCELLED"));
  assert.doesNotThrow(()=>assertTransition("Lead","READY_TO_BOOK","LOST"));
  assert.doesNotThrow(()=>assertTransition("Lead","LOST","IN_PROGRESS"));
  assert.throws(()=>assertTransition("Order","COMPLETED","CANCELLED"));
  assert.throws(()=>assertTransition("Lead","CONVERTED","LOST"));
});

test("an owner-closed Lead blocks autonomous booking before any side effects", async () => {
  const db={$queryRaw:async()=>[],lead:{count:async()=>1}};
  await assert.rejects(()=>bookConfirmed(db as never,{leadId:"closed-lead"} as never,{mode:"AUTO",state:{}} as ToolContext,false),/LEAD_CLOSED/);
});
