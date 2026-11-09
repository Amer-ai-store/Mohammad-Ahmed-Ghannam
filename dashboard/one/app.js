// JAWAFA ONE AI — multi-company command center (GitHub Pages / PWA).
// Data rules: nothing here invents operational numbers. Figures come from a dataset that carries
// its source label; the only dataset in this build is the DEMO generator in core.js, and every
// screen that shows it says so. Company, membership, tasks and agent messages are real Firestore
// records protected by firestore.rules (tested in tests/firestore).
import { OFFICIAL_AGENTS } from "../aas/official-agent-roster.mjs";
import { renderTrustsoftEvidence } from "./trustsoft-evidence.mjs";
import { renderGithubWork } from "./github-work.mjs";
import { renderJawafaCoverage } from "./jawafa-db-coverage.mjs";

const C = window.JawafaCore;
const FIREBASE_VERSION = "10.14.1";
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const EMULATOR = params.has("emulator") && ["localhost", "127.0.0.1"].includes(location.hostname);

// ---------- helpers ----------
function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k instanceof Node ? k : String(k));
  return n;
}
const S = (v, max = 300) => (typeof v === "string" ? v : v == null ? "" : String(v)).slice(0, max);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
let toastTimer;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3800); }
const lang = () => (document.documentElement.lang === "en" ? "en" : "ar");
const T = (ar, en) => (lang() === "en" ? en : ar);
const money = (v) => Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 }) + " " + T("د.أ", "JOD");
const num = (v) => Number(v || 0).toLocaleString("en-US");
const fmtTime = (ms) => (ms ? new Date(ms).toLocaleString(lang() === "en" ? "en-GB" : "ar", { dateStyle: "medium", timeStyle: "short" }) : "—");
const badge = (kind, text) => el("span", { class: "badge " + kind }, text);
const SOURCE_BADGE = { DEMO: () => badge("demo", T("بيانات تجريبية DEMO", "DEMO data")), LIVE: () => badge("live", "LIVE"), UNVERIFIED: () => badge("demo", "UNVERIFIED") };
const STATUS_BADGE = {
  VERIFIED: () => badge("verified", "VERIFIED"), TEST_PASSED: () => badge("live", "TEST_PASSED"),
  BUILT: () => badge("built", "BUILT_NOT_TESTED"), BLOCKED: () => badge("blocked", "BLOCKED"),
  NOT_STARTED: () => badge("", "NOT_STARTED"), DEMO: () => badge("demo", "DEMO"),
};

// ---------- navigation ----------
const NAV = [
  ["home", "⌂", "الرئيسية", "Home"],
  ["sales", "🛒", "المبيعات", "Sales"],
  ["inventory", "📦", "المخزون", "Inventory"],
  ["finance", "🏦", "المالية والشيكات", "Finance & cheques"],
  ["investigations", "🛡", "التحقيقات", "Investigations"],
  ["trustsoft-evidence", "🧾", "تحليل TrustSoft", "TrustSoft evidence"],
  ["jawafa-coverage", "▦", "تغطية قاعدة البيانات", "DB coverage"],
  ["github-work", "⚙", "مستودع العمل GitHub", "GitHub work"],
  ["maps", "📍", "الخرائط", "Maps"],
  ["assistant", "✦", "المساعد الذكي", "AI assistant"],
  ["agents", "⚇", "الوكلاء", "Agents"],
  ["aiagents", "✧", "وكلاء الذكاء الاصطناعي", "AI agents"],
  ["sep", "", "العمليات", "Operations"],
  ["notifications", "🛎", "التنبيهات", "Notifications"],
  ["tasks", "✓", "المهام", "Tasks"],
  ["approvals", "🔔", "الموافقات", "Approvals"],
  ["purchases", "🛍", "أوامر الشراء", "Purchase orders"],
  ["suppliers", "🚚", "الموردون", "Suppliers"],
  ["employees", "🪪", "الموظفون", "Employees"],
  ["sep", "", "الإدارة", "Administration"],
  ["connections", "🔗", "الربط والتكاملات", "Integrations"],
  ["company", "🏢", "الشركة", "Company"],
  ["branches", "🏬", "الفروع والمستودعات", "Branches & warehouses"],
  ["members", "👥", "المستخدمون والصلاحيات", "Users & roles"],
  ["audit", "🧾", "سجل التدقيق", "Audit log"],
  ["plans", "★", "الخطط · Premium Plus", "Plans · Premium Plus"],
];
const BOTTOM = ["home", "agents", "inventory", "sales", "company"];
let current = "home";

function buildNav() {
  $("nav").replaceChildren(...NAV.map(([id, ico, ar, en]) => id === "sep"
    ? el("div", { class: "sep" }, T(ar, en))
    : el("a", { href: "#" + id, "data-nav": id }, el("span", { class: "ico", "aria-hidden": "true" }, ico), T(ar, en))));
  $("bottom-nav").replaceChildren(...BOTTOM.map(id => { const n = NAV.find(x => x[0] === id); return el("a", { href: "#" + id, "data-nav": id }, el("span", { class: "ico", "aria-hidden": "true" }, n[1]), T(n[2], n[3])); }));
  for (const node of document.querySelectorAll("[data-i18n]")) {
    const k = node.dataset.i18n; const d = I18N[k]; if (d) node.textContent = T(d[0], d[1]);
  }
  $("lang-btn").textContent = lang() === "en" ? "عربي" : "EN";
  $("q").placeholder = T("بحث في النظام...", "Search...");
}
const I18N = {
  brand: ["جوافة", "JAWAFA"], saasTitle: ["مجانية لكل صاحب مصلحة", "Free for every business"],
  saasBody: ["بلا رسوم ولا عمولة. كل شركة معزولة ببياناتها. الاشتراك الوحيد اختياري: Premium Plus.", "No fees, no commission. Every company is isolated. The only subscription is the optional Premium Plus."],
  legacy: ["مركز القيادة السابق (جميع الوحدات الحالية)", "Previous command center (all existing modules)"],
};

function show(view) {
  view = (view || "home").replace(/^#/, "");
  if (!NAV.some(n => n[0] === view && view !== "sep")) view = "home";
  current = view;
  for (const f of document.querySelectorAll(`section.view[data-view="${view}"] form[data-dirty]`)) f.removeAttribute("data-dirty");
  for (const s of document.querySelectorAll("section.view")) s.hidden = s.dataset.view !== view;
  for (const a of document.querySelectorAll("[data-nav]")) { if (a.dataset.nav === view) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); }
  $("side").classList.remove("open"); $("menu-btn").setAttribute("aria-expanded", "false");
  render();
  window.scrollTo(0, 0);
}

// ---------- state ----------
const state = {
  cloud: "loading", // loading | ready | unconfigured | failed
  user: null, profile: null, companies: [], companyId: null, invites: [], messages: [], tasks: [], branches: [], audit: [], employees: [], suppliers: [], orders: [], agentsAi: [], workspaces: [], scopeKey: null,
  demo: store.get("jawafa-one-demo", "1") === "1",
  localRouter: C.createRouter(),
};
const company = () => state.companies.find(c => c.id === state.companyId) || null;
const role = () => (state.user ? C.roleOf(company(), state.user.uid) : null);
const dataset = (() => { let cache; return () => (state.demo ? (cache ||= C.demoDataset()) : null); })();

// ---------- Firebase ----------
let fb, auth, fs;
const unsubs = { companies: null, invites: null, messages: null, tasks: null, branches: null, audit: null, employees: null, suppliers: null, orders: null, agentsAi: null, workspaces: null };
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error(src)); document.head.append(s); }); }

async function initCloud() {
  const cfg = window.AMER_FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || !cfg.projectId) { state.cloud = "unconfigured"; render(); return; }
  try {
    if (!window.firebase?.firestore) for (const m of ["app", "auth", "firestore"]) await loadScript(`https://cdn.jsdelivr.net/npm/firebase@${FIREBASE_VERSION}/firebase-${m}-compat.js`);
  } catch { state.cloud = "failed"; render(); return; }
  fb = window.firebase;
  const app = fb.apps.length ? fb.app() : fb.initializeApp(EMULATOR ? { ...cfg, projectId: "demo-jawafa-one" } : cfg);
  auth = app.auth(); fs = app.firestore();
  if (EMULATOR) {
    auth.useEmulator("http://127.0.0.1:9099", { disableWarnings: true });
    fs.useEmulator("127.0.0.1", 8080);
    // Test-only sign in: the Auth emulator accepts an unsigned credential. Never active in production.
    window.__jawafaTestSignIn = (email, sub) => auth.signInWithCredential(fb.auth.GoogleAuthProvider.credential(JSON.stringify({ sub, email, email_verified: true, name: email.split("@")[0] })));
  }
  state.cloud = "ready";
  auth.onAuthStateChanged(onUser);
}

async function signIn() {
  if (!auth) { toast(T("تسجيل الدخول غير متاح الآن.", "Sign-in unavailable.")); return; }
  const provider = new fb.auth.GoogleAuthProvider();
  try { await auth.signInWithPopup(provider); }
  catch (e) {
    if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) await auth.signInWithRedirect(provider);
    else if (e && e.code === "auth/unauthorized-domain") toast(T("هذا النطاق غير مضاف إلى Firebase Authentication › Authorized domains.", "Add this domain to Firebase Authentication authorized domains."));
    else if (e && e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") toast(T("تعذّر تسجيل الدخول: ", "Sign-in failed: ") + S(e.code || e.message, 100));
  }
}

function stopAll() { for (const k of Object.keys(unsubs)) { if (unsubs[k]) unsubs[k](); unsubs[k] = null; } }

function onUser(user) {
  stopAll();
  state.user = user && !user.isAnonymous ? { uid: user.uid, email: C.normalizeEmail(user.email), name: user.displayName || "", photo: user.photoURL || "" } : null;
  state.companies = []; state.invites = []; state.messages = []; state.tasks = []; state.branches = []; state.audit = []; state.employees = []; state.suppliers = []; state.orders = []; state.agentsAi = []; state.workspaces = []; state.scopeKey = null; state.companyId = null; state.profile = null;
  if (!state.user) { render(); return; }
  // The profile remembers the last company across devices; localStorage is only a fallback.
  const me = state.user;
  fs.collection("profiles").doc(me.uid).get().then(d => { if (state.user === me) { state.profile = d.exists ? d.data() : {}; if (!state.companyId && state.profile.lastCompanyId && state.companies.some(c => c.id === state.profile.lastCompanyId)) selectCompany(state.profile.lastCompanyId); } }).catch(() => { state.profile = {}; });
  unsubs.companies = fs.collection("companies").where("memberIds", "array-contains", state.user.uid).onSnapshot(snap => {
    state.companies = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => S(a.name).localeCompare(S(b.name)));
    if (!state.companies.some(c => c.id === state.companyId)) {
      const saved = (state.profile && state.profile.lastCompanyId) || store.get("jawafa-one-company:" + state.user.uid, "");
      selectCompany(state.companies.some(c => c.id === saved) ? saved : state.companies[0]?.id || null);
    } else {
      // A manager may change this member's branch scope; re-query with the new filter.
      const sc = C.branchScope(company(), state.user.uid);
      if (state.scopeKey !== state.companyId + "|" + (sc ? sc.join(",") : "*")) subscribeOps();
      render();
    }
  }, err => { toast(T("تعذّر قراءة الشركات: ", "Could not read companies: ") + S(err.code, 60)); });
  if (state.user.email) unsubs.invites = fs.collection("invites").where("email", "==", state.user.email).onSnapshot(snap => {
    state.invites = snap.docs.map(d => ({ id: d.id, ...d.data() })); render();
  }, () => {});
}

function selectCompany(id) {
  for (const k of ["messages", "tasks", "branches", "audit", "agentsAi", "workspaces"]) { if (unsubs[k]) unsubs[k](); unsubs[k] = null; }
  state.companyId = id; state.messages = []; state.tasks = []; state.branches = []; state.audit = []; state.agentsAi = []; state.workspaces = [];
  aiState.answer = null; aiState.error = null; aiState.editingAgent = null;
  if (id && state.user) {
    store.set("jawafa-one-company:" + state.user.uid, id);
    if (!state.profile || state.profile.lastCompanyId !== id) {
      state.profile = { ...(state.profile || {}), lastCompanyId: id };
      fs.collection("profiles").doc(state.user.uid).set({ email: state.user.email, name: S(state.user.name, 80), lastCompanyId: id, updatedAt: Date.now() }, { merge: true }).catch(() => {});
    }
    const ref = fs.collection("companies").doc(id);
    unsubs.branches = ref.collection("branches").orderBy("name").onSnapshot(s => { state.branches = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }, () => {});
    unsubs.audit = ref.collection("audit").orderBy("at", "desc").limit(100).onSnapshot(s => { state.audit = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }, () => {});
    unsubs.messages = ref.collection("agentMessages").orderBy("at", "desc").limit(50).onSnapshot(s => { state.messages = s.docs.map(d => d.data()); render(); }, () => {});
    const byName = (a, b) => S(a.name).localeCompare(S(b.name));
    unsubs.agentsAi = ref.collection("agents").limit(200).onSnapshot(s => { state.agentsAi = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => typeof a.systemInstruction === "string").sort(byName); render(); }, () => {});
    unsubs.workspaces = ref.collection("workspaces").limit(200).onSnapshot(s => { state.workspaces = s.docs.map(d => ({ id: d.id, ...d.data() })).sort(byName); render(); }, () => {});
    unsubs.tasks = ref.collection("tasks").orderBy("at", "desc").limit(300).onSnapshot(s => { state.tasks = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }, () => {});
  }
  subscribeOps();
  render();
}

async function audit(action, detail) {
  if (!fs || !state.user || !state.companyId) return;
  try { await fs.collection("companies").doc(state.companyId).collection("audit").add({ by: state.user.uid, email: state.user.email, action, detail: S(detail, 300), at: Date.now() }); } catch {}
}
function fail(e) { toast(e && e.code === "permission-denied" ? T("ليست لديك صلاحية لهذا الإجراء.", "You do not have permission for this action.") : T("تعذّر الحفظ: ", "Save failed: ") + S(e && (e.code || e.message), 80)); }

// ---------- company actions ----------
async function createCompany(name) {
  if (!C.validCompanyName(name)) { toast(T("اكتب اسم شركة (1–80 حرفًا).", "Enter a company name (1–80 chars).")); return; }
  const u = state.user;
  try {
    const ref = fs.collection("companies").doc();
    await ref.set({ name: name.trim(), ownerUid: u.uid, memberIds: [u.uid], roles: {}, members: { [u.uid]: { email: u.email, name: S(u.name, 80) } }, pendingInvites: {}, social: {}, plan: "free", createdAt: Date.now() });
    selectCompany(ref.id);
    toast(T("أُنشئت الشركة. أنت مالكها.", "Company created. You are the owner."));
    audit("company.create", name);
  } catch (e) { fail(e); }
}
async function invite(email, r) {
  email = C.normalizeEmail(email);
  if (!C.isEmail(email)) { toast(T("بريد غير صالح.", "Invalid email.")); return; }
  if (!C.INVITABLE_ROLES.includes(r)) return;
  const c = company();
  try {
    await fs.collection("invites").doc(C.inviteId(c.id, email)).set({ companyId: c.id, companyName: c.name, email, role: r, invitedBy: state.user.uid, at: Date.now() });
    await fs.collection("companies").doc(c.id).update(new fb.firestore.FieldPath("pendingInvites", email), r);
    await audit("member.invite", email + " → " + r);
    toast(T("أُرسلت الدعوة. يقبلها المدعو بعد الدخول بحساب Google لهذا البريد.", "Invitation saved. The invitee accepts it after signing in with that Google account."));
  } catch (e) { fail(e); }
}
async function revoke(email) {
  const c = company();
  try {
    await fs.collection("invites").doc(C.inviteId(c.id, email)).delete();
    await fs.collection("companies").doc(c.id).update(new fb.firestore.FieldPath("pendingInvites", email), fb.firestore.FieldValue.delete());
    await audit("member.revoke", email);
  } catch (e) { fail(e); }
}
async function acceptInvite(inv) {
  const u = state.user, FP = fb.firestore.FieldPath, FV = fb.firestore.FieldValue;
  try {
    await fs.collection("companies").doc(inv.companyId).update("memberIds", FV.arrayUnion(u.uid), new FP("roles", u.uid), inv.role,
      new FP("members", u.uid), { email: u.email, name: S(u.name, 80) }, new FP("pendingInvites", u.email), FV.delete());
    await fs.collection("invites").doc(inv.id).delete();
    state.companyId = inv.companyId; store.set("jawafa-one-company:" + u.uid, inv.companyId);
    toast(T("انضممت إلى ", "Joined ") + S(inv.companyName, 80));
  } catch (e) { fail(e); }
}
async function declineInvite(inv) { try { await fs.collection("invites").doc(inv.id).delete(); } catch (e) { fail(e); } }
async function setRole(uid, r) {
  try { await fs.collection("companies").doc(state.companyId).update(new fb.firestore.FieldPath("roles", uid), r); await audit("member.role", uid + " → " + r); toast(T("حُدّث الدور.", "Role updated.")); } catch (e) { fail(e); }
}
async function removeMember(uid, self) {
  const FP = fb.firestore.FieldPath, FV = fb.firestore.FieldValue;
  if (!confirm(self ? T("مغادرة هذه الشركة؟", "Leave this company?") : T("إزالة هذا العضو من الشركة؟", "Remove this member?"))) return;
  try {
    if (!self) await audit("member.remove", uid);
    await fs.collection("companies").doc(state.companyId).update("memberIds", FV.arrayRemove(uid), new FP("roles", uid), FV.delete(), new FP("members", uid), FV.delete());
  } catch (e) { fail(e); }
}
async function saveCompany(form) {
  const name = form.name.value.trim();
  const social = {};
  for (const p of ["facebook", "instagram", "tiktok"]) {
    const v = C.validateSocial(p, form[p].value);
    if (!v.ok) { toast(p + ": " + v.error); form[p].focus(); return; }
    if (v.value) social[p] = v.value;
  }
  if (!C.validCompanyName(name)) { toast(T("اسم الشركة مطلوب.", "Company name required.")); return; }
  try { await fs.collection("companies").doc(state.companyId).update({ name, social }); await audit("company.update", name); toast(T("حُفظ ملف الشركة.", "Company profile saved.")); } catch (e) { fail(e); }
}

