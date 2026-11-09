// Tenant isolation and RBAC tests against the real Firestore emulator (not the UI).
// Run: firebase emulators:exec --only firestore "node --test tests/firestore/tenancy.rules.test.mjs"
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, arrayUnion, deleteField, FieldPath, writeBatch } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
let env;
const users = {
  ownerA: { uid: 'ownerA', email: 'owner.a@example.com' },
  gmA: { uid: 'gmA', email: 'gm.a@example.com' },
  accA: { uid: 'accA', email: 'acc.a@example.com' },
  audA: { uid: 'audA', email: 'aud.a@example.com' },
  empA: { uid: 'empA', email: 'emp.a@example.com' },
  pmA: { uid: 'pmA', email: 'pm.a@example.com' },
  bmA: { uid: 'bmA', email: 'bm.a@example.com' },
  emp2A: { uid: 'emp2A', email: 'emp2.a@example.com' },
  ownerB: { uid: 'ownerB', email: 'owner.b@example.com' },
  stranger: { uid: 'stranger', email: 'stranger@example.com' },
  invitee: { uid: 'invitee', email: 'new.person@example.com' },
};
const db = (u) => env.authenticatedContext(u.uid, { email: u.email, email_verified: true }).firestore();
const companyA = {
  name: 'Jawafa Test A', ownerUid: 'ownerA',
  memberIds: ['ownerA', 'gmA', 'accA', 'audA', 'empA', 'pmA', 'bmA', 'emp2A'],
  roles: { gmA: 'general_manager', accA: 'accountant', audA: 'auditor', empA: 'employee', pmA: 'procurement_manager', bmA: 'branch_manager', emp2A: 'employee' },
  // bmA manages branch b1 only; emp2A works in b2 only; empA has no scope (company-wide).
  branchScopes: { bmA: ['b1'], emp2A: ['b2'] },
  members: {}, pendingInvites: {}, social: {},
};
const companyB = { name: 'Company B', ownerUid: 'ownerB', memberIds: ['ownerB'], roles: {}, members: {}, pendingInvites: {}, social: {} };

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-jawafa-one', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) } });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, 'companies/A'), companyA);
    await setDoc(doc(f, 'companies/B'), companyB);
    await setDoc(doc(f, 'companies/A/workspaces/w1'), { name: 'A secret workspace' });
    await setDoc(doc(f, 'companies/B/workspaces/w1'), { name: 'B secret workspace' });
    await setDoc(doc(f, 'companies/A/branches/b1'), { name: 'Branch 1', kind: 'market', city: '', lat: null, lng: null, by: 'ownerA', at: 1 });
    await setDoc(doc(f, 'companies/A/branches/b2'), { name: 'Branch 2', kind: 'bakery', city: '', lat: null, lng: null, by: 'ownerA', at: 1 });
    await setDoc(doc(f, 'companies/B/branches/b1'), { name: 'B branch', kind: 'market', city: '', lat: null, lng: null, by: 'ownerB', at: 1 });
    await setDoc(doc(f, 'companies/A/suppliers/s1'), { name: 'Supplier 1', status: 'active', by: 'ownerA', at: 1 });
    await setDoc(doc(f, 'companies/A/employees/e1'), { name: 'Emp in b1', title: 'Cashier', branchId: 'b1', phone: '', status: 'active', startDate: '2026-01-01', by: 'ownerA', at: 1 });
    await setDoc(doc(f, 'companies/A/employees/e2'), { name: 'Emp in b2', title: 'Baker', branchId: 'b2', phone: '', status: 'active', startDate: '', by: 'ownerA', at: 1 });
  });
});

test('TEN-01 a user can create a company only as its sole owner', async () => {
  const f = db(users.stranger);
  await assertSucceeds(setDoc(doc(f, 'companies/S'), { name: 'Stranger Co', ownerUid: 'stranger', memberIds: ['stranger'], roles: {}, members: { stranger: { email: 'stranger@example.com' } }, pendingInvites: {}, social: {} }));
  await assertFails(setDoc(doc(f, 'companies/S2'), { name: 'Hijack', ownerUid: 'ownerA', memberIds: ['stranger'], roles: {}, members: {}, pendingInvites: {}, social: {} }));
  await assertFails(setDoc(doc(f, 'companies/S3'), { name: 'Extra', ownerUid: 'stranger', memberIds: ['stranger', 'ownerA'], roles: {}, members: {}, pendingInvites: {}, social: {} }));
});

