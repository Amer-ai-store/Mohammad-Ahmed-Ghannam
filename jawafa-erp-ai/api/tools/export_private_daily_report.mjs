#!/usr/bin/env node
/**
 * PRIVATE ONLY: immutable, hash-bound independent ERP posted-event report.
 *
 * Requires a read-only JSON snapshot of authorized NEW-ERP event records.
 * It never accesses Jawafa_DB, TrustSoft, a bank, or any network endpoint.
 * Its output is a candidate ONLY; not certified TrustSoft functional parity.
 *
 * Source JSON must have:
 * {schemaVersion:1, sourceKind:"NEW_ERP_EVENT_EXPORT_READ_ONLY",
 *  provenance:{captureRef, authorizationRef, tenantId, branchId,
 *              fromDate, toDate}, events:[...]}
 *
 * Outputs are direct children of an explicitly approved private directory.
 * No event identifiers, item codes or money are emitted to stdout/stderr.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {
  independentDailyMovement, independentDailyMovementCsv,
} from '../src/independent_daily_movement.mjs';

const HEX = /^[0-9a-f]{64}$/;
const REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,119}$/;
const MAX_SOURCE_BYTES = 64 * 1024 * 1024;

export class PrivateExportError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
    this.name = 'PrivateExportError';
  }
}
const deny = code => { throw new PrivateExportError(code); };
const sha256 = data => createHash('sha256').update(data).digest('hex');

function argumentMap(argv) {
  const result = {};
  const keys = new Set([
    '--events-json', '--expected-source-sha256', '--approved-private-dir',
    '--output-csv', '--output-manifest',
  ]);
  let attested = false;
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    if (name === '--attest-private-output') {
      if (attested) deny('DUPLICATE_FLAG');
      attested = true;
      continue;
    }
    if (!keys.has(name) || Object.hasOwn(result, name)) deny('INVALID_ARGUMENT');
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) {
      deny('MISSING_ARGUMENT_VALUE');
    }
    result[name] = argv[++i];
  }
  if (!attested) deny('PRIVATE_OUTPUT_ATTESTATION_REQUIRED');
  for (const key of keys) {
    if (!result[key]) deny('MISSING_REQUIRED_ARGUMENT');
  }
  result.attested = attested;
  return result;
}
function assertRef(value) {
  if (typeof value !== 'string' || !REF.test(value)) {
    deny('INVALID_ATTESTATION_REFERENCE');
  }
  return value;
}
async function getPaths(options) {
  const rootInput = path.resolve(options['--approved-private-dir']);
  const root = await fs.realpath(rootInput);
  if (root !== rootInput) deny('APPROVED_ROOT_MUST_NOT_BE_SYMLINK');
  const input = path.resolve(options['--events-json']);
  const inputStat = await fs.lstat(input);
  if (!inputStat.isFile() || inputStat.isSymbolicLink()) {
    deny('SOURCE_MUST_BE_REGULAR_FILE');
  }
  if (inputStat.size > MAX_SOURCE_BYTES || inputStat.size < 1) {
    deny('SOURCE_SIZE_NOT_ACCEPTED');
  }
  if (await fs.realpath(input) !== input) deny('SOURCE_SYMLINK_DENIED');
  if (path.dirname(input) !== root) deny('SOURCE_OUTSIDE_PRIVATE_ROOT');
  const csv = path.resolve(options['--output-csv']);
  const manifest = path.resolve(options['--output-manifest']);
  if (path.dirname(csv) !== root || path.dirname(manifest) !== root) {
    deny('OUTPUT_OUTSIDE_PRIVATE_ROOT');
  }
  if (!csv.endsWith('.csv') || !manifest.endsWith('.json') ||
      !input.endsWith('.json') ||
      new Set([input, csv, manifest]).size !== 3) {
    deny('PATH_EXTENSION_OR_COLLISION');
  }
  return {input, csv, manifest};
}
function validatePayload(json) {
  if (!json || json.schemaVersion !== 1 ||
      json.sourceKind !== 'NEW_ERP_EVENT_EXPORT_READ_ONLY' ||
      !Array.isArray(json.events) ||
      !json.provenance || typeof json.provenance !== 'object') {
    deny('INVALID_NEW_ERP_EVENT_SOURCE_CONTRACT');
  }
  const p = json.provenance;
  assertRef(p.captureRef);
  assertRef(p.authorizationRef);
  // The source/operator assertion is metadata, not independent auth.
  return {
    tenantId: p.tenantId, branchId: p.branchId,
    fromDate: p.fromDate, toDate: p.toDate,
  };
}

export async function privateExport(options) {
  if (options.attested !== true) deny('PRIVATE_OUTPUT_ATTESTATION_REQUIRED');
  const expected = options['--expected-source-sha256'];
  if (typeof expected !== 'string' || !HEX.test(expected)) {
    deny('EXPECTED_SHA256_REQUIRED');
  }
  const {input, csv, manifest} = await getPaths(options);
  const source = await fs.readFile(input);
  if (sha256(source) !== expected) deny('SOURCE_SHA256_MISMATCH');
  let parsed;
  try {
    // Fatal decoder rejects invalid UTF-8 rather than replacing bytes.
    parsed = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(source));
  } catch {
    deny('SOURCE_NOT_VALID_UTF8_JSON');
  }
  const scope = validatePayload(parsed);
  const report = independentDailyMovement({
    events: parsed.events, ...scope,
  });
  const csvContent = independentDailyMovementCsv(report);
  const csvBytes = Buffer.from(csvContent, 'utf-8');
  const resultManifest = {
    schemaVersion: 1,
    kind: 'PRIVATE_NEW_ERP_DAILY_MOVEMENT_CANDIDATE',
    referenceProduct: 'NONE_NEW_ERP_ONLY',
    sourceSha256: expected,
    outputSha256: sha256(csvBytes),
    captureRef: parsed.provenance.captureRef,
    authorizationRef: parsed.provenance.authorizationRef,
    sourceScopedEventCount: report.sourceScopedEventCount,
    postedEventCount: report.postedEventCount,
    ignoredVoidedEventCount: report.ignoredVoidedEventCount,
    outputRowCount: report.rows.length,
    outputColumnCount: report.columns.length,
    calculation: 'INDEPENDENT_POSTED_EVENTS_DAY_ITEM_INTEGER_FILS_MILLI',
    comparisonWithTrustSoftPerformed: false,
    trustsoftFunctionalParityPercent: null,
    sourceTenantAndBranchIndependentlyAuthenticated: false,
    privateOutputAttestedByOperator: true,
    financialDataPublished: false,
  };
  // Explicit exclusive creation and restrictive permissions. Never replace
  // any existing evidence; cleanup only the outputs created by this invocation.
  let writtenCsv = false;
  let writtenManifest = false;
  try {
    const csvFile = await fs.open(csv, 'wx', 0o600);
    writtenCsv = true;
    try {
      await csvFile.writeFile(csvBytes);
    } finally {
      await csvFile.close();
    }
    const manifestFile = await fs.open(manifest, 'wx', 0o600);
    writtenManifest = true;
    try {
      await manifestFile.writeFile(JSON.stringify(resultManifest, null, 2) + '\n');
    } finally {
      await manifestFile.close();
    }
  } catch {
    if (writtenManifest) await fs.unlink(manifest).catch(() => {});
    if (writtenCsv) await fs.unlink(csv).catch(() => {});
    deny('OUTPUT_WRITE_FAILED_OR_ALREADY_EXISTS');
  }
  // Return manifest summary only. No actual CSV row content or file path.
  return Object.freeze(resultManifest);
}

async function main() {
  try {
    const options = argumentMap(process.argv.slice(2));
    const result = await privateExport(options);
    console.log(JSON.stringify({status: 'CREATED_PRIVATE_CANDIDATE', ...result}));
  } catch (error) {
    console.log(JSON.stringify({
      status: 'BLOCKED',
      code: error instanceof PrivateExportError ? error.code :
        error?.code === 'DUPLICATE_EVENT_ID' ? error.code :
        error?.code?.startsWith('INVALID_') ? error.code :
        'INVALID_OR_UNAVAILABLE_PRIVATE_SOURCE',
    }));
    process.exitCode = 2;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url))) {
  await main();
}