// ---------- agents ----------
const hierarchy = () => [
  { id: "agent-999", code: "999", name: T("المشرف العام", "Central supervisor") },
  { id: "agent-777", code: "777", name: T("الإدارة والوكلاء", "Management & agents") },
  { id: "agent-666", code: "666", name: T("الوكلاء", "Agents") },
  { id: "dispatcher-1", code: "D1", name: T("موزع المهام 1", "Task dispatcher 1") },
  { id: "dispatcher-2", code: "D2", name: T("موزع المهام 2", "Task dispatcher 2") },
];
const BLOCK_REASON = () => T("لا يوجد تعريف أو قناة اتصال لهذا الوكيل في مصادر المستودع. روابط محادثات ChatGPT ليست قناة API؛ يلزم endpoint مصرّح به.", "No definition or channel for this agent in the repository. ChatGPT conversation links are not an API channel; an authorised endpoint is required.");
const allAgents = () => [...hierarchy().map(a => ({ ...a, group: "HIERARCHY" })), ...OFFICIAL_AGENTS.map(a => ({ id: a.id, code: a.initials, name: a.name, group: a.group, description: a.description }))];

async function sendMessage(from, to, body) {
  const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  if (state.user && state.companyId) {
    try {
      await fs.collection("companies").doc(state.companyId).collection("agentMessages").doc(id).set({ id, from, to, body, status: "QUEUED", sentBy: state.user.uid, history: [{ status: "QUEUED", at: Date.now() }], at: Date.now() });
      toast(T("حُفظت الرسالة بحالة QUEUED. لا تتقدم الحالة دون إيصال من الوكيل المستلم.", "Message saved as QUEUED. Status advances only with a receipt from the recipient."));
    } catch (e) { fail(e); }
  } else {
    try { state.localRouter.send({ id, from, to, body, at: Date.now() }); toast(T("رسالة محلية (معاينة) بحالة QUEUED — سجّل الدخول لحفظها.", "Local preview message (QUEUED) — sign in to persist.")); render(); }
    catch (e) { toast(S(e.message, 120)); }
  }
}

// ---------- assistant (local, cites its source; Gemini itself is BLOCKED) ----------
function answer(q) {
  const d = dataset();
  if (!d) return { text: T("لا يوجد مصدر بيانات متصل. فعّل البيانات التجريبية للمعاينة أو اربط مصدرًا حقيقيًا من مركز الربط.", "No data source connected. Enable demo data or connect a real source."), src: "—" };
  const src = T("المصدر: بيانات تجريبية DEMO (core.js) — ليست بيانات شركتك", "Source: DEMO dataset (core.js) — not your company data");
  const s = q.replace(/\s+/g, " ");
  if (/(أمس|yesterday)/i.test(s) && /(مبيعات|sales)/i.test(s)) {
    const days = C.dailySales(d, 8); const y = days[6], week = days.slice(0, 7);
    const avg = week.reduce((t, x) => t + x.total, 0) / 7;
    const pct = avg ? ((y.total - avg) / avg) * 100 : 0;
    return { text: T(`مبيعات أمس (${y.day}): ${money(y.total)}.\nمتوسط آخر 7 أيام: ${money(avg)}.\nالفرق: ${pct.toFixed(1)}%.`, `Yesterday (${y.day}): ${money(y.total)}.\n7-day average: ${money(avg)}.\nDifference: ${pct.toFixed(1)}%.`), src: src + " · dailySales()" };
  }
  if (/(شيك|cheque|check)/i.test(s)) {
    const due = d.cheques.filter(c => c.status === "pending" && c.due - d.generatedAt <= 7 * 864e5);
    return { text: due.length ? due.map(c => `${c.no} · ${c.party} · ${money(c.amount)} · ${fmtTime(c.due)}`).join("\n") : T("لا شيكات مستحقة خلال 7 أيام.", "No cheques due within 7 days."), src: src + " · cheques" };
  }
  if (/(تنفد|نفاد|low stock|run out|ينفد)/i.test(s)) {
    const low = d.stock.filter(x => x.qty < x.reorder).sort((a, b) => a.qty - b.qty).slice(0, 10);
    const bn = (id) => d.branches.find(b => b.id === id)?.name || id;
    return { text: low.map(x => `${x.name} — ${bn(x.branch)}: ${num(x.qty)} (${T("حد الطلب", "reorder")} ${x.reorder})`).join("\n"), src: src + " · stock < reorder" };
  }
  if (/(سيولة|liquidity|cash)/i.test(s)) {
    const v = d.cash.filter(c => Math.abs(c.counted - c.expected) >= 50);
    const due = d.cheques.filter(c => c.status === "pending").reduce((t, c) => t + c.amount, 0);
    return { text: T(`لا أستطيع تحديد أسباب السيولة دون بيانات محاسبية حقيقية. المؤشرات المتاحة:\n• شيكات صادرة معلقة: ${money(due)}\n• فروقات صناديق ≥ 50: ${v.length}\nهذه مؤشرات للتحقق وليست استنتاجًا.`, `I can't determine liquidity causes without real accounting data. Available indicators:\n• Pending cheques: ${money(due)}\n• Cash variances ≥ 50: ${v.length}\nThese are leads, not conclusions.`), src: src + " · cash, cheques" };
  }
  return { text: T("هذا السؤال يحتاج نموذج Gemini عبر خادم آمن، وهو غير متصل في هذا الإصدار (BLOCKED). الأسئلة المدعومة محليًا: مبيعات أمس، الشيكات المستحقة، الأصناف التي قد تنفد، مؤشرات السيولة.", "This needs Gemini via a secure backend, not connected in this build (BLOCKED). Supported locally: yesterday's sales, cheques due, low stock, liquidity indicators."), src: T("لم تُستخدم أي بيانات", "No data used") };
}
const chat = [];

// ---------- CSV export ----------
// Excel-friendly (UTF-8 BOM). The first line states the data source so a DEMO export can never be
// mistaken for real figures.
function csvCell(v) { if (typeof v === "number") return Number.isFinite(v) ? String(v) : ""; const t = v == null ? "" : String(v); return /[",\n\r]/.test(t) || /^[=+\-@]/.test(t) ? '"' + (/^[=+\-@]/.test(t) ? "'" : "") + t.replace(/"/g, '""') + '"' : t; }
function toCsv(source, headers, rows) {
  return "\ufeff" + [[T("مصدر البيانات", "Data source"), source], headers, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n");
}
function downloadCsv(name, source, headers, rows) {
  const blob = new Blob([toCsv(source, headers, rows)], { type: "text/csv;charset=utf-8" });
  const a = el("a", { href: URL.createObjectURL(blob), download: `${name}-${source}-${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
window.__jawafaToCsv = toCsv;
const csvBtn = (fn) => el("button", { class: "ghost", onclick: fn }, "⬇ CSV");

// ---------- branches ----------
const BRANCH_KINDS = { market: ["سوق", "Market"], restaurant: ["مطعم", "Restaurant"], bakery: ["فرن", "Bakery"], warehouse: ["مستودع", "Warehouse"], office: ["إدارة", "Office"] };
async function addBranch(f) {
  const name = f.bname.value.trim(), kind = f.kind.value, city = f.city.value.trim();
  const lat = f.lat.value === "" ? null : Number(f.lat.value), lng = f.lng.value === "" ? null : Number(f.lng.value);
  if (!name || name.length > 80) { toast(T("اسم الفرع مطلوب (حتى 80 حرفًا).", "Branch name required (≤80).")); return false; }
  if (!BRANCH_KINDS[kind]) return false;
  if ((lat !== null && !(lat >= -90 && lat <= 90)) || (lng !== null && !(lng >= -180 && lng <= 180)) || ((lat === null) !== (lng === null))) { toast(T("الإحداثيات غير صحيحة.", "Invalid coordinates.")); return false; }
  try {
    await fs.collection("companies").doc(state.companyId).collection("branches").add({ name, kind, city: S(city, 80), lat, lng, by: state.user.uid, at: Date.now() });
    audit("branch.create", name); toast(T("أُضيف الفرع.", "Branch added.")); return true;
  } catch (e) { fail(e); return false; }
}
async function deleteBranch(b) {
  if (!confirm(T("حذف الفرع «" + b.name + "»؟", "Delete branch \"" + b.name + "\"?"))) return;
  try { await fs.collection("companies").doc(state.companyId).collection("branches").doc(b.id).delete(); audit("branch.delete", b.name); } catch (e) { fail(e); }
}
function renderBranches(v) {
  if (!state.user) return needSignIn(v, T("الفروع والمستودعات", "Branches & warehouses"));
  if (!company()) { v.replaceChildren(sectionHead(T("الفروع والمستودعات", "Branches & warehouses")), el("p", null, el("a", { href: "#company" }, T("أنشئ شركة أو اقبل دعوة أولًا.", "Create a company or accept an invitation first.")))); return; }
  const w = C.can(role(), "write");
  const form = w ? el("form", { class: "panel", onsubmit: async (e) => { e.preventDefault(); if (await addBranch(e.target)) e.target.reset(); } },
    el("h3", null, T("إضافة فرع أو مستودع", "Add branch or warehouse")),
    el("div", { class: "cols-2" },
      el("label", { class: "small" }, T("الاسم", "Name"), el("input", { name: "bname", maxlength: "80", required: true })),
      el("label", { class: "small" }, T("النوع", "Type"), el("select", { name: "kind" }, ...Object.entries(BRANCH_KINDS).map(([k, l]) => el("option", { value: k }, T(l[0], l[1]))))),
      el("label", { class: "small" }, T("المدينة", "City"), el("input", { name: "city", maxlength: "80" })),
      el("div", { class: "cols-2" },
        el("label", { class: "small" }, T("خط العرض", "Latitude"), el("input", { name: "lat", type: "number", step: "any", class: "ltr" })),
        el("label", { class: "small" }, T("خط الطول", "Longitude"), el("input", { name: "lng", type: "number", step: "any", class: "ltr" })))),
    el("button", { class: "primary", type: "submit" }, T("إضافة", "Add"))) : el("div", { class: "panel muted small" }, T("دورك للقراءة فقط.", "Your role is read only."));
  const rows = state.branches.map(b => el("tr", null, el("td", null, S(b.name, 80)), el("td", null, T(...(BRANCH_KINDS[b.kind] || [b.kind, b.kind]))), el("td", null, S(b.city, 80)),
    el("td", { class: "ltr" }, b.lat != null ? `${b.lat}, ${b.lng}` : "—"),
    el("td", null, b.lat != null ? el("a", { href: `https://www.google.com/maps?q=${b.lat},${b.lng}`, target: "_blank", rel: "noopener noreferrer" }, "Google Maps") : ""),
    el("td", null, w ? el("button", { class: "ghost", onclick: () => deleteBranch(b) }, T("حذف", "Delete")) : "")));
  v.replaceChildren(sectionHead(T("الفروع والمستودعات", "Branches & warehouses"), badge("demo", "UNVERIFIED"), csvBtn(() => downloadCsv("branches", "UNVERIFIED", [T("الاسم", "Name"), T("النوع", "Type"), T("المدينة", "City"), "lat", "lng"], state.branches.map(b => [b.name, b.kind, b.city, b.lat, b.lng])))),
    el("div", { class: "banner info" }, T("بيانات الفروع يدخلها أعضاء الشركة وتُحفظ في Firestore الخاص بشركتك. وسمها UNVERIFIED لأنها غير مطابقة مع مصدر رسمي. صلاحيات الفروع: يحدد المدير لكل مدير فرع أو موظف فروعه من شاشة المستخدمين.", "Branch data is entered by company members and stored in your company's Firestore. Labelled UNVERIFIED because it is not matched against an official source. Branch permissions: managers set each branch manager's or employee's branches on the users screen.")),
    form, el("div", { style: "margin-top:1rem" }, table([T("الاسم", "Name"), T("النوع", "Type"), T("المدينة", "City"), T("الإحداثيات", "Coordinates"), "", ""], rows)));
}

// ---------- operations: employees, suppliers, purchase orders, approvals (Phase 2) ----------
// Records live in companies/{id}/employees|suppliers|purchaseOrders and are protected by
// firestore.rules (tests EMP-01, SCOPE-01, SUP-01, PO-01, PO-02). Nothing here is DEMO data:
// lists start empty and hold only what company members enter (labelled UNVERIFIED).
const scope = () => (state.user ? C.branchScope(company(), state.user.uid) : null);
const branchName = (id) => S(state.branches.find(b => b.id === id)?.name || id, 80);
const supplierName = (id) => S(state.suppliers.find(s => s.id === id)?.name || id, 80);
const PO_LABEL = { draft: ["مسودة", "Draft"], submitted: ["بانتظار الموافقة", "Awaiting approval"], approved: ["معتمد", "Approved"], rejected: ["مرفوض", "Rejected"], received: ["مستلم", "Received"] };
const PO_BADGE = { draft: "", submitted: "demo", approved: "live", rejected: "blocked", received: "verified" };
const poBadge = (s) => badge(PO_BADGE[s] ?? "", T(...(PO_LABEL[s] || [s, s])));
const myApprovals = () => C.pendingApprovals(role(), state.orders);
const needCompany = (v, title) => v.replaceChildren(sectionHead(title), el("p", null, el("a", { href: "#company" }, T("أنشئ شركة أو اقبل دعوة أولًا.", "Create a company or accept an invitation first."))));
const scopeNote = () => scope() ? el("div", { class: "banner info" }, T("صلاحيتك محصورة في الفروع: ", "Your access is limited to branches: ") + scope().map(branchName).join("، ")) : null;
const branchOptions = (sel, filter) => state.branches.filter(b => !filter || filter(b.id)).map(b => el("option", { value: b.id, selected: b.id === sel }, S(b.name, 80)));

function subscribeOps() {
  for (const k of ["employees", "suppliers", "orders"]) { if (unsubs[k]) unsubs[k](); unsubs[k] = null; }
  state.employees = []; state.suppliers = []; state.orders = [];
  const id = state.companyId;
  if (!id || !state.user || !company()) { state.scopeKey = null; return; }
  const sc = scope();
  state.scopeKey = id + "|" + (sc ? sc.join(",") : "*");
  const ref = fs.collection("companies").doc(id);
  // Scoped members must ask only for their branches: the rules reject an unfiltered query.
  const scoped = (q) => (sc ? q.where("branchId", "in", sc.slice(0, 30)) : q);
  const sortAt = (a, b) => (b.at || 0) - (a.at || 0);
  unsubs.employees = scoped(ref.collection("employees")).limit(500).onSnapshot(s => { state.employees = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => S(a.name).localeCompare(S(b.name))); render(); }, () => {});
  unsubs.suppliers = ref.collection("suppliers").limit(500).onSnapshot(s => { state.suppliers = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => S(a.name).localeCompare(S(b.name))); render(); }, () => {});
  unsubs.orders = scoped(ref.collection("purchaseOrders")).limit(500).onSnapshot(s => { state.orders = s.docs.map(d => ({ id: d.id, ...d.data() })).sort(sortAt); render(); }, () => {});
}