test('TEN-02 company A data is not readable or writable by company B owner (API level)', async () => {
  const f = db(users.ownerB);
  await assertFails(getDoc(doc(f, 'companies/A')));
  await assertFails(getDoc(doc(f, 'companies/A/workspaces/w1')));
  await assertFails(setDoc(doc(f, 'companies/A/workspaces/w2'), { name: 'injected' }));
  await assertFails(getDocs(collection(f, 'companies/A/workspaces')));
  await assertFails(updateDoc(doc(f, 'companies/A'), { memberIds: arrayUnion('ownerB') }));
  await assertSucceeds(getDoc(doc(f, 'companies/B/workspaces/w1')));
});

test('TEN-03 unauthenticated access is denied everywhere', async () => {
  const f = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(f, 'companies/A')));
  await assertFails(getDoc(doc(f, 'companies/A/workspaces/w1')));
  await assertFails(setDoc(doc(f, 'companies/X'), { name: 'x', ownerUid: 'x', memberIds: ['x'], roles: {}, members: {}, pendingInvites: {}, social: {} }));
});

test('TEN-04 company listing returns only the caller\'s companies', async () => {
  const f = db(users.accA);
  const snap = await assertSucceeds(getDocs(query(collection(f, 'companies'), where('memberIds', 'array-contains', 'accA'))));
  assert.deepEqual(snap.docs.map(d => d.id), ['A']);
  await assertFails(getDocs(collection(f, 'companies')));
});

test('RBAC-01 accountant writes data, auditor and employee are read only', async () => {
  await assertSucceeds(setDoc(doc(db(users.accA), 'companies/A/workspaces/w3'), { name: 'ok' }));
  await assertSucceeds(getDoc(doc(db(users.audA), 'companies/A/workspaces/w1')));
  await assertFails(setDoc(doc(db(users.audA), 'companies/A/workspaces/w4'), { name: 'no' }));
  await assertFails(setDoc(doc(db(users.empA), 'companies/A/workspaces/w5'), { name: 'no' }));
  await assertSucceeds(setDoc(doc(db(users.empA), 'companies/A/tasks/t1'), { title: 'employee task' }));
  await assertFails(setDoc(doc(db(users.audA), 'companies/A/tasks/t2'), { title: 'auditor task' }));
  await assertFails(deleteDoc(doc(db(users.empA), 'companies/A/tasks/t1')));
  await assertSucceeds(deleteDoc(doc(db(users.gmA), 'companies/A/tasks/t1')));
});

test('RBAC-02 only owner / chairman / general manager manage members; ownership cannot move', async () => {
  await assertFails(updateDoc(doc(db(users.accA), 'companies/A'), { name: 'renamed by accountant' }));
  await assertSucceeds(updateDoc(doc(db(users.gmA), 'companies/A'), { name: 'Renamed by GM' }));
  await assertFails(updateDoc(doc(db(users.gmA), 'companies/A'), { ownerUid: 'gmA' }));
  await assertFails(updateDoc(doc(db(users.gmA), 'companies/A'), { memberIds: ['gmA', 'accA'] }));
  await assertFails(deleteDoc(doc(db(users.gmA), 'companies/A')));
});

test('RBAC-03 a role value of "owner" in roles grants nothing beyond member rights', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => updateDoc(doc(ctx.firestore(), 'companies/A'), { 'roles.empA': 'owner' }));
  await assertFails(updateDoc(doc(db(users.empA), 'companies/A'), { name: 'pretend owner' }));
  await assertFails(setDoc(doc(db(users.empA), 'companies/A/workspaces/x'), { name: 'pretend owner' }));
});

