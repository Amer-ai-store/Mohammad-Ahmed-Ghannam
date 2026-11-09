/**
 * JAWAFA ERP AI — independent, synthetic reference-report engine.
 *
 * Not a TrustSoft clone, production SQL reader or certified monthly report.
 * Caller MUST enforce authenticated RLS before passing rows. This module
 * additionally requires explicit tenant/branch scope, exact integer fils and
 * milli-unit quantities. No database writes, dynamic SQL or remote requests.
 */
const TYPES = new Set([
  'purchase', 'purchase_return', 'sale', 'sale_return',
  'inventory_in', 'inventory_out',
]);
const COLUMNS = Object.freeze([
  'item_code', 'purchased_qty_milli', 'sold_qty_milli',
  'stock_net_qty_milli', 'purchase_net_fils', 'sales_net_fils',
  'tax_net_fils',
]);

export class ReportInputError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ReportInputError';
    this.code = code;
  }
}

function dateKey(value) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ReportInputError('INVALID_DATE');
  }
  const date = new Date(value + 'T00:00:00.000Z');
  if (Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value) {
    throw new ReportInputError('INVALID_DATE');
  }
  return value;
}

function safeInteger(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ReportInputError(code);
  }
  return value;
}

function checkedAdd(a, b) {
  const sum = a + b;
  if (!Number.isSafeInteger(sum)) {
    throw new ReportInputError('AGGREGATE_OVERFLOW');
  }
  return sum;
}

function validateScope({tenantId, branchId, fromDate, toDate}) {
  if (typeof tenantId !== 'string' || !tenantId.trim() ||
      typeof branchId !== 'string' || !branchId.trim()) {
    throw new ReportInputError('TENANT_AND_BRANCH_REQUIRED');
  }
  const from = dateKey(fromDate);
  const to = dateKey(toDate);
  if (from > to) throw new ReportInputError('REVERSED_PERIOD');
  return {tenantId, branchId, from, to};
}

/** Filter scope BEFORE accessing potentially sensitive row fields. */
export function monthlyItemMovementReport({rows, ...query}) {
  const scope = validateScope(query);
  if (!Array.isArray(rows)) throw new ReportInputError('ROWS_NOT_ARRAY');
  const grouped = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      throw new ReportInputError('INVALID_MOVEMENT_ROW');
    }
    if (row.tenantId !== scope.tenantId || row.branchId !== scope.branchId) {
      continue;
    }
    const day = dateKey(row.date);
    if (day < scope.from || day > scope.to) continue;
    if (typeof row.itemCode !== 'string' ||
        !/^[A-Za-z0-9._-]{1,64}$/.test(row.itemCode)) {
      throw new ReportInputError('INVALID_ITEM_CODE');
    }
    if (!TYPES.has(row.type)) {
      throw new ReportInputError('INVALID_MOVEMENT_TYPE');
    }
    const qty = safeInteger(row.quantityMilli, 'INVALID_QUANTITY_MILLI');
    const value = safeInteger(row.amountFils, 'INVALID_AMOUNT_FILS');
    const tax = safeInteger(row.taxFils, 'INVALID_TAX_FILS');
    let entry = grouped.get(row.itemCode);
    if (!entry) {
      entry = {
        item_code: row.itemCode,
        purchased_qty_milli: 0,
        sold_qty_milli: 0,
        stock_net_qty_milli: 0,
        purchase_net_fils: 0,
        sales_net_fils: 0,
        tax_net_fils: 0,
      };
      grouped.set(row.itemCode, entry);
    }
    const purchase = row.type === 'purchase';
    const purchaseReturn = row.type === 'purchase_return';
    const sale = row.type === 'sale';
    const saleReturn = row.type === 'sale_return';
    const plus = purchase || saleReturn || row.type === 'inventory_in';
    const negative = purchaseReturn || sale || row.type === 'inventory_out';

    // Negative values are legal as aggregated signed results; raw
    // quantity and monetary records must remain nonnegative safe integers.
    entry.stock_net_qty_milli = checkedAdd(
      entry.stock_net_qty_milli, plus ? qty : negative ? -qty : 0);
    if (purchase || purchaseReturn) {
      const sign = purchase ? 1 : -1;
      entry.purchased_qty_milli = checkedAdd(
        entry.purchased_qty_milli, sign * qty);
      entry.purchase_net_fils = checkedAdd(
        entry.purchase_net_fils, sign * value);
      entry.tax_net_fils = checkedAdd(entry.tax_net_fils, sign * tax);
    }
    if (sale || saleReturn) {
      const sign = sale ? 1 : -1;
      entry.sold_qty_milli = checkedAdd(entry.sold_qty_milli, sign * qty);
      entry.sales_net_fils = checkedAdd(entry.sales_net_fils, sign * value);
      entry.tax_net_fils = checkedAdd(entry.tax_net_fils, sign * tax);
    }
  }
  const results = [...grouped.values()].sort((a, b) =>
    a.item_code.localeCompare(b.item_code, 'en'));
  return Object.freeze({
    report: 'SYNTHETIC_MONTHLY_ITEM_MOVEMENT',
    referenceStatus: 'NOT_MATCHED_WITH_TRUSTSOFT',
    query: Object.freeze({...scope}),
    columns: COLUMNS,
    items: Object.freeze(results.map(r => Object.freeze(r))),
  });
}

function csvCell(value) {
  // Formula injection defense applies even to data from an internal database.
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function toItemMovementCsv(report) {
  if (!report || report.report !== 'SYNTHETIC_MONTHLY_ITEM_MOVEMENT' ||
      !Array.isArray(report.items)) {
    throw new ReportInputError('UNSUPPORTED_REPORT');
  }
  const output = [COLUMNS.map(csvCell).join(',')];
  for (const row of report.items) {
    output.push(COLUMNS.map(key => csvCell(row[key])).join(','));
  }
  return output.join('\r\n') + '\r\n';
}
