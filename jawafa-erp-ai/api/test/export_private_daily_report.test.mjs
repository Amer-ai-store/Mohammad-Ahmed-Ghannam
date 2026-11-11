import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, readFile, writeFile, stat, symlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {privateExport, PrivateExportError} from '../tools/export_private_daily_report.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const cli = fileURLToPath(new URL('../tools/export_private_daily_report.mjs', import.meta.url));
function syntheticSnapshot() {
  return {
    schemaVersion: 1, sourceKind: 'NEW_ERP_EVENT_EXPORT_READ_ONLY',
    provenance: {
      captureRef: 'SYNTHETIC-CAPTURE-001',
      authorizationRef: 'SYNTHETIC-APPROVAL-001',
      tenantId: 'TENANT-A', branchId: 'BR-A',
      fromDate: '2026-10-01', toDate: '2026-10-31',
    },
    events: [
      {eventId: 'EV-1', tenantId: 'TENANT-A', branchId: 'BR-A',
       date: '2026-10-01', itemCode: 'SKU-A', familyCode: 'FAM-1',
       supplierCode: 'SUP-1', kind: 'sale', status: 'POSTED',
       quantityMilli: 1000, netAmountFils: 250, taxFils: 40, costFils: 175},
      {eventId: 'EV-2', tenantId: 'TENANT-A', branchId: 'BR-A',
       date: '2026-10-01', itemCode: 'SKU-A', familyCode: 'FAM-1',
       supplierCode: 'SUP-1', kind: 'sale', status: 'VOIDED',
       quantityMilli: 1000, netAmountFils: 250, taxFils: 40, costFils: 175},
      {eventId: 'EV-3', tenantId: 'TENANT-B', branchId: 'BR-A',
       date: '2026-10-01', itemCode: 'PRIVATE-NOT-TO-LEAK',
       kind: 'sale', status: 'POSTED',
       quantityMilli: -2, netAmountFils: NaN, taxFils: -1, costFils: -1},
    ],
  };
}

async function fixture(t, custom) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jawafa-erp-private-'));
  // node:test teardown cleanup using the built-in fs temp cleanup API.
  t.after(async () => {
    const {rm} = await import('node:fs/promises');
    await rm(root, {recursive: true, force: true});
  });
  const source = path.join(root, 'events.json');
  const csv = path.join(root, 'new-erp.csv');
  const manifest = path.join(root, 'new-erp-manifest.json');
  const snapshot = custom ?? syntheticSnapshot();
  const bytes = Buffer.from(JSON.stringify(snapshot));
  await writeFile(source, bytes, {mode: 0o600});
  const options = {
    '--events-json': source,
    '--expected-source-sha256': sha(bytes),
    '--approved-private-dir': root,
    '--output-csv': csv,
    '--output-manifest': manifest,
    attested: true,
  };
  return {root, source, csv, manifest, options, snapshot};
}
async function rejected(promise, code) {
  await assert.rejects(promise, e =>
    e instanceof PrivateExportError && e.code === code);
}

test('creates private candidate and manifest with exact hash, not financial values in result', async t => {
  const f = await fixture(t);
  const original = await readFile(f.source);
  const outcome = await privateExport(f.options);
  assert.equal(outcome.sourceScopedEventCount, 2);
  assert.equal(outcome.postedEventCount, 1);
  assert.equal(outcome.ignoredVoidedEventCount, 1);
  assert.equal(outcome.outputRowCount, 1);
  assert.equal(outcome.comparisonWithTrustSoftPerformed, false);
  assert.equal(outcome.trustsoftFunctionalParityPercent, null);
  assert.equal(outcome.sourceTenantAndBranchIndependentlyAuthenticated, false);
  assert.equal(JSON.stringify(outcome).includes('SKU-A'), false);
  const csv = await readFile(f.csv);
  assert.equal(sha(csv), outcome.outputSha256);
  assert.match(csv.toString(), /"2026-10-01","SKU-A"/);
  assert.match(csv.toString(), /"250","40","175","75"/);
  assert.equal((await stat(f.csv)).mode & 0o777, process.platform === 'win32' ? 
    (await stat(f.csv)).mode & 0o777 : 0o600);
  const manifest = JSON.parse(await readFile(f.manifest, 'utf8'));
  assert.equal(manifest.outputSha256, outcome.outputSha256);
  assert.deepEqual(await readFile(f.source), original);
});

test('no attestation gives no output', async t => {
  const f = await fixture(t);
  await rejected(privateExport({...f.options, attested: false}),
    'PRIVATE_OUTPUT_ATTESTATION_REQUIRED');
  await assert.rejects(readFile(f.csv), {code: 'ENOENT'});
});

test('input hash mismatch fails closed', async t => {
  const f = await fixture(t);
  await rejected(privateExport({...f.options,
    '--expected-source-sha256': '0'.repeat(64)}), 'SOURCE_SHA256_MISMATCH');
  await assert.rejects(readFile(f.csv), {code: 'ENOENT'});
});