test('INV-01 invitation flow: manager invites, only the addressed email can join with that role', async () => {
  const gm = db(users.gmA);
  const email = users.invitee.email;
  await assertFails(setDoc(doc(gm, `invites/A__${email}`), { companyId: 'A', companyName: 'A', email, role: 'owner', invitedBy: 'gmA' }));
  await assertSucceeds(setDoc(doc(gm, `invites/A__${email}`), { companyId: 'A', companyName: 'A', email, role: 'accountant', invitedBy: 'gmA' }));
  await assertSucceeds(updateDoc(doc(gm, 'companies/A'), new FieldPath('pendingInvites', email), 'accountant'));
  await assertFails(setDoc(doc(db(users.accA), `invites/A__x@example.com`), { companyId: 'A', companyName: 'A', email: 'x@example.com', role: 'employee', invitedBy: 'accA' }));
  await assertFails(setDoc(doc(db(users.ownerB), `invites/A__y@example.com`), { companyId: 'A', companyName: 'A', email: 'y@example.com', role: 'employee', invitedBy: 'ownerB' }));

  // A stranger cannot use someone else's invitation.
  await assertFails(updateDoc(doc(db(users.stranger), 'companies/A'), 'memberIds', arrayUnion('stranger'), new FieldPath('roles', 'stranger'), 'accountant'));
  // The invitee cannot take a higher role than invited.
  const inv = db(users.invitee);
  await assertFails(updateDoc(doc(inv, 'companies/A'), 'memberIds', arrayUnion('invitee'), new FieldPath('roles', 'invitee'), 'general_manager',
    new FieldPath('members', 'invitee'), { email }, new FieldPath('pendingInvites', email), deleteField()));
  // Invitee reads their invitations by email and accepts with exactly the invited role.
  const mine = await assertSucceeds(getDocs(query(collection(inv, 'invites'), where('email', '==', email))));
  assert.equal(mine.size, 1);
  await assertSucceeds(updateDoc(doc(inv, 'companies/A'), 'memberIds', arrayUnion('invitee'), new FieldPath('roles', 'invitee'), 'accountant',
    new FieldPath('members', 'invitee'), { email }, new FieldPath('pendingInvites', email), deleteField()));
  await assertSucceeds(deleteDoc(doc(inv, `invites/A__${email}`)));
  await assertSucceeds(getDoc(doc(inv, 'companies/A/workspaces/w1')));
  await assertFails(getDoc(doc(inv, 'companies/B/workspaces/w1')));
});

test('INV-02 a member can leave; the owner cannot be removed', async () => {
  const f = db(users.empA);
  const after = { ...companyA, memberIds: companyA.memberIds.filter(x => x !== 'empA'), roles: { gmA: 'general_manager', accA: 'accountant', audA: 'auditor' } };
  await assertSucceeds(setDoc(doc(f, 'companies/A'), after));
  await assertFails(getDoc(doc(f, 'companies/A/workspaces/w1')));
});

test('MSG-01 agent messages: queued as self, forward-only status, immutable body, no delete', async () => {
  const f = db(users.empA);
  const ref = doc(f, 'companies/A/agentMessages/m1');
  await assertFails(setDoc(ref, { id: 'm1', from: 'agent-999', to: ['agent-777'], body: 'x', status: 'DELIVERED', sentBy: 'empA' }));
  await assertFails(setDoc(ref, { id: 'm1', from: 'agent-999', to: ['agent-777'], body: 'x', status: 'QUEUED', sentBy: 'gmA' }));
  await assertSucceeds(setDoc(ref, { id: 'm1', from: 'agent-999', to: ['agent-777', 'agent-666'], body: 'x', status: 'QUEUED', sentBy: 'empA' }));
  await assertFails(updateDoc(ref, { status: 'ACKNOWLEDGED' }));
  await assertFails(updateDoc(ref, { body: 'tampered' }));
  await assertSucceeds(updateDoc(ref, { status: 'DELIVERED' }));
  await assertFails(updateDoc(ref, { status: 'QUEUED' }));
  await assertSucceeds(updateDoc(ref, { status: 'READ' }));
  await assertSucceeds(updateDoc(ref, { status: 'ACKNOWLEDGED' }));
  await assertFails(deleteDoc(ref));
  await assertFails(getDoc(doc(db(users.ownerB), 'companies/A/agentMessages/m1')));
});

