// End-to-end UI flows on the exported web build (Chromium, phone viewport). Unlike
// tools/screens.mjs (which only renders), every flow here clicks through the real UI
// and asserts an outcome. Exits non-zero if any flow fails.
// Usage: node tools/ui-flows.mjs <distDir> <outDir>
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const dist = process.argv[2] || 'dist';
const out = process.argv[3] || 'flows';
await mkdir(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const server = createServer(async (req, res) => {
  let file = join(dist, decodeURIComponent((req.url || '/').split('?')[0]));
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
  res.end(await readFile(file));
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });

const STORE = 'luqta-store-v2';
const seed = (cart) => JSON.stringify({ cart, favorites: [], compareIds: [], recentIds: [], branchId: 'hashmi', demoOrders: [] });
async function open(path, { cart = {}, tourSeen = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'ar', isMobile: true, hasTouch: true });
  await ctx.addInitScript(([key, value, seen]) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(key, value); if (seen) localStorage.setItem('luqta-tour-v1', 'seen'); else localStorage.removeItem('luqta-tour-v1'); sessionStorage.setItem('seeded', '1'); } } catch { /* ignore */ } }, [STORE, seed(cart), tourSeen]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
  return { ctx, page, errors };
}
const byId = (page, id) => page.locator(`[data-testid="${id}"]`).first();
const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), STORE);
function check(cond, message) { if (!cond) throw new Error(message); }

