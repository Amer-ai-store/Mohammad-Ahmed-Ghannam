import assert from 'node:assert/strict';
import test from 'node:test';
import {
  historicalComparisonWindows, compareIndependentErpYears,
} from '../src/daily_yoy_comparison.mjs';

const scope = {
  tenantId: 'TENANT-A', branchId: 'BR-A', day: '2026-10-03',
};
function sale(date, amount, id, extras = {}) {
  return {
    tenantId:'TENANT-A', branchId:'BR-A',
    eventId:id, date, itemCode:'SKU-A', familyCode:'FAM-A',
    supplierCode:'SUP-A', kind:'sale', status:'POSTED',
    quantityMilli:1000, netAmountFils:amount, taxFils:0,
    costFils:Math.floor(amount/2), ...extras,
  };
}
function run(events, overrides = {}) {
  return compareIndependentErpYears({...scope, ...overrides, events});
}

test('historical windows align same month and day for three years', () => {
  assert.deepEqual(
    historicalComparisonWindows('2026-10-03').map(w => [w.year,w.monthStart,w.day]),
    [[2026,'2026-10-01','2026-10-03'],
     [2025,'2025-10-01','2025-10-03'],
     [2024,'2024-10-01','2024-10-03']],
  );
});

test('independently compute day and MTD with integer money and basis points', () => {
  const events = [
    sale('2026-10-03',1000,'EV-2026-03'),
    sale('2026-10-01',100,'EV-2026-01'),
    sale('2025-10-03',500,'EV-2025-03'),
    sale('2025-10-01',50,'EV-2025-01'),
    sale('2024-10-03',250,'EV-2024-03'),
    sale('2024-10-01',25,'EV-2024-01'),
  ];
  const original = JSON.stringify(events);
  const out = run(events);
  assert.equal(out.report,'INDEPENDENT_NEW_ERP_HISTORICAL_DAILY_AND_MTD_V1');
  assert.equal(out.referenceStatus,'NOT_MATCHED_WITH_TRUSTSOFT');
  assert.equal(out.sourceCompletenessIndependentlyVerified,false);
  assert.equal(out.functionalParityPercent,null);
  assert.deepEqual(out.years.map(x => x.year),[2026,2025,2024]);
  assert.deepEqual(out.years.map(x => x.daily.totals.sales_before_tax_fils),
    [1000,500,250]);
  assert.deepEqual(out.years.map(x => x.monthToDate.totals.sales_before_tax_fils),
    [1100,550,275]);
  assert.equal(out.comparisons[0].daily.sales_before_tax_fils,10000); // +100%
  assert.equal(out.comparisons[1].daily.sales_before_tax_fils,30000); // +300%
  assert.equal(out.comparisons[0].monthToDate.sales_before_tax_fils,10000);
  assert.equal(out.comparisons[1].monthToDate.sales_before_tax_fils,30000);
  assert.equal(out.years[0].monthToDate.daysWithPostedEvents,2);
  assert.equal(JSON.stringify(events),original);
});

test('missing old year is NOT interpreted as zero or as report completeness', () => {
  const out = run([sale('2026-10-03',100,'CUR')]);
  assert.equal(out.years[0].daily.totals.sales_before_tax_fils,100);
  assert.equal(out.years[1].daily.availability,'NO_POSTED_EVENTS_FOUND');
  assert.equal(out.years[1].daily.totals,null);
  assert.equal(out.years[2].monthToDate.totals,null);
  assert.equal(out.comparisons[0].daily.sales_before_tax_fils,null);
  assert.equal(out.comparisons[1].monthToDate.sales_qty_milli,null);
  assert.equal(out.years[1].sourceCoverage,'UNATTESTED');
});

test('historical date invalid or leap-day mismatch fails without silent rollover', () => {
  for(const date of ['2026-02-30','2026-13-03','26-10-03','2001-10-03']) {
    assert.throws(() => historicalComparisonWindows(date));
  }
  assert.throws(() => historicalComparisonWindows('2024-02-29'),
    /COMPARISON_DATE_NOT_IN_ALL_YEARS/);
});

test('negative or zero revenue denominator is not reported as a growth rate', () => {
  const events = [
    sale('2026-10-03',50,'C'),
    sale('2025-10-03',100,'P', {kind:'sale_return',
      referenceEventId:'ORIGINAL-OLD',netAmountFils:100}),
    sale('2024-10-03',0,'PP'),
  ];
  const out = run(events);
  assert.equal(out.years[1].daily.totals.sales_before_tax_fils,-100);
  assert.equal(out.comparisons[0].daily.sales_before_tax_fils,null);
  assert.equal(out.comparisons[1].daily.sales_before_tax_fils,null);
});

test('voided events are excluded; no posted data remains unknown', () => {
  const out = run([
    sale('2026-10-03',100,'GOOD'),
    sale('2025-10-03',999,'VOIDED',{status:'VOIDED'}),
  ]);
  assert.equal(out.years[1].sourceScopedEventCount,1);
  assert.equal(out.years[1].ignoredVoidedEventCount,1);
  assert.equal(out.years[1].postedEventCount,0);
  assert.equal(out.years[1].daily.availability,'NO_POSTED_EVENTS_FOUND');
});