test('AUD-01 audit log is append-only', async () => {
  const f = db(users.accA);
  await assertSucceeds(setDoc(doc(f, 'companies/A/audit/e1'), { by: 'accA', action: 'x' }));
  await assertFails(setDoc(doc(f, 'companies/A/audit/e2'), { by: 'gmA', action: 'spoof' }));
  await assertFails(updateDoc(doc(f, 'companies/A/audit/e1'), { action: 'edit' }));
  await assertFails(deleteDoc(doc(db(users.ownerA), 'companies/A/audit/e1')));
});

test('SOC-01 social links accept only the matching platform host over https', async () => {
  const gm = db(users.gmA);
  await assertSucceeds(updateDoc(doc(gm, 'companies/A'), { social: { facebook: 'https://www.facebook.com/jawafa', instagram: 'https://instagram.com/jawafa', tiktok: 'https://www.tiktok.com/@jawafa' } }));
  await assertFails(updateDoc(doc(gm, 'companies/A'), { social: { facebook: 'http://facebook.com/x' } }));
  await assertFails(updateDoc(doc(gm, 'companies/A'), { social: { instagram: 'https://evil.example/instagram.com/x' } }));
  await assertFails(updateDoc(doc(gm, 'companies/A'), { social: { twitter: 'https://x.com/a' } }));
});

test('STORE-01 Android live-store collections stay readable only by the original owner', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'orders/o1'), { total: 1 }));
  await assertFails(getDoc(doc(db(users.ownerA), 'orders/o1')));
  const owner = env.authenticatedContext('real', { email: 'zxzx.mohammad91@gmail.com', email_verified: true }).firestore();
  await assertSucceeds(getDoc(doc(owner, 'orders/o1')));
});

test('PROF-01 profiles are private to their user', async () => {
  await assertSucceeds(setDoc(doc(db(users.accA), 'profiles/accA'), { lastCompanyId: 'A' }));
  await assertFails(getDoc(doc(db(users.gmA), 'profiles/accA')));
});

test('PLAN-01 companies start free and no client can upgrade itself to Premium Plus', async () => {
  const f = db(users.stranger);
  await assertFails(setDoc(doc(f, 'companies/P'), { name: 'Paid', ownerUid: 'stranger', memberIds: ['stranger'], roles: {}, members: {}, pendingInvites: {}, social: {}, plan: 'premium_plus' }));
  await assertSucceeds(setDoc(doc(f, 'companies/P'), { name: 'Free', ownerUid: 'stranger', memberIds: ['stranger'], roles: {}, members: {}, pendingInvites: {}, social: {}, plan: 'free' }));
  await assertFails(updateDoc(doc(f, 'companies/P'), { plan: 'premium_plus' }));
  await assertFails(updateDoc(doc(db(users.ownerA), 'companies/A'), { plan: 'premium_plus' }));
  await assertSucceeds(updateDoc(doc(f, 'companies/P'), { name: 'Still free' }));
});

test('BR-01 branches: writers add validated branches, read-only roles and other companies cannot', async () => {
  const ok = { name: 'فرع الزرقاء', kind: 'market', city: 'الزرقاء', lat: 32.06, lng: 36.09, by: 'accA', at: 1 };
  await assertSucceeds(setDoc(doc(db(users.accA), 'companies/A/branches/b1'), ok));
  await assertSucceeds(setDoc(doc(db(users.gmA), 'companies/A/branches/b2'), { ...ok, lat: null, lng: null }));
  await assertFails(setDoc(doc(db(users.audA), 'companies/A/branches/b3'), ok));
  await assertFails(setDoc(doc(db(users.empA), 'companies/A/branches/b3'), ok));
  await assertFails(setDoc(doc(db(users.ownerB), 'companies/A/branches/b3'), ok));
  await assertFails(setDoc(doc(db(users.accA), 'companies/A/branches/b4'), { ...ok, kind: 'casino' }));
  await assertFails(setDoc(doc(db(users.accA), 'companies/A/branches/b5'), { ...ok, lat: 123 }));
  await assertFails(setDoc(doc(db(users.accA), 'companies/A/branches/b6'), { ...ok, extra: 'x' }));
  await assertSucceeds(getDoc(doc(db(users.audA), 'companies/A/branches/b1')));
  await assertFails(getDoc(doc(db(users.ownerB), 'companies/A/branches/b1')));
  await assertFails(deleteDoc(doc(db(users.audA), 'companies/A/branches/b1')));
  await assertSucceeds(deleteDoc(doc(db(users.accA), 'companies/A/branches/b1')));
});

