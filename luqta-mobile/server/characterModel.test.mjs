// F-G14-CHAR: the professional companion GLB is configured from the dashboard (settings.character.modelUrl).
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createCommerceServer } from './commerce.mjs';
import { safeModelUrl } from '../src/components/character/characterHtml.ts';

const password = 'character-test-password-123';
test('character model URL setting is validated and exposed publicly', async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), 'luqta-char-'));
  const app = await createCommerceServer({ dbPath: resolve(directory, 'store.sqlite'), bootstrapAdmin: { name: 'مدير', email: 'admin@example.test', password } });
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  t.after(async () => { await app.close(); await rm(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${app.server.address().port}/api`;
  const request = async (method, path, body, token) => { const r = await fetch(base + path, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); return { status: r.status, body: await r.json() }; };
  const admin = (await request('POST', '/auth/login', { email: 'admin@example.test', password })).body;
  assert.equal((await request('GET', '/settings')).body.settings.character.modelUrl, null);
  for (const bad of ['http://cdn.example.test/a.glb', 'https://cdn.example.test/a.exe', 'javascript:alert(1)', 'https://x.test/a.glb"><script>']) {
    assert.equal((await request('PATCH', '/admin/settings', { character: { modelUrl: bad } }, admin.token)).status, 400, bad);
  }
  const ok = await request('PATCH', '/admin/settings', { character: { modelUrl: 'https://cdn.example.test/luqta/avatar.glb?v=2' } }, admin.token);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal((await request('GET', '/settings')).body.settings.character.modelUrl, 'https://cdn.example.test/luqta/avatar.glb?v=2');
  const customer = (await request('POST', '/auth/register', { name: 'عميل', email: 'c@example.test', password })).body;
  assert.equal((await request('PATCH', '/admin/settings', { character: { modelUrl: null } }, customer.token)).status, 403);
  assert.equal((await request('PATCH', '/admin/settings', { character: { modelUrl: null } }, admin.token)).status, 200);
});

test('app-side model URL guard matches the server rule', () => {
  assert.equal(safeModelUrl('https://cdn.example.test/a.glb'), 'https://cdn.example.test/a.glb');
  assert.equal(safeModelUrl('https://cdn.example.test/a.GLTF?x=1'), 'https://cdn.example.test/a.GLTF?x=1');
  assert.equal(safeModelUrl('http://cdn.example.test/a.glb'), undefined);
  assert.equal(safeModelUrl('https://x.test/a.glb"><script>'), undefined);
  assert.equal(safeModelUrl(42), undefined);
});
