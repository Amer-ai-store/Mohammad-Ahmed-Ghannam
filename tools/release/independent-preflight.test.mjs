import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { verifySignedManifest, validateEvidence, REQUIRED_GATES, REPO } from './independent-preflight.mjs';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const pem = publicKey.export({ type: 'spki', format: 'pem' });
const trustedFingerprint = createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex');
const sha = 'a'.repeat(40);
const now = Date.parse('2026-11-03T18:00:00Z');
const sample = () => ({
  schema: 'jawafa.release.acceptance.v1', repository: REPO, release_environment: 'production',
  target_sha: sha, signed_at: new Date(now).toISOString(),
  independent_reviewer: 'outside-security-auditor', release_operator: 'release-owner',
  gates: REQUIRED_GATES.map(id => ({
    id, status: 'VERIFIED', evidence_id: 'synthetic-' + id,
    source_ref: 'synthetic-test-only', artifact_sha256: 'b'.repeat(64),
    verified_by: 'outside-security-auditor',
    verified_at: new Date(now - 60_000).toISOString(),
  })),
});
const signed = m => {
  const raw = JSON.stringify(m);
  return verifySignedManifest(raw, sign(null, Buffer.from(raw), privateKey).toString('base64'), pem, sha, now, trustedFingerprint);
};
test('synthetic signed envelope passes structurally only, not production approval', () => {
  assert.equal(signed(sample()).gates, REQUIRED_GATES.length);
});
test('missing or unverified security gate blocks', () => {
  const a = sample(); a.gates = a.gates.slice(1); assert.throws(() => signed(a), /GATE_COUNT_INVALID/);
  const b = sample(); b.gates[0].status = 'PENDING'; assert.throws(() => signed(b), /GATE_NOT_VERIFIED/);
});
test('duplicate gate and reviewer self-approval block', () => {
  const a = sample(); a.gates[1] = a.gates[0]; assert.throws(() => signed(a), /GATE_ID_INVALID_OR_DUPLICATE/);
  const b = sample(); b.independent_reviewer = b.release_operator; assert.throws(() => signed(b), /INDEPENDENCE_UNVERIFIED/);
});
test('wrong commit and stale evidence block', () => {
  const a = sample(); a.target_sha = 'c'.repeat(40); assert.throws(() => signed(a), /TARGET_SHA_MISMATCH/);
  const b = sample(); b.gates[0].verified_at = new Date(now - 172_800_000).toISOString();
  assert.throws(() => signed(b), /GATE_EVIDENCE_STALE/);
  assert.throws(() => validateEvidence(sample(), sha, now + 86_400_000), /SIGNATURE_TIME_STALE/);
});
test('unsigned and tampered evidence block', () => {
  const raw = JSON.stringify(sample());
  const sig = sign(null, Buffer.from(raw), privateKey).toString('base64');
  assert.throws(() => verifySignedManifest(raw.replace('production','preview'), sig, pem, sha, now, trustedFingerprint), /INDEPENDENT_SIGNATURE_INVALID/);
  assert.throws(() => verifySignedManifest(raw, 'invalid', pem, sha, now, trustedFingerprint), /SIGNATURE_INVALID_ENCODING/);
});
test('wrong reviewer public key and missing hash block', () => {
  const another = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' });
  const raw = JSON.stringify(sample());
  const sig = sign(null, Buffer.from(raw), privateKey).toString('base64');
  assert.throws(() => verifySignedManifest(raw, sig, another, sha, now, trustedFingerprint), /REVIEWER_KEY_NOT_TRUSTED/);
  const a = sample(); a.gates[0].artifact_sha256 = 'NOT_A_HASH'; assert.throws(() => signed(a), /EVIDENCE_MISSING/);
});

test('caller-selected reviewer key is rejected without independently pinned trust anchor', () => {
  const raw = JSON.stringify(sample());
  const sig = sign(null, Buffer.from(raw), privateKey).toString('base64');
  assert.throws(() => verifySignedManifest(raw, sig, pem, sha, now), /REVIEWER_TRUST_ANCHOR_MISSING/);
  assert.throws(() => verifySignedManifest(raw, sig, pem, sha, now, 'f'.repeat(64)), /REVIEWER_KEY_NOT_TRUSTED/);
  assert.equal(verifySignedManifest(raw, sig, pem, sha, now, trustedFingerprint).gates, REQUIRED_GATES.length);
});