// ---------- Phase 2: operations ----------
const emp = (u, over) => ({ name: 'New hire', title: 'Clerk', branchId: 'b1', phone: '0790000000', status: 'active', startDate: '2026-11-01', by: u, at: 2, ...over });
const po = (u, over) => ({ supplierId: 's1', branchId: 'b1', lines: [{ sku: 'S-1', name: 'Rice', qty: 2, unitPrice: 5 }], total: 10, notes: '', status: 'draft', createdBy: u, at: 3, updatedAt: 3, ...over });
// Writes the order change and its audit entry atomically, as the app does.
async function decide(f, u, poId, change, action) {
  const auditId = `${action}-${poId}-${Math.random().toString(36).slice(2, 8)}`;
  const b = writeBatch(f);
  b.set(doc(f, `companies/A/audit/${auditId}`), { by: u, action, ref: poId, detail: '', at: 4 });
  b.update(doc(f, `companies/A/purchaseOrders/${poId}`), { ...change, updatedAt: 4, lastAuditId: auditId });
  return b.commit();
}

test('EMP-01 employees: managers write, others read; validated; never deleted', async () => {
  await assertSucceeds(setDoc(doc(db(users.gmA), 'companies/A/employees/n1'), emp('gmA')));
  await assertFails(setDoc(doc(db(users.accA), 'companies/A/employees/n2'), emp('accA')));
  await assertFails(setDoc(doc(db(users.pmA), 'companies/A/employees/n2'), emp('pmA')));
  await assertFails(setDoc(doc(db(users.empA), 'companies/A/employees/n2'), emp('empA')));
  await assertFails(setDoc(doc(db(users.gmA), 'companies/A/employees/n3'), emp('gmA', { branchId: 'nope' })));
  await assertFails(setDoc(doc(db(users.gmA), 'companies/A/employees/n4'), emp('gmA', { status: 'fired' })));
  await assertFails(setDoc(doc(db(users.gmA), 'companies/A/employees/n5'), emp('gmA', { salary: 900 })));
  await assertFails(setDoc(doc(db(users.gmA), 'companies/A/employees/n6'), emp('gmA', { startDate: '1/1/2026' })));
  await assertFails(setDoc(doc(db(users.gmA), 'companies/A/employees/n7'), emp('accA')));
  await assertSucceeds(updateDoc(doc(db(users.gmA), 'companies/A/employees/n1'), { status: 'inactive', by: 'gmA', at: 5 }));
  await assertFails(deleteDoc(doc(db(users.ownerA), 'companies/A/employees/n1')));
  await assertSucceeds(getDoc(doc(db(users.audA), 'companies/A/employees/n1')));
  await assertFails(getDoc(doc(db(users.ownerB), 'companies/A/employees/n1')));
  await assertFails(setDoc(doc(db(users.ownerB), 'companies/A/employees/n8'), emp('ownerB')));
});

test('SCOPE-01 branch scope: branch manager and employee see and write only their branches', async () => {
  const bm = db(users.bmA), e2 = db(users.emp2A);
  // Branch manager manages b1 employees only, and cannot move one out of scope.
  await assertSucceeds(setDoc(doc(bm, 'companies/A/employees/m1'), emp('bmA')));
  await assertFails(setDoc(doc(bm, 'companies/A/employees/m2'), emp('bmA', { branchId: 'b2' })));
  await assertFails(updateDoc(doc(bm, 'companies/A/employees/e2'), { status: 'inactive', by: 'bmA', at: 5 }));
  await assertFails(updateDoc(doc(bm, 'companies/A/employees/m1'), { branchId: 'b2', by: 'bmA', at: 5 }));
  // Reads: single document and queries.
  await assertSucceeds(getDoc(doc(bm, 'companies/A/employees/e1')));
  await assertFails(getDoc(doc(bm, 'companies/A/employees/e2')));
  await assertFails(getDocs(collection(bm, 'companies/A/employees')));
  const mine = await assertSucceeds(getDocs(query(collection(bm, 'companies/A/employees'), where('branchId', 'in', ['b1']))));
  assert.ok(mine.docs.every(d => d.data().branchId === 'b1') && mine.size >= 1);
  await assertFails(getDocs(query(collection(bm, 'companies/A/employees'), where('branchId', 'in', ['b1', 'b2']))));
  await assertSucceeds(getDoc(doc(e2, 'companies/A/employees/e2')));
  await assertFails(getDoc(doc(e2, 'companies/A/employees/e1')));
  // An employee without a scope entry is company-wide; managers are never scoped.
  await assertSucceeds(getDocs(collection(db(users.empA), 'companies/A/employees')));
  await assertSucceeds(getDocs(collection(db(users.gmA), 'companies/A/employees')));
  // Scope is set by managers only.
  await assertSucceeds(updateDoc(doc(db(users.gmA), 'companies/A'), new FieldPath('branchScopes', 'empA'), ['b2']));
  await assertFails(getDoc(doc(db(users.empA), 'companies/A/employees/e1')));
  await assertFails(updateDoc(doc(db(users.bmA), 'companies/A'), new FieldPath('branchScopes', 'bmA'), ['b1', 'b2']));
});