// --- employees ---
const empForm = { editing: null };
async function saveEmployee(f) {
  const name = f.ename.value.trim(), branchId = f.branch.value, startDate = f.start.value;
  if (!name || name.length > 80) { toast(T("اسم الموظف مطلوب (حتى 80 حرفًا).", "Employee name required (≤80).")); return false; }
  if (!branchId) { toast(T("اختر الفرع. أضف فرعًا أولًا إن لم يوجد.", "Choose a branch (add one first if none).")); return false; }
  if (!C.isDate(startDate)) { toast(T("تاريخ المباشرة غير صحيح.", "Invalid start date.")); return false; }
  const data = { name, title: S(f.title.value.trim(), 80), branchId, phone: S(f.phone.value.trim(), 30), status: f.status.value === "inactive" ? "inactive" : "active", startDate, by: state.user.uid, at: Date.now() };
  const col = fs.collection("companies").doc(state.companyId).collection("employees");
  try {
    if (empForm.editing) { await col.doc(empForm.editing).set(data); audit("employee.update", name); }
    else { await col.add(data); audit("employee.create", name); }
    empForm.editing = null; toast(T("حُفظ الموظف.", "Employee saved.")); return true;
  } catch (e) { fail(e); return false; }
}
async function setEmployeeStatus(e, status) {
  try { await fs.collection("companies").doc(state.companyId).collection("employees").doc(e.id).update({ status, by: state.user.uid, at: Date.now() }); audit(status === "inactive" ? "employee.deactivate" : "employee.activate", e.name); }
  catch (err) { fail(err); }
}
function renderEmployees(v) {
  const title = T("الموظفون", "Employees");
  if (!state.user) return needSignIn(v, title);
  if (!company()) return needCompany(v, title);
  const r = role(), sc = scope();
  const filter = v.querySelector("#emp-branch")?.value || "";
  const list = state.employees.filter(e => !filter || e.branchId === filter);
  const canAny = C.can(r, "manage") || r === "branch_manager";
  const editing = empForm.editing ? state.employees.find(e => e.id === empForm.editing) : null;
  const form = canAny ? el("form", { class: "panel", onsubmit: async (e) => { e.preventDefault(); if (await saveEmployee(e.target)) { e.target.reset(); render(); } } },
    el("h3", null, editing ? T("تعديل موظف", "Edit employee") : T("إضافة موظف", "Add employee")),
    el("div", { class: "cols-2" },
      el("label", { class: "small" }, T("الاسم", "Name"), el("input", { name: "ename", maxlength: "80", required: true, value: editing ? S(editing.name, 80) : null })),
      el("label", { class: "small" }, T("المسمى الوظيفي", "Job title"), el("input", { name: "title", maxlength: "80", value: editing ? S(editing.title, 80) : null })),
      el("label", { class: "small" }, T("الفرع", "Branch"), el("select", { name: "branch", required: true }, el("option", { value: "" }, "—"), ...branchOptions(editing?.branchId, (id) => C.canManageEmployees(r, sc, id)))),
      el("label", { class: "small" }, T("الهاتف", "Phone"), el("input", { name: "phone", maxlength: "30", class: "ltr", inputmode: "tel", value: editing ? S(editing.phone, 30) : null })),
      el("label", { class: "small" }, T("تاريخ المباشرة", "Start date"), el("input", { name: "start", type: "date", class: "ltr", value: editing ? S(editing.startDate, 10) : null })),
      el("label", { class: "small" }, T("الحالة", "Status"), el("select", { name: "status" }, el("option", { value: "active", selected: editing?.status !== "inactive" }, T("على رأس العمل", "Active")), el("option", { value: "inactive", selected: editing?.status === "inactive" }, T("موقوف", "Inactive"))))),
    el("div", { class: "toolbar" }, el("button", { class: "primary", type: "submit" }, editing ? T("حفظ التعديل", "Save changes") : T("إضافة", "Add")),
      editing ? el("button", { type: "button", onclick: () => { empForm.editing = null; v.querySelector("form")?.removeAttribute("data-dirty"); render(); } }, T("إلغاء", "Cancel")) : null),
    state.branches.length ? null : el("p", { class: "small muted" }, el("a", { href: "#branches" }, T("لا توجد فروع بعد — أضف فرعًا أولًا.", "No branches yet — add one first."))))
    : el("div", { class: "panel muted small" }, T("دورك للقراءة فقط. إدارة الموظفين للمالك ورئيس المجلس والمدير العام ومدير الفرع.", "Read only. Owner, chairman, general manager and branch managers manage employees."));
  const rows = list.map(e => el("tr", null, el("td", null, S(e.name, 80)), el("td", null, S(e.title, 80)), el("td", null, branchName(e.branchId)),
    el("td", { class: "ltr" }, S(e.phone, 30)), el("td", { class: "ltr" }, S(e.startDate, 10) || "—"),
    el("td", null, e.status === "inactive" ? badge("blocked", T("موقوف", "Inactive")) : badge("live", T("على رأس العمل", "Active"))),
    el("td", null, C.canManageEmployees(r, sc, e.branchId) ? el("div", { class: "toolbar", style: "margin:0" },
      el("button", { class: "ghost", onclick: () => { empForm.editing = e.id; v.querySelector("form")?.removeAttribute("data-dirty"); render(); } }, T("تعديل", "Edit")),
      el("button", { class: "ghost", onclick: () => setEmployeeStatus(e, e.status === "inactive" ? "active" : "inactive") }, e.status === "inactive" ? T("إعادة تفعيل", "Reactivate") : T("إيقاف", "Deactivate"))) : "")));
  v.replaceChildren(sectionHead(title, badge("demo", "UNVERIFIED"),
      el("select", { id: "emp-branch", style: "width:auto", "aria-label": T("تصفية حسب الفرع", "Filter by branch"), onchange: () => renderEmployees(v) }, el("option", { value: "" }, T("كل الفروع", "All branches")), ...branchOptions(filter, sc ? (id) => sc.includes(id) : null)),
      csvBtn(() => downloadCsv("employees", "UNVERIFIED", [T("الاسم", "Name"), T("المسمى", "Title"), T("الفرع", "Branch"), T("الهاتف", "Phone"), T("المباشرة", "Start"), T("الحالة", "Status")], list.map(e => [e.name, e.title, branchName(e.branchId), e.phone, e.startDate, e.status])))),
    el("div", { class: "banner info" }, T("سجلات الموظفين يدخلها أعضاء الشركة وتُحفظ في Firestore شركتك. لا تُحذف؛ تُوقف فقط ليبقى السجل كاملًا. غير مربوطة بقاعدة جوافة.", "Employee records are entered by company members and stored in your company's Firestore. They are never deleted, only deactivated. Not connected to the Jawafa database.")),
    scopeNote() || "", form,
    el("div", { style: "margin-top:1rem" }, table([T("الاسم", "Name"), T("المسمى", "Title"), T("الفرع", "Branch"), T("الهاتف", "Phone"), T("المباشرة", "Start"), T("الحالة", "Status"), ""], rows)));
}

// --- suppliers ---
async function addSupplier(f) {
  const name = f.sname.value.trim(), email = f.semail.value.trim();
  if (!name || name.length > 80) { toast(T("اسم المورد مطلوب (حتى 80 حرفًا).", "Supplier name required (≤80).")); return false; }
  if (email && !C.isEmail(email)) { toast(T("البريد غير صحيح.", "Invalid email.")); return false; }
  try {
    await fs.collection("companies").doc(state.companyId).collection("suppliers").add({ name, phone: S(f.sphone.value.trim(), 30), email: C.normalizeEmail(email), category: S(f.scat.value.trim(), 80), status: "active", by: state.user.uid, at: Date.now() });
    audit("supplier.create", name); toast(T("أُضيف المورد.", "Supplier added.")); return true;
  } catch (e) { fail(e); return false; }
}
async function setSupplierStatus(s, status) {
  try { await fs.collection("companies").doc(state.companyId).collection("suppliers").doc(s.id).update({ status, by: state.user.uid, at: Date.now() }); audit("supplier." + (status === "inactive" ? "deactivate" : "activate"), s.name); }
  catch (e) { fail(e); }
}
function renderSuppliers(v) {
  const title = T("الموردون", "Suppliers");
  if (!state.user) return needSignIn(v, title);
  if (!company()) return needCompany(v, title);
  const w = C.PROCURERS.includes(role());
  const stats = C.supplierStats(state.orders);
  const st = (id) => stats[id] || { orders: 0, spend: 0, rejectionRate: null, avgApprovalHours: null, avgDeliveryHours: null };
  const hrs = (h) => (h == null ? "—" : num(h) + T(" س", " h"));
  const form = w ? el("form", { class: "panel", onsubmit: async (e) => { e.preventDefault(); if (await addSupplier(e.target)) e.target.reset(); } },
    el("h3", null, T("إضافة مورد", "Add supplier")),
    el("div", { class: "cols-2" },
      el("label", { class: "small" }, T("الاسم", "Name"), el("input", { name: "sname", maxlength: "80", required: true })),
      el("label", { class: "small" }, T("الفئة", "Category"), el("input", { name: "scat", maxlength: "80" })),
      el("label", { class: "small" }, T("الهاتف", "Phone"), el("input", { name: "sphone", maxlength: "30", class: "ltr", inputmode: "tel" })),
      el("label", { class: "small" }, T("البريد", "Email"), el("input", { name: "semail", type: "email", maxlength: "200", class: "ltr" }))),
    el("button", { class: "primary", type: "submit" }, T("إضافة", "Add"))) : el("div", { class: "panel muted small" }, T("إضافة الموردين للمالك ورئيس المجلس والمدير العام ومدير المشتريات.", "Owner, chairman, general manager and procurement manager add suppliers."));
  const rows = state.suppliers.map(s => el("tr", null, el("td", null, S(s.name, 80)), el("td", null, S(s.category, 80)), el("td", { class: "ltr" }, S(s.phone, 30)), el("td", { class: "ltr" }, S(s.email, 200)),
    el("td", null, num(st(s.id).orders)), el("td", null, money(st(s.id).spend)), el("td", null, st(s.id).rejectionRate == null ? "—" : st(s.id).rejectionRate + "%"),
    el("td", null, hrs(st(s.id).avgApprovalHours)), el("td", null, hrs(st(s.id).avgDeliveryHours)), el("td", null, s.status === "inactive" ? badge("blocked", T("موقوف", "Inactive")) : badge("live", T("نشط", "Active"))),
    el("td", null, w ? el("button", { class: "ghost", onclick: () => setSupplierStatus(s, s.status === "inactive" ? "active" : "inactive") }, s.status === "inactive" ? T("تفعيل", "Activate") : T("إيقاف", "Deactivate")) : "")));
  v.replaceChildren(sectionHead(title, badge("demo", "UNVERIFIED"), csvBtn(() => downloadCsv("suppliers", "UNVERIFIED", [T("الاسم", "Name"), T("الفئة", "Category"), T("الهاتف", "Phone"), T("البريد", "Email"), T("الحالة", "Status")], state.suppliers.map(s => [s.name, s.category, s.phone, s.email, s.status])))),
    el("div", { class: "banner info" }, T("قائمة الموردين يدخلها فريق المشتريات. مؤشرات الأداء (عدد الأوامر، والمصروف المعتمد، ونسبة الرفض، ومتوسط زمن الموافقة من الإرسال إلى القرار، ومتوسط زمن التوريد من الاعتماد إلى الاستلام) محسوبة من أوامر الشراء المسجلة هنا فقط، لا من قاعدة جوافة.", "Suppliers are entered by the procurement team. Performance figures (orders, approved spend, rejection rate, average approval time from submission to decision, average delivery time from approval to receipt) come only from purchase orders recorded here, not from the Jawafa database.")),
    form, el("div", { style: "margin-top:1rem" }, table([T("الاسم", "Name"), T("الفئة", "Category"), T("الهاتف", "Phone"), T("البريد", "Email"), T("أوامر الشراء", "Orders"), T("المصروف المعتمد", "Approved spend"), T("نسبة الرفض", "Rejection"), T("زمن الموافقة", "Approval time"), T("زمن التوريد", "Delivery time"), T("الحالة", "Status"), ""], rows)));
}

// --- purchase orders ---
// Form values live here so that adding or removing a line (which redraws the form) keeps them.
const poDraft = { supplierId: "", branchId: "", notes: "", lines: [{ sku: "", name: "", qty: "1", unitPrice: "" }] };
async function createOrder(f) {
  const supplierId = f.supplier.value, branchId = f.branch.value;
  if (!supplierId || !branchId) { toast(T("اختر المورد والفرع.", "Choose supplier and branch.")); return false; }
  const v = C.validateLines(poDraft.lines);
  if (!v.ok) { toast(v.error); return false; }
  try {
    const now = Date.now();
    const ref = await fs.collection("companies").doc(state.companyId).collection("purchaseOrders").add({ supplierId, branchId, lines: v.lines, total: v.total, notes: S(f.notes.value.trim(), 500), status: "draft", createdBy: state.user.uid, at: now, updatedAt: now });
    audit("po.create", ref.id + " · " + supplierName(supplierId) + " · " + v.total);
    Object.assign(poDraft, { supplierId: "", branchId: "", notes: "", lines: [{ sku: "", name: "", qty: "1", unitPrice: "" }] });
    toast(T("حُفظ أمر الشراء كمسودة.", "Purchase order saved as draft.")); return true;
  } catch (e) { fail(e); return false; }
}
/** Moves an order to its next status and writes the audit entry in the same atomic batch
 * (the rules reject a decision without it). */
