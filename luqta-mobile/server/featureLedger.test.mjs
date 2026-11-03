// Each of the 125 features is checked as its own sub-test (code wiring + named test).
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { checkFeature, ledger } from '../tools/ledger-check.mjs';

const data = ledger();
test('ledger declares the 125 original features in 13 groups plus G14 (Aura) and G15 (phone/Google login), unique ids', () => {
  const ids = data.groups.flatMap((g) => g.features.map((f) => f.id));
  const original = data.groups.filter((g) => !['G14', 'G15', 'G16', 'G17', 'G18'].includes(g.id));
  assert.equal(original.length, 13);
  assert.equal(original.flatMap((g) => g.features).length, 125);
  assert.ok(data.groups.find((g) => g.id === 'G14').features.length >= 40);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(data.total, ids.length);
  for (const g of data.groups) for (const f of g.features) assert.ok(['verified-auto', 'verified-source', 'needs-device', 'partial', 'blocked-external'].includes(f.status), f.id);
});
for (const g of data.groups) {
  for (const f of g.features) {
    test(`${f.id} ${f.title}`, () => {
      const r = checkFeature(f);
      assert.ok(r.ok, r.problems.join('\n'));
    });
  }
}