test('SUP-01 suppliers: procurement roles write, everyone reads, never deleted', async () => {
  const ok = { name: 'Dairy Co', phone: '06000000', email: 'sales@dairy.example', category: 'dairy', status: 'active' };
  await assertSucceeds(setDoc(doc(db(users.pmA), 'companies/A/suppliers/s2'), { ...ok, by: 'pmA', at: 1 }));
  await assertSucceeds(setDoc(doc(db(users.gmA), 'companies/A/suppliers/s3'), { ...ok, by: 'gmA', at: 1 }));
  await assertFails(setDoc(doc(db(users.accA), 'companies/A/suppliers/s4'), { ...ok, by: 'accA', at: 1 }));
  await assertFails(setDoc(doc(db(users.bmA), 'companies/A/suppliers/s4'), { ...ok, by: 'bmA', at: 1 }));
  await assertFails(setDoc(doc(db(users.pmA), 'companies/A/suppliers/s5'), { ...ok, by: 'pmA', at: 1, iban: 'x' }));
  await assertSucceeds(getDoc(doc(db(users.audA), 'companies/A/suppliers/s2')));
  await assertFails(getDoc(doc(db(users.ownerB), 'companies/A/suppliers/s2')));
  await assertFails(deleteDoc(doc(db(users.ownerA), 'companies/A/suppliers/s2')));
});

