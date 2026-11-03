// F-G16-16 private release signing is wired only when CI secrets exist.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const script = resolve('tools/apply-release-signing.mjs');
const gradle = `android {\n    signingConfigs {\n        debug {\n            storeFile file('debug.keystore')\n        }\n    }\n    buildTypes {\n        debug {\n            signingConfig signingConfigs.debug\n        }\n        release {\n            // Caution! In production, you need to generate your own keystore file.\n            signingConfig signingConfigs.debug\n            minifyEnabled false\n        }\n    }\n}\n`;

test('F-G16-16 توقيع الإصدار بمفتاح خاص من أسرار CI فقط', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'luqta-sign-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'android', 'app'), { recursive: true });
  await writeFile(join(dir, 'android', 'app', 'build.gradle'), gradle);
  const clean = { ...process.env, LUQTA_KEYSTORE_BASE64: '', LUQTA_KEYSTORE_PASSWORD: '', LUQTA_KEY_ALIAS: '', LUQTA_KEY_PASSWORD: '' };
  assert.match(execFileSync('node', [script], { cwd: dir, env: clean }).toString(), /debug key/);
  assert.equal(await readFile(join(dir, 'android', 'app', 'build.gradle'), 'utf8'), gradle, 'untouched without secrets');
  const out = execFileSync('node', [script], { cwd: dir, env: { ...clean, LUQTA_KEYSTORE_BASE64: Buffer.from('fake-keystore').toString('base64'), LUQTA_KEYSTORE_PASSWORD: 'p', LUQTA_KEY_ALIAS: 'luqta', LUQTA_KEY_PASSWORD: 'k' } }).toString();
  assert.match(out, /private keystore configured/);
  const g = await readFile(join(dir, 'android', 'app', 'build.gradle'), 'utf8');
  assert.match(g, /luqtaRelease \{/); assert.match(g, /release \{[\s\S]*signingConfig signingConfigs\.luqtaRelease/);
  assert.match(g, /debug \{\n {12}signingConfig signingConfigs\.debug/, 'debug build keeps the debug key');
  assert.ok(!g.includes("storePassword 'p'"), 'passwords are read from the environment, never written');
});
