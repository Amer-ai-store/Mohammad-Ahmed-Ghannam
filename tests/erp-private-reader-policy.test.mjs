import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifiedReaderIdentity, sanitizedReaderStatus,
} from '../api/_erp_reader_policy.mjs';

test('approved independent report role and database are accepted', () => {
  assert.equal(verifiedReaderIdentity([
    { connected_role: 'erp_reports_readonly', connected_db: 'neondb' },
  ]), true);
});
test('privileged owner, wrong database and missing identity fail closed', () => {
  for (const rows of [
    [{ connected_role: 'neondb_owner', connected_db: 'neondb' }],
    [{ connected_role: 'erp_reports_readonly', connected_db: 'Jawafa_DB' }],
    [], null, [{}],
  ]) assert.equal(verifiedReaderIdentity(rows), false);
});
test('success response does not return database rows or credentials', () => {
  const x = sanitizedReaderStatus(true);
  assert.deepEqual(x, {
    status: 'HEALTHY', source: 'neon_independent_reports',
    read_only_role: true, jawafa_db_connected: false,
  });
  assert.equal(Object.keys(x).length, 4);
  assert.ok(Object.isFrozen(x));
});
test('fail-closed error response exposes no raw exception or secrets', () => {
  assert.deepEqual(sanitizedReaderStatus(false), {
    status: 'UNAVAILABLE', source: 'neon_independent_reports',
    read_only_role: false, jawafa_db_connected: false,
  });
});
