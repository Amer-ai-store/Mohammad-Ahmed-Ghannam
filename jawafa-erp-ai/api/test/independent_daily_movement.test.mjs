import assert from 'node:assert/strict';
import test from 'node:test';
import {
  independentDailyMovement, independentDailyMovementCsv,
  DailyMovementError,
} from '../src/independent_daily_movement.mjs';

const scope = {
  tenantId: 'TENANT-A', branchId: 'BR-01',
  fromDate: '2026-10-01', toDate: '2026-10-31',
};
let serial = 0;
function movement(kind, quantityMilli, netAmountFils, taxFils, costFils, extra = {}) {
  serial += 1;
  return {
    eventId: 'SYN-EVT-' + serial, tenantId: 'TENANT-A', branchId: 'BR-01',
    date: '2026-10-12', itemCode: 'SKU-01',
    familyCode: 'FAM-A', supplierCode: 'SUP-A',
    kind, status: 'POSTED', quantityMilli, netAmountFils,
    taxFils, costFils, ...extra,
  };
}
function run(events, extra = {}) {
  return independentDailyMovement({...scope, ...extra, events});
}
function expectError(events, code, extra = {}) {
  assert.throws(() => run(events, extra), error =>
    error instanceof DailyMovementError && error.code === code);
}

test('sales, purchases, returns and stock changes reconcile as exact integer events', () => {
  const purchase = movement('purchase', 5000, 2000, 320, 0);
  const sale = movement('sale', 2000, 1000, 160, 650);
  const events = [
    purchase,
    movement('purchase_return', 1000, 400, 64, 0,
      {referenceEventId: purchase.eventId}),
    sale,
    movement('sale_return', 500, 250, 40, 160,
      {referenceEventId: sale.eventId}),
    movement('stock_in', 300, 0, 0, 0),
    movement('stock_out', 100, 0, 0, 0),
  ];
  const report = run(events);
  assert.equal(report.referenceStatus, 'NOT_MATCHED_WITH_TRUSTSOFT');
  assert.equal(report.formulaStatus, 'INDEPENDENT_EVENT_RULES_ONLY');
  assert.equal(report.rows.length, 1);
  assert.deepEqual(report.rows[0], {
    day: '2026-10-12', item_code: 'SKU-01',
    purchase_qty_milli: 4000,
    sales_qty_milli: 1500,
    stock_delta_qty_milli: 2700,
    purchases_before_tax_fils: 1600,
    purchase_tax_fils: 256,
    sales_before_tax_fils: 750,
    sales_tax_fils: 120,
    sales_cost_fils: 490,
    sales_profit_fils: 260,
  });
  assert.equal(report.postedEventCount, 6);
  assert.equal(report.ignoredVoidedEventCount, 0);
  assert.ok(Object.isFrozen(report.rows[0]));
});

test('status VOIDED is excluded and raw data is not mutated', () => {
  const good = movement('sale', 1000, 500, 80, 300);
  const canceled = movement('sale', 1000, 500, 80, 300, {status: 'VOIDED'});
  const initial = JSON.stringify([good, canceled]);
  const report = run([good, canceled]);
  assert.equal(report.sourceScopedEventCount, 2);
  assert.equal(report.postedEventCount, 1);
  assert.equal(report.ignoredVoidedEventCount, 1);
  assert.equal(report.rows[0].sales_before_tax_fils, 500);
  assert.equal(JSON.stringify([good, canceled]), initial);
});

test('scope exclusion happens before private row details are inspected', () => {
  const foreign = movement('sale', -1, Number.NaN, -5, -9, {
    tenantId: 'TENANT-FOREIGN', itemCode: '=HIDDEN',
  });
  const result = run([foreign, movement('sale', 100, 200, 32, 150)]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.sourceScopedEventCount, 1);
});

test('date, branch and family/supplier/item filters are exact', () => {
  const events = [
    movement('sale', 1000, 150, 24, 100),
    movement('sale', 1000, 999, 159, 400, {date: '2026-11-01'}),
    movement('sale', 1000, 999, 159, 400, {branchId: 'BR-02'}),
    movement('sale', 1000, 999, 159, 400, {familyCode: 'OTHER'}),
    movement('sale', 1000, 999, 159, 400, {supplierCode: 'OTHER'}),
    movement('sale', 1000, 999, 159, 400, {itemCode: 'OTHER'}),
  ];
  const r = run(events, {
    itemCode: 'SKU-01', familyCode: 'FAM-A', supplierCode: 'SUP-A',
  });
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].sales_before_tax_fils, 150);
  assert.equal(r.sourceScopedEventCount, 1);
});

test('same-day same item is aggregated; different days remain separate and sorted', () => {
  const report = run([
    movement('sale', 100, 50, 8, 30, {date: '2026-10-13'}),
    movement('sale', 300, 100, 16, 60, {date: '2026-10-12'}),
    movement('sale', 200, 75, 12, 40, {date: '2026-10-12'}),
  ]);
  assert.deepEqual(report.rows.map(r => r.day),
    ['2026-10-12', '2026-10-13']);
  assert.equal(report.rows[0].sales_qty_milli, 500);
  assert.equal(report.rows[0].sales_before_tax_fils, 175);
});

