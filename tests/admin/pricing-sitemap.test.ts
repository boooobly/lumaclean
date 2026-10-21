import test from 'node:test';
import assert from 'node:assert/strict';
import sitemap from '../../src/app/sitemap';

test('localized pricing pages advertise their real latest content revisions',()=>{
  const entries=sitemap();
  for(const locale of ['ru','sr','en']){
    const home=entries.find(e=>e.url===`https://lumacleanrs.com/${locale}`)!;
    assert.equal(new Date(home.lastModified!).toISOString(),'2026-10-19T00:00:00.000Z');
    const services=entries.filter(e=>e.url.startsWith(`https://lumacleanrs.com/${locale}/services/`));
    assert.equal(services.length,5);
    for(const entry of services)assert.equal(new Date(entry.lastModified!).toISOString(),'2026-10-18T00:00:00.000Z');
  }
  // Sitemap reads do not manufacture a new modification time.
  assert.deepEqual(sitemap(),entries);
});