async function moveOrder(o, to, note) {
  const u = state.user, now = Date.now();
  const ref = fs.collection("companies").doc(state.companyId);
  const auditRef = ref.collection("audit").doc();
  const change = { status: to, updatedAt: now, lastAuditId: auditRef.id };
  if (to === "submitted") Object.assign(change, { submittedBy: u.uid, submittedAt: now });
  if (to === "approved" || to === "rejected") Object.assign(change, { decidedBy: u.uid, decidedAt: now, decisionNote: S(note || "", 500) });
  if (to === "received") Object.assign(change, { receivedBy: u.uid, receivedAt: now });
  const b = fs.batch();
  b.set(auditRef, { by: u.uid, email: u.email, action: C.PO_ACTION[to], ref: o.id, detail: S(supplierName(o.supplierId) + " · " + o.total + (note ? " · " + note : ""), 300), at: now });
  b.update(ref.collection("purchaseOrders").doc(o.id), change);
  try { await b.commit(); toast(T("تم: ", "Done: ") + T(...PO_LABEL[to])); } catch (e) { fail(e); }
}
async function deleteDraft(o) {
  if (!confirm(T("حذف المسودة؟", "Delete this draft?"))) return;
  try { await fs.collection("companies").doc(state.companyId).collection("purchaseOrders").doc(o.id).delete(); audit("po.delete", o.id); } catch (e) { fail(e); }
}
function orderLines(o) {
  const computed = C.poTotal(o.lines);
  return el("details", null, el("summary", { class: "small" }, num((o.lines || []).length) + T(" سطر", " lines")),
    table([T("الرمز", "SKU"), T("الصنف", "Item"), T("الكمية", "Qty"), T("سعر الوحدة", "Unit price"), T("المجموع", "Subtotal")],
      (o.lines || []).map(l => el("tr", null, el("td", { class: "ltr" }, S(l.sku, 40)), el("td", null, S(l.name, 120)), el("td", null, num(l.qty)), el("td", null, money(l.unitPrice)), el("td", null, money(Number(l.qty) * Number(l.unitPrice)))))),
    Math.abs(computed - Number(o.total || 0)) > 0.005 ? el("div", { class: "banner" }, T("تنبيه: الإجمالي المحفوظ لا يطابق مجموع السطور (", "Warning: stored total does not match the lines (") + money(computed) + ")") : null);
}
function orderActions(o) {
  const moves = C.poMoves(role(), scope(), o);
  const btns = moves.filter(m => m === "submitted" || m === "received").map(m => el("button", { class: "primary", onclick: () => moveOrder(o, m) }, m === "submitted" ? T("إرسال للموافقة", "Submit for approval") : T("تأكيد الاستلام", "Confirm receipt")));
  if (moves.includes("approved")) btns.push(el("a", { class: "button", href: "#approvals" }, T("قرّر في الموافقات", "Decide in approvals")));
  if (o.status === "draft" && C.PROCURERS.includes(role())) btns.push(el("button", { class: "ghost", onclick: () => deleteDraft(o) }, T("حذف", "Delete")));
  return el("div", { class: "toolbar", style: "margin:0" }, ...btns);
}
function renderPurchases(v) {
  const title = T("أوامر الشراء", "Purchase orders");
  if (!state.user) return needSignIn(v, title);
  if (!company()) return needCompany(v, title);
  const w = C.PROCURERS.includes(role());
  const filter = v.querySelector("#po-status")?.value || "";
  const list = state.orders.filter(o => !filter || o.status === filter);
  const total = C.poTotal(poDraft.lines.map(l => ({ qty: Number(l.qty) || 0, unitPrice: Number(l.unitPrice) || 0 })));
  const lineRow = (l, i) => el("div", { class: "po-line" },
    el("input", { name: "line-sku-" + i, "aria-label": T("الرمز", "SKU"), placeholder: T("الرمز", "SKU"), class: "ltr", maxlength: "40", value: l.sku, oninput: (e) => { l.sku = e.target.value; } }),
    el("input", { name: "line-name-" + i, "aria-label": T("الصنف", "Item"), placeholder: T("الصنف", "Item"), maxlength: "120", value: l.name, "data-line-name": String(i), oninput: (e) => { l.name = e.target.value; } }),
    el("input", { name: "line-qty-" + i, "aria-label": T("الكمية", "Qty"), placeholder: T("الكمية", "Qty"), type: "number", min: "0", step: "any", class: "ltr", value: l.qty, oninput: (e) => { l.qty = e.target.value; v.querySelector("#po-total").textContent = money(C.poTotal(poDraft.lines.map(x => ({ qty: Number(x.qty) || 0, unitPrice: Number(x.unitPrice) || 0 })))); } }),
    el("input", { name: "line-price-" + i, "aria-label": T("سعر الوحدة", "Unit price"), placeholder: T("سعر الوحدة", "Unit price"), type: "number", min: "0", step: "any", class: "ltr", value: l.unitPrice, oninput: (e) => { l.unitPrice = e.target.value; v.querySelector("#po-total").textContent = money(C.poTotal(poDraft.lines.map(x => ({ qty: Number(x.qty) || 0, unitPrice: Number(x.unitPrice) || 0 })))); } }),
    el("button", { type: "button", class: "ghost", "aria-label": T("حذف السطر", "Remove line"), disabled: poDraft.lines.length === 1, onclick: () => { poDraft.lines.splice(i, 1); renderPurchases(v); } }, "✕"));
  const activeSuppliers = state.suppliers.filter(s => s.status !== "inactive");
  const form = w ? el("form", { class: "panel", onsubmit: async (e) => { e.preventDefault(); if (await createOrder(e.target)) renderPurchases(v); } },
    el("h3", null, T("أمر شراء جديد", "New purchase order")),
    el("div", { class: "cols-2" },
      el("label", { class: "small" }, T("المورد", "Supplier"), el("select", { name: "supplier", required: true, onchange: (e) => { poDraft.supplierId = e.target.value; } }, el("option", { value: "" }, "—"), ...activeSuppliers.map(s => el("option", { value: s.id, selected: s.id === poDraft.supplierId }, S(s.name, 80))))),
      el("label", { class: "small" }, T("الفرع المستلم", "Receiving branch"), el("select", { name: "branch", required: true, onchange: (e) => { poDraft.branchId = e.target.value; } }, el("option", { value: "" }, "—"), ...branchOptions(poDraft.branchId)))),
    el("div", { class: "small muted", style: "margin-top:.5rem" }, T("السطور", "Lines")),
    ...poDraft.lines.map(lineRow),
    el("div", { class: "toolbar" }, el("button", { type: "button", disabled: poDraft.lines.length >= 50, onclick: () => { poDraft.lines.push({ sku: "", name: "", qty: "1", unitPrice: "" }); renderPurchases(v); } }, T("+ سطر", "+ Line")),
      el("span", null, T("الإجمالي: ", "Total: "), el("b", { id: "po-total" }, money(total)))),
    el("label", { class: "small" }, T("ملاحظات", "Notes"), el("input", { name: "notes", maxlength: "500", value: poDraft.notes, oninput: (e) => { poDraft.notes = e.target.value; } })),
    el("button", { class: "primary", type: "submit" }, T("حفظ كمسودة", "Save as draft")),
    (!activeSuppliers.length || !state.branches.length) ? el("p", { class: "small muted" }, T("يلزم مورد نشط وفرع واحد على الأقل. ", "Needs an active supplier and a branch. "), el("a", { href: "#suppliers" }, T("الموردون", "Suppliers")), " · ", el("a", { href: "#branches" }, T("الفروع", "Branches"))) : null)
    : el("div", { class: "panel muted small" }, T("إنشاء أوامر الشراء للمالك ورئيس المجلس والمدير العام ومدير المشتريات.", "Owner, chairman, general manager and procurement manager create orders."));
  const rows = list.map(o => el("tr", null, el("td", null, fmtTime(o.at)), el("td", null, supplierName(o.supplierId)), el("td", null, branchName(o.branchId)),
    el("td", null, money(o.total)), el("td", null, poBadge(o.status), o.decisionNote ? el("div", { class: "small muted" }, S(o.decisionNote, 120)) : null), el("td", null, orderLines(o)), el("td", null, orderActions(o))));
  v.replaceChildren(sectionHead(title, badge("demo", "UNVERIFIED"),
      el("select", { id: "po-status", style: "width:auto", "aria-label": T("تصفية حسب الحالة", "Filter by status"), onchange: () => renderPurchases(v) }, el("option", { value: "" }, T("كل الحالات", "All statuses")), ...C.PO_STATES.map(s => el("option", { value: s, selected: s === filter }, T(...PO_LABEL[s])))),
      csvBtn(() => downloadCsv("purchase-orders", "UNVERIFIED", [T("التاريخ", "Date"), T("المورد", "Supplier"), T("الفرع", "Branch"), T("الإجمالي", "Total"), T("الحالة", "Status")], list.map(o => [new Date(o.at).toISOString(), supplierName(o.supplierId), branchName(o.branchId), o.total, o.status])))),
    el("div", { class: "banner info" }, T("المسار: مسودة ← بانتظار الموافقة ← معتمد أو مرفوض ← مستلم. الأمر المعتمد لا يُعدَّل، وكل انتقال يُسجَّل في سجل التدقيق في العملية نفسها (تفرضه قواعد Firestore). هذه أوامر داخلية للمتابعة، وليست قيودًا محاسبية ولا تُكتب في قاعدة جوافة.", "Flow: draft → awaiting approval → approved or rejected → received. Approved orders cannot be edited, and every step is written to the audit log in the same operation (enforced by Firestore rules). These are internal tracking orders, not accounting entries, and nothing is written to the Jawafa database.")),
    scopeNote() || "", form,
    el("div", { style: "margin-top:1rem" }, table([T("التاريخ", "Date"), T("المورد", "Supplier"), T("الفرع", "Branch"), T("الإجمالي", "Total"), T("الحالة", "Status"), T("السطور", "Lines"), ""], rows)));
}

// --- approvals inbox ---
function renderApprovals(v) {
  const title = T("الموافقات", "Approvals");
  if (!state.user) return needSignIn(v, title);
  if (!company()) return needCompany(v, title);
  const mine = myApprovals();
  const isApprover = C.APPROVERS.includes(role());
  const recent = state.orders.filter(o => o.decidedBy === state.user.uid).slice(0, 20);
  const card = (o) => {
    const note = el("input", { maxlength: "500", placeholder: T("ملاحظة القرار (اختياري)", "Decision note (optional)"), "aria-label": T("ملاحظة القرار", "Decision note") });
    return el("div", { class: "panel", "data-po": o.id },
      el("div", { class: "row" }, el("b", null, supplierName(o.supplierId)), poBadge(o.status)),
      el("div", { class: "small muted" }, branchName(o.branchId) + " · " + fmtTime(o.submittedAt || o.at) + " · " + S(company().members?.[o.submittedBy]?.email || "", 120)),
      el("div", { style: "font-size:1.3rem;font-weight:800;margin:.4rem 0" }, money(o.total)),
      orderLines(o), o.notes ? el("p", { class: "small" }, S(o.notes, 500)) : null,
      note,
      el("div", { class: "toolbar" },
        el("button", { class: "primary", onclick: () => moveOrder(o, "approved", note.value.trim()) }, T("اعتماد", "Approve")),
        el("button", { class: "danger", onclick: () => moveOrder(o, "rejected", note.value.trim()) }, T("رفض", "Reject"))));
  };
  v.replaceChildren(sectionHead(title, badge(mine.length ? "demo" : "live", num(mine.length) + T(" بانتظارك", " waiting"))),
    el("div", { class: "banner info" }, T("يظهر هنا كل أمر شراء أُرسل للموافقة، لمن يملك صلاحية القرار (المالك، رئيس المجلس، المدير العام). يُسجَّل كل قرار في سجل التدقيق غير القابل للتعديل.", "Every order sent for approval appears here for those who can decide (owner, chairman, general manager). Every decision is written to the append-only audit log.")),
    !isApprover ? el("div", { class: "panel muted small" }, T("دورك لا يملك صلاحية اعتماد أوامر الشراء.", "Your role cannot approve purchase orders.")) :
      mine.length ? el("div", { class: "grid" }, ...mine.map(card)) : el("div", { class: "panel muted" }, T("لا توجد طلبات بانتظار قرارك.", "Nothing is waiting for your decision.")),
    recent.length ? el("div", { style: "margin-top:1rem" }, el("h3", null, T("قراراتك الأخيرة", "Your recent decisions")),
      table([T("المورد", "Supplier"), T("الإجمالي", "Total"), T("القرار", "Decision"), T("الوقت", "Time")], recent.map(o => el("tr", null, el("td", null, supplierName(o.supplierId)), el("td", null, money(o.total)), el("td", null, poBadge(o.status)), el("td", null, fmtTime(o.decidedAt)))))) : "");
}

// --- member branch scope (members screen) ---
async function setScope(uid, ids) {
  try {
    await fs.collection("companies").doc(state.companyId).update(new fb.firestore.FieldPath("branchScopes", uid), ids.length ? ids : fb.firestore.FieldValue.delete());
    audit("member.scope", (company().members?.[uid]?.email || uid) + " → " + (ids.length ? ids.map(branchName).join(", ") : "*"));
    toast(T("حُفظت فروع العضو.", "Member branches saved."));
  } catch (e) { fail(e); }
}
function scopeEditor(c, uid, r) {
  if (!(r === "branch_manager" || r === "employee")) return "";
  const cur = (c.branchScopes && c.branchScopes[uid]) || [];
  const manage = C.can(role(), "manage");
  const label = cur.length ? cur.map(branchName).join("، ") : T("كل الفروع", "All branches");
  if (!manage) return el("span", { class: "small" }, label);
  const boxes = state.branches.map(b => el("label", { class: "small", style: "display:flex;gap:.4rem;align-items:center" }, el("input", { type: "checkbox", value: b.id, checked: cur.includes(b.id), style: "width:auto;min-height:auto" }), S(b.name, 60)));
  return el("details", { class: "scope" }, el("summary", { class: "small" }, label),
    boxes.length ? el("div", null, ...boxes, el("p", { class: "small muted" }, T("بدون اختيار = كل الفروع.", "None selected = all branches.")),
      el("button", { type: "button", onclick: (e) => setScope(uid, [...e.target.closest("details").querySelectorAll("input:checked")].map(x => x.value).slice(0, 30)) }, T("حفظ", "Save")))
      : el("p", { class: "small muted" }, T("أضف فروعًا أولًا.", "Add branches first.")));
}

