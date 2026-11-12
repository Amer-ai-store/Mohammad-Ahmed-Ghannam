/**
 * Independent NEW ERP year-on-year same-day and month-to-date comparison.
 *
 * This is an event projection, NEVER a TrustSoft accounting formula or an
 * attestation that absent source rows mean zero sales. All values are exact
 * integer fils or milli-units. A private API must enforce OIDC, tenant RLS,
 * per-subject branch access, scoped SQL and row limits before calling.
 */
import {independentDailyMovement} from './independent_daily_movement.mjs';

const COLUMNS = Object.freeze([
  'purchase_qty_milli', 'sales_qty_milli', 'stock_delta_qty_milli',
  'purchases_before_tax_fils', 'purchase_tax_fils',
  'sales_before_tax_fils', 'sales_tax_fils',
  'sales_cost_fils', 'sales_profit_fils',
]);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const safeSum = (a, b) => {
  const sum = a + b;
  if (!Number.isSafeInteger(sum)) throw new Error('YOY_TOTAL_OVERFLOW');
  return sum;
};
function validDate(day) {
  if (typeof day !== 'string' || !ISO.test(day)) return false;
  const d = new Date(day + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

export function historicalComparisonWindows(day) {
  if (!validDate(day)) throw new Error('INVALID_COMPARISON_DATE');
  const year = Number(day.slice(0, 4));
  if (year < 2002 || year > 9999) {
    throw new Error('HISTORICAL_COMPARISON_YEAR_UNSUPPORTED');
  }
  const monthDay = day.slice(4);
  const windows = [year, year - 1, year - 2].map((y) => {
    const targetDay = String(y).padStart(4, '0') + monthDay;
    // Do not silently treat leap-day 2024-02-29 as 2023-02-28.
    if (!validDate(targetDay)) throw new Error('COMPARISON_DATE_NOT_IN_ALL_YEARS');
    return Object.freeze({
      year: y,
      day: targetDay,
      monthStart: targetDay.slice(0, 8) + '01',
    });
  });
  return Object.freeze(windows);
}

function totals(rows) {
  const out = Object.fromEntries(COLUMNS.map(k => [k, 0]));
  for (const row of rows) {
    for (const column of COLUMNS) {
      if (!Number.isSafeInteger(row[column])) throw new Error('INVALID_COMPARISON_TOTAL');
      out[column] = safeSum(out[column], row[column]);
    }
  }
  return Object.freeze(out);
}

/**
 * Calendar-date points are source observations, not a complete cash ledger.
 * Null (no POSTED event found) must NEVER become a fabricated zero.
 * Positive and negative net sales are both allowed (returns can dominate).
 */
function observedDailySeries(rows, window) {
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.day)) grouped.set(row.day, []);
    grouped.get(row.day).push(row);
  }
  const points = [];
  const lastDay = Number(window.day.slice(-2));
  for (let dayNumber = 1; dayNumber <= lastDay; dayNumber += 1) {
    const date = window.monthStart.slice(0, 8) +
      String(dayNumber).padStart(2, '0');
    const observed = grouped.get(date) ?? [];
    points.push(Object.freeze({
      dayOfMonth: dayNumber,
      date,
      availability: observed.length > 0
        ? 'HAS_POSTED_EVENTS_UNATTESTED' : 'NO_POSTED_EVENTS_FOUND',
      totals: observed.length > 0 ? totals(observed) : null,
    }));
  }
  return Object.freeze(points);
}

function percentBasisPoints(current, baseline, currentHasData, baselineHasData) {
  if (!currentHasData || !baselineHasData) return null;
  // Profit / returns may have negative baselines; those do not yield a
  // meaningful simple growth rate and must not be presented as % increase.
  if (baseline <= 0) return null;
  const basisPoints = (
    (BigInt(current) - BigInt(baseline)) * 10000n / BigInt(baseline)
  );
  if (basisPoints < BigInt(Number.MIN_SAFE_INTEGER) ||
      basisPoints > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('YOY_PERCENT_OVERFLOW');
  }
  return Number(basisPoints);
}

export function compareIndependentErpYears({
  events, day, tenantId, branchId, itemCode, familyCode, supplierCode,
}) {
  if (!Array.isArray(events)) throw new Error('YOY_EVENTS_NOT_ARRAY');
  const windows = historicalComparisonWindows(day);
  const filters = {
    ...(itemCode === undefined ? {} : {itemCode}),
    ...(familyCode === undefined ? {} : {familyCode}),
    ...(supplierCode === undefined ? {} : {supplierCode}),
  };
  const years = windows.map(w => {
    const projection = independentDailyMovement({
      events, tenantId, branchId, ...filters,
      fromDate: w.monthStart, toDate: w.day,
    });
    const daily = projection.rows.filter(r => r.day === w.day);
    const dailySeries = observedDailySeries(projection.rows, w);
    const dailyHasData = daily.length > 0;
    const mtdHasData = projection.rows.length > 0;
    return Object.freeze({
      year: w.year, date: w.day, monthStart: w.monthStart,
      sourceScopedEventCount: projection.sourceScopedEventCount,
      postedEventCount: projection.postedEventCount,
      ignoredVoidedEventCount: projection.ignoredVoidedEventCount,
      // NO_POSTED_DATA does NOT imply zero or complete source extraction.
      sourceCoverage: 'UNATTESTED',
      dailySeries,
      daily: Object.freeze({
        availability: dailyHasData ? 'HAS_POSTED_EVENTS_UNATTESTED' : 'NO_POSTED_EVENTS_FOUND',
        itemsWithEvents: daily.length,
        totals: dailyHasData ? totals(daily) : null,
      }),
      monthToDate: Object.freeze({
        availability: mtdHasData ? 'HAS_POSTED_EVENTS_UNATTESTED' : 'NO_POSTED_EVENTS_FOUND',
        daysWithPostedEvents: new Set(projection.rows.map(r => r.day)).size,
        itemsWithEvents: new Set(projection.rows.map(r => r.item_code)).size,
        totals: mtdHasData ? totals(projection.rows) : null,
      }),
    });
  });
  const comparisonColumns = Object.freeze([
    'sales_before_tax_fils', 'sales_cost_fils', 'sales_profit_fils',
    'sales_qty_milli', 'purchases_before_tax_fils',
    'purchase_qty_milli', 'stock_delta_qty_milli',
  ]);
  const current = years[0];
  const comparisons = years.slice(1).map(previous => {
    const periods = {};
    for (const [name, period] of [['daily', 'daily'], ['monthToDate', 'monthToDate']]) {
      const currentValue = current[period].totals;
      const priorValue = previous[period].totals;
      const rates = {};
      for (const col of comparisonColumns) {
        rates[col] = percentBasisPoints(
          currentValue?.[col], priorValue?.[col],
          currentValue !== null, priorValue !== null,
        );
      }
      periods[name] = Object.freeze(rates);
    }
    return Object.freeze({
      againstYear: previous.year,
      percentageUnit: 'BASIS_POINTS_100_EQUALS_1_PERCENT',
      daily: periods.daily,
      monthToDate: periods.monthToDate,
    });
  });
  return Object.freeze({
    report: 'INDEPENDENT_NEW_ERP_HISTORICAL_DAILY_AND_MTD_V1',
    referenceStatus: 'NOT_MATCHED_WITH_TRUSTSOFT',
    sourceCompletenessIndependentlyVerified: false,
    formulasIndependentlyApproved: false,
    functionalParityPercent: null,
    scope: Object.freeze({tenantId, branchId, day, ...filters}),
    years: Object.freeze(years),
    comparisons: Object.freeze(comparisons),
  });
}