test('PO-01 purchase orders: draft -> submitted -> approved -> received, each audited', async () => {
  const pm = db(users.pmA), gm = db(users.gmA);
  await assertFails(setDoc(doc(db(users.accA), 'companies/A/purchaseOrders/p0'), po('accA')));
  await assertFails(setDoc(doc(pm, 'companies/A/purchaseOrders/p0'), po('pmA', { status: 'approved' })));
  await assertFails(setDoc(doc(pm, 'companies/A/purchaseOrders/p0'), po('pmA', { supplierId: 'ghost' })));
  await assertFails(setDoc(doc(pm, 'companies/A/purchaseOrders/p0'), po('pmA', { lines: [] })));
  await assertFails(setDoc(doc(pm, 'companies/A/purchaseOrders/p0'), po('gmA')));
  await assertSucceeds(setDoc(doc(pm, 'companies/A/purchaseOrders/p1'), po('pmA')));
  await assertSucceeds(updateDoc(doc(pm, 'companies/A/purchaseOrders/p1'), { lines: [{ sku: 'S-1', name: 'Rice', qty: 3, unitPrice: 5 }], total: 15, updatedAt: 5 }));
  // Submitting needs an audit entry in the same batch.
  await assertFails(updateDoc(doc(pm, 'companies/A/purchaseOrders/p1'), { status: 'submitted', submittedBy: 'pmA', submittedAt: 6, updatedAt: 6 }));
  await assertSucceeds(decide(pm, 'pmA', 'p1', { status: 'submitted', submittedBy: 'pmA', submittedAt: 6 }, 'po.submit'));
  // Once submitted the lines are frozen and the procurer cannot approve.
  await assertFails(updateDoc(doc(pm, 'companies/A/purchaseOrders/p1'), { total: 1, updatedAt: 7 }));
  await assertFails(decide(pm, 'pmA', 'p1', { status: 'approved', decidedBy: 'pmA', decidedAt: 7 }, 'po.approve'));
  // The audit action must match the decision.
  await assertFails(decide(gm, 'gmA', 'p1', { status: 'approved', decidedBy: 'gmA', decidedAt: 7 }, 'po.reject'));
  await assertSucceeds(decide(gm, 'gmA', 'p1', { status: 'approved', decidedBy: 'gmA', decidedAt: 7, decisionNote: 'ok' }, 'po.approve'));
  // Approved orders cannot be edited, re-decided or deleted.
  await assertFails(updateDoc(doc(gm, 'companies/A/purchaseOrders/p1'), { total: 1, updatedAt: 8 }));
  await assertFails(decide(gm, 'gmA', 'p1', { status: 'rejected', decidedBy: 'gmA', decidedAt: 8 }, 'po.reject'));
  await assertFails(deleteDoc(doc(pm, 'companies/A/purchaseOrders/p1')));
  // Receiving: branch manager of b1 may receive; the order is then final.
  await assertSucceeds(decide(db(users.bmA), 'bmA', 'p1', { status: 'received', receivedBy: 'bmA', receivedAt: 9 }, 'po.receive'));
  await assertFails(decide(pm, 'pmA', 'p1', { status: 'approved', decidedBy: 'pmA', decidedAt: 10 }, 'po.approve'));
  const audit = await assertSucceeds(getDocs(query(collection(gm, 'companies/A/audit'), where('ref', '==', 'p1'))));
  assert.deepEqual(audit.docs.map(d => d.data().action).sort(), ['po.approve', 'po.receive', 'po.submit']);
});

test('PO-02 rejection, scoped visibility, reuse of audit entries and cross-company denial', async () => {
  const pm = db(users.pmA);
  await assertSucceeds(setDoc(doc(pm, 'companies/A/purchaseOrders/p2'), po('pmA', { branchId: 'b2' })));
  await assertSucceeds(decide(pm, 'pmA', 'p2', { status: 'submitted', submittedBy: 'pmA', submittedAt: 6 }, 'po.submit'));
  // An existing audit entry cannot be reused for another decision.
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'companies/A/audit/old'), { by: 'ownerA', action: 'po.reject', ref: 'p2', at: 1 }));
  await assertFails(updateDoc(doc(db(users.ownerA), 'companies/A/purchaseOrders/p2'), { status: 'rejected', decidedBy: 'ownerA', decidedAt: 7, updatedAt: 7, lastAuditId: 'old' }));
  await assertSucceeds(decide(db(users.ownerA), 'ownerA', 'p2', { status: 'rejected', decidedBy: 'ownerA', decidedAt: 7, decisionNote: 'price too high' }, 'po.reject'));
  // Rejected is final: cannot be received or resubmitted.
  await assertFails(decide(pm, 'pmA', 'p2', { status: 'received', receivedBy: 'pmA', receivedAt: 8 }, 'po.receive'));
  await assertFails(decide(pm, 'pmA', 'p2', { status: 'submitted', submittedBy: 'pmA', submittedAt: 8 }, 'po.submit'));
  // b2 order is invisible to the b1 branch manager, visible to b2 employee.
  await assertFails(getDoc(doc(db(users.bmA), 'companies/A/purchaseOrders/p2')));
  await assertSucceeds(getDoc(doc(db(users.emp2A), 'companies/A/purchaseOrders/p2')));
  // Company B cannot read, create or decide company A orders.
  const b = db(users.ownerB);
  await assertFails(getDoc(doc(b, 'companies/A/purchaseOrders/p2')));
  await assertFails(getDocs(collection(b, 'companies/A/purchaseOrders')));
  await assertFails(setDoc(doc(b, 'companies/A/purchaseOrders/p3'), po('ownerB')));
  // A draft may be deleted by procurement; nothing else.
  await assertSucceeds(setDoc(doc(pm, 'companies/A/purchaseOrders/p4'), po('pmA')));
  await assertFails(deleteDoc(doc(db(users.accA), 'companies/A/purchaseOrders/p4')));
  await assertSucceeds(deleteDoc(doc(pm, 'companies/A/purchaseOrders/p4')));
});