// ---------- AI agents & workspaces (Firebase AI Logic) ----------
// Agents and workspaces are Firestore records (rules AGT-01, WS-01). A run sends only the agent's
// settings and the text the member typed to Gemini through Firebase AI Logic; no company dataset or
// financial record is attached, and the prompt/answer are not stored. Runs are enabled only when
// ai-config.js carries an App Check (reCAPTCHA Enterprise) site key, so the public site cannot be
// used to spend the project's AI quota. Answers are labelled AI and are never treated as LIVE data.
const AI_SDK = "11.10.0";
const aiState = { editingAgent: null, running: false, answer: null, error: null, wsId: "", text: "" };
let aiRunner = null;
function aiSiteKey() { return S(window.JAWAFA_ONE_APPCHECK_SITE_KEY || "", 200); }
async function getAiRunner() {
  if (EMULATOR && typeof window.__jawafaAiTestRun === "function") return window.__jawafaAiTestRun; // E2E stub only
  if (!C.aiRunnable(aiSiteKey(), false)) throw Object.assign(new Error("appcheck"), { code: "appcheck-missing" });
  if (!aiRunner) aiRunner = (async () => {
    const base = `https://www.gstatic.com/firebasejs/${AI_SDK}/`;
    const [appMod, checkMod, aiMod] = await Promise.all([import(base + "firebase-app.js"), import(base + "firebase-app-check.js"), import(base + "firebase-ai.js")]);
    const app = appMod.getApps().find(a => a.name === "jawafa-one-ai") || appMod.initializeApp(window.AMER_FIREBASE_CONFIG, "jawafa-one-ai");
    checkMod.initializeAppCheck(app, { provider: new checkMod.ReCaptchaEnterpriseProvider(aiSiteKey()), isTokenAutoRefreshEnabled: true });
    const ai = aiMod.getAI(app, { backend: new aiMod.GoogleAIBackend() });
    return async (req) => {
      const model = aiMod.getGenerativeModel(ai, { model: req.model, systemInstruction: req.systemInstruction, generationConfig: req.generationConfig });
      const res = await model.generateContent(req.contents);
      return res.response.text();
    };
  })().catch((e) => { aiRunner = null; throw e; });
  return aiRunner;
}
const agentsCol = () => fs.collection("companies").doc(state.companyId).collection("agents");
const wsCol = () => fs.collection("companies").doc(state.companyId).collection("workspaces");
async function saveAgent(f) {
  const v = C.validateAgent({ name: f.aname.value, systemInstruction: f.instr.value, model: f.model.value, temperature: f.temp.value });
  if (!v.ok) { toast(v.error); return false; }
  const data = { ...v.value, by: state.user.uid, at: Date.now() };
  try {
    if (aiState.editingAgent) { await agentsCol().doc(aiState.editingAgent).set(data); audit("agent.update", v.value.name + " · " + v.value.model); }
    else { await agentsCol().add(data); audit("agent.create", v.value.name + " · " + v.value.model); }
    aiState.editingAgent = null; toast(T("حُفظ الوكيل.", "Agent saved.")); return true;
  } catch (e) { fail(e); return false; }
}
async function deleteAgent(a) {
  if (state.workspaces.some(w => w.activeAgentId === a.id)) { toast(T("الوكيل مستخدم في مساحة عمل؛ غيّر الوكيل هناك أولًا.", "The agent is used by a workspace; change it there first.")); return; }
  if (!confirm(T("حذف الوكيل «" + a.name + "»؟", "Delete agent \"" + a.name + "\"?"))) return;
  try { await agentsCol().doc(a.id).delete(); audit("agent.delete", a.name); } catch (e) { fail(e); }
}
async function addWorkspace(f) {
  const name = f.wname.value.trim();
  if (!name || name.length > 80) { toast(T("اسم مساحة العمل مطلوب (حتى 80 حرفًا).", "Workspace name required (≤80).")); return false; }
  try { await wsCol().add({ name, activeAgentId: f.wagent.value || null, by: state.user.uid, at: Date.now() }); audit("workspace.create", name); return true; }
  catch (e) { fail(e); return false; }
}
async function setWorkspaceAgent(w, agentId) {
  try { await wsCol().doc(w.id).update({ activeAgentId: agentId || null, by: state.user.uid, at: Date.now() }); audit("workspace.agent", w.name + " → " + (agentId ? S(state.agentsAi.find(a => a.id === agentId)?.name || agentId, 80) : "—")); }
  catch (e) { fail(e); }
}
function aiErrorText(e) {
  const code = e && (e.code || "");
  if (code === "appcheck-missing") return T("التشغيل غير مفعّل: يلزم ضبط App Check لهذا الموقع (انظر docs/jawafa-one/AI_AGENTS.md).", "Runs are off: App Check must be configured for this site.");
  if (/appCheck|app-check/i.test(code + (e && e.message || ""))) return T("رفض App Check الطلب. تحقق من مفتاح reCAPTCHA Enterprise وتسجيل النطاق.", "App Check rejected the request.");
  if (/not.?found|404/i.test(code + (e && e.message || ""))) return T("النموذج غير متاح. تحقق من اسم النموذج في إعدادات الوكيل.", "Model not available. Check the agent's model name.");
  if (/quota|429|resource-exhausted/i.test(code + (e && e.message || ""))) return T("تجاوزت الحصة المسموحة. حاول لاحقًا.", "Quota exceeded. Try later.");
  if (/fetch|network|Failed to load/i.test(code + (e && e.message || ""))) return T("تعذّر الاتصال بخدمة الذكاء الاصطناعي.", "Could not reach the AI service.");
  return T("تعذّر تشغيل الوكيل: ", "Agent run failed: ") + S(code || (e && e.message), 120);
}
async function runAgent(text) {
  const w = state.workspaces.find(x => x.id === aiState.wsId);
  const a = w && state.agentsAi.find(x => x.id === w.activeAgentId);
  if (!w || !a) { toast(T("اختر مساحة عمل لها وكيل نشط.", "Choose a workspace with an active agent.")); return; }
  let req;
  try { req = C.buildAiRequest(a, text); } catch (e) { toast(S(e.message, 120)); return; }
  aiState.running = true; aiState.answer = null; aiState.error = null; render();
  try {
    const run = await getAiRunner();
    const out = await run(req);
    aiState.answer = { text: S(out, 20000), agent: a.name, model: a.model, at: Date.now() };
    audit("agent.run", a.name + " · " + a.model + " · " + w.name);
  } catch (e) { aiState.error = aiErrorText(e); }
  finally { aiState.running = false; render(); }
}
function renderAiAgents(v) {
  const title = T("وكلاء الذكاء الاصطناعي", "AI agents");
  if (!state.user) return needSignIn(v, title);
  if (!company()) return needCompany(v, title);
  const manage = C.can(role(), "manage"), write = C.can(role(), "write");
  const runnable = C.aiRunnable(aiSiteKey(), EMULATOR && typeof window.__jawafaAiTestRun === "function");
  const editing = aiState.editingAgent ? state.agentsAi.find(a => a.id === aiState.editingAgent) : null;
  const agentForm = manage ? el("form", { class: "panel", onsubmit: async (e) => { e.preventDefault(); if (await saveAgent(e.target)) { e.target.reset(); render(); } } },
    el("h3", null, editing ? T("تعديل وكيل", "Edit agent") : T("وكيل جديد", "New agent")),
    el("div", { class: "cols-2" },
      el("label", { class: "small" }, T("الاسم", "Name"), el("input", { name: "aname", maxlength: "80", required: true, value: editing ? S(editing.name, 80) : null })),
      el("label", { class: "small" }, T("النموذج", "Model"), el("input", { name: "model", class: "ltr", maxlength: "48", required: true, placeholder: "gemini-…", value: editing ? S(editing.model, 48) : null })),
      el("label", { class: "small" }, T("الحرارة (0–2)", "Temperature (0–2)"), el("input", { name: "temp", type: "number", min: "0", max: "2", step: "0.1", class: "ltr", required: true, value: editing ? String(editing.temperature) : "0.2" }))),
    el("label", { class: "small" }, T("تعليمات النظام", "System instruction"), el("textarea", { name: "instr", maxlength: "4000", rows: "4", required: true }, editing ? S(editing.systemInstruction, 4000) : "")),
    el("div", { class: "toolbar" }, el("button", { class: "primary", type: "submit" }, editing ? T("حفظ التعديل", "Save changes") : T("إضافة الوكيل", "Add agent")),
      editing ? el("button", { type: "button", onclick: () => { aiState.editingAgent = null; v.querySelector("form")?.removeAttribute("data-dirty"); render(); } }, T("إلغاء", "Cancel")) : null))
    : el("div", { class: "panel muted small" }, T("إنشاء الوكلاء وتعديل تعليماتهم للمالك ورئيس المجلس والمدير العام.", "Owner, chairman and general manager create and edit agents."));
  const agentRows = state.agentsAi.map(a => el("tr", null, el("td", null, S(a.name, 80)), el("td", { class: "ltr" }, S(a.model, 48)), el("td", null, String(a.temperature)),
    el("td", null, el("details", null, el("summary", { class: "small" }, T("التعليمات", "Instruction")), el("p", { class: "small" }, S(a.systemInstruction, 4000)))),
    el("td", null, manage ? el("div", { class: "toolbar", style: "margin:0" },
      el("button", { class: "ghost", onclick: () => { aiState.editingAgent = a.id; v.querySelector("form")?.removeAttribute("data-dirty"); render(); } }, T("تعديل", "Edit")),
      el("button", { class: "ghost", onclick: () => deleteAgent(a) }, T("حذف", "Delete"))) : "")));
  const agentOptions = (sel) => [el("option", { value: "" }, T("— بلا وكيل —", "— no agent —")), ...state.agentsAi.map(a => el("option", { value: a.id, selected: a.id === sel }, S(a.name, 80)))];
  const wsRows = state.workspaces.map(w => el("tr", null, el("td", null, S(w.name, 80)),
    el("td", null, write ? el("select", { style: "width:auto", "aria-label": T("الوكيل النشط", "Active agent"), "data-ws": w.id, onchange: (e) => setWorkspaceAgent(w, e.target.value) }, ...agentOptions(w.activeAgentId))
      : S(state.agentsAi.find(a => a.id === w.activeAgentId)?.name || "—", 80))));
  const wsForm = write ? el("form", { class: "toolbar", onsubmit: async (e) => { e.preventDefault(); if (await addWorkspace(e.target)) e.target.reset(); } },
    el("input", { name: "wname", maxlength: "80", required: true, placeholder: T("اسم مساحة العمل", "Workspace name"), "aria-label": T("اسم مساحة العمل", "Workspace name") }),
    el("select", { name: "wagent", style: "width:auto", "aria-label": T("الوكيل", "Agent") }, ...agentOptions("")),
    el("button", { type: "submit" }, T("إضافة مساحة", "Add workspace"))) : null;
  const withAgent = state.workspaces.filter(w => state.agentsAi.some(a => a.id === w.activeAgentId));
  if (!withAgent.some(w => w.id === aiState.wsId)) aiState.wsId = withAgent[0]?.id || "";
  const runPanel = el("div", { class: "panel" },
    el("h3", null, T("تشغيل الوكيل", "Run agent"), badge(runnable ? "live" : "blocked", runnable ? "Firebase AI Logic" : T("غير مفعّل — يلزم App Check", "Off — App Check required"))),
    !withAgent.length ? el("p", { class: "muted small" }, T("أنشئ وكيلًا واربطه بمساحة عمل أولًا.", "Create an agent and attach it to a workspace first.")) :
      el("div", null,
        el("label", { class: "small" }, T("مساحة العمل", "Workspace"), el("select", { id: "ai-ws", onchange: (e) => { aiState.wsId = e.target.value; render(); } },
          ...withAgent.map(w => el("option", { value: w.id, selected: w.id === aiState.wsId }, S(w.name, 80) + " · " + S(state.agentsAi.find(a => a.id === w.activeAgentId)?.name, 60))))),
        el("label", { class: "small" }, T("نصّك (لا تلصق بيانات مالية أو شخصية حساسة)", "Your text (do not paste sensitive financial or personal data)"), el("textarea", { id: "ai-text", rows: "4", maxlength: "8000", oninput: (e) => { aiState.text = e.target.value; } }, aiState.text || "")),
        el("button", { class: "primary", disabled: !runnable || aiState.running, onclick: () => runAgent(v.querySelector("#ai-text").value) }, aiState.running ? T("جارٍ التشغيل...", "Running...") : T("تشغيل", "Run"))),
    aiState.error ? el("div", { class: "banner err", role: "alert" }, aiState.error) : null,
    aiState.answer ? el("div", { class: "panel ai-answer", style: "margin-top:.75rem" },
      el("div", { class: "row" }, badge("demo", T("ناتج ذكاء اصطناعي — راجعه قبل الاعتماد", "AI output — review before relying on it")), el("span", { class: "small muted" }, S(aiState.answer.agent, 80) + " · " + S(aiState.answer.model, 48) + " · " + fmtTime(aiState.answer.at))),
      el("p", { style: "white-space:pre-wrap", id: "ai-answer" }, aiState.answer.text)) : null);
  v.replaceChildren(sectionHead(title, badge("live", "Firestore")),
    el("div", { class: "banner info" }, T("الوكيل = اسم + تعليمات نظام + نموذج Gemini + حرارة. مساحة العمل تختار وكيلها النشط. عند التشغيل يُرسل فقط إعداد الوكيل والنص الذي تكتبه إلى Gemini عبر Firebase AI Logic؛ لا تُرسل بيانات الشركة ولا قاعدة جوافة، ولا يُحفظ النص أو الرد. يُسجَّل في سجل التدقيق أن الوكيل شُغّل فقط.", "An agent = name + system instruction + Gemini model + temperature. Each workspace picks its active agent. A run sends only the agent settings and the text you type to Gemini via Firebase AI Logic; no company data or Jawafa database is sent, and neither prompt nor answer is stored. The audit log records only that the agent ran.")),
    el("div", { class: "cols-2" }, agentForm, runPanel),
    el("h3", { style: "margin-top:1rem" }, T("الوكلاء", "Agents")),
    table([T("الاسم", "Name"), T("النموذج", "Model"), T("الحرارة", "Temp."), T("التعليمات", "Instruction"), ""], agentRows),
    el("h3", { style: "margin-top:1rem" }, T("مساحات العمل", "Workspaces")), wsForm || "",
    table([T("مساحة العمل", "Workspace"), T("الوكيل النشط", "Active agent")], wsRows));
}

// ---------- task board & notifications (phase 3) ----------
// Tasks are companies/{id}/tasks (rules TASK-01). Notifications are computed in the browser from
// data the member can already read (approvals, tasks assigned to them, invitations); nothing is sent
// outside the app.
const TASK_LABEL = { todo: ["للتنفيذ", "To do"], doing: ["قيد التنفيذ", "In progress"], done: ["منجزة", "Done"] };
const PRIO_LABEL = { low: ["منخفضة", "Low"], normal: ["عادية", "Normal"], high: ["عالية", "High"] };
const memberName = (uid) => { const m = company()?.members?.[uid]; return S(m?.name || m?.email || uid || "—", 80); };
const myNotifications = () => (state.user ? C.notificationsFor({ role: role(), uid: state.user.uid, orders: state.orders, tasks: state.tasks, invites: state.invites, today: C.todayIso() }) : []);
const taskView = { mine: false };
async function addTask(f) {
  const title = f.ttitle.value.trim(), due = f.tdue.value;
  if (!title || title.length > 200) { toast(T("عنوان المهمة مطلوب (حتى 200 حرف).", "Task title required (≤200).")); return false; }
  if (!C.isDate(due)) { toast(T("تاريخ الاستحقاق غير صحيح.", "Invalid due date.")); return false; }
  const now = Date.now();
  const data = { title, status: "todo", by: state.user.uid, at: now, updatedAt: now, assigneeUid: f.tassignee.value || null, dueDate: due, priority: C.TASK_PRIORITY.includes(f.tprio.value) ? f.tprio.value : "normal", branchId: f.tbranch.value || null };
  try { await fs.collection("companies").doc(state.companyId).collection("tasks").add(data); audit("task.create", title + (data.assigneeUid ? " → " + memberName(data.assigneeUid) : "")); toast(T("أُضيفت المهمة.", "Task added.")); return true; }
  catch (e) { fail(e); return false; }
}
async function moveTask(t, status) {
  const change = { status, updatedAt: Date.now() };
  if (status === "done") change.doneAt = Date.now();
  try { await fs.collection("companies").doc(state.companyId).collection("tasks").doc(t.id).update(change); audit("task." + status, S(t.title, 120)); }
  catch (e) { fail(e); }
}
function taskCard(t, today) {
  const late = C.isOverdue(t, today);
  const can = C.canEditTask(role(), state.user.uid, t);
  const moves = C.TASK_STATES.filter(s => s !== (t.status || "todo"));
  return el("div", { class: "item task-card" + (late ? " late" : ""), "data-task": t.id },
    el("div", { class: "row" }, el("b", null, S(t.title, 200)), t.priority === "high" ? badge("blocked", T(...PRIO_LABEL.high)) : null, late ? badge("blocked", T("متأخرة", "Overdue")) : null),
    el("div", { class: "small muted" }, T("المكلَّف: ", "Assignee: ") + (t.assigneeUid ? memberName(t.assigneeUid) : "—") + (t.dueDate ? " · " + T("الاستحقاق: ", "Due: ") + S(t.dueDate, 10) : "") + (t.branchId ? " · " + branchName(t.branchId) : "")),
    can ? el("div", { class: "toolbar", style: "margin:.3rem 0 0" }, ...moves.map(s => el("button", { class: "ghost small", onclick: () => moveTask(t, s) }, "→ " + T(...TASK_LABEL[s])))) : null);
}
function renderTasks(v) {
  const title = T("المهام", "Tasks");
  if (!state.user) return needSignIn(v, title);
  if (!company()) return needCompany(v, title);
  const r = role(), today = C.todayIso();
  const list = state.tasks.filter(t => !taskView.mine || t.assigneeUid === state.user.uid);
  const late = list.filter(t => C.isOverdue(t, today)).length;
  const form = C.can(r, "tasks") ? el("form", { class: "panel", onsubmit: async (e) => { e.preventDefault(); if (await addTask(e.target)) e.target.reset(); } },
    el("h3", null, T("مهمة جديدة", "New task")),
    el("div", { class: "cols-2" },
      el("label", { class: "small" }, T("العنوان", "Title"), el("input", { name: "ttitle", maxlength: "200", required: true })),
      el("label", { class: "small" }, T("المكلَّف", "Assignee"), el("select", { name: "tassignee" }, el("option", { value: "" }, "—"), ...(company().memberIds || []).map(uid => el("option", { value: uid }, memberName(uid))))),
      el("label", { class: "small" }, T("تاريخ الاستحقاق", "Due date"), el("input", { name: "tdue", type: "date", class: "ltr" })),
      el("label", { class: "small" }, T("الأولوية", "Priority"), el("select", { name: "tprio" }, ...C.TASK_PRIORITY.map(p => el("option", { value: p, selected: p === "normal" }, T(...PRIO_LABEL[p]))))),
      el("label", { class: "small" }, T("الفرع (اختياري)", "Branch (optional)"), el("select", { name: "tbranch" }, el("option", { value: "" }, "—"), ...branchOptions()))),
    el("button", { class: "primary", type: "submit" }, T("إضافة المهمة", "Add task")))
    : el("div", { class: "panel muted small" }, T("دورك للقراءة فقط.", "Your role is read only."));
  const col = (s) => el("div", { class: "panel task-col", "data-col": s }, el("h3", null, T(...TASK_LABEL[s]), " ", badge("", num(list.filter(t => (t.status || "todo") === s).length))),
    el("div", { class: "list" }, ...list.filter(t => (t.status || "todo") === s).sort((a, b) => S(a.dueDate || "9999").localeCompare(S(b.dueDate || "9999"))).map(t => taskCard(t, today))));
  v.replaceChildren(sectionHead(title, badge("live", "Firestore"), late ? badge("blocked", num(late) + T(" متأخرة", " overdue")) : null,
      el("label", { class: "small" }, el("input", { id: "task-mine", type: "checkbox", style: "width:auto;min-height:auto", checked: taskView.mine, onchange: (e) => { taskView.mine = e.target.checked; renderTasks(v); } }), " ", T("مهامي فقط", "My tasks only")),
      csvBtn(() => downloadCsv("tasks", "FIRESTORE", [T("العنوان", "Title"), T("الحالة", "Status"), T("المكلَّف", "Assignee"), T("الاستحقاق", "Due"), T("الأولوية", "Priority")], list.map(t => [t.title, t.status, t.assigneeUid ? memberName(t.assigneeUid) : "", t.dueDate || "", t.priority || ""])))),
    el("div", { class: "banner info" }, T("يحرّك المهمة المكلَّف بها أو منشئها أو المدير، وتفرض ذلك قواعد Firestore. كل تغيير يُسجَّل في سجل التدقيق.", "The assignee, the creator or a manager moves a task (enforced by Firestore rules). Every change is in the audit log.")),
    form, el("div", { class: "task-board", style: "margin-top:1rem" }, ...C.TASK_STATES.map(col)));
}
function renderNotifications(v) {
  const title = T("التنبيهات", "Notifications");
  if (!state.user) return needSignIn(v, title);
  const items = myNotifications();
  const KIND = { overdue: ["blocked", "متأخرة", "Overdue"], approval: ["demo", "موافقة", "Approval"], invite: ["verified", "دعوة", "Invite"], task: ["live", "مهمة", "Task"] };
  v.replaceChildren(sectionHead(title, badge(items.length ? "demo" : "live", num(items.length))),
    el("div", { class: "banner info" }, T("التنبيهات محسوبة من بياناتك في التطبيق: أوامر الشراء بانتظار قرارك، والمهام المسندة إليك والمتأخرة، والدعوات. لا تُرسل إشعارات خارج التطبيق بعد.", "Computed from your data in the app: orders awaiting your decision, tasks assigned to you and overdue, invitations. No push or e-mail notifications yet.")),
    items.length ? el("div", { class: "list" }, ...items.map(n => el("a", { class: "item row notif", href: n.href, "data-kind": n.kind }, badge(KIND[n.kind][0], T(KIND[n.kind][1], KIND[n.kind][2])), el("span", null, T(n.ar, n.en)))))
      : el("div", { class: "panel muted" }, T("لا توجد تنبيهات.", "No notifications.")));
}