test('source must stay within approved private directory', async t => {
  const f = await fixture(t);
  const outside = path.join(os.tmpdir(), 'not-approved-erp.json');
  // The direct helper exposes fs ENOENT, while the CLI masks path details.
  await assert.rejects(
    privateExport({...f.options, '--events-json': outside}),
    {code: 'ENOENT'},
  );
  const nestedRoot = path.join(f.root, 'sub');
  const {mkdir} = await import('node:fs/promises');
  await mkdir(nestedRoot);
  const moved = path.join(nestedRoot, 'events.json');
  await writeFile(moved, await readFile(f.source));
  await rejected(privateExport({...f.options, '--events-json': moved}),
    'SOURCE_OUTSIDE_PRIVATE_ROOT');
});

test('invalid source declaration and weak capture ref denied', async t => {
  const bad = syntheticSnapshot();
  bad.sourceKind = 'TRUSTSOFT_REPORT';
  const f = await fixture(t, bad);
  await rejected(privateExport(f.options), 'INVALID_NEW_ERP_EVENT_SOURCE_CONTRACT');
  const b2 = syntheticSnapshot();
  b2.provenance.captureRef = 'x';
  const f2 = await fixture(t, b2);
  await rejected(privateExport(f2.options), 'INVALID_ATTESTATION_REFERENCE');
});

test('duplicates in scoped posted events are rejected', async t => {
  const s = syntheticSnapshot();
  s.events.push({...s.events[0], netAmountFils: 999});
  const f = await fixture(t, s);
  await assert.rejects(privateExport(f.options), /DUPLICATE_EVENT_ID/);
  await assert.rejects(readFile(f.csv), {code: 'ENOENT'});
});

test('missing posting status is not treated as posted', async t => {
  const s = syntheticSnapshot();
  s.events[0].status = 'DRAFT';
  const f = await fixture(t, s);
  await assert.rejects(privateExport(f.options), /INVALID_POSTING_STATUS/);
});

test('output may never overwrite an existing report', async t => {
  const f = await fixture(t);
  await privateExport(f.options);
  const beforeCsv = await readFile(f.csv);
  const beforeManifest = await readFile(f.manifest);
  await rejected(privateExport(f.options), 'OUTPUT_WRITE_FAILED_OR_ALREADY_EXISTS');
  assert.deepEqual(await readFile(f.csv), beforeCsv);
  assert.deepEqual(await readFile(f.manifest), beforeManifest);
});

test('manifest collision rolls back only the newly created CSV', async t => {
  const f = await fixture(t);
  await writeFile(f.manifest, 'PREEXISTING-DO-NOT-CHANGE');
  await rejected(privateExport(f.options), 'OUTPUT_WRITE_FAILED_OR_ALREADY_EXISTS');
  await assert.rejects(readFile(f.csv), {code: 'ENOENT'});
  assert.equal(await readFile(f.manifest, 'utf8'), 'PREEXISTING-DO-NOT-CHANGE');
});

test('output path outside approved directory is rejected', async t => {
  const f = await fixture(t);
  const elsewhere = path.resolve(f.root, '..', 'not-allowed.csv');
  await rejected(privateExport({...f.options, '--output-csv': elsewhere}),
    'OUTPUT_OUTSIDE_PRIVATE_ROOT');
});

test('CLI emits only count/hash metadata and never item or amount', async t => {
  const f = await fixture(t);
  const args = [
    cli, '--events-json', f.source,
    '--expected-source-sha256', f.options['--expected-source-sha256'],
    '--approved-private-dir', f.root,
    '--output-csv', f.csv, '--output-manifest', f.manifest,
    '--attest-private-output',
  ];
  const p = spawnSync(process.execPath, args, {encoding: 'utf8'});
  assert.equal(p.status, 0, p.stderr + p.stdout);
  assert.equal(JSON.parse(p.stdout).status, 'CREATED_PRIVATE_CANDIDATE');
  assert.ok(!p.stdout.includes('SKU-A'));
  assert.ok(!p.stdout.includes('250'));
  assert.ok(!p.stdout.includes('PRIVATE-NOT-TO-LEAK'));
});

test('malformed JSON is rejected without making output', async t => {
  const f = await fixture(t);
  const invalid = Buffer.from('{"schemaVersion":1, invalid}', 'utf8');
  await writeFile(f.source, invalid);
  await rejected(privateExport({...f.options,
    '--expected-source-sha256': sha(invalid)}), 'SOURCE_NOT_VALID_UTF8_JSON');
  await assert.rejects(readFile(f.csv), {code: 'ENOENT'});
});

test('zero valid events yields CSV header only without manufacturing totals', async t => {
  const snapshot = syntheticSnapshot();
  snapshot.events = [];
  const f = await fixture(t, snapshot);
  const result = await privateExport(f.options);
  assert.equal(result.outputRowCount, 0);
  assert.equal((await readFile(f.csv, 'utf8')).trim().split('\n').length, 1);
});
