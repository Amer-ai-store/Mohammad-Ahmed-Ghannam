// Renders the exported web build of the app in Chromium at phone size and saves a
// screenshot per screen (visual evidence vs. the reference designs). Also records
// console errors per route. Usage: node tools/screens.mjs <distDir> <outDir>
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const dist = process.argv[2] || 'dist';
const out = process.argv[3] || 'screens';
await mkdir(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.json': 'application/json', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const server = createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = join(dist, url);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
  res.end(await readFile(file));
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

const now = new Date().toISOString();
const demoOrder = { id: 'LQ-DEMO-001', date: now, createdAt: now, status: 'preparing', items: [{ productId: 'rice', name: 'أرز بسمتي', price: 3.25, quantity: 1 }, { productId: 'milk', name: 'حليب طويل الأمد', price: 2.2, quantity: 2 }, { productId: 'banana', name: 'موز', price: 1.75, quantity: 1 }], subtotal: 9.4, discount: 0, shipping: 1, total: 10.4, currency: 'JOD', paymentMethod: 'cod', paymentStatus: 'simulated', address: { name: 'محمد', phone: '0790000000', city: 'عمان', street: 'الهاشمي، شارع الأمير راشد بن الحسن، رقم 12' }, events: [{ status: 'pending', createdAt: now, note: 'تم استلام الطلب (مثال)' }, { status: 'preparing', createdAt: now, note: 'تم تجهيز الطلب وجاري الإعداد للشحن (مثال)' }] };
const delivered = { ...demoOrder, id: 'LQ-DEMO-002', status: 'delivered' };
const seeded = JSON.stringify({ cart: { rice: 1, milk: 2, banana: 1 }, favorites: [], compareIds: [], recentIds: [], branchId: 'hashmi', demoOrders: [demoOrder, delivered] });
const routes = [
  ['01-home', '/'], ['02-assistant', '/assistant?q=' + encodeURIComponent('جهز لي سلة بـ 20 دينار')], ['03-view3d', '/view3d/armchair'],
  ['04-product', '/product/headphones'], ['05-explore', '/explore'], ['06-cart', '/cart'], ['07-character', '/character'],
  ['08-delivery', '/delivery'], ['09-checkout', '/checkout'], ['10-character-create', '/character-create'], ['11-payment', '/payment'],
  ['12-tracking', '/tracking/LQ-DEMO-001'], ['13-orders', '/orders'], ['14-support', '/support'], ['15-profile', '/profile'],
];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const report = [];
for (const [name, path] of routes) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar', isMobile: true, hasTouch: true });
  await ctx.addInitScript((value) => { try { localStorage.setItem('luqta-store-v2', value); } catch { /* ignore */ } }, seeded);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  try {
    await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(4500);
    await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
  } catch (e) { errors.push('navigation: ' + e.message); }
  report.push({ name, path, errors });
  await ctx.close();
}
await browser.close();
server.close();
await writeFile(join(out, 'screens-report.json'), JSON.stringify(report, null, 1));
console.log(report.map((r) => `${r.name}: ${r.errors.length} errors`).join('\n'));
