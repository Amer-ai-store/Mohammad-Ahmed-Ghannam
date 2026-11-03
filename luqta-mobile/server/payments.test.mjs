// F-G07-08 card payments via HyperPay hosted widget (mocked gateway).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createCommerceServer } from './commerce.mjs';
import { formatAmount, isPaidCode } from './payments.mjs';

const password = 'payments-test-password-123';
const address = { name: 'عميل', phone: '+962790123456', city: 'عمان', street: 'شارع الاختبار 12' };
async function fixture(t, paymentEnv, gateway) {
  const directory = await mkdtemp(resolve(tmpdir(), 'luqta-pay-'));
  const calls = [];
  const paymentFetch = async (url, init = {}) => { calls.push({ url: String(url), init }); return gateway(String(url), init); };
  const app = await createCommerceServer({ dbPath: resolve(directory, 'c.sqlite'), bootstrapAdmin: { name: 'مدير', email: 'admin@example.test', password }, paymentEnv: { HYPERPAY_ENTITY_ID: '', HYPERPAY_ACCESS_TOKEN: '', ...paymentEnv }, paymentFetch });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}/api`;
  const request = async (method, path, body, token) => { const r = await fetch(base + path, { method, redirect: 'manual', headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); const txt = await r.text(); let json = {}; try { json = JSON.parse(txt); } catch { /* html */ } return { status: r.status, body: json, text: txt, headers: r.headers }; };
  const admin = (await request('POST', '/auth/login', { email: 'admin@example.test', password })).body;
  const user = (await request('POST', '/auth/register', { name: 'عميل', email: `${Math.random().toString(36).slice(2)}@example.test`, password })).body;
  t.after(async () => { await app.close(); await rm(directory, { recursive: true, force: true }); });
  return { ...app, request, admin, user, calls };
}
const env = { HYPERPAY_ENTITY_ID: 'ent-123', HYPERPAY_ACCESS_TOKEN: 'secret-token', HYPERPAY_BASE_URL: 'https://eu-test.oppwa.com', PUBLIC_BASE_URL: 'https://shop.example' };

test('F-G07-08 أكواد النتيجة وصيغة المبلغ (الدينار 3 خانات)', () => {
  assert.equal(formatAmount(59, 'JOD'), '59.000'); assert.equal(formatAmount(9.5, 'SAR'), '9.50');
  assert.equal(isPaidCode('000.100.110'), true); assert.equal(isPaidCode('000.000.000'), true); assert.equal(isPaidCode('800.100.151'), false);
});

test('F-G07-08 بدون بيانات بوابة: البطاقة غير متاحة وتُرفض في الطلب', async (t) => {
  const { request, user } = await fixture(t, {}, async () => new Response('{}'));
  assert.equal((await request('GET', '/payments/methods')).body.card, false);
  assert.equal((await request('POST', '/orders', { items: [{ productId: 'mug', quantity: 1 }], address, paymentMethod: 'card', idempotencyKey: 'card-order-0' }, user.token)).body.code, 'payments_not_configured');
});

test('F-G07-08 دفع بالبطاقة عبر نموذج HyperPay المستضاف ثم تحقق الخادم قبل اعتماد الدفع', async (t) => {
  let paidCode = '000.100.110', paidAmount = '59.000';
  const gateway = async (url) => {
    if (url.endsWith('/v1/checkouts')) return new Response(JSON.stringify({ id: 'CHK.abc-1', result: { code: '000.200.100' } }), { status: 200 });
    if (url.includes('/v1/checkouts/CHK.abc-1/payment')) return new Response(JSON.stringify({ result: { code: paidCode }, amount: paidAmount, merchantTransactionId: url.match(/x/) ? 'x' : undefined }), { status: 200 });
    return new Response('{}', { status: 404 });
  };
  const { request, user, admin, calls, db } = await fixture(t, env, gateway);
  assert.deepEqual((await request('GET', '/payments/methods')).body, { card: true, sandbox: true, provider: 'hyperpay', cod: true, wallet: true, bnpl: false });
  const o = await request('POST', '/orders', { items: [{ productId: 'mug', quantity: 1 }], address, paymentMethod: 'card', idempotencyKey: 'card-order-1' }, user.token);
  assert.equal(o.status, 201, JSON.stringify(o.body)); assert.equal(o.body.order.paymentStatus, 'awaiting_payment');
  assert.equal((await request('PATCH', `/admin/orders/${o.body.order.id}`, { status: 'confirmed' }, admin.token)).body.code, 'payment_pending', 'unpaid card orders cannot be confirmed');
  const c = await request('POST', '/payments/checkout', { orderId: o.body.order.id }, user.token);
  assert.equal(c.status, 201, JSON.stringify(c.body)); assert.equal(c.body.amount, '59.000');
  const form = new URLSearchParams(calls[0].init.body.toString());
  assert.equal(form.get('entityId'), 'ent-123'); assert.equal(form.get('amount'), '59.000'); assert.equal(form.get('currency'), 'JOD'); assert.equal(form.get('merchantTransactionId'), o.body.order.id);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-token');
  assert.ok(!JSON.stringify(c.body).includes('secret-token'), 'token never reaches the client');
  const page = await request('GET', c.body.pageUrl.replace('/api', ''));
  assert.equal(page.status, 200); assert.match(page.text, /paymentWidgets\.js\?checkoutId=CHK\.abc-1/); assert.match(page.text, /action="https:\/\/shop\.example\/api\/payments\/return"/);
  assert.match(page.headers.get('content-security-policy'), /eu-test\.oppwa\.com/);
  assert.equal(page.headers.get('x-frame-options'), 'DENY');
  // tampered amount → not paid
  paidAmount = '1.000';
  let back = await request('GET', '/payments/return?id=CHK.abc-1&resourcePath=%2Fv1%2Fcheckouts%2FCHK.abc-1%2Fpayment');
  assert.equal(back.status, 302); assert.match(back.headers.get('location'), /payment=failed/);
  paidAmount = '59.000';
  back = await request('GET', '/payments/return?id=CHK.abc-1');
  assert.equal(back.headers.get('location'), `luqta://order/${o.body.order.id}?payment=paid`);
  assert.equal(db.prepare('SELECT payment_status FROM orders WHERE id=?').get(o.body.order.id).payment_status, 'paid');
  assert.equal((await request('POST', '/payments/verify', { orderId: o.body.order.id }, user.token)).body.status, 'paid');
  assert.equal((await request('PATCH', `/admin/orders/${o.body.order.id}`, { status: 'confirmed' }, admin.token)).status, 200);
  const cancel = await request('PATCH', `/admin/orders/${o.body.order.id}`, { status: 'cancelled' }, admin.token);
  assert.equal(cancel.status, 200); assert.equal(db.prepare('SELECT payment_status FROM orders WHERE id=?').get(o.body.order.id).payment_status, 'refund_due');
  paidCode = '800.100.151';
});

test('F-G07-08 لا يُقبل عنوان بوابة غير oppwa.com', async () => {
  await assert.rejects(() => createCommerceServer({ dbPath: ':memory:', paymentEnv: { HYPERPAY_ENTITY_ID: 'e', HYPERPAY_ACCESS_TOKEN: 't', HYPERPAY_BASE_URL: 'https://evil.example' } }), /oppwa/);
});
