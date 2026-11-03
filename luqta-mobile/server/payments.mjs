// Card payments through HyperPay (OPPWA COPYandPAY hosted widget) — widely used in Jordan.
// Card details are typed into HyperPay's own widget; they never reach the Luqta server or
// app (PCI DSS SAQ-A scope). The server only creates a checkout for a server-priced order
// and verifies the result with HyperPay before marking the order paid.
//   HYPERPAY_ENTITY_ID, HYPERPAY_ACCESS_TOKEN   (merchant credentials, server only)
//   HYPERPAY_BASE_URL   https://eu-test.oppwa.com (sandbox, default) | https://eu-prod.oppwa.com
//   PUBLIC_BASE_URL     public https origin of this server (for the return URL)
//   HYPERPAY_BRANDS     default "VISA MASTER MADA"
import { createHash } from 'node:crypto';

const THREE_DECIMALS = new Set(['JOD', 'KWD', 'BHD', 'OMR', 'TND', 'IQD', 'LYD']);
export const formatAmount = (amount, currency) => Number(amount).toFixed(THREE_DECIMALS.has(currency) ? 3 : 2);
/** HyperPay result codes: successful / successfully processed (pending review) payments. */
export const isPaidCode = (code) => /^(000\.000\.|000\.100\.1|000\.[36])/.test(String(code || ''));
export const isPendingCode = (code) => /^(000\.200)/.test(String(code || ''));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function installPayments(ctx) {
  const { db, get, all, run, transaction, id, now, fail, text, requireUser, notify, setting, audit, options } = ctx;
  db.exec(`CREATE TABLE IF NOT EXISTS payment_attempts(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),provider TEXT NOT NULL,checkout_id TEXT UNIQUE NOT NULL,status TEXT NOT NULL,result_code TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);`);
  const env = { ...process.env, ...(options.paymentEnv || {}) };
  const fetcher = options.paymentFetch || fetch;
  const cfg = env.HYPERPAY_ENTITY_ID && env.HYPERPAY_ACCESS_TOKEN ? { entityId: env.HYPERPAY_ENTITY_ID, token: env.HYPERPAY_ACCESS_TOKEN, base: (env.HYPERPAY_BASE_URL || 'https://eu-test.oppwa.com').replace(/\/$/, ''), publicBase: (env.PUBLIC_BASE_URL || '').replace(/\/$/, ''), brands: env.HYPERPAY_BRANDS || 'VISA MASTER MADA' } : null;
  if (cfg && !/^https:\/\/([\w-]+\.)*oppwa\.com$/.test(cfg.base)) throw new Error('HYPERPAY_BASE_URL must be an https oppwa.com host');
  const configured = () => !!cfg;
  const sandbox = () => !!cfg && /test/.test(cfg.base);

  async function call(method, path, form) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const r = await fetcher(`${cfg.base}${path}`, { method, signal: controller.signal, headers: { Authorization: `Bearer ${cfg.token}`, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, ...(form ? { body: new URLSearchParams(form) } : {}) });
      const data = await r.json().catch(() => ({}));
      return { ok: r.ok, data };
    } catch { fail(502, 'تعذّر الاتصال ببوابة الدفع؛ حاول مجددًا', 'payment_gateway_unreachable'); } finally { clearTimeout(timer); }
  }
  const markPaid = (o, attempt, code) => transaction(() => {
    run("UPDATE payment_attempts SET status='paid',result_code=?,updated_at=? WHERE id=?", code, now(), attempt.id);
    if (o.payment_status !== 'paid') {
      run("UPDATE orders SET payment_status='paid',updated_at=? WHERE id=?", now(), o.id);
      run('INSERT INTO order_events VALUES(?,?,?,?,?)', id('evt'), o.id, o.status, 'تم الدفع بالبطاقة عبر HyperPay', now());
      notify(o.user_id, 'تم الدفع بنجاح', `استلمنا دفعة الطلب ${o.id}`, o.id);
      audit({ id: 'hyperpay' }, 'payment.paid', o.id, { code });
    }
  });
  async function verify(o, attempt) {
    const r = await call('GET', `/v1/checkouts/${encodeURIComponent(attempt.checkout_id)}/payment?entityId=${encodeURIComponent(cfg.entityId)}`);
    const code = r.data?.result?.code || '';
    const amountOk = !r.data?.amount || r.data.amount === formatAmount(o.total, o.currency);
    const refOk = !r.data?.merchantTransactionId || r.data.merchantTransactionId === o.id;
    if (isPaidCode(code) && amountOk && refOk) { markPaid(o, attempt, code); return 'paid'; }
    if (isPendingCode(code)) { run("UPDATE payment_attempts SET status='pending',result_code=?,updated_at=? WHERE id=?", code, now(), attempt.id); return 'pending'; }
    run("UPDATE payment_attempts SET status='failed',result_code=?,updated_at=? WHERE id=?", code, now(), attempt.id);
    return 'failed';
  }

  async function handle(method, path, body, req, url) {
    let m;
    if (method === 'GET' && path === '/api/payments/methods') return { status: 200, body: { card: configured(), sandbox: sandbox(), provider: configured() ? 'hyperpay' : null, cod: true, wallet: true, bnpl: false } };
    if (method === 'POST' && path === '/api/payments/checkout') {
      const actor = requireUser(req); if (!cfg) fail(503, 'الدفع بالبطاقة يحتاج ربط بوابة دفع على الخادم', 'payments_not_configured');
      const o = get('SELECT * FROM orders WHERE id=? AND user_id=?', text(body.orderId, 'الطلب', 3, 100), actor.id);
      if (!o) fail(404, 'الطلب غير موجود', 'not_found');
      if (o.payment_method !== 'card') fail(409, 'هذا الطلب ليس بالدفع بالبطاقة');
      if (o.payment_status === 'paid') fail(409, 'الطلب مدفوع مسبقًا', 'already_paid');
      if (o.status === 'cancelled') fail(409, 'الطلب ملغي');
      const r = await call('POST', '/v1/checkouts', { entityId: cfg.entityId, amount: formatAmount(o.total, o.currency), currency: o.currency, paymentType: 'DB', merchantTransactionId: o.id, 'customer.merchantCustomerId': createHash('sha256').update(actor.id).digest('hex').slice(0, 32) });
      if (!r.ok || !r.data?.id || !/^000\.200/.test(r.data?.result?.code || '')) fail(502, 'رفضت بوابة الدفع إنشاء عملية الدفع', 'payment_gateway_error');
      const aid = id('pay'); run('INSERT INTO payment_attempts VALUES(?,?,?,?,?,NULL,?,?)', aid, o.id, 'hyperpay', r.data.id, 'created', now(), now());
      return { status: 201, body: { checkoutId: r.data.id, pageUrl: `/api/payments/page/${encodeURIComponent(r.data.id)}`, sandbox: sandbox(), amount: formatAmount(o.total, o.currency), currency: o.currency } };
    }
    if (method === 'GET' && (m = /^\/api\/payments\/page\/([\w.\-]+)$/.exec(path))) {
      if (!cfg) fail(503, 'بوابة الدفع غير معدّة', 'payments_not_configured');
      const attempt = get('SELECT * FROM payment_attempts WHERE checkout_id=?', m[1]); if (!attempt) fail(404, 'عملية الدفع غير موجودة', 'not_found');
      const back = `${cfg.publicBase || ''}/api/payments/return`;
      const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>الدفع الآمن — لُقطة</title><style>body{font-family:system-ui,sans-serif;background:#F6F2FE;margin:0;padding:18px;color:#1F0A47}h1{font-size:20px}.note{color:#826BA2;font-size:13px}</style>
<script>var wpwlOptions={locale:"ar",style:"card",brandDetection:true};</script>
<script src="${esc(cfg.base)}/v1/paymentWidgets.js?checkoutId=${encodeURIComponent(attempt.checkout_id)}"></script></head>
<body><h1>الدفع الآمن بالبطاقة</h1><p class="note">تُدخل بيانات البطاقة في نموذج HyperPay المشفّر مباشرة؛ لا يراها متجر لُقطة.${sandbox() ? ' (بيئة اختبار)' : ''}</p>
<form action="${esc(back)}" class="paymentWidgets" data-brands="${esc(cfg.brands)}"></form></body></html>`;
      return { status: 200, html, csp: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' ${cfg.base} https://*.oppwa.com; style-src 'self' 'unsafe-inline' ${cfg.base} https://*.oppwa.com; img-src 'self' data: https:; connect-src ${cfg.base} https://*.oppwa.com; frame-src ${cfg.base} https://*.oppwa.com; form-action 'self' ${cfg.base} https://*.oppwa.com ${cfg.publicBase || ''}` };
    }
    if (method === 'GET' && path === '/api/payments/return') {
      if (!cfg) fail(503, 'بوابة الدفع غير معدّة', 'payments_not_configured');
      const checkoutId = url.searchParams.get('id') || '';
      const attempt = get('SELECT * FROM payment_attempts WHERE checkout_id=?', checkoutId); if (!attempt) fail(404, 'عملية الدفع غير موجودة', 'not_found');
      const o = get('SELECT * FROM orders WHERE id=?', attempt.order_id);
      const result = await verify(o, attempt);
      return { status: 302, redirect: `luqta://order/${encodeURIComponent(o.id)}?payment=${result}` };
    }
    if (method === 'POST' && path === '/api/payments/verify') {
      const actor = requireUser(req); if (!cfg) fail(503, 'بوابة الدفع غير معدّة', 'payments_not_configured');
      const o = get('SELECT * FROM orders WHERE id=? AND user_id=?', text(body.orderId, 'الطلب', 3, 100), actor.id); if (!o) fail(404, 'الطلب غير موجود', 'not_found');
      if (o.payment_status === 'paid') return { status: 200, body: { status: 'paid' } };
      const attempt = get('SELECT * FROM payment_attempts WHERE order_id=? ORDER BY created_at DESC LIMIT 1', o.id); if (!attempt) fail(404, 'لا توجد عملية دفع لهذا الطلب', 'not_found');
      return { status: 200, body: { status: await verify(o, attempt) } };
    }
    return undefined;
  }
  return { handle, configured };
}
