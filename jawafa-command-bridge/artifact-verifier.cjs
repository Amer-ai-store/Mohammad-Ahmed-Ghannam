'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// The QA directory and public key must be provisioned independently of workers.
// No caller-supplied paths or network URLs are followed.
function createArtifactVerifier({directory, publicKey}) {
  const root = fs.realpathSync(directory);
  const key = crypto.createPublicKey(publicKey);
  if (key.asymmetricKeyType !== 'ed25519') throw Error('ED25519_QA_KEY_REQUIRED');
  return async proof => {
    let fd;
    try {
      if (!/^[A-Za-z0-9_-]{5,128}$/.test(proof.evidence_ref)) return false;
      const file = path.join(root, proof.evidence_ref + '.json');
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1048576) return false;
      fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
      const opened = fs.fstatSync(fd);
      if (!opened.isFile() || opened.size > 1048576 || opened.ino !== stat.ino || opened.dev !== stat.dev) return false;
      const bytes = Buffer.alloc(opened.size + 1);
      const count = fs.readSync(fd, bytes, 0, bytes.length, 0);
      if (count !== opened.size) return false;
      const raw = bytes.subarray(0, count);
      if (crypto.createHash('sha256').update(raw).digest('hex') !== proof.sha256) return false;
      const envelope = JSON.parse(raw);
      if (typeof envelope.payload !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.signature || '')) return false;
      const signature = Buffer.from(envelope.signature, 'base64');
      if (signature.length !== 64 || !crypto.verify(null, Buffer.from(envelope.payload), key, signature)) return false;
      const checked = JSON.parse(envelope.payload);
      for (const field of ['request_id', 'agent_id', 'operation', 'source_version', 'evidence_ref']) {
        if (!Object.hasOwn(checked, field) || checked[field] !== proof[field]) return false;
      }
      return checked.schema_version === 'jawafa.qa-artifact.v1' &&
        checked.test_result === 'PASS' && typeof checked.reviewer_id === 'string' &&
        checked.reviewer_id.length >= 5 && checked.reviewer_id !== proof.agent_id &&
        typeof checked.checked_at === 'string' && Number.isFinite(Date.parse(checked.checked_at)) &&
        checked.findings !== null && typeof checked.findings === 'object' && !Array.isArray(checked.findings);
    } catch { return false; }
    finally { if (fd !== undefined) fs.closeSync(fd); }
  };
}
module.exports = {createArtifactVerifier};