test('no cross-tenant, branch, item, family, supplier or outside-day leakage', () => {
  const events = [
    sale('2026-10-03',100,'GOOD'),
    sale('2026-10-03',999,'FOREIGN',{tenantId:'FOREIGN'}),
    sale('2026-10-03',999,'OTHER-BRANCH',{branchId:'OTHER'}),
    sale('2026-10-03',999,'OTHER-ITEM',{itemCode:'OTHER'}),
    sale('2026-10-03',999,'OTHER-FAM',{familyCode:'OTHER'}),
    sale('2026-10-03',999,'OTHER-SUP',{supplierCode:'OTHER'}),
    sale('2026-09-30',999,'OTHER-MONTH'),
    sale('2026-10-04',999,'FUTURE-DAY'),
  ];
  const out = run(events,{itemCode:'SKU-A',familyCode:'FAM-A',supplierCode:'SUP-A'});
  assert.equal(out.years[0].sourceScopedEventCount,1);
  assert.equal(out.years[0].daily.totals.sales_before_tax_fils,100);
  assert.equal(JSON.stringify(out).includes('999'),false);
});

test('per-item and per-day aggregation overflow is rejected', () => {
  assert.throws(() => run([
    sale('2026-10-03', Number.MAX_SAFE_INTEGER,'BIG'),
    sale('2026-10-03', 1,'SMALL'),
  ]),/AGGREGATE_OVERFLOW/);
});

test('valid negative margin is preserved without vendor profit assumptions', () => {
  const out = run([sale('2026-10-03',50,'C',{costFils:100})]);
  assert.equal(out.years[0].daily.totals.sales_profit_fils,-50);
  assert.equal(out.formulasIndependentlyApproved,false);
});

test('source validation must reject a missing events array', () => {
  assert.throws(() => run(null), /YOY_EVENTS_NOT_ARRAY/);
});


test('three-year daily trend has one point per calendar day, never fake zero on gaps', () => {
  const data = run([
    sale('2026-10-01',300,'TREND-A'),
    sale('2026-10-03',100,'TREND-B'),
    sale('2025-10-02',200,'TREND-C'),
    sale('2024-10-03',50,'TREND-D'),
  ]);
  assert.deepEqual(data.years.map(y => y.dailySeries.length),[3,3,3]);
  assert.deepEqual(data.years[0].dailySeries.map(p => p.date),
    ['2026-10-01','2026-10-02','2026-10-03']);
  assert.equal(data.years[0].dailySeries[0].totals.sales_before_tax_fils,300);
  assert.equal(data.years[0].dailySeries[1].totals,null);
  assert.equal(data.years[0].dailySeries[1].availability,'NO_POSTED_EVENTS_FOUND');
  assert.equal(data.years[0].dailySeries[2].totals.sales_before_tax_fils,100);
  assert.equal(data.years[1].dailySeries[1].totals.sales_before_tax_fils,200);
  assert.equal(data.years[2].dailySeries[0].totals,null);
  assert.deepEqual(data.years.map(y=>y.sourceCoverage),['UNATTESTED','UNATTESTED','UNATTESTED']);
  for(const year of data.years) {
    assert.deepEqual(year.dailySeries.at(-1).totals,year.daily.totals);
    assert.equal(Object.isFrozen(year.dailySeries),true);
    assert.equal(Object.isFrozen(year.dailySeries[0]),true);
  }
  assert.equal(data.functionalParityPercent,null);
});

test('year trend maintains returns as signed negative observations, not missing', () => {
  const d = run([
    sale('2026-10-01',100,'ORIGINAL'),
    sale('2026-10-02',75,'RETURN',{kind:'sale_return',
      referenceEventId:'ORIGINAL',costFils:30}),
  ]);
  assert.equal(d.years[0].dailySeries[1].totals.sales_before_tax_fils,-75);
  assert.equal(d.years[0].dailySeries[1].availability,'HAS_POSTED_EVENTS_UNATTESTED');
  assert.equal(d.years[0].monthToDate.totals.sales_before_tax_fils,25);
});

test('trend excludes VOIDED and foreign tenant or branch rows and filtered categories', () => {
  const d = run([
    sale('2026-10-01',100,'GOOD'),
    sale('2026-10-02',999,'VOIDED',{status:'VOIDED'}),
    sale('2026-10-02',999,'OTHER-COMPANY',{tenantId:'TENANT-B'}),
    sale('2026-10-02',999,'OTHER-BRANCH',{branchId:'BR-B'}),
    sale('2026-10-03',999,'OTHER-ITEM',{itemCode:'ANOTHER'}),
  ],{itemCode:'SKU-A'});
  assert.deepEqual(d.years[0].dailySeries.map(p=>p.totals?.sales_before_tax_fils ?? null),
    [100,null,null]);
  assert.equal(d.years[0].sourceScopedEventCount,2);
  assert.equal(JSON.stringify(d).includes('999'),false);
});

test('full 31-day month series is bounded to requested day and never includes future rows', () => {
  const d = run([
    sale('2026-10-31',200,'OCT-END'),
    sale('2026-11-01',999,'NOV-EXCLUDED'),
  ], {day:'2026-10-31'});
  assert.deepEqual(d.years.map(y=>y.dailySeries.length),[31,31,31]);
  assert.equal(d.years[0].dailySeries[29].totals,null);
  assert.equal(d.years[0].dailySeries[30].totals.sales_before_tax_fils,200);
  assert.equal(d.years[0].monthToDate.totals.sales_before_tax_fils,200);
  assert.equal(d.years[1].dailySeries[30].availability,'NO_POSTED_EVENTS_FOUND');
});
