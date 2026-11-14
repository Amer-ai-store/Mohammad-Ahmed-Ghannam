#!/usr/bin/env node
/**
 * Read-only source preflight: no network, SQL, deployment or financial data writes.
 * Independent manifest, Ed25519 signature and reviewer key are supplied privately.
 * Signature verification alone does not establish that underlying evidence is genuine.
 */
import { readFileSync } from 'node:fs';
import { createHash, createPublicKey, timingSafeEqual, verify } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const REPO = 'Amer-ai-store/Mohammad-Ahmed-Ghannam';
export const REQUIRED_GATES = Object.freeze([
  'independent_security_approval',
  'provider_inventory_and_freeze',
  'protected_release_negative_tests',
  'private_https_and_secret_isolation',
  'firebase_real_owner_identity',
  'authorization_401_403_200_real_tokens',
  'command_bridge_real_e2e',
  'sql_least_privilege_select_only',
  'export_sha_and_row_integrity',
  'off_host_restore_reproducible',
  'gate15_financial_reconciliation',
  'google_docs_10_private_reports',
  'mobile_and_desktop_e2e',
  'dashboard_navigation_visibility_dedup',
  'executive_detail_excel_pdf_pptx_evidence',
]);

const sha40 = /^[0-9a-f]{40}$/i;
const sha64 = /^[0-9a-f]{64}$/i;
const nonEmpty = x => typeof x === 'string' && x.trim().length > 0 && x.trim().length <= 300;
const parseTime = x => typeof x === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(x) && Number.isFinite(Date.parse(x)) ? Date.parse(x) : NaN;
function requireCondition(value, code) { if (!value) throw new Error(code); }

export function validateEvidence(manifest, expectedSha, now = Date.now()) {
  requireCondition(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'MANIFEST_INVALID');
  requireCondition(manifest.schema === 'jawafa.release.acceptance.v1', 'SCHEMA_INVALID');
  requireCondition(manifest.repository === REPO, 'REPOSITORY_MISMATCH');
  requireCondition(sha40.test(expectedSha) && manifest.target_sha === expectedSha, 'TARGET_SHA_MISMATCH');
  const signedAt = parseTime(manifest.signed_at);
  requireCondition(Number.isFinite(signedAt) && signedAt <= now + 300_000 && now - signedAt <= 3_600_000, 'SIGNATURE_TIME_STALE');
  requireCondition(manifest.release_environment === 'production', 'ENVIRONMENT_INVALID');
  requireCondition(nonEmpty(manifest.independent_reviewer) && manifest.independent_reviewer !== manifest.release_operator, 'INDEPENDENCE_UNVERIFIED');
  requireCondition(nonEmpty(manifest.release_operator), 'RELEASE_OPERATOR_MISSING');
  requireCondition(Array.isArray(manifest.gates) && manifest.gates.length === REQUIRED_GATES.length, 'GATE_COUNT_INVALID');
  const unique = new Set();
  for (const g of manifest.gates) {
    requireCondition(g && typeof g === 'object' && REQUIRED_GATES.includes(g.id) && !unique.has(g.id), 'GATE_ID_INVALID_OR_DUPLICATE');
    unique.add(g.id);
    requireCondition(g.status === 'VERIFIED', 'GATE_NOT_VERIFIED');
    requireCondition(nonEmpty(g.evidence_id) && nonEmpty(g.source_ref) && sha64.test(g.artifact_sha256), 'EVIDENCE_MISSING');
    requireCondition(nonEmpty(g.verified_by) && g.verified_by === manifest.independent_reviewer, 'GATE_REVIEWER_MISMATCH');
    const stamp = parseTime(g.verified_at);
    requireCondition(Number.isFinite(stamp) && stamp <= signedAt + 300_000 && signedAt - stamp <= 86_400_000, 'GATE_EVIDENCE_STALE');
  }
  return { target_sha: expectedSha, gates: unique.size, signed_at: manifest.signed_at };
}

export function verifySignedManifest(rawManifest, signatureB64, publicKeyPem, expectedSha, now = Date.now(), trustedReviewerSpkiSha256) {
  requireCondition(typeof rawManifest === 'string' && Buffer.byteLength(rawManifest) <= 131_072, 'MANIFEST_TOO_LARGE');
  requireCondition(typeof signatureB64 === 'string' && /^[A-Za-z0-9+/]{86}==$/.test(signatureB64.trim()), 'SIGNATURE_INVALID_ENCODING');
  // The trust anchor must be enrolled out of band in a protected environment; never selected by the manifest signer.
  requireCondition(typeof trustedReviewerSpkiSha256 === 'string' && sha64.test(trustedReviewerSpkiSha256), 'REVIEWER_TRUST_ANCHOR_MISSING');
  let key;
  try { key = createPublicKey(publicKeyPem); } catch { throw new Error('REVIEWER_PUBLIC_KEY_INVALID'); }
  requireCondition(key.asymmetricKeyType === 'ed25519', 'REVIEWER_KEY_MUST_BE_ED25519');
  const fingerprint = createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest();
  requireCondition(timingSafeEqual(fingerprint, Buffer.from(trustedReviewerSpkiSha256, 'hex')), 'REVIEWER_KEY_NOT_TRUSTED');
  const signature = Buffer.from(signatureB64.trim(), 'base64');
  requireCondition(signature.length === 64 && verify(null, Buffer.from(rawManifest, 'utf8'), key, signature), 'INDEPENDENT_SIGNATURE_INVALID');
  let manifest;
  try { manifest = JSON.parse(rawManifest); } catch { throw new Error('MANIFEST_INVALID_JSON'); }
  return validateEvidence(manifest, expectedSha, now);
}

function main(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 2) {
    requireCondition(['--manifest','--signature','--reviewer-public-key','--sha'].includes(argv[i]) && argv[i + 1], 'USAGE_INVALID');
    requireCondition(!args.has(argv[i]), 'DUPLICATE_ARGUMENT');
    args.set(argv[i], argv[i + 1]);
  }
  requireCondition(args.size === 4, 'USAGE_INVALID');
  const result = verifySignedManifest(
    readFileSync(args.get('--manifest'), 'utf8'),
    readFileSync(args.get('--signature'), 'utf8'),
    readFileSync(args.get('--reviewer-public-key'), 'utf8'),
    args.get('--sha'),
    Date.now(),
    process.env.JAWAFA_TRUSTED_REVIEWER_SPKI_SHA256
  );
  // Do not print source refs, owner IDs, tokens or private artifacts.
  process.stdout.write('INDEPENDENT_PREFLIGHT_PASS sha=' + result.target_sha + ' gates=' + result.gates + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write('INDEPENDENT_PREFLIGHT_BLOCKED ' + String(error.message).replace(/[^A-Z0-9_]/g, '') + '\n');
    process.exitCode = 2;
  }
}
