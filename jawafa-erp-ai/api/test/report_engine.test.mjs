import assert from 'node:assert/strict';
import test from 'node:test';
import {
  monthlyItemMovementReport,
  toItemMovementCsv,
  ReportInputError,
} from '../src/report_engine.mjs';

const scope = {
  tenantId: 'TENANT-A', branchId: 'BR-1',
  fromDate: '2026-10-01', toDate: '2026-10-31',
};
function movement(type, quantityMilli, amountFils, taxFils, extra = {}) {
  return {
    tenantId: 'TENANT-A', branchId: 'BR-1',
    date: '2026-10-12', itemCode: 'ITEM-01',
    type, quantityMilli, amountFils, taxFils, ...extra,
  };
}

test('synthetic monthly item report uses exact fils and milli-units', () => {
  const report = monthlyItemMovementReport({
    ...scope, rows: [
      movement('purchase', 5000, 2000, 320),
      movement('purchase_return', 1000, 400, 64),
      movement('sale', 2000, 1000, 160),
      movement('sale_return', 500, 250, 40),
      movement('inventory_in', 300, 0, 0),
      movement('inventory_out', 100, 0, 0),
    ],
  });
  assert.equal(report.referenceStatus, 'NOT_MATCHED_WITH_TRUSTSOFT');
  assert.equal(report.items.length, 1);
  const row = report.items[0];
  assert.deepEqual(row, {
    item_code: 'ITEM-01',
    purchased_qty_milli: 4000,
    sold_qty_milli: 1500,
    stock_net_qty_milli: 2700,
    purchase_net_fils: 1600,
    sales_net_fils: 750,
    tax_net_fils: 376,
  });
  assert.ok(Object.isFrozen(report.items));
  assert.ok(Object.isFrozen(row));
});

test('strict tenant and branch isolation before any row details', () => {
  const report = monthlyItemMovementReport({
    ...scope, rows: [
      movement('sale', 1000, 500, 80),
      movement('sale', -1000, NaN, 0, {
        tenantId: 'TENANT-B', branchId: 'BR-1',
        itemCode: '=SENSITIVE',
      }),
      movement('sale', 1000, 500, 80, {branchId: 'BR-2'}),
      movement('sale', 1000, 500, 80, {date: '2026-11-01'}),
    ],
  });
  assert.equal(report.items.length, 1);
  assert.equal(report.items[0].sales_net_fils, 500);
  assert.equal(report.items[0].sold_qty_milli, 1000);
});

test('invalid dates, missing scopes and reversed periods fail closed', () => {
  for (const invalidDate of ['2026-02-30', '2026-13-01', '10/01/2026']) {
    assert.throws(() => monthlyItemMovementReport({
      ...scope, fromDate: invalidDate, rows: [],
    }), /INVALID_DATE/);
  }
  assert.throws(() => monthlyItemMovementReport({
    ...scope, fromDate: '2026-11-01', toDate: '2026-10-31', rows: [],
  }), /REVERSED_PERIOD/);
  assert.throws(() => monthlyItemMovementReport({
    ...scope, branchId: '', rows: [],
  }), /TENANT_AND_BRANCH_REQUIRED/);
});

test('invalid amounts, quantity and tax are not coerced or rounded', () => {
  for (const [field, bad] of [
    ['amountFils', 0.1], ['taxFils', -1], ['quantityMilli', 0.5],
    ['amountFils', Number.MAX_SAFE_INTEGER + 1],
  ]) {
    assert.throws(() => monthlyItemMovementReport({
      ...scope, rows: [movement('sale', 1000, 500, 80, {[field]: bad})],
    }), ReportInputError);
  }
});

test('unknown movement type and unsafe item codes are rejected', () => {
  assert.throws(() => monthlyItemMovementReport({
    ...scope, rows: [movement('deleted_source_mutation', 1, 1, 0)],
  }), /INVALID_MOVEMENT_TYPE/);
  assert.throws(() => monthlyItemMovementReport({
    ...scope, rows: [movement('sale', 1, 1, 0, {itemCode: '=HYPERLINK(1)'})],
  }), /INVALID_ITEM_CODE/);
});

test('aggregation overflow is denied instead of producing wrong figures', () => {
  assert.throws(() => monthlyItemMovementReport({
    ...scope, rows: [
      movement('sale', 1, Number.MAX_SAFE_INTEGER, 0),
      movement('sale', 1, 5, 0),
    ],
  }), /AGGREGATE_OVERFLOW/);
});

test('read-only CSV output has fixed, appropriately quoted columns', () => {
  const report = monthlyItemMovementReport({
    ...scope, rows: [movement('purchase', 1250, 250, 40)],
  });
  const csv = toItemMovementCsv(report);
  assert.equal(csv.split('\r\n').length, 3);
  assert.ok(csv.includes('"item_code"'));
  assert.ok(csv.includes('"ITEM-01","1250","0","1250","250","0","40"'));
  assert.throws(() => toItemMovementCsv({items: []}), /UNSUPPORTED_REPORT/);
});

test('empty range is an empty report, not zero fabricated financial totals', () => {
  const report = monthlyItemMovementReport({...scope, rows: []});
  assert.deepEqual(report.items, []);
  assert.equal(report.referenceStatus, 'NOT_MATCHED_WITH_TRUSTSOFT');
});
