// Fail-closed identity contract. No rows from ERP business tables are returned.
export const EXPECTED_ROLE = 'erp_reports_readonly';
export const EXPECTED_DB = 'neondb';
export function verifiedReaderIdentity(rows) {
  return Array.isArray(rows) && rows.length === 1 &&
    rows[0]?.connected_role === EXPECTED_ROLE &&
    rows[0]?.connected_db === EXPECTED_DB;
}
export function sanitizedReaderStatus(ok) {
  return Object.freeze({
    status: ok ? 'HEALTHY' : 'UNAVAILABLE',
    source: 'neon_independent_reports',
    read_only_role: Boolean(ok),
    jawafa_db_connected: false,
  });
}