test('duplicate event IDs fail closed instead of inflating sales', () => {
  const first = movement('sale', 100, 200, 32, 100);
  const second = {...first, netAmountFils: 300};
  expectError([first, second], 'DUPLICATE_EVENT_ID');
  const voided = {...first, status: 'VOIDED'};
  expectError([first, voided], 'DUPLICATE_EVENT_ID');
});

test('unknown status or omitted posting status never silently posts', () => {
  expectError([movement('sale', 100, 300, 48, 100,
    {status: 'DRAFT'})], 'INVALID_POSTING_STATUS');
  expectError([movement('sale', 100, 300, 48, 100,
    {status: undefined})], 'INVALID_POSTING_STATUS');
});

test('returns require explicit source reference, but do not falsely claim lineage proof', () => {
  expectError([movement('sale_return', 100, 150, 24, 80)],
    'RETURN_REFERENCE_REQUIRED');
  expectError([movement('purchase_return', 100, 150, 24, 0,
    {referenceEventId: '=1+1'})], 'RETURN_REFERENCE_REQUIRED');
  const r = run([movement('sale_return', 100, 150, 24, 80,
    {referenceEventId: 'EXTERNAL-OLDER-TRANSACTION'})]);
  assert.equal(r.rows[0].sales_before_tax_fils, -150);
  assert.equal(r.rows[0].sales_profit_fils, -70);
});

test('bad source amounts and quantities are rejected, not rounded or coerced', () => {
  const errorCases = [
    ['quantityMilli', 0, 'INVALID_QUANTITY_MILLI'],
    ['quantityMilli', 0.5, 'INVALID_QUANTITY_MILLI'],
    ['netAmountFils', 2.3, 'INVALID_NET_AMOUNT_FILS'],
    ['netAmountFils', -4, 'INVALID_NET_AMOUNT_FILS'],
    ['taxFils', Infinity, 'INVALID_TAX_FILS'],
    ['costFils', Number.MAX_SAFE_INTEGER + 1, 'INVALID_COST_FILS'],
  ];
  for (const [field, bad, error] of errorCases) {
    expectError([movement('sale', 100, 200, 32, 100, {[field]: bad})], error);
  }
});

test('stock event with money is denied; purchase event cannot masquerade sales cost', () => {
  expectError([movement('stock_in', 100, 1, 0, 0)],
    'STOCK_EVENT_MONEY_NOT_SUPPORTED');
  expectError([movement('stock_out', 100, 0, 1, 0)],
    'STOCK_EVENT_MONEY_NOT_SUPPORTED');
  expectError([movement('purchase', 100, 300, 48, 1)],
    'PURCHASE_SALES_COST_NOT_SUPPORTED');
});

test('aggregates exceeding safe integer capacity are rejected', () => {
  expectError([
    movement('sale', 1, Number.MAX_SAFE_INTEGER, 0, 0),
    movement('sale', 1, 2, 0, 0),
  ], 'AGGREGATE_OVERFLOW');
});

test('negative gross margin stays negative when explicit cost exceeds revenue', () => {
  const r = run([movement('sale', 100, 50, 8, 80)]);
  assert.equal(r.rows[0].sales_profit_fils, -30);
});

test('date, branch, tenant and filter validation fails closed', () => {
  for (const invalid of ['2026-02-30', '2026-13-01', '01/10/2026']) {
    expectError([], 'INVALID_FROM_DATE', {fromDate: invalid});
  }
  expectError([], 'REVERSED_PERIOD',
    {fromDate: '2026-11-01', toDate: '2026-10-31'});
  expectError([], 'INVALID_TENANT_ID', {tenantId: ''});
  expectError([], 'INVALID_BRANCH_ID', {branchId: '=HACK'});
  expectError([], 'INVALID_SUPPLIER_FILTER', {supplierCode: ''});
});

test('CSV is deterministically sorted, exact and contains no untrusted row text', () => {
  const r = run([movement('sale', 100, 250, 40, 200)]);
  const csv = independentDailyMovementCsv(r);
  assert.ok(csv.startsWith('"day","item_code","purchase_qty_milli"'));
  assert.ok(csv.includes('"2026-10-12","SKU-01","0","100"'));
  assert.ok(csv.includes('"250","40","200","50"'));
  assert.ok(csv.endsWith('\r\n'));
  assert.throws(() => independentDailyMovementCsv({rows: []}),
    /UNSUPPORTED_DAILY_REPORT/);
});

test('empty input reports absence of events, not manufactured financial totals', () => {
  const report = run([]);
  assert.deepEqual(report.rows, []);
  assert.equal(report.postedEventCount, 0);
  assert.equal(report.referenceStatus, 'NOT_MATCHED_WITH_TRUSTSOFT');
});
