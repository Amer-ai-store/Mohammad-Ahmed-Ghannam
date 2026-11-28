import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './testkit.mjs';

test('restaurant directory exposes only active restaurant menus and uses the existing checkout', async (t) => {
  const { request, admin, register, db } = await fixture(t);
  const create = async (name, kind) => {
    const result = await request('POST', '/admin/vendors', { name, kind }, admin.token);
    assert.equal(result.status, 201, JSON.stringify(result.body));
    return result.body.vendor.id;
  };
  assert.equal((await request('POST', '/admin/vendors', { name: 'غير صالح', kind: 'unknown' }, admin.token)).status, 400);
  const restaurant = await create('مطعم الاختبار', 'restaurant');
  const shop = await create('متجر آخر', 'store');
  const item = await request('POST', '/admin/products', { id: 'meal-test', name: 'وجبة اختبار', price: 3, stock: 4, category: 'pantry', vendorId: restaurant }, admin.token);
  assert.equal(item.status, 201, JSON.stringify(item.body));
  const catalog = await request('GET', '/restaurants');
  assert.deepEqual(catalog.body.restaurants.map((r) => r.id), [restaurant]);
  assert.equal(catalog.body.restaurants[0].products, 1);
  const menu = await request('GET', `/restaurants/${restaurant}/menu`);
  assert.equal(menu.body.products[0].id, 'meal-test');
  assert.equal((await request('GET', `/restaurants/${shop}/menu`)).status, 404);
  const customer = await register();
  const order = await request('POST', '/orders', { items: [{ productId: 'meal-test', quantity: 1 }], address: { name: 'عميل', phone: '0791234567', city: 'عمان', street: 'شارع المتجر 12' }, paymentMethod: 'cod', idempotencyKey: 'restaurant-order-test' }, customer.token);
  assert.equal(order.status, 201, JSON.stringify(order.body));
  assert.equal(order.body.order.subtotal, 3);
  assert.equal((await request('PATCH', `/admin/vendors/${restaurant}`, { status: 'suspended' }, admin.token)).status, 200);
  assert.equal((await request('GET', `/restaurants/${restaurant}/menu`)).status, 404);
  assert.equal((await request('GET', '/restaurants')).body.restaurants.length, 0);
  assert.equal(db.prepare('SELECT kind FROM vendors WHERE id=?').get(restaurant).kind, 'restaurant');
});