// ---------- audit log viewer ----------
function renderAudit(v) {
  if (!state.user) return needSignIn(v, T("سجل التدقيق", "Audit log"));
  if (!company()) { v.replaceChildren(sectionHead(T("سجل التدقيق", "Audit log")), el("p", null, el("a", { href: "#company" }, T("أنشئ شركة أو اقبل دعوة أولًا.", "Create a company or accept an invitation first.")))); return; }
  const q = (v.querySelector("#audit-q")?.value || "").trim().toLowerCase();
  const list = state.audit.filter(a => !q || [a.action, a.detail, a.email].join(" ").toLowerCase().includes(q));
  const input = el("input", { id: "audit-q", type: "search", value: q, placeholder: T("تصفية...", "Filter..."), style: "width:auto", oninput: () => renderAudit(v) });
  v.replaceChildren(sectionHead(T("سجل التدقيق", "Audit log"), badge("live", T("إلحاق فقط", "append-only")), input,
      csvBtn(() => downloadCsv("audit", "FIRESTORE", [T("الوقت", "Time"), T("المستخدم", "User"), T("الإجراء", "Action"), T("التفاصيل", "Detail")], list.map(a => [new Date(a.at).toISOString(), a.email, a.action, a.detail])))),
    el("div", { class: "banner info" }, T("لا يمكن لأي عضو تعديل أو حذف سجل — مفروض في قواعد Firestore. يعرض آخر 100 حدث.", "No member can edit or delete an entry — enforced by Firestore rules. Shows the latest 100 events.")),
    table([T("الوقت", "Time"), T("المستخدم", "User"), T("الإجراء", "Action"), T("التفاصيل", "Detail")],
      list.map(a => el("tr", null, el("td", null, fmtTime(a.at)), el("td", { class: "ltr" }, S(a.email, 120)), el("td", { class: "ltr" }, S(a.action, 60)), el("td", null, S(a.detail, 200))))));
  const n = v.querySelector("#audit-q"); if (q && n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
}

// ---------- rendering ----------
function sectionHead(title, ...extra) { return el("div", { class: "toolbar", style: "justify-content:space-between" }, el("h1", { style: "margin:0;font-size:1.4rem" }, title), el("div", { class: "toolbar", style: "margin:0" }, ...extra)); }
function demoToggle() {
  return el("button", { class: state.demo ? "" : "gold", onclick: () => { state.demo = !state.demo; store.set("jawafa-one-demo", state.demo ? "1" : "0"); render(); } },
    state.demo ? T("إخفاء البيانات التجريبية", "Hide demo data") : T("عرض بيانات تجريبية", "Show demo data"));
}
function noData() {
  return el("div", { class: "panel" }, el("h3", null, T("لا يوجد مصدر بيانات متصل", "No data source connected"), badge("blocked", "LIVE: BLOCKED")),
    el("p", { class: "muted" }, T("لا تُعرض أرقام تشغيلية دون اتصال حقيقي. اربط قاعدة بيانات عبر خادم آمن للقراءة فقط من مركز الربط، أو اعرض بيانات تجريبية موسومة للمعاينة.", "No operational figures are shown without a real connection. Connect a database through a secure read-only backend, or preview labelled demo data.")),
    el("div", { class: "toolbar" }, demoToggle(), el("a", { href: "#connections" }, T("مركز الربط", "Integrations"))));
}

function lineChart(points) {
  const W = 600, H = 220, P = 34, L = 58;
  const max = Math.max(1, ...points.map(p => p.total));
  const x = (i) => L + (i * (W - L - P)) / Math.max(1, points.length - 1);
  const y = (v) => H - P - (v / max) * (H - 2 * P);
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", T("مبيعات يومية: ", "Daily sales: ") + points.map(p => p.day + " " + p.total).join("، "));
  const mk = (tag, attrs) => { const n = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); svg.append(n); return n; };
  const defs = document.createElementNS(ns, "defs"); defs.innerHTML = '<linearGradient id="g-em" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22c55e" stop-opacity=".45"/><stop offset="1" stop-color="#22c55e" stop-opacity="0"/></linearGradient>'; svg.append(defs);
  for (let i = 0; i <= 4; i++) { const yy = P + (i * (H - 2 * P)) / 4; mk("line", { x1: L, x2: W - P, y1: yy, y2: yy, class: "grid-line" }); const t = mk("text", { x: L - 8, y: yy + 4, "text-anchor": "end" }); t.textContent = num(Math.round(max - (i * max) / 4)); }
  const d = points.map((p, i) => (i ? "L" : "M") + x(i) + " " + y(p.total)).join(" ");
  mk("path", { d: d + ` L${x(points.length - 1)} ${H - P} L${x(0)} ${H - P} Z`, class: "area" });
  mk("path", { d, class: "line" });
  points.forEach((p, i) => { mk("circle", { cx: x(i), cy: y(p.total), r: 4, class: "dot" }); const t = mk("text", { x: x(i), y: H - 10, "text-anchor": "middle" }); t.textContent = p.day.slice(5); });
  return el("div", { class: "chart" }, svg);
}

function table(headers, rows) {
  return el("div", { class: "table-wrap" }, el("table", null, el("thead", null, el("tr", null, ...headers.map(h => el("th", { scope: "col" }, h)))),
    el("tbody", null, ...(rows.length ? rows : [el("tr", null, el("td", { colspan: String(headers.length), class: "muted" }, T("لا توجد بيانات.", "No data.")))]))));
}

function kpiCards(d) {
  const k = C.kpis(d);
  const card = (label, value, sub, accent, alert) => el("div", { class: "kpi" + (alert ? " alert" : ""), style: accent ? `--accent:${accent}` : null },
    el("div", { class: "label" }, el("span", null, label), badge(d.source === "LIVE" ? "live" : "demo", d.source)), el("div", { class: "value" }, value), el("div", { class: "small muted" }, sub));
  const findings = C.detectAnomalies(d);
  return el("div", { class: "kpis" },
    card(T("تنبيهات تحتاج مراجعة", "Alerts to review"), num(findings.length), T("نتائج للتحقق — ليست اتهامات", "Leads, not accusations"), "#ef4444", true),
    card(T("إجمالي المبيعات (14 يومًا)", "Sales (14 days)"), money(k.sales), num(k.invoices) + T(" فاتورة", " invoices"), "#22c55e"),
    card(T("قيمة المخزون", "Stock value"), money(k.stockValue), num(k.lowStock) + T(" صنف تحت حد الطلب", " items below reorder"), "#a78bfa"),
    card(T("شيكات مستحقة خلال 7 أيام", "Cheques due in 7 days"), num(k.chequesDue7), money(k.chequesDue7Amount), "#d9b45a"),
    card(T("الموظفون", "Employees"), num(k.employees), num(k.branches) + T(" فروع ومستودعات", " branches & warehouses"), "#38bdf8"));
}

function renderHome(v) {
  const d = dataset(), c = company();
  const hero = el("div", { class: "hero" },
    el("div", { class: "small", style: "color:var(--gold-2);letter-spacing:.08em" }, "JAWAFA ONE AI · UNIFIED ENTERPRISE COMMAND"),
    el("h1", null, T("مرحبًا بك في مركز القيادة الذكي", "Welcome to the smart command center")),
    el("p", null, T("منصة موحدة لإدارة الأسواق والمطاعم والأفران والمستودعات — مجانية لكل صاحب مصلحة، بلا رسوم ولا عمولة.", "One platform for markets, restaurants, bakeries and warehouses — free for every business, no fees, no commission.")),
    el("div", { class: "toolbar" },
      c ? el("span", { class: "badge verified" }, "🏢 " + S(c.name, 60) + " · " + T(C.ROLES[role()]?.ar || "", C.ROLES[role()]?.en || ""))
        : state.user ? el("button", { class: "gold", onclick: () => { location.hash = "#company"; } }, T("أنشئ شركتك مجانًا", "Create your company — free"))
        : el("button", { class: "google-btn", onclick: signIn, disabled: state.cloud !== "ready" }, googleG(), T("الدخول عبر Google", "Sign in with Google")),
      demoToggle()));
  const network = el("div", { class: "panel" }, el("h3", null, T("شبكة الوكلاء والترابط", "Agent network"), el("a", { class: "small", href: "#agents" }, T("فتح", "Open"))),
    el("div", { class: "network" }, ...[hierarchy()[2], hierarchy()[0], hierarchy()[1]].map(a => el("div", { class: "node" + (a.code === "999" ? " main" : "") },
      el("div", { class: "ring" }, a.code), el("b", { class: "small" }, a.name), badge("blocked", "BLOCKED")))),
    el("p", { class: "small muted" }, BLOCK_REASON()));
  const hub = el("div", { class: "panel" }, el("h3", null, T("مركز الربط والتكاملات", "Integrations hub"), el("a", { class: "small", href: "#connections" }, T("التفاصيل", "Details"))),
    el("div", { class: "hub" }, ...integrations().slice(0, 8).map(i => el("a", { class: "tile", href: "#connections" }, el("b", null, i.name), STATUS_BADGE[i.status]()))));
  const assistant = el("div", { class: "panel" }, el("h3", null, T("مساعد جوافة الذكي", "Jawafa assistant"), badge("blocked", "Gemini: BLOCKED")),
    el("div", { class: "chips" }, ...quickQuestions().map(q => el("button", { onclick: () => { location.hash = "#assistant"; ask(q); } }, q))));
  v.replaceChildren(hero,
    d ? kpiCards(d) : noData(),
    el("div", { class: "cols-3" },
      el("div", { class: "panel" }, el("h3", null, T("تحليل المبيعات — آخر 7 أيام", "Sales — last 7 days"), d ? SOURCE_BADGE[d.source]() : null), d ? lineChart(C.dailySales(d, 7)) : el("p", { class: "muted" }, "—")),
      network,
      el("div", { class: "panel" }, el("h3", null, T("الخرائط والتشغيل الميداني", "Maps & field ops"), el("a", { class: "small", href: "#maps" }, T("فتح", "Open"))), d ? branchMap(d, 200) : el("p", { class: "muted" }, "—"))),
    el("div", { class: "cols-2", style: "margin-top:1rem" }, assistant, hub));
}
function googleG() { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 48 48"); s.setAttribute("width", "20"); s.setAttribute("height", "20"); s.setAttribute("aria-hidden", "true"); s.innerHTML = '<path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.2-8.5 2.2-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/>'; return s; }

function renderSales(v) {
  const d = dataset();
  if (!d) { v.replaceChildren(sectionHead(T("المبيعات", "Sales")), noData()); return; }
  const branch = v.querySelector("#sales-branch")?.value || "";
  const bn = (id) => d.branches.find(b => b.id === id)?.name || id;
  const inv = d.invoices.filter(i => !branch || i.branch === branch).sort((a, b) => b.at - a.at).slice(0, 60);
  const sel = el("select", { id: "sales-branch", style: "width:auto", onchange: () => renderSales(v) }, el("option", { value: "" }, T("كل الفروع", "All branches")),
    ...d.branches.filter(b => b.kind !== "warehouse").map(b => el("option", { value: b.id, selected: b.id === branch }, b.name)));
  v.replaceChildren(sectionHead(T("المبيعات", "Sales"), SOURCE_BADGE[d.source](), sel, csvBtn(() => downloadCsv("sales", d.source, ["no", "branch", "total", "discountPct", "user", "status", "time"], d.invoices.filter(i => !branch || i.branch === branch).map(i => [i.no, bn(i.branch), i.total, i.discountPct, i.user, i.status, new Date(i.at).toISOString()]))), demoToggle()),
    el("div", { class: "panel" }, el("h3", null, T("المبيعات اليومية — 14 يومًا", "Daily sales — 14 days")), lineChart(C.dailySales({ ...d, invoices: d.invoices.filter(i => !branch || i.branch === branch) }, 14))),
    el("div", { class: "panel", style: "margin-top:1rem" }, el("h3", null, T("أحدث الفواتير", "Latest invoices")),
      table([T("رقم", "No."), T("الفرع", "Branch"), T("المجموع", "Total"), T("الخصم", "Discount"), T("المستخدم", "User"), T("الحالة", "Status"), T("الوقت", "Time")],
        inv.map(i => el("tr", null, el("td", { class: "ltr" }, i.no), el("td", null, bn(i.branch)), el("td", { class: "num" }, money(i.total)), el("td", { class: "num" }, i.discountPct + "%"), el("td", { class: "ltr" }, i.user), el("td", null, i.status === "void" ? badge("blocked", T("ملغاة", "void")) : badge("", T("سليمة", "ok"))), el("td", null, fmtTime(i.at)))))));
}

function renderInventory(v) {
  const d = dataset();
  if (!d) { v.replaceChildren(sectionHead(T("المخزون والمستودعات", "Inventory & warehouses")), noData()); return; }
  const onlyLow = v.querySelector("#inv-low")?.checked || false;
  const bn = (id) => d.branches.find(b => b.id === id)?.name || id;
  const rows = d.stock.filter(s => !onlyLow || s.qty < s.reorder).sort((a, b) => a.qty - b.qty);
  v.replaceChildren(sectionHead(T("المخزون والمستودعات", "Inventory & warehouses"), SOURCE_BADGE[d.source](),
      el("label", { class: "small" }, el("input", { id: "inv-low", type: "checkbox", style: "width:auto;min-height:auto", checked: onlyLow, onchange: () => renderInventory(v) }), " ", T("تحت حد الطلب فقط", "Below reorder only")),
      csvBtn(() => downloadCsv("inventory", d.source, ["sku", "item", "location", "qty", "reorder"], rows.map(s => [s.sku, s.name, bn(s.branch), s.qty, s.reorder]))), demoToggle()),
    table([T("الصنف", "Item"), "SKU", T("الموقع", "Location"), T("الرصيد", "Qty"), T("حد الطلب", "Reorder"), T("الحالة", "State")],
      rows.map(s => el("tr", null, el("td", null, s.name), el("td", { class: "ltr" }, s.sku), el("td", null, bn(s.branch)), el("td", { class: "num" }, num(s.qty)), el("td", { class: "num" }, num(s.reorder)),
        el("td", null, s.qty < 0 ? badge("blocked", T("رصيد سالب", "negative")) : s.qty < s.reorder ? badge("demo", T("منخفض", "low")) : badge("live", T("كافٍ", "ok")))))));
}

function renderFinance(v) {
  const d = dataset();
  if (!d) { v.replaceChildren(sectionHead(T("المالية والشيكات", "Finance & cheques")), noData()); return; }
  const bank = new Set(d.bank.map(b => b.chequeNo));
  const bn = (id) => d.branches.find(b => b.id === id)?.name || id;
  v.replaceChildren(sectionHead(T("المالية والشيكات والصناديق", "Finance, cheques & cash"), SOURCE_BADGE[d.source](), demoToggle()),
    el("div", { class: "banner" }, T("قراءة فقط. لا يكتب هذا التطبيق إلى Jawafa_DB أو أي سجل محاسبي، ولا يوجد اتصال مالي حي في هذا الإصدار.", "Read only. This app never writes to Jawafa_DB or any accounting record; no live financial connection exists in this build.")),
    el("div", { class: "cols-2" },
      el("div", { class: "panel" }, el("h3", null, T("الشيكات", "Cheques")),
        table([T("رقم", "No."), T("الجهة", "Party"), T("المبلغ", "Amount"), T("الاستحقاق", "Due"), T("المطابقة البنكية", "Bank match")],
          d.cheques.map(c => el("tr", null, el("td", { class: "ltr" }, c.no), el("td", null, c.party), el("td", { class: "num" }, money(c.amount)), el("td", null, fmtTime(c.due)),
            el("td", null, c.status === "pending" ? badge("", T("معلق", "pending")) : bank.has(c.no) ? badge("live", T("مطابق", "matched")) : badge("blocked", T("غير مطابق", "unmatched"))))))),
      el("div", { class: "panel" }, el("h3", null, T("فروقات الصناديق", "Cash variances")),
        table([T("الفرع", "Branch"), T("اليوم", "Day"), T("المتوقع", "Expected"), T("المعدود", "Counted"), T("الفرق", "Diff")],
          d.cash.map(c => { const diff = c.counted - c.expected; return el("tr", null, el("td", null, bn(c.branch)), el("td", { class: "ltr" }, c.day), el("td", { class: "num" }, money(c.expected)), el("td", { class: "num" }, money(c.counted)), el("td", { class: "num", style: Math.abs(diff) >= 50 ? "color:var(--red)" : null }, money(diff))); })))));
}

function renderInvestigations(v) {
  const d = dataset();
  if (!d) { v.replaceChildren(sectionHead(T("التحقيقات وكشف التلاعب", "Investigations & anomaly detection")), noData()); return; }
  const f = C.detectAnomalies(d);
  v.replaceChildren(sectionHead(T("التحقيقات وكشف التلاعب", "Investigations & anomaly detection"), SOURCE_BADGE[d.source](),
      csvBtn(() => downloadCsv("findings", d.source, ["type", "title", "ref", "confidence", "classification", "detail"], f.map(x => [x.type, x.title, x.ref, x.confidence, C.FINDING_CLASS[x.classification], x.detail]))), demoToggle()),
    el("div", { class: "banner info" }, T("كل نتيجة مؤشر للتحقق وليست اتهامًا لأي شخص. على البيانات التجريبية لا تُصنَّف أي نتيجة «مثبتة»؛ الإثبات يتطلب بيانات LIVE وأدلة مرفقة.", "Each result is a lead, never an accusation. On demo data nothing is classified as proven; proof needs LIVE data and attached evidence.")),
    el("div", { class: "list" }, ...f.map(x => el("div", { class: "item" },
      el("div", { class: "row" }, el("b", null, x.title), el("span", { class: "toolbar", style: "margin:0" }, badge(x.classification === "proven" ? "live" : "demo", C.FINDING_CLASS[x.classification]), SOURCE_BADGE[x.source]())),
      el("div", { class: "small muted" }, el("span", { class: "ltr" }, x.ref), " · ", x.detail, " · ", T("الثقة ", "confidence ") + Math.round(x.confidence * 100) + "%"),
      el("div", { class: "small muted" }, T("الأدلة: لا توجد مستندات مرفقة (مصدر تجريبي).", "Evidence: none attached (demo source)."))))));
}

function renderTrustsoftEvidenceView(v) {
  renderTrustsoftEvidence(v);
}
function renderGithubWorkView(v) { renderGithubWork(v); }
function renderJawafaCoverageView(v) { renderJawafaCoverage(v); }

function branchMap(d, h) {
  const W = 600, H = h || 320, P = (h || 320) < 260 ? 90 : 70;
  const lats = d.branches.map(b => b.lat), lngs = d.branches.map(b => b.lng);
  const [a0, a1, o0, o1] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", T("مخطط مواقع الفروع", "Branch location sketch"));
  svg.style.cssText = "width:100%;height:auto;background:var(--bg-2);border-radius:12px;border:1px solid var(--line)";
  const color = { market: "#22c55e", restaurant: "#f59e0b", bakery: "#d9b45a", warehouse: "#38bdf8" };
  for (const b of d.branches) {
    const x = P + ((b.lng - o0) / (o1 - o0 || 1)) * (W - 2 * P), y = H - P - ((b.lat - a0) / (a1 - a0 || 1)) * (H - 2 * P);
    const c = document.createElementNS(ns, "circle"); c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", H < 260 ? 14 : 10); c.setAttribute("fill", color[b.kind]); svg.append(c);
    const t = document.createElementNS(ns, "text"); t.setAttribute("x", x); t.setAttribute("y", y - (H < 260 ? 22 : 16)); t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "currentColor"); t.setAttribute("font-size", H < 260 ? "24" : "15"); t.textContent = b.name.split("—")[0].trim(); svg.append(t);
  }
  return svg;
}
function renderMaps(v) {
  const d = dataset();
  if (!d) { v.replaceChildren(sectionHead(T("الخرائط والخدمات اللوجستية", "Maps & logistics")), noData()); return; }
  v.replaceChildren(sectionHead(T("الخرائط والخدمات اللوجستية", "Maps & logistics"), SOURCE_BADGE[d.source](), badge("blocked", "Google Maps API: BLOCKED")),
    el("div", { class: "banner info" }, T("خريطة Google التفاعلية تحتاج مفتاح Maps JavaScript API مقيّدًا بالنطاق. حتى توفره يُعرض مخطط نسبي للمواقع مع روابط فتحها في Google Maps.", "The interactive Google map needs a domain-restricted Maps JavaScript API key. Until then, a relative sketch with Google Maps links is shown.")),
    el("div", { class: "panel" }, branchMap(d, 340)),
    el("div", { class: "panel", style: "margin-top:1rem" }, table([T("الموقع", "Site"), T("النوع", "Type"), T("الإحداثيات", "Coordinates"), ""],
      d.branches.map(b => el("tr", null, el("td", null, b.name), el("td", null, b.kind), el("td", { class: "ltr" }, b.lat + ", " + b.lng),
        el("td", null, el("a", { href: `https://www.google.com/maps?q=${b.lat},${b.lng}`, target: "_blank", rel: "noopener noreferrer" }, T("فتح في Google Maps", "Open in Google Maps"))))))));
}

