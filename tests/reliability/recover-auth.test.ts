import test from 'node:test';
import assert from 'node:assert/strict';
import {GET} from '../../src/app/api/agent/recover/route';
test('recovery rejects malformed multibyte bearer secrets without throwing or touching DB',async()=>{
 const old=process.env.CRON_SECRET;
 try {
  process.env.CRON_SECRET='abcdef';
  const response=await GET(new Request('https://test.invalid/api/agent/recover',{headers:{authorization:'Bearer ébcdef'}}));
  assert.equal(response.status,401);
 } finally {if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;}
});