const flows = {
  async 'add-to-cart'() {
    const { ctx, page } = await open('/product/headphones');
    await byId(page, 'product-add').click();
    await page.waitForFunction((k) => (JSON.parse(localStorage.getItem(k) || '{}').cart || {}).headphones >= 1, STORE, { timeout: 8000 });
    await page.goto(base + '/cart', { waitUntil: 'networkidle' });
    await byId(page, 'cart-row-headphones').waitFor({ timeout: 8000 });
    return { ctx, page, note: `cart=${JSON.stringify((await stored(page)).cart)}` };
  },
  async 'basket-optimizer'() {
    const { ctx, page } = await open('/basket-optimizer', { cart: { rice: 2, milk: 2, banana: 1 } });
    await byId(page, 'optimizer-result').waitFor({ timeout: 10000 });
    const before = await byId(page, 'optimizer-result').innerText();
    await page.getByText('الأسرع', { exact: true }).first().click();
    await page.waitForTimeout(600);
    const after = await byId(page, 'optimizer-result').innerText();
    check(before.length > 20 && after.length > 20, 'optimizer produced no plan');
    return { ctx, page, note: `objective switched; plan text ${before.length}→${after.length} chars` };
  },
  async 'memory-game-win'() {
    const { ctx, page } = await open('/game');
    const label = async (i) => (await byId(page, `card-${i}`).getAttribute('aria-label')) || '';
    const faces = new Map();
    for (let i = 0; i < 12; i += 2) {
      for (const j of [i, i + 1]) { await byId(page, `card-${j}`).click(); faces.set(j, (await label(j)).replace('بطاقة ', '')); }
      await page.waitForTimeout(950);
    }
    const groups = {};
    for (const [i, f] of faces) (groups[f] ||= []).push(i);
    check(Object.keys(groups).length === 6 && Object.values(groups).every((g) => g.length === 2), `unexpected deck ${JSON.stringify(groups)}`);
    for (const [a, b] of Object.values(groups)) {
      if ((await label(a)).includes('مغلقة')) { await byId(page, `card-${a}`).click(); await byId(page, `card-${b}`).click(); await page.waitForTimeout(150); }
    }
    await byId(page, 'game-won').waitFor({ timeout: 5000 });
    return { ctx, page, note: 'all 6 pairs matched, win card shown' };
  },
  async 'guided-tour'() {
    const { ctx, page } = await open('/?tour=1', { tourSeen: false });
    await byId(page, 'tour').waitFor({ timeout: 10000 });
    await byId(page, 'tour-next').click();
    await page.waitForTimeout(400);
    await byId(page, 'tour-skip').click();
    await byId(page, 'tour').waitFor({ state: 'detached', timeout: 5000 });
    const seen = await page.evaluate(() => localStorage.getItem('luqta-tour-v1'));
    check(!!seen, 'tour completion not remembered');
    return { ctx, page, note: `tour dismissed, remembered at ${seen}` };
  },
  async 'list-to-cart'() {
    const { ctx, page } = await open('/list-to-cart');
    await byId(page, 'intent-text').fill('2 حليب\nموز\nكافيار ذهبي');
    await byId(page, 'intent-go').click();
    await byId(page, 'intent-result').waitFor({ timeout: 8000 });
    await page.getByText('غير موجود في المتجر').first().waitFor({ timeout: 3000 });
    await byId(page, 'intent-add').click();
    await page.waitForFunction((k) => { const c = (JSON.parse(localStorage.getItem(k) || '{}').cart || {}); return c.milk === 2 && c.banana >= 1 && Object.keys(c).length === 2; }, STORE, { timeout: 8000 });
    return { ctx, page, note: `matched milk×2 + banana, unknown item flagged and not added; cart=${JSON.stringify((await stored(page)).cart)}` };
  },
  async 'explore-search'() {
    const { ctx, page } = await open('/explore');
    await byId(page, 'explore-search').fill('سماعات');
    await byId(page, 'product-card-headphones').waitFor({ timeout: 8000 });
    check(!(await byId(page, 'product-card-rice').isVisible().catch(() => false)), 'unrelated product still shown');
    await byId(page, 'explore-search').fill('zzzz-لا-يوجد');
    await page.getByText('لا توجد منتجات مطابقة').first().waitFor({ timeout: 5000 });
    return { ctx, page, note: 'search narrows to headphones; nonsense query shows the empty state' };
  },
  async 'product-favorite-3d'() {
    const { ctx, page } = await open('/product/headphones');
    await page.locator('[aria-label="حفظ في المفضلة"]').first().click();
    await page.waitForFunction((k) => (JSON.parse(localStorage.getItem(k) || '{}').favorites || []).includes('headphones'), STORE, { timeout: 5000 });
    await byId(page, 'open-3d').click();
    await page.waitForURL(/\/view3d\/headphones/, { timeout: 8000 });
    return { ctx, page, note: 'favorite persisted; 3D viewer opened' };
  },
  async 'cart-quantity-remove'() {
    const { ctx, page } = await open('/cart', { cart: { rice: 1, milk: 2 } });
    await byId(page, 'cart-row-rice').waitFor({ timeout: 8000 });
    await page.locator('[aria-label^="زيادة كمية"]').first().click();
    await page.waitForFunction((k) => Object.values(JSON.parse(localStorage.getItem(k) || '{}').cart || {}).reduce((a, b) => a + b, 0) === 4, STORE, { timeout: 5000 });
    await byId(page, 'cart-remove-milk').click();
    await page.waitForFunction((k) => !(JSON.parse(localStorage.getItem(k) || '{}').cart || {}).milk, STORE, { timeout: 5000 });
    await byId(page, 'coupon-input').fill('LUQTA1');
    await byId(page, 'coupon-apply').click();
    await page.getByText('LUQTA1').first().waitFor({ timeout: 5000 });
    return { ctx, page, note: `quantity +1, milk removed, demo coupon applied; cart=${JSON.stringify((await stored(page)).cart)}` };
  },
  async 'assistant-budget-basket'() {
    const { ctx, page } = await open('/assistant');
    await byId(page, 'chat-input').fill('جهز لي سلة بـ 20 دينار');
    await byId(page, 'chat-send').click();
    await byId(page, 'basket-suggestions').waitFor({ timeout: 10000 });
    await byId(page, 'review-basket').click();
    await page.waitForFunction((k) => Object.keys(JSON.parse(localStorage.getItem(k) || '{}').cart || {}).length > 0, STORE, { timeout: 8000 });
    const cart = (await stored(page)).cart;
    return { ctx, page, note: `budget basket suggested and added after review; cart=${JSON.stringify(cart)}` };
  },
  async 'dark-mode'() {
    const { ctx, page } = await open('/appearance');
    await page.locator('[aria-label="الوضع الليلي"]').first().click();
    await page.waitForFunction(() => localStorage.getItem('luqta-appearance-v1') === 'dark', null, { timeout: 5000 });
    return { ctx, page, note: 'dark mode chosen and persisted' };
  },
  async 'switch-to-english'() {
    const { ctx, page } = await open('/appearance');
    await byId(page, 'lang-en').click();
    await page.waitForFunction(() => localStorage.getItem('luqta-lang') === 'en', null, { timeout: 5000 });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.getByText('What do you need today?').first().waitFor({ timeout: 10000 });
    await page.getByText('Home', { exact: true }).first().waitFor({ timeout: 5000 });
    await page.goto(base + '/smart-tools', { waitUntil: 'networkidle' });
    await page.getByText('Basket optimizer', { exact: true }).first().waitFor({ timeout: 8000 });
    return { ctx, page, note: 'language persisted; home, tab bar and smart tools rendered in English' };
  },
  async 'demo-checkout'() {
    const { ctx, page } = await open('/delivery', { cart: { rice: 1, milk: 2 } });
    await byId(page, 'addr-name').fill('محمد اختبار');
    await byId(page, 'addr-phone').fill('0790000000');
    await byId(page, 'addr-street').fill('شارع الأمير راشد');
    await byId(page, 'delivery-save').click();
    await page.waitForURL(/\/payment/, { timeout: 8000 });
    await byId(page, 'pay-cod').click();
    await byId(page, 'payment-next').click();
    await page.waitForURL(/\/checkout/, { timeout: 8000 });
    const terms = byId(page, 'terms');
    await terms.waitFor({ timeout: 10000 });
    await terms.locator('div').first().click(); // the square itself, not the «terms» link inside the label
    await page.waitForTimeout(400); // checkbox state is visual on web (no aria-checked attribute); the confirm button gate below proves it
    await page.waitForFunction(() => document.querySelector('[data-testid="confirm-order"]')?.getAttribute('aria-disabled') !== 'true', null, { timeout: 15000 });
    await byId(page, 'confirm-order').click();
    await page.waitForURL(/\/tracking\//, { timeout: 10000 });
    await byId(page, 'order-steps').waitFor({ timeout: 8000 });
    await byId(page, 'order-info').waitFor({ timeout: 3000 });
    const s = await stored(page);
    check((s.demoOrders || []).length === 1, 'demo order not stored');
    return { ctx, page, note: `order ${s.demoOrders[0].id} total ${s.demoOrders[0].total}, url ${new URL(page.url()).pathname}` };
  },
};

const report = [];
for (const [name, run] of Object.entries(flows)) {
  let result = { name, ok: false };
  let ctx;
  try {
    const r = await run();
    ctx = r.ctx;
    result = { name, ok: true, note: r.note };
    const jpg = await r.page.screenshot({ type: 'jpeg', quality: 50 });
    await writeFile(join(out, `${name}.jpg`), jpg);
    if (process.env.CI) console.log(`LUQTA_SHOT flow-${name} ${jpg.toString('base64')}`);
  } catch (e) {
    result = { name, ok: false, error: String(e.message || e).slice(0, 400) };
    const pages = browser.contexts().flatMap((c) => c.pages());
    const last = pages.at(-1);
    if (last && process.env.CI) { try { const jpg = await last.screenshot({ type: 'jpeg', quality: 50 }); console.log(`LUQTA_SHOT flow-FAIL-${name} ${jpg.toString('base64')}`); console.log(`url at failure: ${last.url()}`); } catch { /* ignore */ } }
    for (const c of browser.contexts()) await c.close().catch(() => {});
  }
  if (ctx) await ctx.close();
  report.push(result);
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${name} — ${result.note || result.error}`);
}
await browser.close();
server.close();
await writeFile(join(out, 'flows-report.json'), JSON.stringify(report, null, 1));
const failed = report.filter((r) => !r.ok).length;
console.log(`ui-flows: ${report.length - failed}/${report.length} passed`);
process.exit(failed ? 1 : 0);