const quickQuestions = () => [T("قارن مبيعات أمس مع الأسبوع الماضي", "Compare yesterday's sales with last week"), T("اعرض الشيكات المستحقة خلال 7 أيام", "Show cheques due in 7 days"), T("أي الأصناف قد تنفد قريبًا؟", "Which items may run out soon?"), T("ما أسباب انخفاض السيولة؟", "Why is liquidity down?")];
function ask(q) { q = S(q, 500).trim(); if (!q) return; chat.push({ role: "user", text: q }); const a = answer(q); chat.push({ role: "bot", text: a.text, src: a.src }); render(); }
function renderAssistant(v) {
  const log = el("div", { class: "chat", "aria-live": "polite" }, ...(chat.length ? chat.map(m => el("div", { class: "msg " + m.role }, m.text, m.src ? el("span", { class: "src" }, m.src) : null)) : [el("p", { class: "muted" }, T("اسأل عن المبيعات أو المخزون أو الشيكات.", "Ask about sales, stock or cheques."))]));
  const input = el("input", { id: "ask-input", placeholder: T("اسأل عن مبيعات، مخزون، أو أي تحليل إداري...", "Ask about sales, stock..."), maxlength: "500" });
  v.replaceChildren(sectionHead(T("المساعد الذكي", "AI assistant"), badge("blocked", "Gemini: BLOCKED"), badge("blocked", "OpenAI: BLOCKED")),
    el("div", { class: "banner info" }, T("يجيب المساعد حاليًا بمحرك محلي محدد يذكر مصدر كل رقم ولا يخترع نتائج. ربط Gemini أو OpenAI يتطلب خادمًا آمنًا يحفظ المفتاح ويطبق صلاحيات الشركة — غير متوفر في هذا الإصدار.", "The assistant currently uses a deterministic local engine that cites its source and never invents results. Gemini/OpenAI need a secure backend holding the key and enforcing company permissions — not available in this build.")),
    el("div", { class: "panel" }, log,
      el("form", { class: "toolbar", onsubmit: (e) => { e.preventDefault(); ask(input.value); } }, el("label", { class: "sr", for: "ask-input" }, T("سؤال", "Question")), input, el("button", { class: "primary", type: "submit" }, T("إرسال", "Send"))),
      el("div", { class: "chips" }, ...quickQuestions().map(q => el("button", { onclick: () => ask(q) }, q)))));
  log.scrollTop = log.scrollHeight;
}

function renderAgents(v) {
  const agents = allAgents();
  const msgs = state.user && state.companyId ? state.messages : [...state.localRouter.store.values()].reverse();
  const opt = (a) => el("option", { value: a.id }, a.code + " · " + a.name);
  const from = el("select", { id: "msg-from" }, ...agents.map(opt));
  const to = el("select", { id: "msg-to", multiple: true, size: "5" }, ...agents.map(opt));
  const body = el("textarea", { id: "msg-body", rows: "3", maxlength: "4000" });
  v.replaceChildren(sectionHead(T("مركز الوكلاء والتراسل", "Agent command & messaging"), badge("built", T("السجل والموجّه: مُنفّذ", "Registry & router: built"))),
    el("div", { class: "banner" }, T("لا يُعرض أي وكيل كمتصل دون دليل تسليم. الرسائل تُحفظ QUEUED، ولا تتقدم إلى DELIVERED/READ/ACKNOWLEDGED إلا بإيصال من الوجهة. لا توجد في هذا الإصدار قناة تسليم مصرح بها لأي وكيل.", "No agent is shown as connected without delivery evidence. Messages are saved QUEUED and only advance with a receipt from the destination. This build has no authorised delivery channel for any agent.")),
    el("div", { class: "cols-2" },
      el("div", { class: "panel" }, el("h3", null, T("سجل الوكلاء", "Agent registry"), badge("", num(agents.length))),
        el("div", { class: "list" }, ...agents.map(a => el("div", { class: "item" }, el("div", { class: "row" }, el("b", null, a.code + " · " + a.name), a.group === "HIERARCHY" ? badge("blocked", "BLOCKED") : badge("built", T("تعريف فقط", "definition only"))),
          el("div", { class: "small muted" }, a.group === "HIERARCHY" ? BLOCK_REASON() : S(a.description, 200)))))),
      el("div", { class: "panel" }, el("h3", null, T("إرسال رسالة (Many-to-Many)", "Send message (many-to-many)")),
        el("form", { class: "list", onsubmit: (e) => { e.preventDefault(); const t = [...to.selectedOptions].map(o => o.value); if (!t.length || !body.value.trim()) { toast(T("اختر مستلمًا واكتب الرسالة.", "Pick recipients and write a message.")); return; } sendMessage(from.value, t, body.value.trim()); body.value = ""; } },
          el("label", { class: "small" }, T("من", "From"), from), el("label", { class: "small" }, T("إلى (يمكن اختيار أكثر من وكيل)", "To (multi-select)"), to), el("label", { class: "small" }, T("النص", "Body"), body),
          el("button", { class: "primary", type: "submit" }, T("إرسال", "Send"))),
        el("h3", { style: "margin-top:1rem" }, T("الرسائل", "Messages"), state.user && state.companyId ? badge("live", "Firestore") : badge("demo", T("معاينة محلية", "local preview"))),
        el("div", { class: "list" }, ...(msgs.length ? msgs.map(m => el("div", { class: "item" }, el("div", { class: "row" }, el("b", { class: "ltr" }, m.from + " → " + m.to.join(", ")), badge(m.status === "FAILED" ? "blocked" : m.status === "QUEUED" ? "demo" : "live", m.status)),
          el("div", { class: "small" }, S(m.body, 400)), el("div", { class: "small muted ltr" }, m.id))) : [el("p", { class: "muted small" }, T("لا رسائل.", "No messages."))])))));
}

function integrations() {
  return [
    { name: "Google Sign-In", status: "BUILT", note: T("مُنفّذ عبر Firebase Auth. يحتاج إضافة النطاق إلى Authorized domains والتحقق على النسخة المنشورة.", "Implemented with Firebase Auth. Needs the domain in Authorized domains and verification on the deployed site.") },
    { name: T("الشركات والصلاحيات (Firestore)", "Companies & RBAC (Firestore)"), status: "TEST_PASSED", note: T("15 اختبار قواعد على Firestore Emulator: عزل الشركات عبر API، الأدوار، الدعوات، الخطط.", "15 rules tests on the Firestore emulator: API-level isolation, roles, invites, plans.") },
    { name: "SQL Server · Jawafa_DB", status: "BLOCKED", note: T("يحتاج خادم Backend آمن وحساب قراءة فقط محدود الجداول. لا اتصال من المتصفح أو الهاتف.", "Needs a secure backend and a least-privilege read-only account. No browser/phone connection.") },
    { name: "PostgreSQL / MySQL / REST", status: "NOT_STARTED", note: T("موصلات مستقبلية خلف الخادم نفسه.", "Future connectors behind the same backend.") },
    { name: "Gemini", status: "BLOCKED", note: T("يوجد وكيل Gemini في AAS-CC (Cloudflare Worker) ولم يُربط بهذه المنصة متعددة الشركات بعد.", "A Gemini proxy exists in AAS-CC (Cloudflare Worker), not yet wired to this multi-company app.") },
    { name: "OpenAI / ChatGPT", status: "BLOCKED", note: T("يحتاج مفتاح API على الخادم. روابط محادثات ChatGPT ليست قناة API.", "Needs a server-side API key. ChatGPT conversation links are not an API.") },
    { name: T("المتجر / POS (لُقطة)", "Store / POS (Luqta)"), status: "BLOCKED", note: T("عميل لُقطة موجود في اللوحة السابقة؛ يحتاج خادمًا منشورًا بعنوان HTTPS دائم.", "Luqta client exists in the previous dashboard; needs a deployed HTTPS server.") },
    { name: "Google Maps", status: "BLOCKED", note: T("يحتاج مفتاح API مقيدًا بالنطاق.", "Needs a domain-restricted API key.") },
    { name: "Facebook / Instagram / TikTok", status: "BUILT", note: T("روابط الصفحات محفوظة ومتحقق من صيغتها في ملف الشركة. النشر والإحصاءات تحتاج APIs رسمية وتفويضًا.", "Profile links stored and validated in the company profile. Posting/insights need official APIs and authorisation.") },
    { name: T("كاميرات TrustSoft", "TrustSoft cameras"), status: "BLOCKED", note: T("وحدة TrustSoft موجودة في اللوحة السابقة (قراءة فقط)، دون بث كاميرات مصرح به.", "TrustSoft module exists in the previous dashboard (read only), no authorised camera feed.") },
    { name: T("مدفوعات Premium Plus", "Premium Plus billing"), status: "NOT_STARTED", note: T("لا يوجد مزود دفع. الخطة لا يغيّرها إلا خادم الفوترة.", "No payment provider. Only a billing backend may change the plan.") },
  ];
}
function renderConnections(v) {
  v.replaceChildren(sectionHead(T("مركز الربط والتكاملات", "Integrations hub")),
    el("div", { class: "banner info" }, T("الحالات من أدلة فعلية في المستودع (انظر INTEGRATION_STATUS.md). لا يوصف أي تكامل بأنه LIVE دون اختبار موثق في البيئة المقصودة.", "Statuses come from evidence in the repository (see INTEGRATION_STATUS.md). Nothing is LIVE without a documented test in the target environment.")),
    el("div", { class: "list" }, ...integrations().map(i => el("div", { class: "item" }, el("div", { class: "row" }, el("b", null, i.name), STATUS_BADGE[i.status]()), el("div", { class: "small muted" }, i.note)))));
}

function needSignIn(v, title) {
  v.replaceChildren(sectionHead(title), el("div", { class: "panel login-card" },
    el("h2", { style: "justify-content:center" }, T("سجّل الدخول للمتابعة", "Sign in to continue")),
    el("p", { class: "muted" }, state.cloud === "unconfigured" ? T("لم تُضبط إعدادات Firebase.", "Firebase is not configured.") : state.cloud === "failed" ? T("تعذّر تحميل Firebase. تحقق من الاتصال.", "Could not load Firebase.") : T("كل شركة معزولة: لا يرى أحد بياناتها إلا أعضاؤها.", "Every company is isolated: only its members can see its data.")),
    el("button", { class: "google-btn", onclick: signIn, disabled: state.cloud !== "ready" }, googleG(), T("الدخول عبر Google", "Sign in with Google"))));
}

