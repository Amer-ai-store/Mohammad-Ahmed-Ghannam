const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../one/core.js');

test('CORE-01 roles: owner from ownerUid only, unknown role values grant nothing', () => {
  const c = { ownerUid: 'o', memberIds: ['o', 'a', 'b', 'x'], roles: { a: 'accountant', b: 'auditor', x: 'owner' } };
  assert.equal(C.roleOf(c, 'o'), 'owner');
  assert.equal(C.roleOf(c, 'a'), 'accountant');
  assert.equal(C.roleOf(c, 'x'), null);
  assert.equal(C.roleOf(c, 'stranger'), null);
  assert.ok(C.can('accountant', 'write')); assert.ok(!C.can('auditor', 'write')); assert.ok(!C.can('employee', 'write'));
  assert.ok(C.can('employee', 'tasks')); assert.ok(!C.can('auditor', 'tasks'));
  assert.ok(C.can('general_manager', 'manage')); assert.ok(!C.can('branch_manager', 'manage'));
  assert.deepEqual(Object.keys(C.ROLES), ['owner', 'chairman', 'general_manager', 'procurement_manager', 'branch_manager', 'accountant', 'auditor', 'employee']);
});

test('CORE-02 invite ids and email/social validation', () => {
  assert.equal(C.inviteId('A', ' Ali@Example.COM '), 'A__ali@example.com');
  assert.ok(C.isEmail('a@b.co')); assert.ok(!C.isEmail('nope'));
  assert.ok(C.validateSocial('facebook', 'https://www.facebook.com/jawafa').ok);
  assert.ok(!C.validateSocial('facebook', 'http://facebook.com/jawafa').ok);
  assert.ok(!C.validateSocial('instagram', 'https://evil.example/instagram.com/x').ok);
  assert.ok(C.validateSocial('tiktok', 'https://www.tiktok.com/@jawafa').ok);
  assert.ok(C.validateSocial('tiktok', '').ok);
});

test('CORE-03 router: dedupe, forward-only states, receipts required from a recipient', () => {
  const r = C.createRouter();
  const a = r.send({ id: 'm1', from: 'agent-999', to: ['agent-777', 'agent-666', 'agent-777'], body: 'تقرير' });
  assert.equal(a.message.status, 'QUEUED'); assert.deepEqual(a.message.to, ['agent-777', 'agent-666']);
  assert.equal(r.send({ id: 'm1', from: 'agent-999', to: ['x'], body: 'again' }).duplicate, true);
  assert.throws(() => r.advance('m1', 'DELIVERED'), /receipt/);
  assert.throws(() => r.advance('m1', 'DELIVERED', { by: 'agent-111' }), /receipt/);
  assert.throws(() => r.advance('m1', 'READ', { by: 'agent-777' }), /illegal/);
  r.advance('m1', 'DELIVERED', { by: 'agent-777' });
  r.advance('m1', 'READ', { by: 'agent-777' });
  r.advance('m1', 'ACKNOWLEDGED', { by: 'agent-777' });
  assert.throws(() => r.advance('m1', 'FAILED', {}), /illegal/);
  assert.equal(r.inbox('agent-666').length, 1); assert.equal(r.outbox('agent-999').length, 1);
  r.send({ id: 'm2', from: 'agent-777', to: 'agent-999', body: 'x' });
  assert.equal(r.advance('m2', 'FAILED', { reason: 'no channel' }).status, 'FAILED');
});

test('CORE-04 anomaly engine finds seeded cases and never marks DEMO data as proven', () => {
  const d = C.demoDataset();
  assert.equal(d.source, 'DEMO');
  const f = C.detectAnomalies(d);
  const types = new Set(f.map(x => x.type));
  for (const t of ['duplicate_invoice', 'off_hours_change', 'high_discount', 'negative_stock', 'cash_variance', 'unmatched_cheque']) assert.ok(types.has(t), 'missing ' + t);
  assert.ok(f.every(x => x.classification === 'verify' || x.classification === 'hypothesis'));
  assert.ok(f.every(x => x.source === 'DEMO'));
  assert.equal(C.classify('LIVE', 0.95, true), 'proven');
  assert.equal(C.classify('LIVE', 0.95, false), 'verify');
});

test('CORE-05 aggregates are derived from the dataset, not hard coded', () => {
  const d = C.demoDataset();
  const k = C.kpis(d);
  const manual = d.invoices.filter(i => i.status !== 'void').reduce((t, i) => t + i.total, 0);
  assert.equal(k.sales, +manual.toFixed(2));
  assert.equal(C.dailySales(d, 7).length, 7);
  assert.ok(k.chequesDue7 >= 1);
  assert.equal(k.branches, 4);
});

test('CORE-06 browser module app.js parses as an ES module', async () => {
  const { readFileSync, writeFileSync, mkdtempSync } = require('node:fs');
  const { join } = require('node:path'); const { execFileSync } = require('node:child_process'); const os = require('node:os');
  const dir = mkdtempSync(join(os.tmpdir(), 'one-'));
  const f = join(dir, 'app.mjs'); writeFileSync(f, readFileSync(join(__dirname, '../one/app.js')));
  execFileSync(process.execPath, ['--check', f]);
  execFileSync(process.execPath, ['--check', join(__dirname, '../one/sw.js')]);
});

