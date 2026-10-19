import assert from 'node:assert/strict';
import test from 'node:test';
import {managerLink} from '../../src/lib/notification-links';

test('Preview manager links use the exact deployment origin and fail closed without it',()=>{
  const before={...process.env};
  try{
    process.env.VERCEL_ENV='preview';process.env.VERCEL_URL='synthetic-preview.vercel.app';
    process.env.NEXT_PUBLIC_SITE_URL='https://lumacleanrs.com';
    assert.equal(managerLink('/admin/leads/fixture'),'https://synthetic-preview.vercel.app/admin/leads/fixture');
    delete process.env.VERCEL_URL;
    assert.throws(()=>managerLink('/admin/leads/fixture'),/PREVIEW_NOTIFICATION_ORIGIN_UNCONFIGURED/);
    process.env.VERCEL_ENV='production';
    assert.equal(managerLink('/admin/leads/fixture'),'https://lumacleanrs.com/admin/leads/fixture');
  }finally{for(const key of Object.keys(process.env))if(!(key in before))delete process.env[key];Object.assign(process.env,before);}
});