function renderCompany(v) {
  if (!state.user) return needSignIn(v, T("الشركة", "Company"));
  const c = company(), r = role();
  const invites = state.invites.length ? el("div", { class: "panel", style: "margin-bottom:1rem" }, el("h3", null, T("دعوات بانتظارك", "Pending invitations")),
    el("div", { class: "list" }, ...state.invites.map(i => el("div", { class: "item" }, el("div", { class: "row" }, el("b", null, S(i.companyName, 80)), badge("verified", T(C.ROLES[i.role]?.ar, C.ROLES[i.role]?.en))),
      el("div", { class: "toolbar" }, el("button", { class: "primary", onclick: () => acceptInvite(i) }, T("قبول", "Accept")), el("button", { onclick: () => declineInvite(i) }, T("رفض", "Decline"))))))) : null;
  const createForm = el("form", { class: "panel", onsubmit: (e) => { e.preventDefault(); createCompany(e.target.cname.value); } },
    el("h3", null, T("تسجيل شركة جديدة — مجانًا", "Register a new company — free")),
    el("label", { class: "small" }, T("اسم الشركة", "Company name"), el("input", { name: "cname", maxlength: "80", required: true })),
    el("p", { class: "small muted" }, T("ستكون المالك. بيانات الشركة معزولة عن أي شركة أخرى. بلا رسوم ولا عمولة.", "You will be the owner. Company data is isolated from every other company. No fees, no commission.")),
    el("button", { class: "gold", type: "submit" }, T("إنشاء الشركة", "Create company")));
  if (!c) { v.replaceChildren(sectionHead(T("الشركة", "Company")), invites || "", createForm); return; }
  const manage = C.can(r, "manage");
  const f = el("form", { class: "panel", onsubmit: (e) => { e.preventDefault(); saveCompany(e.target); } },
    el("h3", null, T("ملف الشركة", "Company profile"), badge(c.plan === "premium_plus" ? "verified" : "live", c.plan === "premium_plus" ? "Premium Plus" : T("مجاني", "Free"))),
    el("label", { class: "small" }, T("الاسم", "Name"), el("input", { name: "name", value: S(c.name, 80), maxlength: "80", disabled: !manage })),
    ...["facebook", "instagram", "tiktok"].map(p => el("label", { class: "small" }, { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok" }[p],
      el("input", { name: p, class: "ltr", type: "url", value: S(c.social?.[p], 300), placeholder: { facebook: "https://www.facebook.com/…", instagram: "https://www.instagram.com/…", tiktok: "https://www.tiktok.com/@…" }[p], disabled: !manage }))),
    manage ? el("button", { class: "primary", type: "submit" }, T("حفظ", "Save")) : el("p", { class: "small muted" }, T("التعديل للمالك ورئيس المجلس والمدير العام.", "Editing is for owner, chairman and general manager.")));
  const links = Object.entries(c.social || {}).filter(([, u]) => u);
  v.replaceChildren(sectionHead(T("الشركة", "Company"), el("span", { class: "small muted" }, T("دورك: ", "Your role: ") + T(C.ROLES[r]?.ar, C.ROLES[r]?.en))),
    invites || "",
    el("div", { class: "cols-2" }, f,
      el("div", { class: "grid" },
        el("div", { class: "panel" }, el("h3", null, T("الحضور على الشبكات", "Social presence")),
          links.length ? el("div", { class: "list" }, ...links.map(([p, u]) => el("a", { class: "tile", href: u, target: "_blank", rel: "noopener noreferrer" }, el("b", null, p), el("span", { class: "small ltr" }, u)))) : el("p", { class: "muted small" }, T("لا روابط بعد.", "No links yet."))),
        el("div", { class: "panel" }, el("h3", null, T("المهام", "Tasks"), badge("live", "Firestore")),
          C.can(r, "tasks") ? el("form", { class: "toolbar", onsubmit: async (e) => { e.preventDefault(); const t = e.target.t.value.trim(); if (!t) return; try { await fs.collection("companies").doc(c.id).collection("tasks").add({ title: S(t, 200), status: "todo", by: state.user.uid, at: Date.now() }); e.target.reset(); } catch (err) { fail(err); } } },
            el("input", { name: "t", maxlength: "200", placeholder: T("مهمة جديدة...", "New task...") }), el("button", { type: "submit" }, T("إضافة", "Add"))) : el("p", { class: "small muted" }, T("دورك للقراءة فقط.", "Your role is read only.")),
          el("div", { class: "list" }, ...state.tasks.map(t => el("div", { class: "item small" }, S(t.title, 200))))),
        createForm)));
}

function renderMembers(v) {
  if (!state.user) return needSignIn(v, T("المستخدمون والصلاحيات", "Users & roles"));
  const c = company();
  if (!c) { v.replaceChildren(sectionHead(T("المستخدمون والصلاحيات", "Users & roles")), el("p", null, el("a", { href: "#company" }, T("أنشئ شركة أو اقبل دعوة أولًا.", "Create a company or accept an invitation first.")))); return; }
  const manage = C.can(role(), "manage");
  const roleSelect = (uid, current) => el("select", { style: "width:auto", disabled: !manage, "aria-label": T("الدور", "Role"), onchange: (e) => setRole(uid, e.target.value) },
    ...C.INVITABLE_ROLES.map(rr => el("option", { value: rr, selected: rr === current }, T(C.ROLES[rr].ar, C.ROLES[rr].en))));
  const rows = (c.memberIds || []).map(uid => {
    const m = c.members?.[uid] || {}; const r = C.roleOf(c, uid);
    return el("tr", null, el("td", { class: "ltr" }, S(m.email || uid, 120)), el("td", null, S(m.name, 80)),
      el("td", null, uid === c.ownerUid ? badge("verified", T("المالك", "Owner")) : roleSelect(uid, r)),
      el("td", null, uid === c.ownerUid ? "" : scopeEditor(c, uid, r)),
      el("td", null, uid === c.ownerUid ? "" : uid === state.user.uid ? el("button", { onclick: () => removeMember(uid, true) }, T("مغادرة", "Leave")) : manage ? el("button", { onclick: () => removeMember(uid, false) }, T("إزالة", "Remove")) : ""));
  });
  const pending = Object.entries(c.pendingInvites || {});
  v.replaceChildren(sectionHead(T("المستخدمون والصلاحيات", "Users & roles"), badge("live", T("محمي بقواعد Firestore", "Enforced by Firestore rules"))),
    el("div", { class: "banner info" }, T("الصلاحيات تُفرض في قواعد Firestore على الخادم، وليست بإخفاء الأزرار فقط. المالك/رئيس المجلس/المدير العام: إدارة الأعضاء. مدير المشتريات/مدير الفرع/المحاسب: كتابة البيانات التشغيلية. المدقق: قراءة فقط. الموظف: قراءة + مهام ورسائل.", "Permissions are enforced by server-side Firestore rules, not by hiding buttons.")),
    table([T("البريد", "Email"), T("الاسم", "Name"), T("الدور", "Role"), T("الفروع", "Branches"), ""], rows),
    el("div", { class: "cols-2", style: "margin-top:1rem" },
      manage ? el("form", { class: "panel", onsubmit: (e) => { e.preventDefault(); invite(e.target.email.value, e.target.role.value); e.target.reset(); } },
        el("h3", null, T("دعوة عضو", "Invite member")),
        el("label", { class: "small" }, T("البريد (حساب Google)", "Email (Google account)"), el("input", { name: "email", type: "email", class: "ltr", required: true })),
        el("label", { class: "small" }, T("الدور", "Role"), el("select", { name: "role" }, ...C.INVITABLE_ROLES.map(rr => el("option", { value: rr, selected: rr === "employee" }, T(C.ROLES[rr].ar, C.ROLES[rr].en))))),
        el("button", { class: "primary", type: "submit" }, T("إرسال الدعوة", "Send invite"))) : el("div", { class: "panel muted small" }, T("دعوة الأعضاء للمالك ورئيس المجلس والمدير العام.", "Only owner, chairman and general manager can invite.")),
      el("div", { class: "panel" }, el("h3", null, T("دعوات معلقة", "Pending invites")),
        pending.length ? el("div", { class: "list" }, ...pending.map(([email, r]) => el("div", { class: "item row" }, el("span", { class: "ltr" }, email), badge("", T(C.ROLES[r]?.ar, C.ROLES[r]?.en)), manage ? el("button", { onclick: () => revoke(email) }, T("إلغاء", "Revoke")) : ""))) : el("p", { class: "muted small" }, T("لا يوجد.", "None.")))));
}

function renderPlans(v) {
  const c = company();
  v.replaceChildren(sectionHead(T("الخطط", "Plans")),
    el("div", { class: "plans" },
      el("div", { class: "plan" + (c?.plan !== "premium_plus" ? " current" : "") }, el("h3", null, T("المجانية — لكل صاحب مصلحة", "Free — for every business")), el("div", { class: "price" }, T("0 · بلا رسوم ولا عمولة", "0 · no fees, no commission")),
        el("ul", null, ...[T("شركات وفروع ومستخدمون بأدوار", "Companies, branches, users with roles"), T("عزل كامل لبيانات كل شركة", "Full isolation per company"), T("المهام والوكلاء والتراسل", "Tasks, agents & messaging"), T("المبيعات والمخزون والتحقيقات (عند ربط مصدرك)", "Sales, stock & investigations (once your source is connected)"), T("لا عمولة على أي عملية بيع", "No commission on any sale")].map(x => el("li", null, x))),
        c ? badge(c.plan === "premium_plus" ? "" : "live", c.plan === "premium_plus" ? "" : T("خطتك الحالية", "Your current plan")) : null),
      el("div", { class: "plan plus" }, el("h3", null, "Premium Plus ★"), el("div", { class: "price" }, T("اشتراك اختياري", "Optional subscription")),
        el("ul", null, ...[T("المساعد الذكي Gemini/OpenAI عبر الخادم", "Gemini/OpenAI assistant via backend"), T("موصلات قواعد البيانات المؤسسية (SQL Server وغيرها)", "Enterprise database connectors"), T("تقارير متقدمة وتصدير", "Advanced reports & export"), T("دعم أولوية", "Priority support")].map(x => el("li", null, x))),
        el("button", { class: "gold", disabled: true, title: T("لا يوجد مزود دفع بعد", "No payment provider yet") }, T("الاشتراك — قريبًا", "Subscribe — coming soon")),
        el("p", { class: "small muted" }, T("الدفع غير مفعّل (NOT_STARTED). الخطة يغيّرها خادم الفوترة فقط — قواعد Firestore تمنع أي عميل من ترقية نفسه.", "Billing not enabled. Only the billing backend can change the plan — Firestore rules stop clients upgrading themselves.")))));
}

function renderUser() {
  const box = $("user-box");
  if (!state.user) { box.replaceChildren(el("button", { class: "primary", onclick: signIn, disabled: state.cloud !== "ready" }, T("دخول", "Sign in"))); }
  else {
    const initials = (state.user.name || state.user.email).slice(0, 1).toUpperCase();
    box.replaceChildren(el("div", { class: "avatar", title: state.user.email }, state.user.photo ? el("img", { src: state.user.photo, alt: "", referrerpolicy: "no-referrer" }) : initials),
      el("div", { class: "hide-m small" }, el("b", null, S(state.user.name || state.user.email, 40)), el("div", { class: "muted" }, role() ? T(C.ROLES[role()].ar, C.ROLES[role()].en) : "")),
      el("button", { class: "ghost small", onclick: () => auth.signOut() }, T("خروج", "Sign out")));
  }
  const waiting = state.user && company() ? myApprovals().length : 0;
  const notes = myNotifications().length;
  const bell = $("bell");
  bell.hidden = !state.user;
  bell.querySelector(".count").textContent = notes ? String(notes) : "";
  bell.querySelector(".count").hidden = !notes;
  bell.setAttribute("aria-label", T("التنبيهات", "Notifications") + (notes ? " (" + notes + ")" : ""));
  const navItem = document.querySelector('#nav a[data-nav="approvals"]');
  if (navItem) { let n = navItem.querySelector(".count"); if (!n) { n = el("span", { class: "count" }); navItem.append(n); } n.textContent = waiting ? String(waiting) : ""; n.hidden = !waiting; }
  const pill = $("company-pill"), sel = $("company-select");
  pill.hidden = !state.user || state.companies.length === 0;
  sel.replaceChildren(...state.companies.map(c => el("option", { value: c.id, selected: c.id === state.companyId }, S(c.name, 60))));
  const conn = state.cloud === "ready" ? (state.user ? T("حالة الاتصال: Firebase متصل · ", "Connection: Firebase connected · ") + (company() ? S(company().name, 40) : T("بلا شركة", "no company")) : T("حالة الاتصال: Firebase جاهز · غير مسجل", "Connection: Firebase ready · signed out"))
    : state.cloud === "loading" ? T("حالة الاتصال: جارٍ التحميل", "Connection: loading") : T("حالة الاتصال: Firebase غير متاح", "Connection: Firebase unavailable");
  $("status-conn").textContent = conn + (EMULATOR ? " (EMULATOR)" : "");
  $("status-data").textContent = state.demo ? T("البيانات المعروضة: تجريبية DEMO — ليست بيانات حقيقية", "Shown data: DEMO — not real") : T("البيانات التشغيلية: لا يوجد مصدر LIVE", "Operational data: no LIVE source");
}

const RENDER = { home: renderHome, sales: renderSales, inventory: renderInventory, finance: renderFinance, investigations: renderInvestigations, "trustsoft-evidence": renderTrustsoftEvidenceView, "github-work": renderGithubWorkView, "jawafa-coverage": renderJawafaCoverageView, maps: renderMaps, assistant: renderAssistant, agents: renderAgents, connections: renderConnections, company: renderCompany, members: renderMembers, plans: renderPlans, branches: renderBranches, audit: renderAudit, employees: renderEmployees, suppliers: renderSuppliers, purchases: renderPurchases, approvals: renderApprovals, aiagents: renderAiAgents, tasks: renderTasks, notifications: renderNotifications };
// Redraws a view but keeps what the user typed in forms marked dirty (see the listeners below), and
// puts the caret back if it was inside one of those forms.
function redrawKeepingDrafts(v) {
  const view = Object.hasOwn(RENDER, current) ? RENDER[current] : null;
  if (typeof view !== "function") return;
  const forms = () => [...v.querySelectorAll("form")];
  const active = document.activeElement;
  const activeForm = active && active.form && v.contains(active) ? forms().indexOf(active.form) : -1;
  const focus = activeForm >= 0 && active.name ? { form: activeForm, name: active.name, start: active.selectionStart, end: active.selectionEnd } : null;
  const drafts = forms().map((f, i) => f.hasAttribute("data-dirty")
    ? { i, vals: [...f.elements].filter(e => e.name).map(e => [e.name, e.type === "checkbox" ? e.checked : e.value]) } : null).filter(Boolean);
  view(v);
  const now = forms();
  for (const d of drafts) {
    const f = now[d.i]; if (!f) continue;
    for (const [name, val] of d.vals) {
      const e = f.elements.namedItem(name);
      if (!e || typeof e.value === "undefined" || e instanceof RadioNodeList) continue;
      if (e.type === "checkbox") e.checked = val;
      else if (e.tagName === "SELECT") { if ([...e.options].some(o => o.value === val)) e.value = val; }
      else e.value = val;
    }
    f.setAttribute("data-dirty", "1");
  }
  if (focus) {
    const e = now[focus.form] && now[focus.form].elements.namedItem(focus.name);
    if (e && typeof e.focus === "function" && !(e instanceof RadioNodeList)) {
      e.focus();
      try { if (focus.start != null) e.setSelectionRange(focus.start, focus.end); } catch {}
    }
  }
}
let rq = false;
function render() {
  if (rq) return; rq = true;
  requestAnimationFrame(() => {
    rq = false;
    renderUser();
    const v = document.querySelector(`section.view[data-view="${current}"]`);
    // Fields outside a form (filters, free text) are not redrawn while focused; form fields are redrawn
    // with their typed values and caret restored, so live data (new options, rows) still appears.
    const ae = document.activeElement;
    const typingOutsideForm = v && v.contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName) && !ae.form && ae.id !== "sales-branch" && ae.id !== "inv-low";
    if (v && !typingOutsideForm) redrawKeepingDrafts(v);
    $("banner").replaceChildren(...(state.demo && ["home", "sales", "inventory", "finance", "investigations", "maps"].includes(current)
      ? [el("div", { class: "banner" }, el("b", null, T("بيانات تجريبية: ", "Demo data: ")), T("الأرقام في هذه الشاشة مولّدة للمعاينة فقط، وليست من قاعدة جوافة أو أي شركة.", "Figures on this screen are generated for preview only, not from Jawafa or any company."))] : []));
  });
}

// ---------- search ----------
function setupSearch() {
  const q = $("q"), box = $("q-results");
  const items = () => NAV.filter(n => n[0] !== "sep").map(n => ({ id: n[0], label: T(n[2], n[3]) }));
  let idx = 0;
  const draw = () => {
    const s = q.value.trim().toLowerCase();
    const list = s ? items().filter(i => i.label.toLowerCase().includes(s) || i.id.includes(s)) : [];
    box.hidden = !list.length; idx = Math.min(idx, Math.max(0, list.length - 1));
    box.replaceChildren(...list.map((i, k) => el("a", { href: "#" + i.id, class: k === idx ? "on" : null, onclick: () => { q.value = ""; box.hidden = true; } }, i.label)));
    return list;
  };
  q.addEventListener("input", () => { idx = 0; draw(); });
  q.addEventListener("keydown", (e) => {
    const list = draw();
    if (e.key === "ArrowDown") { idx = Math.min(idx + 1, list.length - 1); draw(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { idx = Math.max(idx - 1, 0); draw(); e.preventDefault(); }
    else if (e.key === "Enter" && list[idx]) { location.hash = "#" + list[idx].id; q.value = ""; box.hidden = true; }
    else if (e.key === "Escape") { q.value = ""; box.hidden = true; }
  });
  document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); q.focus(); } });
  q.addEventListener("blur", () => setTimeout(() => (box.hidden = true), 150));
}

// ---------- boot ----------
$("menu-btn").addEventListener("click", () => { const open = $("side").classList.toggle("open"); $("menu-btn").setAttribute("aria-expanded", String(open)); });
$("theme-btn").addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "light";
  document.documentElement.dataset.theme = dark ? "light" : "dark"; store.set("jawafa-one-theme", document.documentElement.dataset.theme); themeIcon();
});
function themeIcon() { const light = document.documentElement.dataset.theme === "light"; $("theme-btn").textContent = light ? "☾" : "☀"; $("theme-btn").setAttribute("aria-label", light ? T("الوضع الليلي", "Dark mode") : T("الوضع النهاري", "Light mode")); }
themeIcon();
$("lang-btn").addEventListener("click", () => {
  const en = lang() !== "en";
  document.documentElement.lang = en ? "en" : "ar"; document.documentElement.dir = en ? "ltr" : "rtl";
  store.set("jawafa-one-lang", en ? "en" : "ar"); buildNav(); show(current);
});
$("company-select").addEventListener("change", (e) => selectCompany(e.target.value));
window.addEventListener("hashchange", () => show(location.hash.slice(1)));
// Dirty-form tracking for render(): typing marks the form (its values survive redraws); submitting or resetting releases it.
document.addEventListener("input", (e) => { const f = e.target && e.target.form; if (f) f.setAttribute("data-dirty", "1"); }, true);
document.addEventListener("change", (e) => { const f = e.target && e.target.form; if (f && e.target.id !== "sales-branch") f.setAttribute("data-dirty", "1"); }, true);
document.addEventListener("submit", (e) => { e.target.removeAttribute("data-dirty"); }, true);
document.addEventListener("reset", (e) => { e.target.removeAttribute("data-dirty"); render(); }, true);
buildNav(); setupSearch(); show(location.hash.slice(1));
initCloud();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
window.__jawafaState = state; // read-only inspection for tests
