// F-G13: dashboard sync (products, images, prices, quantities, branches), dedupe,
// and stock/price verification before order confirmation.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createCommerceServer } from './commerce.mjs';

const password = 'dashboard-sync-password-123';
async function fixture(t) {
  const directory = await mkdtemp(resolve(tmpdir(), 'luqta-sync-'));
  const app = await createCommerceServer({ dbPath: resolve(directory, 'store.sqlite'), bootstrapAdmin: { name: 'مدير', email: 'admin@example.test', password } });
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  t.after(async () => { await app.close(); await rm(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${app.server.address().port}/api`;
  const request = async (method, path, body, token) => {
    const response = await fetch(base + path, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  const admin = (await request('POST', '/auth/login', { email: 'admin@example.test', password })).body;
  const customer = (await request('POST', '/auth/register', { name: 'عميل', email: 'c@example.test', password })).body;
  return { ...app, request, admin, customer };
}
const branches = [{ id: 'hashmi', name: 'فرع الهاشمي', city: 'عمان' }, { id: 'sweileh', name: 'فرع صويلح', city: 'عمان' }];
const payload = {
  branches,
  products: [
    { sku: 'RICE-1KG', barcode: '6251234567890', name: 'أرز بسمتي', price: 3.25, category: 'grocery', images: ['https://cdn.example.com/rice.png'], branchStock: { hashmi: 10, sweileh: 4 } },
    { sku: 'MILK-1L', name: 'حليب طويل الأمد', price: 2.2, category: 'grocery', branchStock: { hashmi: 1, sweileh: 0 } },
    { barcode: '625 1234567890', name: 'أرز بسمتي (مكرر بالباركود)', price: 3.25, branchStock: { hashmi: 12, sweileh: 4 } },
    { sku: 'BAD', name: 'سعر غير صالح', price: -1 },
    { sku: 'BADIMG', name: 'صورة غير آمنة', price: 1, images: ['http://insecure.example.com/x.png'] },
  ],
};

test('F-G13-01/02/03 sync imports products, images, prices, branch quantities and merges duplicates', async (t) => {
  const { request, admin, customer } = await fixture(t);
  assert.equal((await request('POST', '/admin/dashboard-sync', payload, customer.token)).status, 403, 'customers cannot sync');
  const dry = await request('POST', '/admin/dashboard-sync', { ...payload, dryRun: true }, admin.token);
  assert.equal(dry.status, 200, JSON.stringify(dry.body));
  assert.equal(dry.body.dryRun, true);
  assert.equal((await request('GET', '/branches')).body.branches.length, 1, 'dry run writes nothing');
  const synced = await request('POST', '/admin/dashboard-sync', payload, admin.token);
  assert.equal(synced.status, 200, JSON.stringify(synced.body));
  assert.equal(synced.body.duplicatesMerged, 1);
  assert.equal(synced.body.created, 2);
  assert.equal(synced.body.rejected.length, 2);
  const listed = (await request('GET', '/branches')).body.branches.map((b) => b.id);
  assert.deepEqual(listed, ['hashmi', 'sweileh']);
  const rice = (await request('GET', '/products/RICE-1KG')).body.product;
  assert.equal(rice.price, 3.25);
  assert.equal(rice.stock, 16, 'stock is the sum of branch stock from the merged (latest) row');
  assert.deepEqual(rice.branchStock, { hashmi: 12, sweileh: 4 });
  assert.equal(rice.image, 'https://cdn.example.com/rice.png');
  assert.equal(rice.barcode, '6251234567890');
  // second sync with same SKU/barcode updates instead of duplicating
  const again = await request('POST', '/admin/dashboard-sync', { products: [{ barcode: '6251234567890', name: 'أرز بسمتي', price: 3.5, branchStock: { hashmi: 9, sweileh: 1 } }] }, admin.token);
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(again.body.created, 0);
  assert.equal(again.body.updated, 1);
  const all = (await request('GET', '/products')).body.products.filter((p) => /أرز بسمتي/.test(p.name));
  assert.equal(all.length, 1, 'no duplicate product rows');
  assert.equal(all[0].price, 3.5);
  const last = await request('GET', '/admin/dashboard-sync', undefined, admin.token);
  assert.equal(last.body.last.syncId, again.body.syncId);
  assert.equal(last.body.undo.id, again.body.syncId, 'latest sync is reversible through the inventory undo log');
});

test('F-G13-04/05 cart check reports price change and branch stock before confirmation; order guards price', async (t) => {
  const { request, admin, customer } = await fixture(t);
  assert.equal((await request('POST', '/admin/dashboard-sync', payload, admin.token)).status, 200);
  const check = await request('POST', '/orders/check', { branchId: 'hashmi', items: [{ productId: 'RICE-1KG', quantity: 2, price: 3.0 }, { productId: 'MILK-1L', quantity: 2, price: 2.2 }] });
  assert.equal(check.status, 200, JSON.stringify(check.body));
  assert.equal(check.body.ok, false);
  assert.deepEqual(check.body.issues.map((i) => i.code).sort(), ['insufficient_stock', 'price_changed']);
  assert.equal(check.body.lines.find((l) => l.productId === 'MILK-1L').available, 1);
  const address = { name: 'محمد', phone: '0790000000', city: 'عمان', street: 'شارع الأمير راشد بن الحسن 12' };
  const stale = await request('POST', '/orders', { items: [{ productId: 'RICE-1KG', quantity: 1 }], address, idempotencyKey: 'order-stale-1', expectedSubtotal: 3.0 }, customer.token);
  assert.equal(stale.status, 409);
  assert.equal(stale.body.code, 'price_changed', 'never charges a price the customer did not review');
  const branchShort = await request('POST', '/orders', { branchId: 'sweileh', items: [{ productId: 'MILK-1L', quantity: 1 }], address, idempotencyKey: 'order-branch-1' }, customer.token);
  assert.equal(branchShort.status, 409);
  assert.equal(branchShort.body.code, 'out_of_stock');
  const ok = await request('POST', '/orders', { branchId: 'hashmi', items: [{ productId: 'RICE-1KG', quantity: 2 }], address, idempotencyKey: 'order-ok-1', expectedSubtotal: 6.5 }, customer.token);
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  const rice = (await request('GET', '/products/RICE-1KG')).body.product;
  assert.equal(rice.branchStock.hashmi, 10);
  assert.equal(rice.stock, 14);
  assert.equal((await request('POST', '/orders/check', { branchId: 'nope', items: [{ productId: 'RICE-1KG', quantity: 1 }] })).status, 400);
});

test('F-G13-06 branch management validates ids and rejects unknown branch stock', async (t) => {
  const { request, admin } = await fixture(t);
  assert.equal((await request('PUT', '/admin/branches', { branches: [{ id: 'bad id', name: 'x' }] }, admin.token)).status, 400);
  assert.equal((await request('PUT', '/admin/branches', { branches }, admin.token)).status, 200);
  const r = await request('POST', '/admin/dashboard-sync', { products: [{ sku: 'X', name: 'منتج', price: 1, branchStock: { unknown: 3 } }] }, admin.token);
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'nothing_to_sync');
});
