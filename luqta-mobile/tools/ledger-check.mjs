// Checks every feature of ledger/features.json individually:
//  - its source file exists and contains the wiring tokens (code evidence)
//  - when a test is referenced, that test file exists and declares the named test
// Run: node tools/ledger-check.mjs [--write]  (writes ledger/RESULTS.md with the git commit)
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ledger = () => JSON.parse(readFileSync(join(root, 'ledger', 'features.json'), 'utf8'));
const cache = new Map();
const read = (p) => { if (!cache.has(p)) cache.set(p, existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : null); return cache.get(p); };

export function checkFeature(f) {
  const problems = [];
  const src = read(f.source.file);
  if (src === null) problems.push(`missing source ${f.source.file}`);
  else for (const token of f.source.contains) if (!src.includes(token)) problems.push(`${f.source.file} lacks «${token}»`);
  if (f.test) {
    const t = read(f.test.file);
    if (t === null) problems.push(`missing test file ${f.test.file}`);
    else if (!t.includes(f.test.name)) problems.push(`${f.test.file} has no test «${f.test.name}»`);
  }
  return { id: f.id, ok: problems.length === 0, problems };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const data = ledger();
  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch { /* not a git checkout */ }
  const rows = [];
  let failed = 0;
  const counts = {};
  for (const g of data.groups) for (const f of g.features) {
    const r = checkFeature(f); if (!r.ok) failed++;
    counts[f.status] = (counts[f.status] || 0) + 1;
    rows.push(`| ${f.id} | ${f.title} | ${f.status} | ${r.ok ? 'pass' : 'FAIL: ' + r.problems.join('; ')} | ${f.test ? `${f.test.file} › ${f.test.name}` : f.source.file} | ${f.evidence || ''} |`);
  }
  const md = `# نتائج فحص الميزات — commit ${commit}\n\nالإجمالي ${rows.length} ميزة في ${data.groups.length} مجموعة. فشل: ${failed}. الحالات: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join('، ')}.\n\n| المعرّف | الميزة | الحالة | فحص الكود | الاختبار/المصدر | الدليل |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n`;
  if (process.argv.includes('--write')) writeFileSync(join(root, 'ledger', 'RESULTS.md'), md);
  console.log(`features=${rows.length} groups=${data.groups.length} failed=${failed} ${JSON.stringify(counts)}`);
  process.exit(failed ? 1 : 0);
}