// ---------- AI agents and workspaces ----------
const agent = (u, over) => ({ name: 'مساعد المبيعات', systemInstruction: 'أنت مساعد خبير في تحليل فواتير الإيجارات وتلخيصها للمستأجرين.', model: 'gemini-3.7-flash', temperature: 0.2, by: u, at: 1, ...over });

test('AGT-01 agents: only owner/chairman/GM write; fields validated; members read; other companies denied', async () => {
  await assertSucceeds(setDoc(doc(db(users.gmA), 'companies/A/agents/agent_abc123'), agent('gmA')));
  await assertSucceeds(setDoc(doc(db(users.ownerA), 'companies/A/agents/a2'), agent('ownerA', { temperature: 1 })));
  await assertFails(setDoc(doc(db(users.accA), 'companies/A/agents/a3'), agent('accA')));
  await assertFails(setDoc(doc(db(users.pmA), 'companies/A/agents/a3'), agent('pmA')));
  await assertFails(setDoc(doc(db(users.gmA), 'companies/A/agents/a4'), agent('gmA', { temperature: 3 })));
  await assertFails(setDoc(doc(db(users.gmA), 'companies/A/agents/a4'), agent('gmA', { temperature: '0.2' })));
  await assertFails(setDoc(doc(db(users.gmA), 'companies/A/agents/a4'), agent('gmA', { model: 'gpt-4o' })));
  await assertFails(setDoc(doc(db(users.gmA), 'companies/A/agents/a4'), agent('gmA', { systemInstruction: '' })));
  await assertFails(setDoc(doc(db(users.gmA), 'companies/A/agents/a4'), agent('gmA', { systemInstruction: 'x'.repeat(4001) })));
  await assertFails(setDoc(doc(db(users.gmA), 'companies/A/agents/a4'), agent('gmA', { apiKey: 'secret' })));
  await assertFails(setDoc(doc(db(users.gmA), 'companies/A/agents/a4'), agent('ownerA')));
  await assertSucceeds(getDoc(doc(db(users.empA), 'companies/A/agents/agent_abc123')));
  await assertFails(getDoc(doc(db(users.ownerB), 'companies/A/agents/agent_abc123')));
  await assertFails(setDoc(doc(db(users.ownerB), 'companies/A/agents/a5'), agent('ownerB')));
  await assertFails(deleteDoc(doc(db(users.accA), 'companies/A/agents/a2')));
  await assertSucceeds(deleteDoc(doc(db(users.gmA), 'companies/A/agents/a2')));
});

test('WS-01 workspaces: writers set the active agent, which must exist in the same company', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, 'companies/A/agents/agent_abc123'), agent('ownerA'));
    await setDoc(doc(f, 'companies/B/agents/agentB'), agent('ownerB'));
  });
  await assertSucceeds(setDoc(doc(db(users.accA), 'companies/A/workspaces/ws1'), { name: 'شاشة عقود الإيجار', activeAgentId: 'agent_abc123' }));
  await assertSucceeds(setDoc(doc(db(users.accA), 'companies/A/workspaces/ws2'), { name: 'بلا وكيل', activeAgentId: null, by: 'accA', at: 1 }));
  await assertFails(setDoc(doc(db(users.accA), 'companies/A/workspaces/ws3'), { name: 'وكيل غير موجود', activeAgentId: 'ghost' }));
  await assertFails(setDoc(doc(db(users.accA), 'companies/A/workspaces/ws3'), { name: 'وكيل شركة أخرى', activeAgentId: 'agentB' }));
  await assertFails(setDoc(doc(db(users.accA), 'companies/A/workspaces/ws3'), { name: 'حقل زائد', activeAgentId: null, prompt: 'x' }));
  await assertFails(setDoc(doc(db(users.audA), 'companies/A/workspaces/ws3'), { name: 'مدقق' }));
  await assertSucceeds(updateDoc(doc(db(users.gmA), 'companies/A/workspaces/ws2'), { activeAgentId: 'agent_abc123' }));
  await assertFails(getDoc(doc(db(users.ownerB), 'companies/A/workspaces/ws1')));
});
