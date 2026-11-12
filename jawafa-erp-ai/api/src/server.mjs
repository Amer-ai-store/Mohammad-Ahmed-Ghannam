import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { createOidcVerifier } from './auth.mjs';
import { independentDailyMovement } from './independent_daily_movement.mjs';
import { historicalComparisonWindows, compareIndependentErpYears } from './daily_yoy_comparison.mjs';

const { Pool } = pg;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_FINANCE_ROLES = new Set(['accountant', 'supervisor', 'auditor']);
const ERP_CODE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_REPORT_EVENT_ROWS = 50000;

function validDay(value) {
  if (typeof value !== 'string' || !ISO_DAY.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0,10) === value;
}

function exactFilsOrMilli(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) {
    throw new Error('UNSAFE_LEDGER_VALUE');
  }
  const number = BigInt(value);
  if (number > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('UNSAFE_LEDGER_VALUE');
  }
  return Number(number);
}


function reply(res, status, data, requestId, origin) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store, private',
    'x-content-type-options': 'nosniff',
    'x-request-id': requestId,
    ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
  });
  res.end(JSON.stringify(data));
}

/** Read-only JAWAFA ERP API: never expose pg connection to Flutter clients. */
export function createServer({ pool, verifyToken, allowedOrigins = [] }) {
  if (!pool || typeof verifyToken !== 'function') {
    throw new Error('DATABASE_POOL_AND_VERIFIER_REQUIRED');
  }
  const origins = new Set(allowedOrigins);
  return http.createServer(async (req, res) => {
    const requestId = randomUUID();
    let db;
    let inTransaction = false;
    const send = (status, body, origin) => reply(res, status, body, requestId, origin);
    try {
      const origin = req.headers.origin;
      const cors = typeof origin === 'string' && origins.has(origin) ? origin : undefined;
      if (origin && !cors) return send(403, { error: 'ORIGIN_NOT_ALLOWED' });
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'access-control-allow-origin': cors ?? 'null',
          'access-control-allow-methods': 'GET, OPTIONS',
          'access-control-allow-headers': 'authorization, x-erp-tenant-id, x-erp-branch-id',
          'cache-control': 'no-store',
          'x-request-id': requestId,
          vary: 'Origin',
        });
        res.end();
        return;
      }
      if (req.method !== 'GET') return send(405, { error: 'METHOD_NOT_ALLOWED' }, cors);
      const requestUrl = new URL(req.url ?? '/', 'http://localhost');
      const pathname = requestUrl.pathname;
      if (pathname === '/health/live') {
        return send(200, { status: 'up', service: 'jawafa-erp-ai-api' }, cors);
      }
      if (pathname.length > 200) return send(404, { error: 'NOT_FOUND' }, cors);
      const one = pathname.match(/^\/v1\/cheques\/([0-9a-f-]{36})$/i);
      const events = pathname.match(/^\/v1\/cheques\/([0-9a-f-]{36})\/events$/i);
      const isList = pathname === '/v1/cheques';
      const isJournal = pathname === '/v1/journals/draft-balances';
      const isPurchases = pathname === '/v1/purchase-invoices';
      const isSuppliers = pathname === '/v1/suppliers';
      const isPersonnel = pathname === '/v1/personnel';
      const isSettings = pathname === '/v1/settings';
      const isPermissions = pathname === '/v1/permissions';
      const isMovementReport = pathname === '/v1/reports/daily-movements';
      const isHistoricalComparison = pathname === '/v1/reports/historical-daily-compare';
      if (!one && !events && !isList && !isJournal && !isPurchases &&
          !isSuppliers && !isPersonnel && !isSettings && !isPermissions &&
          !isMovementReport && !isHistoricalComparison) {
        return send(404, { error: 'NOT_FOUND' }, cors);
      }
      if ((one && !UUID.test(one[1])) || (events && !UUID.test(events[1]))) {
        return send(400, { error: 'INVALID_CHEQUE_ID' }, cors);
      }
      let subject;
      try {
        ({ subject } = await verifyToken(req.headers.authorization));
      } catch {
        return send(401, { error: 'UNAUTHENTICATED' }, cors);
      }
      const tenantId = req.headers['x-erp-tenant-id'];
      if (typeof tenantId !== 'string' || !UUID.test(tenantId)) {
        return send(400, { error: 'VALID_TENANT_ID_REQUIRED' }, cors);
      }
      let reportParams = null;
      if (isMovementReport || isHistoricalComparison) {
        const branchId = req.headers['x-erp-branch-id'];
        const allowed = new Set(isHistoricalComparison
          ? ['date', 'item', 'family', 'supplier']
          : ['from', 'to', 'item', 'family', 'supplier']);
        if (typeof branchId !== 'string' || !ERP_CODE.test(branchId) ||
            [...requestUrl.searchParams.keys()].some(k => !allowed.has(k)) ||
            [...allowed].some(k => requestUrl.searchParams.getAll(k).length > 1)) {
          return send(400, {error: 'INVALID_REPORT_SCOPE'}, cors);
        }
        let fromDate = null;
        let toDate = null;
        let comparisonDay = null;
        let comparisonWindows = null;
        if (isHistoricalComparison) {
          comparisonDay = requestUrl.searchParams.get('date');
          try {
            comparisonWindows = historicalComparisonWindows(comparisonDay);
          } catch {
            return send(400, {error: 'INVALID_HISTORICAL_COMPARISON_DATE'}, cors);
          }
        } else {
          fromDate = requestUrl.searchParams.get('from');
          toDate = requestUrl.searchParams.get('to');
          if (!validDay(fromDate) || !validDay(toDate) ||
              fromDate > toDate ||
              Date.parse(toDate) - Date.parse(fromDate) > 30 * 86400000) {
            return send(400, {error: 'INVALID_REPORT_PERIOD_MAX_31_DAYS'}, cors);
          }
        }
        const codeFilter = (name) => {
          const value = requestUrl.searchParams.get(name);
          return value === null ? null : ERP_CODE.test(value) ? value : false;
        };
        const itemCode = codeFilter('item');
        const familyCode = codeFilter('family');
        const supplierCode = codeFilter('supplier');
        if ([itemCode, familyCode, supplierCode].includes(false)) {
          return send(400, {error: 'INVALID_REPORT_FILTER'}, cors);
        }
        reportParams = {
          branchId, fromDate, toDate, comparisonDay, comparisonWindows,
          itemCode, familyCode, supplierCode,
        };
      }
      db = await pool.connect();
      await db.query('BEGIN READ ONLY');
      inTransaction = true;
      await db.query("SELECT set_config('erp.tenant_id', $1, true)", [tenantId]);
      // The company ID is untrusted. The authenticated OIDC subject must
      // be an active member of THAT company in the NEW ERP database.
      const membership = await db.query(
        `SELECT erp_role FROM erp.api_memberships
          WHERE tenant_id = $1 AND oidc_subject = $2 AND is_active = true`,
        [tenantId, subject],
      );
      if (membership.rowCount !== 1) {
        return send(403, { error: 'TENANT_MEMBERSHIP_DENIED' }, cors);
      }
      // HR/settings permission checks are deliberately separate from finance.
      // A role name by itself does NOT grant access. A tenant-specific allow
      // row must exist, otherwise access fails closed.
      const resource = isPersonnel ? 'personnel' :
        isSettings ? 'settings' : isPermissions ? 'permissions' : null;
      if (resource) {
        const granted = await db.query(
          `SELECT 1 FROM erp.role_permissions
            WHERE tenant_id = $1 AND erp_role = $2 AND resource = $3
              AND action = 'read' AND allowed = true`,
          [tenantId, membership.rows[0].erp_role, resource],
        );
        if (granted.rowCount !== 1) {
          return send(403, { error: 'PERMISSION_DENIED' }, cors);
        }
      } else if (!ALLOWED_FINANCE_ROLES.has(membership.rows[0].erp_role)) {
        return send(403, { error: 'PERMISSION_DENIED' }, cors);
      }
      if (isMovementReport || isHistoricalComparison) {
        const branchAccess = await db.query(
          `SELECT 1 FROM erp.current_report_branch_access
           WHERE tenant_id=$1 AND oidc_subject=$2 AND branch_id=$3
             AND allowed=true`,
          [tenantId, subject, reportParams.branchId],
        );
        if (branchAccess.rowCount !== 1) {
          return send(403, {error:'REPORT_BRANCH_ACCESS_DENIED'}, cors);
        }
        // Three exact same-month windows avoid fetching unrelated years or
        // months; both routes use parameterized, tenant-scoped read-only SQL.
        const dateClause = isHistoricalComparison
          ? `((event_date BETWEEN $3::date AND $4::date) OR
              (event_date BETWEEN $5::date AND $6::date) OR
              (event_date BETWEEN $7::date AND $8::date))`
          : `(event_date >= $3::date AND event_date <= $4::date)`;
        const filterStart = isHistoricalComparison ? 9 : 5;
        const readArgs = [
          tenantId, reportParams.branchId,
          ...(isHistoricalComparison
            ? reportParams.comparisonWindows.flatMap(w => [w.monthStart, w.day])
            : [reportParams.fromDate, reportParams.toDate]),
          reportParams.itemCode, reportParams.familyCode, reportParams.supplierCode,
        ];
        const read = await db.query(
          `SELECT event_id, event_date::text, item_code, family_code,
                  supplier_code, movement_kind, posting_status,
                  quantity_milli::text, net_amount_fils::text,
                  tax_fils::text, cost_fils::text, reference_event_id
             FROM erp.item_movement_events
            WHERE tenant_id=$1 AND branch_id=$2
              AND ${dateClause}
              AND (${filterStart}::text IS NULL OR item_code=${filterStart})
              AND (${filterStart + 1}::text IS NULL OR family_code=${filterStart + 1})
              AND (${filterStart + 2}::text IS NULL OR supplier_code=${filterStart + 2})
            ORDER BY event_date, event_id LIMIT 50001`,
          readArgs,
        );
        if (read.rowCount > MAX_REPORT_EVENT_ROWS) {
          return send(422, {error: 'REPORT_EVENT_LIMIT_EXCEEDED'}, cors);
        }
        const scopedEvents = read.rows.map(row => ({
          eventId: row.event_id,
          tenantId,
          branchId: reportParams.branchId,
          date: row.event_date,
          itemCode: row.item_code,
          familyCode: row.family_code,
          supplierCode: row.supplier_code,
          kind: row.movement_kind,
          status: row.posting_status,
          quantityMilli: exactFilsOrMilli(row.quantity_milli),
          netAmountFils: exactFilsOrMilli(row.net_amount_fils),
          taxFils: exactFilsOrMilli(row.tax_fils),
          costFils: exactFilsOrMilli(row.cost_fils),
          ...(row.reference_event_id
            ? {referenceEventId: row.reference_event_id} : {}),
        }));
        if (isHistoricalComparison) {
          return send(200, compareIndependentErpYears({
            events: scopedEvents,
            day: reportParams.comparisonDay,
            tenantId, branchId: reportParams.branchId,
            ...(reportParams.itemCode ? {itemCode: reportParams.itemCode} : {}),
            ...(reportParams.familyCode ? {familyCode: reportParams.familyCode} : {}),
            ...(reportParams.supplierCode ? {supplierCode: reportParams.supplierCode} : {}),
          }), cors);
        }
        const projected = independentDailyMovement({
          events: scopedEvents,
          tenantId, branchId: reportParams.branchId,
          fromDate: reportParams.fromDate, toDate: reportParams.toDate,
          ...(reportParams.itemCode ? {itemCode:reportParams.itemCode} : {}),
          ...(reportParams.familyCode ? {familyCode:reportParams.familyCode} : {}),
          ...(reportParams.supplierCode ? {supplierCode:reportParams.supplierCode} : {}),
        });
        return send(200, {
          report: projected.report,
          referenceStatus: projected.referenceStatus,
          evidenceStatus: 'ERP_EVENTS_ONLY_NOT_TRUSTSOFT_PARITY',
          sourceScopedEventCount: projected.sourceScopedEventCount,
          postedEventCount: projected.postedEventCount,
          ignoredVoidedEventCount: projected.ignoredVoidedEventCount,
          items: projected.rows,
          functionalParityPercent: null,
        }, cors);
      }
      let result;
      if (isList) {
        result = await db.query(
          `SELECT cheque_id, reference_no, direction, amount_fils::text,
                  current_state, last_event_time, event_count
             FROM erp.cheque_current_state
            WHERE tenant_id = $1
            ORDER BY reference_no, cheque_id LIMIT 100`,
          [tenantId],
        );
      } else if (one) {
        result = await db.query(
          `SELECT cheque_id, reference_no, direction, amount_fils::text,
                  current_state, last_event_time, event_count
             FROM erp.cheque_current_state
            WHERE tenant_id = $1 AND cheque_id = $2`,
          [tenantId, one[1]],
        );
      } else if (events) {
        result = await db.query(
          `SELECT event_id, state_before, state_after, event_time, recorded_at
             FROM erp.cheque_events
            WHERE tenant_id = $1 AND cheque_id = $2
            ORDER BY event_time, event_id LIMIT 100`,
          [tenantId, events[1]],
        );
      } else if (isPurchases) {
        result = await db.query(
          `SELECT purchase_invoice_id, supplier_id, original_invoice_number,
                  invoice_number_key, total_fils::text, currency_code, line_count,
                  net_fils::text, tax_fils::text, lines_gross_fils::text,
                  draft_total_matches_lines
             FROM erp.purchase_invoice_draft_checks
            WHERE tenant_id = $1 ORDER BY invoice_number_key LIMIT 100`,
          [tenantId],
        );
      } else if (isSuppliers) {
        result = await db.query(
          `SELECT supplier_id, supplier_code, legal_name
             FROM erp.suppliers WHERE tenant_id = $1
            ORDER BY supplier_code LIMIT 100`,
          [tenantId],
        );
      } else if (isPersonnel) {
        // Only minimal directory fields, not payroll, ID numbers or contacts.
        result = await db.query(
          `SELECT employee_id, employee_code, display_name, department_code,
                  employment_status FROM erp.personnel_directory
             WHERE tenant_id = $1 ORDER BY employee_code LIMIT 100`,
          [tenantId],
        );
      } else if (isSettings) {
        // Explicit allowlist in the DB forbids credentials as setting keys.
        result = await db.query(
          `SELECT setting_key, setting_value, revision_no
             FROM erp.current_system_settings
            WHERE tenant_id = $1 ORDER BY setting_key LIMIT 100`,
          [tenantId],
        );
      } else if (isPermissions) {
        result = await db.query(
          `SELECT erp_role, resource, action, allowed
             FROM erp.role_permissions
            WHERE tenant_id = $1 ORDER BY erp_role, resource LIMIT 100`,
          [tenantId],
        );
      } else {
        result = await db.query(
          `SELECT journal_id, journal_ref, line_count,
                  debit_total_fils::text, credit_total_fils::text,
                  balanced_for_review
             FROM erp.journal_draft_balance
            WHERE tenant_id = $1 ORDER BY journal_ref LIMIT 100`,
          [tenantId],
        );
      }
      if (one && result.rowCount === 0) {
        return send(404, { error: 'NOT_FOUND' }, cors);
      }
      send(200, one ? { cheque: result.rows[0] } : { items: result.rows }, cors);
    } catch {
      // Fail closed: neither raw SQL errors, passwords nor identities leak.
      if (!res.headersSent) send(503, { error: 'SERVICE_UNAVAILABLE' });
    } finally {
      if (db) {
        if (inTransaction) {
          try { await db.query('ROLLBACK'); } catch { /* broken connection */ }
        }
        db.release();
      }
    }
  });
}

