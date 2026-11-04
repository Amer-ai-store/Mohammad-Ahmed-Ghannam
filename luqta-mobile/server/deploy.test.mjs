// Deployment kit consistency: the Docker image ships every server module, and .env.example
// documents every environment variable the server reads (no secret values committed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
// modules reachable from the production entry point
const sources = [];
(function walk(f) { if (sources.includes(f)) return; sources.push(f); for (const m of readFileSync(resolve(here, f), 'utf8').matchAll(/from '\.\/([\w.-]+\.mjs)'/g)) walk(m[1]); })('commerce.mjs');
const allModules = readdirSync(here).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs'));

test('Docker image copies all server modules and catalog, runs as non-root with persistent /data', () => {
  const docker = readFileSync(resolve(root, 'deploy/Dockerfile'), 'utf8');
  assert.match(docker, /COPY server\/\*\.mjs server\/catalog\.json/);
  assert.match(docker, /USER luqta/); assert.match(docker, /COMMERCE_DB=\/data\//); assert.match(docker, /HOST=0\.0\.0\.0/);
  assert.match(docker, /HEALTHCHECK .*\/api\/ready/);
  assert.ok(sources.length >= 8 && sources.every((f) => allModules.includes(f)));
  for (const f of sources) for (const m of readFileSync(resolve(here, f), 'utf8').matchAll(/from '\.\.\/([^']+)'/g)) assert.fail(`${f} imports ${m[1]} outside server/`);
});

test('.env.example lists every env var the server reads and contains no secrets', () => {
  const example = readFileSync(resolve(root, 'deploy/.env.example'), 'utf8');
  const documented = new Set([...example.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]));
  const internal = new Set(['COMMERCE_DB', 'PORT', 'HOST', 'STATIC_DIR', 'NODE_ENV', 'HOME', 'CI']);
  const used = new Set();
  for (const f of sources) for (const m of readFileSync(resolve(here, f), 'utf8').matchAll(/(?:process\.)?env\.([A-Z][A-Z0-9_]+)/g)) used.add(m[1]);
  const missing = [...used].filter((v) => !documented.has(v) && !internal.has(v));
  assert.deepEqual(missing, [], `undocumented env vars: ${missing.join(', ')}`);
  for (const line of example.split('\n')) if (/(TOKEN|SECRET|KEY|AUTH_TOKEN)=/.test(line)) assert.match(line, /=$/, `secret must be empty: ${line}`);
  assert.match(readFileSync(resolve(root, '.gitignore'), 'utf8'), /^deploy\/\.env$/m);
});
