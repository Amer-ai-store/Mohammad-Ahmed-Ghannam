// F-G09-08 push notifications — server registry and Expo push sender (mocked).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createCommerceServer } from './commerce.mjs';

test('F-G09-08 تسجيل جهاز الإشعارات ودفع كل إشعار عبر Expo Push وحذف الأجهزة غير المسجلة', async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), 'luqta-push-'));
  const sent = [];
  const pushFetch = async (url, init) => { const msgs = JSON.parse(init.body); sent.push({ url, msgs }); return new Response(JSON.stringify({ data: msgs.map((m) => (m.to.includes('dead') ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok' })) }), { status: 200 }); };
  const app = await createCommerceServer({ dbPath: resolve(directory, 'c.sqlite'), pushEnv: { PUSH_ENABLED: '1' }, pushFetch });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  t.after(async () => { await app.close(); await rm(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${app.server.address().port}/api`;
  const req = async (method, path, body, token) => { const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; };
  const u = (await req('POST', '/auth/register', { name: 'عميل', email: 'p@example.test', password: 'push-test-password-1' })).body;
  assert.equal((await req('GET', '/push/status')).body.enabled, true);
  assert.equal((await req('POST', '/devices', { token: 'not-a-valid-push-token-value', platform: 'android' }, u.token)).body.code, 'invalid_push_token');
  assert.equal((await req('POST', '/devices', { token: 'ExponentPushToken[abcdefghijk123]', platform: 'android' }, u.token)).status, 201);
  assert.equal((await req('POST', '/devices', { token: 'ExponentPushToken[deaddevice12345]', platform: 'android' }, u.token)).status, 201);
  sent.length = 0;
  await req('POST', '/orders', { items: [{ productId: 'mug', quantity: 1 }], address: { name: 'عميل', phone: '+962790123456', city: 'عمان', street: 'شارع الاختبار 12' }, idempotencyKey: 'push-order-1' }, u.token);
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(sent.some((s) => s.url === 'https://exp.host/--/api/v2/push/send' && s.msgs.some((m) => m.title === 'تم استلام طلبك')));
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM push_devices').get().n, 1, 'DeviceNotRegistered tokens are removed');
});
