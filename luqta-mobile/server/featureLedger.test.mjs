// Each of the 125 features is checked as its own sub-test (code wiring + named test).
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { checkFeature, ledger } from '../tools/ledger-check.mjs';

const data = ledger();
test('ledger declares 125 features in 13 groups with unique ids', () => {
  const ids = data.groups.flatMap((g) => g.features.map((f) => f.id));
  assert.equal(data.groups.length, 13);
  assert.equal(ids.length, 125);
  assert.equal(new Set(ids).size, 125);
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
