/**
 * Independent JAWAFA ERP AI daily item movement projector.
 *
 * Input MUST be authorized new-ERP event records only, never a TrustSoft
 * extracted report. Callers enforce authentication + database tenant RLS.
 * This function additionally enforces exact tenant/branch/day/item filters.
 *
 * All amounts are integer fils; all quantities are integer milli-units.
 * No inferred sales cost, tax rate, historic stock opening balance, SQL
 * mutation, external fetch or TrustSoft business formula is used.
 *
 * A passing test proves this SPECIFIC new-ERP calculation only.
 * Reference parity remains NOT_MEASURED.
 */
const KINDS = new Set([
  'purchase', 'purchase_return', 'sale', 'sale_return',
  'stock_in', 'stock_out',
]);
const STATUS = new Set(['POSTED', 'VOIDED']);
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const COLUMNS = Object.freeze([
  'day', 'item_code', 'purchase_qty_milli', 'sales_qty_milli',
  'stock_delta_qty_milli', 'purchases_before_tax_fils',
  'purchase_tax_fils', 'sales_before_tax_fils', 'sales_tax_fils',
  'sales_cost_fils', 'sales_profit_fils',
]);
const NUMERIC = COLUMNS.slice(2);

export class DailyMovementError extends Error {
  constructor(code) {
    super(code);
    this.name = 'DailyMovementError';
    this.code = code;
  }
}

function safeId(input, label) {
  if (typeof input !== 'string' || !ID.test(input)) {
    throw new DailyMovementError('INVALID_' + label);
  }
  return input;
}
function iso(input, label) {
  if (typeof input !== 'string' || !DATE.test(input)) {
    throw new DailyMovementError('INVALID_' + label);
  }
  const value = new Date(input + 'T00:00:00.000Z');
  if (Number.isNaN(value.getTime()) ||
      value.toISOString().slice(0, 10) !== input) {
    throw new DailyMovementError('INVALID_' + label);
  }
  return input;
}
function integer(input, label, positive = false) {
  if (!Number.isSafeInteger(input) || input < (positive ? 1 : 0)) {
    throw new DailyMovementError('INVALID_' + label);
  }
  return input;
}
function add(previous, delta) {
  if (!Number.isSafeInteger(delta)) {
    throw new DailyMovementError('AGGREGATE_OVERFLOW');
  }
  const next = previous + delta;
  if (!Number.isSafeInteger(next)) {
    throw new DailyMovementError('AGGREGATE_OVERFLOW');
  }
  return next;
}
function scopeOf(input) {
  const tenantId = safeId(input.tenantId, 'TENANT_ID');
  const branchId = safeId(input.branchId, 'BRANCH_ID');
  const fromDate = iso(input.fromDate, 'FROM_DATE');
  const toDate = iso(input.toDate, 'TO_DATE');
  if (fromDate > toDate) throw new DailyMovementError('REVERSED_PERIOD');
  const itemCode = input.itemCode === undefined ? null :
    safeId(input.itemCode, 'ITEM_FILTER');
  const familyCode = input.familyCode === undefined ? null :
    safeId(input.familyCode, 'FAMILY_FILTER');
  const supplierCode = input.supplierCode === undefined ? null :
    safeId(input.supplierCode, 'SUPPLIER_FILTER');
  return Object.freeze({
    tenantId, branchId, fromDate, toDate,
    itemCode, familyCode, supplierCode,
  });
}

/**
 * Event contract:
 * {eventId, tenantId, branchId, date, itemCode, familyCode, supplierCode,
 *  kind, status, quantityMilli, netAmountFils, taxFils, costFils,
 *  referenceEventId? }
 *
 * Returns must cite an existing event identifier. Checking existence and
 * posting lineage requires a separate independently audited ledger step.
 */
