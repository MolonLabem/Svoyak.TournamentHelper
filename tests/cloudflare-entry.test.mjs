import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/cloudflare-entry.mjs';

test('Cloudflare blocks reads and writes until the migration is explicitly ready', async () => {
  const DB = new Proxy({}, {get() { throw new Error('Pending deployment must not access D1'); }});
  for (const status of [undefined, '', 'pending', 'READY', true]) {
    for (const [method, path] of [['GET', '/'], ['HEAD', '/'], ['GET', '/api/tournaments/existing'], ['POST', '/api/tournaments'], ['POST', '/api/tournaments/existing/delete']]) {
      const response = await worker.fetch(new Request(`https://fixture.invalid${path}`, {method}), {DB, SVOYAK_MIGRATION_STATUS: status});
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
      assert.equal(response.headers.get('set-cookie'), null);
      if (method === 'HEAD') assert.equal(await response.text(), '');
      else if (path.startsWith('/api/')) assert.match((await response.json()).error, /Турниры временно недоступны/);
      else {const body=await response.text();assert.match(body,/Прежний адрес больше не принимает изменения/);assert.doesNotMatch(body,/href=/);}
    }
  }
});

test('ready Cloudflare deployment delegates to the existing application and access checks', async () => {
  const env = {DB: {}, SVOYAK_MIGRATION_STATUS: 'ready'};
  const page = await worker.fetch(new Request('https://fixture.invalid/'), env);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /lang="ru"/);
  const session = await worker.fetch(new Request('https://fixture.invalid/api/session'), env);
  assert.deepEqual(await session.json(), {hasOwnerSession: false});
  const doc = await worker.fetch(new Request('https://fixture.invalid/README.md'), env);
  assert.equal(doc.status, 401);
});