test('CORE-07 branch scope: only branch_manager/employee with a non-empty list are scoped', () => {
  const c = { ownerUid: 'o', memberIds: ['o', 'g', 'b', 'e', 'x'], roles: { g: 'general_manager', b: 'branch_manager', e: 'employee', x: 'employee' },
    branchScopes: { g: ['b1'], b: ['b1'], e: ['b2'], x: [], o: ['b1'] } };
  assert.equal(C.branchScope(c, 'o'), null);
  assert.equal(C.branchScope(c, 'g'), null);
  assert.deepEqual(C.branchScope(c, 'b'), ['b1']);
  assert.deepEqual(C.branchScope(c, 'e'), ['b2']);
  assert.equal(C.branchScope(c, 'x'), null);
  assert.ok(C.inScope(null, 'b9')); assert.ok(C.inScope(['b1'], 'b1')); assert.ok(!C.inScope(['b1'], 'b2'));
  assert.ok(C.canManageEmployees('general_manager', null, 'b2'));
  assert.ok(C.canManageEmployees('branch_manager', ['b1'], 'b1'));
  assert.ok(!C.canManageEmployees('branch_manager', ['b1'], 'b2'));
  assert.ok(!C.canManageEmployees('procurement_manager', null, 'b1'));
  assert.ok(!C.canManageEmployees('employee', null, 'b1'));
});

test('CORE-08 purchase orders: lines, totals and allowed moves per role', () => {
  const v = C.validateLines([{ sku: 'S-1', name: 'أرز', qty: '3', unitPrice: '1.1' }, { name: 'زيت', qty: 2, unitPrice: 7.95 }]);
  assert.ok(v.ok); assert.equal(v.total, 19.2);
  assert.ok(!C.validateLines([]).ok);
  assert.ok(!C.validateLines([{ name: '', qty: 1, unitPrice: 1 }]).ok);
  assert.ok(!C.validateLines([{ name: 'x', qty: 0, unitPrice: 1 }]).ok);
  assert.ok(!C.validateLines([{ name: 'x', qty: 1, unitPrice: -1 }]).ok);
  assert.deepEqual(C.poMoves('procurement_manager', null, { status: 'draft' }), ['submitted']);
  assert.deepEqual(C.poMoves('procurement_manager', null, { status: 'submitted' }), []);
  assert.deepEqual(C.poMoves('general_manager', null, { status: 'submitted' }), ['approved', 'rejected']);
  assert.deepEqual(C.poMoves('general_manager', null, { status: 'approved' }), ['received']);
  assert.deepEqual(C.poMoves('branch_manager', ['b1'], { status: 'approved', branchId: 'b1' }), ['received']);
  assert.deepEqual(C.poMoves('branch_manager', ['b1'], { status: 'approved', branchId: 'b2' }), []);
  assert.deepEqual(C.poMoves('accountant', null, { status: 'draft' }), []);
  for (const s of ['rejected', 'received']) assert.deepEqual(C.poMoves('owner', null, { status: s }), []);
  const orders = [{ status: 'submitted' }, { status: 'draft' }, { status: 'submitted' }];
  assert.equal(C.pendingApprovals('owner', orders).length, 2);
  assert.equal(C.pendingApprovals('procurement_manager', orders).length, 0);
  assert.equal(C.PO_ACTION.approved, 'po.approve');
  assert.ok(C.isDate('2026-11-09')); assert.ok(C.isDate('')); assert.ok(!C.isDate('9/11/2026'));
});

test('CORE-09 AI agents: validation matches the rules and requests carry only agent settings + typed text', () => {
  const a = { name: 'مساعد المبيعات', systemInstruction: 'أنت مساعد خبير في تحليل فواتير الإيجارات وتلخيصها للمستأجرين.', model: 'gemini-3.7-flash', temperature: '0.2' };
  const v = C.validateAgent(a);
  assert.ok(v.ok); assert.equal(v.value.temperature, 0.2);
  assert.ok(!C.validateAgent({ ...a, model: 'gpt-4o' }).ok);
  assert.ok(!C.validateAgent({ ...a, model: 'Gemini-Pro' }).ok);
  assert.ok(!C.validateAgent({ ...a, temperature: 2.5 }).ok);
  assert.ok(!C.validateAgent({ ...a, systemInstruction: '' }).ok);
  const r = C.buildAiRequest(a, '  لخّص هذا العقد  ');
  assert.deepEqual(Object.keys(r).sort(), ['contents', 'generationConfig', 'model', 'systemInstruction']);
  assert.equal(r.contents, 'لخّص هذا العقد'); assert.equal(r.generationConfig.temperature, 0.2);
  assert.throws(() => C.buildAiRequest(a, '   '));
  assert.throws(() => C.buildAiRequest(a, 'x'.repeat(8001)));
  assert.ok(!C.aiRunnable('', false)); assert.ok(!C.aiRunnable(undefined, false));
  assert.ok(C.aiRunnable('6Lc_abcdefghijklmnop', false)); assert.ok(C.aiRunnable('', true));
});