export function independentDailyMovement({events, ...scopeInput}) {
  const scope = scopeOf(scopeInput);
  if (!Array.isArray(events)) throw new DailyMovementError('EVENTS_NOT_ARRAY');
  const seen = new Set();
  const grouped = new Map();
  let sourceScoped = 0;
  let posted = 0;
  let ignoredVoided = 0;
  for (const event of events) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      throw new DailyMovementError('INVALID_EVENT');
    }
    // Do not read fields other than tenant/branch until scope matches.
    if (event.tenantId !== scope.tenantId ||
        event.branchId !== scope.branchId) continue;
    const day = iso(event.date, 'EVENT_DATE');
    if (day < scope.fromDate || day > scope.toDate) continue;
    const itemCode = safeId(event.itemCode, 'ITEM_CODE');
    if (scope.itemCode && itemCode !== scope.itemCode) continue;
    const familyCode = safeId(event.familyCode, 'FAMILY_CODE');
    if (scope.familyCode && familyCode !== scope.familyCode) continue;
    const supplierCode = safeId(event.supplierCode, 'SUPPLIER_CODE');
    if (scope.supplierCode && supplierCode !== scope.supplierCode) continue;

    sourceScoped += 1;
    const id = safeId(event.eventId, 'EVENT_ID');
    if (seen.has(id)) throw new DailyMovementError('DUPLICATE_EVENT_ID');
    seen.add(id);
    if (!STATUS.has(event.status)) {
      throw new DailyMovementError('INVALID_POSTING_STATUS');
    }
    if (event.status === 'VOIDED') {
      ignoredVoided += 1;
      continue;
    }
    posted += 1;
    if (!KINDS.has(event.kind)) {
      throw new DailyMovementError('INVALID_MOVEMENT_KIND');
    }
    const qty = integer(event.quantityMilli, 'QUANTITY_MILLI', true);
    const amount = integer(event.netAmountFils, 'NET_AMOUNT_FILS');
    const tax = integer(event.taxFils, 'TAX_FILS');
    const cost = integer(event.costFils, 'COST_FILS');
    if ((event.kind === 'purchase_return' || event.kind === 'sale_return') &&
        (typeof event.referenceEventId !== 'string' ||
         !ID.test(event.referenceEventId))) {
      throw new DailyMovementError('RETURN_REFERENCE_REQUIRED');
    }
    if (event.kind === 'stock_in' || event.kind === 'stock_out') {
      if (amount !== 0 || tax !== 0 || cost !== 0) {
        throw new DailyMovementError('STOCK_EVENT_MONEY_NOT_SUPPORTED');
      }
    } else if (!['sale', 'sale_return'].includes(event.kind) && cost !== 0) {
      throw new DailyMovementError('PURCHASE_SALES_COST_NOT_SUPPORTED');
    }

    const key = day + '\u0000' + itemCode;
    let item = grouped.get(key);
    if (!item) {
      item = {day, item_code: itemCode};
      for (const column of NUMERIC) item[column] = 0;
      grouped.set(key, item);
    }
    const purchaseSign = event.kind === 'purchase' ? 1 :
      event.kind === 'purchase_return' ? -1 : 0;
    const saleSign = event.kind === 'sale' ? 1 :
      event.kind === 'sale_return' ? -1 : 0;
    const stockSign = purchaseSign - saleSign +
      (event.kind === 'stock_in' ? 1 : event.kind === 'stock_out' ? -1 : 0);
    item.purchase_qty_milli = add(item.purchase_qty_milli, purchaseSign * qty);
    item.sales_qty_milli = add(item.sales_qty_milli, saleSign * qty);
    item.stock_delta_qty_milli = add(item.stock_delta_qty_milli, stockSign * qty);
    item.purchases_before_tax_fils = add(
      item.purchases_before_tax_fils, purchaseSign * amount);
    item.purchase_tax_fils = add(item.purchase_tax_fils, purchaseSign * tax);
    item.sales_before_tax_fils = add(
      item.sales_before_tax_fils, saleSign * amount);
    item.sales_tax_fils = add(item.sales_tax_fils, saleSign * tax);
    item.sales_cost_fils = add(item.sales_cost_fils, saleSign * cost);
    // This is only independent ERP event accounting. NOT vendor net profit.
    item.sales_profit_fils = add(
      item.sales_profit_fils, saleSign * (amount - cost));
  }
  const rows = [...grouped.values()].sort((a, b) =>
    a.day < b.day ? -1 : a.day > b.day ? 1 :
      a.item_code.localeCompare(b.item_code, 'en'));
  return Object.freeze({
    report: 'INDEPENDENT_ERP_DAILY_ITEM_MOVEMENT_V1',
    referenceStatus: 'NOT_MATCHED_WITH_TRUSTSOFT',
    formulaStatus: 'INDEPENDENT_EVENT_RULES_ONLY',
    scope,
    columns: COLUMNS,
    sourceScopedEventCount: sourceScoped,
    postedEventCount: posted,
    ignoredVoidedEventCount: ignoredVoided,
    rows: Object.freeze(rows.map(row => Object.freeze(row))),
  });
}

function csvCell(value) {
  const str = typeof value === 'number' ? String(value) : String(value ?? '');
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new DailyMovementError('INVALID_CSV_INTEGER');
  }
  const safe = /^[\s]*[=+@-]/.test(str) && typeof value !== 'number'
    ? "'" + str : str;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function independentDailyMovementCsv(report) {
  if (!report || report.report !== 'INDEPENDENT_ERP_DAILY_ITEM_MOVEMENT_V1' ||
      !Array.isArray(report.rows) || report.columns !== COLUMNS) {
    throw new DailyMovementError('UNSUPPORTED_DAILY_REPORT');
  }
  return [COLUMNS, ...report.rows.map(row => COLUMNS.map(k => row[k]))]
    .map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