export function buildRuntimeConfig(env = process.env) {
  const localTest = env.NODE_ENV === 'test' && env.ERP_ALLOW_LOCAL_PLAINTEXT_DB === '1';
  if (!env.ERP_DATABASE_URL || !env.ERP_OIDC_ISSUER ||
      !env.ERP_OIDC_AUDIENCE || !env.ERP_OIDC_JWKS_URL) {
    throw new Error('ERP_API_SECRETS_OR_OIDC_CONFIGURATION_MISSING');
  }
  const dbUrl = new URL(env.ERP_DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(dbUrl.protocol)) {
    throw new Error('ONLY_POSTGRESQL_DATABASE_IS_SUPPORTED');
  }
  if (localTest && !['127.0.0.1', 'localhost'].includes(dbUrl.hostname)) {
    throw new Error('PLAINTEXT_DB_ONLY_FOR_LOOPBACK_CI');
  }
  const pool = new Pool({
    connectionString: env.ERP_DATABASE_URL,
    ssl: localTest ? false : { rejectUnauthorized: true },
    max: 5, idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 3000, statement_timeout: 5000,
  });
  const verifier = createOidcVerifier({
    issuer: env.ERP_OIDC_ISSUER, audience: env.ERP_OIDC_AUDIENCE,
    jwksUrl: env.ERP_OIDC_JWKS_URL, allowLocalHttpJwks: localTest,
  });
  const allowedOrigins = (env.ERP_CORS_ALLOWED_ORIGINS ?? '')
    .split(',').map((x) => x.trim()).filter(Boolean);
  if (allowedOrigins.some((x) => !/^https:\/\//.test(x) &&
      !(localTest && /^http:\/\/localhost:\d+$/.test(x)))) {
    throw new Error('CORS_ORIGINS_HTTPS_REQUIRED');
  }
  return { pool, verifier, allowedOrigins };
}

export async function startFromEnvironment(env = process.env) {
  const { pool, verifier, allowedOrigins } = buildRuntimeConfig(env);
  const port = Number(env.PORT ?? '8080');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('INVALID_LISTEN_PORT');
  }
  const host = env.ERP_BIND_HOST ?? '127.0.0.1';
  const server = createServer({ pool, verifyToken: verifier, allowedOrigins });
  server.listen(port, host);
  return { server, pool };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startFromEnvironment().catch(() => {
    process.stderr.write('ERP_API_STARTUP_FAILED\n');
    process.exitCode = 1;
  });
}
