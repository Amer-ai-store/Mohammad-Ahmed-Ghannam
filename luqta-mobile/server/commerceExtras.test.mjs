// G16 — delivery-app parity (requirements.md / feature_gap_backlog.md), clean-room implementation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createCommerceServer } from './commerce.mjs';
import { haversineKm, normalizeQuery } from './commerceExtras.mjs';

const password = 'extras-test-password-123';
const address = { name: 'عميل', phone: '+962790123456', city: 'عمان', street: 'شارع الاختبار 12', latitude: 31.955, longitude: 35.91 };
async function fixture(t) {
  const directory = await mkdtemp(resolve(tmpdir(), 'luqta-extras-'));
  const app = await createCommerceServer({ dbPath: resolve(directory, 'c.sqlite'), bootstrapAdmin: { name: 'مدير', email: 'admin@example.test', password }, geminiApiKey: '' });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}/api`;
  const request = async (method, path, body, token) => { const r = await fetch(base + path, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, body: await r.json() }; };
  const register = async (name = 'عميل') => (await request('POST', '/auth/register', { name, email: `${Math.random().toString(36).slice(2)}@example.test`, password })).body;
  const admin = (await request('POST', '/auth/login', { email: 'admin@example.test', password })).body;
  const driver = await register('سائق'); await request('PATCH', `/admin/users/${driver.user.id}`, { role: 'driver' }, admin.token);
  const deliver = async (id, pickup = false) => {
    for (const status of ['confirmed', 'preparing']) assert.equal((await request('PATCH', `/admin/orders/${id}`, { status }, admin.token)).status, 200);
    if (!pickup) assert.equal((await request('PATCH', `/admin/orders/${id}`, { status: 'out_for_delivery', driverId: driver.user.id }, admin.token)).status, 200);
    const d = await request('PATCH', `/admin/orders/${id}`, { status: 'delivered' }, admin.token); assert.equal(d.status, 200, JSON.stringify(d.body));
  };
  t.after(async () => { await app.close(); await rm(directory, { recursive: true, force: true }); });
  return { ...app, request, register, admin, deliver };
}
const branches = [{ id: 'hashmi', name: 'فرع الهاشمي', city: 'عمان', latitude: 31.96, longitude: 35.92 }, { id: 'zarqa', name: 'فرع الزرقاء', city: 'الزرقاء', latitude: 32.07, longitude: 36.09 }];

test('F-G16-01 اقتراحات البحث والبحث الشائع دون بيانات شخصية', async (t) => {
  const { request } = await fixture(t);
  assert.equal(normalizeQuery('  سمّاعات  ة!'), 'سماعات ه');
  const s = await request('GET', `/search/suggest?q=${encodeURIComponent('سما')}`);
  assert.equal(s.body.products[0].id, 'headphones');
  for (let i = 0; i < 3; i++) await request('POST', '/search/log', { q: 'سماعات' });
  assert.equal((await request('POST', '/search/log', { q: 'me@example.com' })).body.stored, false, 'emails are never stored');
  assert.equal((await request('POST', '/search/log', { q: '0791234567' })).body.stored, false, 'phone numbers are never stored');
  assert.deepEqual((await request('GET', '/search/popular')).body.queries[0], { query: 'سماعات', count: 3 });
  assert.deepEqual((await request('GET', `/search/suggest?q=${encodeURIComponent('سم')}`)).body.queries, ['سماعات']);
});

test('F-G16-02 اكتشاف المتاجر: المتجر الرسمي والتجار المعتمدون', async (t) => {
  const { request, register, admin } = await fixture(t);
  const m = await register('تاجر'); await request('POST', '/merchant/apply', { storeName: 'مناحل السلط' }, m.token);
  await request('PATCH', `/admin/merchants/${m.user.id}`, { status: 'approved' }, admin.token);
  const p = await request('POST', '/merchant/products', { name: 'عسل سدر', price: 7, category: 'grocery', stock: 5 }, m.token);
  await request('PATCH', `/admin/products/${p.body.product.id}`, { active: true }, admin.token);
  const v = await request('GET', '/vendors');
  assert.equal(v.body.vendors[0].id, 'luqta'); assert.equal(v.body.vendors[0].official, true);
  assert.equal(v.body.vendors.find((x) => x.id === m.user.id).products, 1);
  assert.equal((await request('GET', `/vendors/${m.user.id}`)).body.products[0].name, 'عسل سدر');
  assert.equal((await request('GET', '/vendors/nope')).status, 404);
});

test('F-G16-03 المجموعات المنسّقة من الإدارة', async (t) => {
  const { request, admin } = await fixture(t);
  assert.equal((await request('PATCH', '/admin/settings', { collections: [{ id: 'morning', title: 'روتين الصباح', productIds: ['mug', 'serum', 'ghost'] }] }, admin.token)).status, 200);
  const c = await request('GET', '/collections');
  assert.equal(c.body.collections[0].products.length, 2, 'unknown/inactive products are skipped');
  assert.equal((await request('GET', '/collections/morning')).body.collection.title, 'روتين الصباح');
});

test('F-G16-04 بطاقة الأختام تُصدر قسيمة شخصية لا يستخدمها غير صاحبها', async (t) => {
  const { request, register, admin, deliver } = await fixture(t);
  await request('PATCH', '/admin/settings', { stampCard: { stamps: 2, rewardType: 'fixed', rewardValue: 3, validDays: 10 } }, admin.token);
  const u = await register(), other = await register();
  for (const k of ['s1', 's2']) { const o = await request('POST', '/orders', { items: [{ productId: 'mug', quantity: 1 }], address, idempotencyKey: `stamp-${k}` }, u.token); await deliver(o.body.order.id); }
  const st = await request('GET', '/loyalty/stamps', undefined, u.token);
  assert.equal(st.body.stamps, 0); assert.equal(st.body.completed, 1); assert.equal(st.body.vouchers.length, 1);
  const code = st.body.vouchers[0].code; assert.match(code, /^STAMP-/);
  assert.equal((await request('POST', '/coupons/validate', { code, items: [{ productId: 'mug', quantity: 1 }] }, other.token)).body.code, 'invalid_coupon');
  const ok = await request('POST', '/coupons/validate', { code, items: [{ productId: 'mug', quantity: 1 }] }, u.token);
  assert.equal(ok.status, 200); assert.equal(ok.body.discount, 3);
  assert.equal((await request('GET', '/coupons/public')).body.coupons.some((c) => c.code === code), false, 'personal vouchers are not public');
});

test('F-G16-05 التجارة السريعة: أقرب فرع، المسافة، الزمن والرسوم من الخادم', async (t) => {
  const { request, register, admin } = await fixture(t);
  assert.equal((await request('PUT', '/admin/branches', { branches }, admin.token)).status, 200);
  await request('PATCH', '/admin/settings', { express: { fee: 1.5, maxKm: 5, baseMinutes: 20, perKmMinutes: 5 } }, admin.token);
  assert.ok(haversineKm(address, branches[0]) < 2);
  const near = await request('POST', '/delivery/options', { items: [{ productId: 'mug', quantity: 1 }], latitude: address.latitude, longitude: address.longitude });
  assert.equal(near.body.express.available, true); assert.equal(near.body.express.branch.id, 'hashmi'); assert.equal(near.body.express.fee, 1.5);
  const far = await request('POST', '/delivery/options', { items: [{ productId: 'mug', quantity: 1 }], latitude: 29.53, longitude: 35.0 });
  assert.equal(far.body.express.available, false); assert.match(far.body.express.reason, /كم/);
  const u = await register();
  const o = await request('POST', '/orders', { items: [{ productId: 'mug', quantity: 1 }], address, idempotencyKey: 'express-1', deliveryMode: 'express', tip: 1, instructions: 'اترك الطلب عند الباب', contactless: true }, u.token);
  assert.equal(o.status, 201, JSON.stringify(o.body));
  assert.equal(o.body.order.shipping, 1.5, 'free-shipping order pays only the express fee'); assert.equal(o.body.order.total, 59 + 1.5 + 1);
  assert.equal(o.body.order.extras.mode, 'express'); assert.equal(o.body.order.extras.instructions, 'اترك الطلب عند الباب'); assert.equal(o.body.order.extras.contactless, true); assert.ok(o.body.order.extras.etaMinutes > 20);
  assert.equal((await request('POST', '/orders', { items: [{ productId: 'mug', quantity: 1 }], address: { ...address, latitude: 29.53, longitude: 35 }, idempotencyKey: 'express-2', deliveryMode: 'express' }, u.token)).body.code, 'express_unavailable');
  await request('PATCH', '/admin/settings', { flags: { express: false } }, admin.token);
  assert.equal((await request('POST', '/delivery/options', { items: [{ productId: 'mug', quantity: 1 }], latitude: address.latitude, longitude: address.longitude })).body.express.available, false);
});

test('F-G16-06 الاستلام من الفرع بدون رسوم وبدون سائق', async (t) => {
  const { request, register, admin, deliver } = await fixture(t);
  await request('PUT', '/admin/branches', { branches }, admin.token);
  const u = await register();
  assert.equal((await request('POST', '/orders', { items: [{ productId: 'mug', quantity: 1 }], address, idempotencyKey: 'pickup-0', deliveryMode: 'pickup', pickupBranchId: 'nope' }, u.token)).body.code, 'unknown_branch');
  const o = await request('POST', '/orders', { items: [{ productId: 'lamp', quantity: 1 }], address, idempotencyKey: 'pickup-1', deliveryMode: 'pickup', pickupBranchId: 'hashmi', tip: 2 }, u.token);
  assert.equal(o.status, 201, JSON.stringify(o.body));
  assert.equal(o.body.order.shipping, 0); assert.equal(o.body.order.total, 129, 'no tip on pickup'); assert.equal(o.body.order.extras.branchName, 'فرع الهاشمي');
  await deliver(o.body.order.id, true);
  const std = await request('POST', '/orders', { items: [{ productId: 'mug', quantity: 1 }], address, idempotencyKey: 'standard-order-1' }, u.token);
  for (const status of ['confirmed', 'preparing']) await request('PATCH', `/admin/orders/${std.body.order.id}`, { status }, admin.token);
  assert.equal((await request('PATCH', `/admin/orders/${std.body.order.id}`, { status: 'delivered' }, admin.token)).status, 409, 'delivery orders still need a courier step');
});

test('F-G16-07 تقييم الطلب بعد التسليم مرة واحدة وإشعار الإدارة بالتقييم المنخفض', async (t) => {
  const { request, register, admin, deliver, db } = await fixture(t);
  const u = await register();
  const o = await request('POST', '/orders', { items: [{ productId: 'mug', quantity: 1 }], address, idempotencyKey: 'feedback-order-1' }, u.token);
  assert.equal((await request('POST', `/orders/${o.body.order.id}/feedback`, { rating: 5 }, u.token)).status, 409, 'only after delivery');
  await deliver(o.body.order.id);
  assert.equal((await request('GET', '/orders/feedback/pending', undefined, u.token)).body.order.id, o.body.order.id);
  const f = await request('POST', `/orders/${o.body.order.id}/feedback`, { rating: 2, tags: ['تأخر', 'غير مسموح'], comment: 'وصل متأخرًا' }, u.token);
  assert.equal(f.status, 201); assert.deepEqual(f.body.tags, ['تأخر']);
  assert.equal((await request('POST', `/orders/${o.body.order.id}/feedback`, { rating: 4 }, u.token)).body.code, 'already_rated');
  assert.equal((await request('GET', '/orders/feedback/pending', undefined, u.token)).body.order, null);
  assert.ok(db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE title='تقييم منخفض لطلب'").get().n >= 1);
  const s = await request('GET', '/admin/feedback', undefined, admin.token);
  assert.equal(s.body.average, 2); assert.equal(s.body.tags['تأخر'], 1);
});

test('F-G16-08 حوكمة مفاتيح الميزات: إيقاف فوري ومُدقق من الإدارة فقط', async (t) => {
  const { request, register, admin, db } = await fixture(t);
  const u = await register();
  assert.equal((await request('GET', '/flags')).body.flags.game, true);
  assert.equal((await request('PATCH', '/admin/settings', { flags: { game: false } }, u.token)).status, 403);
  assert.equal((await request('PATCH', '/admin/settings', { flags: { nope: false } }, admin.token)).status, 400);
  assert.equal((await request('PATCH', '/admin/settings', { flags: { game: false, reels: false, merchant: false } }, admin.token)).status, 200);
  assert.equal((await request('GET', '/flags')).body.flags.game, false);
  assert.equal((await request('POST', '/rewards/game', { moves: 12, seconds: 40 }, u.token)).body.code, 'feature_disabled');
  assert.equal((await request('POST', '/merchant/apply', { storeName: 'متجر' }, u.token)).body.code, 'feature_disabled');
  assert.equal((await request('GET', '/media?kind=video')).body.disabled, true);
  assert.ok(db.prepare("SELECT COUNT(*) AS n FROM audit WHERE action='settings.update'").get().n >= 1, 'flag changes are audited');
});

test('F-G16-09 تحليلات مجمّعة يومية بلا هوية مستخدم وقمع التحويل للإدارة', async (t) => {
  const { request, register, admin, db } = await fixture(t);
  for (const name of ['view_product', 'view_product', 'view_product', 'view_product', 'add_to_cart', 'add_to_cart', 'begin_checkout']) await request('POST', '/analytics/event', { name });
  assert.equal((await request('POST', '/analytics/event', { name: 'user_email', email: 'x@y.z' })).status, 400);
  const cols = db.prepare('PRAGMA table_info(analytics_daily)').all().map((c) => c.name);
  assert.deepEqual(cols, ['day', 'name', 'count'], 'no user, ip or device columns');
  const u = await register(); await request('POST', '/orders', { items: [{ productId: 'mug', quantity: 1 }], address, idempotencyKey: 'analytics-order-1' }, u.token);
  assert.equal((await request('GET', '/admin/analytics', undefined, u.token)).status, 403);
  const a = await request('GET', '/admin/analytics?days=7', undefined, admin.token);
  assert.equal(a.body.totals.view_product, 4); assert.equal(a.body.funnel[1].rate, 50); assert.equal(a.body.funnel[3].count, 1); assert.equal(a.body.funnel[3].rate, 100);
  await request('PATCH', '/admin/settings', { flags: { analytics: false } }, admin.token);
  assert.equal((await request('POST', '/analytics/event', { name: 'search' })).body.stored, false);
});
