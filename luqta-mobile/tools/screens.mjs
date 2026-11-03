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
  // G14 / G15 additions
  ['16-smart-tools', '/smart-tools'], ['17-market-pulse', '/market-pulse'], ['18-price-radar', '/price-radar?id=headphones'], ['19-basket-optimizer', '/basket-optimizer'],
  ['20-game', '/game'], ['21-coupons', '/coupons'], ['22-trending', '/trending'], ['23-studio', '/studio'], ['24-lens', '/lens'], ['25-nutrition', '/nutrition'],
  ['26-green', '/green'], ['27-login', '/login'], ['28-appearance', '/appearance'], ['29-tour', '/?tour=1'], ['30-receipts', '/receipts'],
  ['31-vendors', '/vendors'], ['32-rewards', '/rewards'], ['33-privacy', '/privacy'], ['34-merchant', '/merchant'], ['35-list-to-cart', '/list-to-cart'], ['36-galaxy', '/galaxy'], ['37-account-details', '/account-details'], ['38-addresses', '/addresses'], ['39-admin', '/admin'], ['40-auth', '/auth'], ['41-collection', '/collection/featured'], ['42-command-center', '/command-center'], ['43-compare', '/compare'], ['44-connection', '/connection'], ['45-delete-account', '/delete-account'], ['46-driver', '/driver'], ['47-export', '/export'], ['48-favorites', '/favorites'], ['49-insights', '/insights'], ['50-lists', '/lists'], ['51-list-detail', '/lists/demo'], ['52-live', '/live/LQ-DEMO-001'], ['53-notification-settings', '/notification-settings'], ['54-notifications', '/notifications'], ['55-offers', '/offers'], ['56-order', '/order/LQ-DEMO-001'], ['57-pay', '/pay/LQ-DEMO-001'], ['58-permissions', '/permissions'], ['59-recover-account', '/recover-account'], ['60-reels', '/reels'], ['61-register', '/register'], ['62-returns', '/returns'], ['63-social', '/social'], ['64-terms', '/terms'], ['65-vendor', '/vendor/luqta'], ['66-voice', '/voice'], ['67-wallet', '/wallet'], ['68-watchlist', '/watchlist'],
];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const report = [];
for (const [name, path] of routes) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar', isMobile: true, hasTouch: true });
  await ctx.addInitScript((value) => { try { localStorage.setItem('luqta-store-v2', value); localStorage.setItem('luqta-tour-v1', 'seen'); } catch { /* ignore */ } }, seeded);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  try {
    await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(4500);
    await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
    // CI: also print a compact JPEG into the job log so reviewers (and the agent) can inspect
    // screens without downloading artifacts. Decode lines starting with LUQTA_SHOT.
    if (process.env.CI) { const jpg = await page.screenshot({ type: 'jpeg', quality: 50, scale: 'css', fullPage: true }); console.log(`LUQTA_SHOT ${name} ${jpg.toString('base64')}`); }
  } catch (e) { errors.push('navigation: ' + e.message); }
  report.push({ name, path, errors });
  await ctx.close();
}
await browser.close();
server.close();
await writeFile(join(out, 'screens-report.json'), JSON.stringify(report, null, 1));
console.log(report.map((r) => `${r.name}: ${r.errors.length} errors`).join('\n'));
const crashed = report.filter((r) => r.errors.some((e) => /^pageerror|^navigation/.test(e)));
if (crashed.length) { console.error(`::error::${crashed.length} screen(s) crashed: ${crashed.map((r) => r.name).join(', ')}`); for (const r of crashed) console.error(r.name, r.errors.join(' | ').slice(0, 500)); process.exit(1); }
console.log(`screens: ${report.length} rendered, crashes: 0, console errors: ${report.reduce((n, r) => n + r.errors.length, 0)}`);
