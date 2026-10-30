/* Authenticated Luqta operations inside Amer AI Store's central dashboard. */
(() => {
  "use strict";
  const root = document.getElementById("luqta-root");
  if (!root || !window.LuqtaAPI) return;
  const client = window.LuqtaAPI.createClient();
  const tabs = [
    ["overview", "الملخص"], ["products", "الأصناف"], ["inventory", "المخزون"],
    ["orders", "الطلبات والتتبع"], ["users", "العملاء والمحفظة"],
    ["coupons", "الخصومات"], ["returns", "المرتجعات"], ["tickets", "الدعم"],
    ["settings", "الإعدادات"], ["agents", "الوكلاء"], ["audit", "السجل"],
  ];
  let tab = "overview";
  let status;
  let body;
  let lastAgentToken = "";
  const node = (tag, value, className) => {
    const result = document.createElement(tag);
    if (value !== undefined && value !== null) result.textContent = String(value);
    if (className) result.className = className;
    return result;
  };
  const text = (parent, value, tag = "p", className = "") => {
    const result = node(tag, value, className); parent.append(result); return result;
  };
  const button = (label, handler, className = "tiny") => {
    const result = node("button", label, className); result.type = "button";
    result.addEventListener("click", handler); return result;
  };
  const cell = (row, value) => { const td = node("td", value); row.append(td); return td; };
  const table = (parent, headers, rows) => {
    const wrap = node("div", undefined, "table-wrap"); const tbl = node("table");
    const thead = node("thead"), tr = node("tr"); headers.forEach(h => tr.append(node("th", h))); thead.append(tr); tbl.append(thead);
    const tbody = node("tbody"); rows.forEach(row => tbody.append(row));
    if (!rows.length) { const empty = node("tr"), td = cell(empty, "لا توجد سجلات."); td.colSpan = headers.length; tbody.append(empty); }
    tbl.append(tbody); wrap.append(tbl); parent.append(wrap); return tbl;
  };
  const field = (form, label, key, type = "text", required = false, value = "") => {
    const wrapper = node("label", undefined, "field"); wrapper.append(node("span", label));
    const input = node(type === "textarea" ? "textarea" : "input");
    if (type !== "textarea") input.type = type;
    input.name = key; input.required = required; input.value = String(value ?? "");
    wrapper.append(input); form.append(wrapper); return input;
  };
  const select = (form, label, key, options, value = "") => {
    const wrapper = node("label", undefined, "field"); wrapper.append(node("span", label));
    const input = node("select"); input.name = key;
    options.forEach(([id, name]) => { const option = node("option", name); option.value = id; input.append(option); });
    input.value = value; wrapper.append(input); form.append(wrapper); return input;
  };
  const form = (parent, title, submitLabel, submit) => {
    const panel = node("form", undefined, "panel"); panel.style.marginTop = ".7rem";
    panel.append(node("h3", title));
    panel.addEventListener("submit", event => { event.preventDefault(); void run(() => submit(panel)); });
    const action = node("button", submitLabel, "primary"); action.type = "submit"; panel.append(action);
    parent.append(panel); return panel;
  };
  const value = (form, key) => form.elements.namedItem(key)?.value?.trim() || "";
  const count = (value) => Number(value || 0).toLocaleString("ar-JO");
  const money = (value) => `${Number(value || 0).toFixed(3)} د.أ`;
  const safeId = (id) => { const v = String(id); if (!/^[A-Za-z0-9_-]{1,100}$/.test(v)) throw Error("معرّف السجل غير صالح."); return v; };
  const message = (value, failed = false) => { if (status) { status.textContent = value; status.style.color = failed ? "var(--coral)" : "var(--ok)"; } };
  async function run(work, refresh = true) {
    message("جارٍ تنفيذ الطلب...");
    try {
      const result = await work();
      if (!client.connected) { draw(); return; }
      message(typeof result === "string" ? result : "اكتملت العملية وتأكد رد الخادم.");
      if (refresh) await load();
    } catch (error) {
      if (!client.connected) draw();
      message(error.message || "تعذر تنفيذ العملية.", true);
    }
  }
  function draw() {
    root.replaceChildren();
    if (!client.connected) {
      text(root, "يرتبط هذا القسم بخادم لُقطة فقط بعد إدخال عنوان HTTPS وتسجيل دخول مدير المتجر. لا تحفظ الصفحة كلمة المرور أو رمز الجلسة في المتصفح.");
      const login = form(root, "اتصال المدير", "دخول وفحص الاتصال", async (f) => {
        const result = await client.login(value(f, "url"), value(f, "email"), value(f, "password"));
        f.reset(); draw(); return `متصل بالخادم ${result.origin} بحساب ${result.user.name || result.user.email}.`;
      });
      field(login, "عنوان خادم لُقطة", "url", "url", true, "https://");
      field(login, "بريد المدير", "email", "email", true);
      field(login, "كلمة المرور", "password", "password", true);
      text(root, "الرابط الحالي هو لوحة عرض عامة على GitHub Pages؛ يجب نشر خادم لُقطة مستقل بعنوان HTTPS وإضافة هذا المنشأ إلى CORS. لن تُعرض بيانات تجريبية على أنها حية.", "p", "small muted");
      status = node("p", "بانتظار الاتصال.", "small"); root.append(status); return;
    }
    const header = node("div", undefined, "toolbar");
    header.append(node("span", `متصل: ${client.origin} · ${client.user.name || client.user.email}`, "pill ok"));
    header.append(button("تحديث", () => void run(() => load(), false)));
    header.append(button("تسجيل الخروج", () => void run(async () => { await client.logout(); lastAgentToken = ""; draw(); return "انتهت الجلسة."; }, false)));
    root.append(header);
    const nav = node("div", undefined, "toolbar"); nav.style.marginTop = ".7rem";
    tabs.forEach(([id, label]) => nav.append(button(label, () => { tab = id; void run(() => load(), false); }, id === tab ? "tiny primary" : "tiny")));
    root.append(nav);
    status = node("p", "", "small"); root.append(status);
    body = node("div"); body.style.display = "grid"; body.style.gap = ".65rem"; root.append(body);
    void run(() => load(), false);
  }
  async function load() {
    if (!client.connected || !body) return;
    const current = tab; let result;
    if (current === "inventory") {
      const [undo, connector] = await Promise.all([client.request("GET", "/admin/inventory/undo"), client.request("GET", "/admin/inventory/connector")]);
      result = { ...undo, ...connector };
    } else if (current === "agents") {
      const [keys, jobs] = await Promise.all([client.request("GET", "/admin/agent-keys"), client.request("GET", "/admin/agent-jobs")]);
      result = { ...keys, ...jobs };
    } else if (current === "orders") {
      const [orders, users] = await Promise.all([client.request("GET", "/admin/orders"), client.request("GET", "/admin/users")]);
      result = { ...orders, ...users };
    } else result = await client.request("GET", "/admin/" + current);
    if (tab !== current) return;
    body.replaceChildren();
    const render = renderers[current];
    if (render) render(result || {});
    message(`آخر تحديث: ${new Date().toLocaleString("ar-JO")}`);
  }
  function renderOverview(data) {
    const stats = data.stats || {};
    const tiles = node("div", undefined, "kpis");
    [["الأصناف", stats.products], ["المخزون المنخفض", stats.lowStock], ["الطلبات", stats.orders],
      ["طلبات معلقة", stats.pendingOrders], ["العملاء", stats.customers], ["الإيراد المحصل", money(stats.revenue)]].forEach(([label, n]) => {
      const tile = node("div", undefined, "kpi"); text(tile, label, "span", "label"); text(tile, typeof n === "string" ? n : count(n), "span", "value"); tiles.append(tile);
    });
    body.append(tiles); text(body, "أحدث الطلبات", "h3");
    table(body, ["المعرّف", "الحالة", "القيمة"], (data.recentOrders || []).map(o => { const tr = node("tr"); cell(tr, o.id); cell(tr, o.status); cell(tr, money(o.total)); return tr; }));
    text(body, "أصناف منخفضة المخزون", "h3");
    table(body, ["الصنف", "الكمية"], (data.lowStockProducts || []).map(p => { const tr = node("tr"); cell(tr, p.name); cell(tr, count(p.stock)); return tr; }));
  }
  function renderProducts(data) {
    let editing = "";
    const editor = form(body, "إنشاء أو تعديل صنف", "حفظ الصنف", async f => {
      const payload = { name: value(f, "name"), price: Number(value(f, "price")), stock: Number(value(f, "stock")),
        category: value(f, "category"), description: value(f, "description"), brand: value(f, "brand"), active: f.elements.namedItem("active").checked };
      if (value(f, "oldPrice")) payload.oldPrice = Number(value(f, "oldPrice"));
      else if (editing) payload.oldPrice = null;
      for (const key of ["variantOf", "variantLabel"]) if (value(f, key)) payload[key] = value(f, key);
      if (!editing) { if (value(f, "id")) payload.id = value(f, "id"); await client.request("POST", "/admin/products", payload); }
      else await client.request("PATCH", "/admin/products/" + safeId(editing), payload);
      editing = ""; f.reset(); return "حُفظ الصنف في قاعدة بيانات المتجر.";
    });
    const inputs = {};
    for (const [label, key, type, required] of [["معرّف اختياري", "id", "text", false], ["الاسم", "name", "text", true], ["السعر بالدينار", "price", "number", true], ["السعر السابق للعرض (اختياري)", "oldPrice", "number", false], ["الكمية", "stock", "number", true], ["الفئة", "category", "text", false], ["العلامة", "brand", "text", false], ["الوصف", "description", "textarea", false], ["معرّف الصنف الأب", "variantOf", "text", false], ["المقاس/اللون", "variantLabel", "text", false]]) inputs[key] = field(editor, label, key, type, required);
    inputs.price.step = "0.001"; inputs.price.min = "0.001"; inputs.oldPrice.step = "0.001"; inputs.oldPrice.min = "0.001"; inputs.stock.step = "1"; inputs.stock.min = "0";
    const activeLabel = node("label", "منشور "); const active = node("input"); active.type = "checkbox"; active.name = "active"; active.checked = true; activeLabel.append(active); editor.append(activeLabel);
    editor.append(button("نموذج جديد", () => { editing = ""; editor.reset(); inputs.id.disabled = false; active.checked = true; }));
    text(body, `الأصناف: ${count(data.products?.length)}`, "h3");
    table(body, ["الصنف", "المعرّف", "السعر", "السعر السابق", "المخزون", "الحالة", "إجراء"], (data.products || []).map(p => {
      const tr = node("tr"); cell(tr, p.name); cell(tr, p.id); cell(tr, money(p.price)); cell(tr, p.oldPrice == null ? "—" : money(p.oldPrice)); cell(tr, count(p.stock)); cell(tr, p.active ? "منشور" : "مؤرشف");
      const actions = cell(tr, ""); actions.append(button("تعديل", () => { editing = p.id; for (const key of Object.keys(inputs)) inputs[key].value = p[key] ?? ""; inputs.id.value = p.id; inputs.id.disabled = true; active.checked = p.active !== false; editor.scrollIntoView({ behavior: "smooth" }); }));
      if (p.active) actions.append(button("أرشفة", () => { if (confirm(`أرشفة ${p.name}؟`)) void run(() => client.request("DELETE", "/admin/products/" + safeId(p.id))); }, "tiny danger"));
      return tr;
    }));
  }
  function renderInventory(data) {
    const connector = data.connector || {};
    text(body, data.undo ? `آخر استيراد قابل للتراجع: ${data.undo.id} · ${count(data.undo.count)} صنف` : "لا توجد عملية استيراد قابلة للتراجع.");
    if (data.undo) body.append(button("التراجع عن آخر استيراد", () => { if (confirm("هل تريد التراجع عن آخر استيراد؟ سيرفض الخادم التراجع إذا تغيرت الأصناف بعده.")) void run(() => client.request("POST", "/admin/inventory/undo", { importId: data.undo.id })); }, "danger"));
    const importer = form(body, "استيراد CSV إلى قاعدة بيانات المتجر", "استيراد الأصناف", async f => {
      const csv = value(f, "csv"); if (!csv) throw Error("ألصق بيانات CSV أولًا.");
      const result = await client.request("POST", "/admin/inventory/import", { csv, mode: value(f, "mode") });
      return `استُورد ${count(result.imported)} صنفًا (${count(result.created)} جديد).`;
    });
    field(importer, "CSV: id,name,price,stock,category", "csv", "textarea", true);
    select(importer, "طريقة تحديث الكمية", "mode", [["replace", "استبدال"], ["add", "إضافة"]]);
    const connectorForm = form(body, "تطبيق المخزون الخارجي", "حفظ رابط التطبيق", async f => {
      await client.request("PUT", "/admin/inventory/connector", { url: value(f, "url"), ...(value(f, "token") ? { token: value(f, "token") } : {}) });
      f.elements.namedItem("token").value = ""; return "حُفظ الربط على الخادم.";
    });
    field(connectorForm, "عنوان HTTPS لملف JSON", "url", "url", true, connector.url || "");
    field(connectorForm, "رمز API اختياري (لا يُعرض لاحقًا)", "token", "password");
    text(body, connector.lastSyncAt ? `آخر مزامنة: ${connector.lastSyncAt}` : "لم تحدث مزامنة بعد.", "p", "small muted");
    body.append(button("استيراد الكميات بضغطة زر", () => void run(async () => {
      const result = await client.request("POST", "/admin/inventory/sync", {});
      return `أعاد الخادم نتيجة الاستيراد: ${count(result.imported)} صنف.`;
    }), "primary"));
  }
  function renderOrders(data) {
    const drivers = (data.users || []).filter(u => u.role === "driver");
    const next = { pending: "confirmed", confirmed: "preparing", preparing: "out_for_delivery", out_for_delivery: "delivered" };
    table(body, ["الطلب", "التاريخ", "العميل", "المبلغ", "الحالة", "السائق", "إجراءات"], (data.orders || []).map(o => {
      const tr = node("tr"); cell(tr, o.id); cell(tr, o.date || ""); cell(tr, o.userId); cell(tr, money(o.total)); cell(tr, o.status); cell(tr, o.driverId || "—");
      const actions = cell(tr, ""); const driver = node("select");
      [["", "اختر سائقًا"], ...drivers.map(d => [d.id, d.name || d.email])].forEach(([id, name]) => { const option = node("option", name); option.value = id; driver.append(option); });
      driver.value = o.driverId || ""; actions.append(driver);
      actions.append(button("تعيين السائق", () => void run(() => client.request("PATCH", "/admin/orders/" + safeId(o.id), { driverId: driver.value || null }))));
      if (next[o.status]) actions.append(button("إلى " + next[o.status], () => void run(() => client.request("PATCH", "/admin/orders/" + safeId(o.id), { status: next[o.status], ...(driver.value ? { driverId: driver.value } : {}) }))));
      if (["pending", "confirmed"].includes(o.status)) actions.append(button("إلغاء", () => { if (confirm("إلغاء الطلب وإعادة مخزونه؟")) void run(() => client.request("PATCH", "/admin/orders/" + safeId(o.id), { status: "cancelled" })); }, "tiny danger"));
      actions.append(button("تتبع", () => void run(async () => {
        const tracking = await client.request("GET", "/orders/" + safeId(o.id) + "/tracking");
        const point = tracking.location;
        if (point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) {
          const url = `https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=15/${point.latitude}/${point.longitude}`;
          const link = node("a", `موقع السائق (${point.updatedAt || ""})`); link.href = url; link.target = "_blank"; link.rel = "noopener"; actions.append(link);
          return "موقع السائق الفعلي متاح على الخريطة.";
        }
        return "لم يشارك السائق موقعه بعد.";
      }, false)));
      return tr;
    }));
  }
  function renderUsers(data) {
    const walletForm = form(body, "تعديل رصيد المحفظة بإجراء مدقق", "إضافة الحركة", async f => {
      const result = await client.request("POST", "/admin/wallet/adjust", { userId: value(f, "userId"), amount: Number(value(f, "amount")), note: value(f, "note") });
      f.reset(); return `الرصيد الجديد: ${money(result.balance)}.`;
    });
    const userInput = field(walletForm, "معرّف العميل", "userId", "text", true);
    const amount = field(walletForm, "المبلغ (+ أو -)", "amount", "number", true); amount.step = "0.001";
    field(walletForm, "سبب التعديل", "note", "text", true);
    table(body, ["المستخدم", "البريد", "الدور", "الإجراء"], (data.users || []).map(u => {
      const tr = node("tr"); cell(tr, u.id); cell(tr, u.email); cell(tr, u.role); const actions = cell(tr, "");
      actions.append(button("للمحفظة", () => { userInput.value = u.id; walletForm.scrollIntoView({ behavior: "smooth" }); }));
      const roles = node("select"); [["customer", "عميل"], ["driver", "سائق"], ["admin", "مدير"]].forEach(([id, name]) => { const opt = node("option", name); opt.value = id; roles.append(opt); }); roles.value = u.role; actions.append(roles);
      actions.append(button("تغيير الدور", () => { if (confirm(`تغيير دور ${u.email} إلى ${roles.value}؟`)) void run(() => client.request("PATCH", "/admin/users/" + safeId(u.id), { role: roles.value })); }));
      return tr;
    }));
  }
  function renderCoupons(data) {
    let editing = "";
    const editor = form(body, "إنشاء أو تعديل قسيمة", "حفظ القسيمة", async f => {
      const payload = { code: value(f, "code"), type: value(f, "type"), value: Number(value(f, "value")), minSubtotal: Number(value(f, "minSubtotal") || 0), active: true };
      if (value(f, "maxUses")) payload.maxUses = Number(value(f, "maxUses"));
      if (value(f, "expiresAt")) payload.expiresAt = new Date(value(f, "expiresAt")).toISOString();
      await client.request(editing ? "PATCH" : "POST", "/admin/coupons" + (editing ? "/" + safeId(editing) : ""), payload);
      editing = ""; f.reset(); return "حُفظت القسيمة.";
    });
    const inputs = { code: field(editor, "رمز الخصم", "code", "text", true), type: select(editor, "النوع", "type", [["percent", "نسبة مئوية"], ["fixed", "مبلغ ثابت"]]), value: field(editor, "القيمة", "value", "number", true), minSubtotal: field(editor, "الحد الأدنى للسلة", "minSubtotal", "number", false, "0"), maxUses: field(editor, "الحد الأقصى للاستخدام", "maxUses", "number"), expiresAt: field(editor, "تاريخ الانتهاء", "expiresAt", "datetime-local") };
    inputs.value.step = "0.001"; inputs.minSubtotal.step = "0.001";
    editor.append(button("قسيمة جديدة", () => { editing = ""; editor.reset(); }));
    table(body, ["الرمز", "النوع", "القيمة", "استخدامات", "نشط", "إجراءات"], (data.coupons || []).map(c => {
      const tr = node("tr"); cell(tr, c.code); cell(tr, c.type); cell(tr, c.value); cell(tr, `${c.uses}/${c.maxUses || "∞"}`); cell(tr, c.active ? "نعم" : "لا");
      const actions = cell(tr, ""); actions.append(button("تعديل", () => { editing = c.id; for (const key of ["code", "type", "value", "minSubtotal", "maxUses"]) inputs[key].value = c[key] ?? ""; inputs.expiresAt.value = c.expiresAt ? String(c.expiresAt).slice(0, 16) : ""; editor.scrollIntoView({ behavior: "smooth" }); }));
      if (c.active) actions.append(button("تعطيل", () => { if (confirm("تعطيل القسيمة؟")) void run(() => client.request("DELETE", "/admin/coupons/" + safeId(c.id))); }, "tiny danger"));
      return tr;
    }));
  }
  function renderReturns(data) {
    table(body, ["الطلب", "العميل", "السبب", "الحالة", "إجراء"], (data.returns || []).map(r => {
      const tr = node("tr"); cell(tr, r.orderId); cell(tr, r.userId); cell(tr, r.reason); cell(tr, r.status);
      const actions = cell(tr, ""); if (r.status === "requested") for (const [state, label] of [["approved", "قبول ورد المحفظة"], ["rejected", "رفض"]]) actions.append(button(label, () => {
        const note = prompt("ملاحظة القرار (اختيارية):", ""); if (note === null) return;
        if (confirm(`${label} طلب الإرجاع؟`)) void run(() => client.request("PATCH", "/admin/returns/" + safeId(r.id), { status: state, note }));
      }, state === "rejected" ? "tiny danger" : "tiny")); return tr;
    }));
  }
  function renderTickets(data) {
    table(body, ["الموضوع", "رسالة العميل", "الحالة", "ردود", "إجراء"], (data.tickets || []).map(t => {
      const tr = node("tr"); cell(tr, t.subject); cell(tr, t.message); cell(tr, t.status); cell(tr, count(t.replies?.length));
      const actions = cell(tr, ""); actions.append(button("رد", () => { const reply = prompt("اكتب رد الدعم:"); if (reply) void run(() => client.request("POST", "/admin/tickets/" + safeId(t.id) + "/replies", { message: reply })); }));
      if (t.status !== "resolved") actions.append(button("إغلاق", () => void run(() => client.request("PATCH", "/admin/tickets/" + safeId(t.id), { status: "resolved" }))));
      return tr;
    }));
  }
  function renderSettings(data) {
    const s = data.settings || {};
    const editor = form(body, "إعدادات المتجر الحية", "حفظ الإعدادات", async f => {
      await client.request("PATCH", "/admin/settings", { storeName: value(f, "storeName"), currency: value(f, "currency"), country: value(f, "country"), shippingFee: Number(value(f, "shippingFee")), freeShippingThreshold: Number(value(f, "freeShippingThreshold")), returnsDays: Number(value(f, "returnsDays")) });
      return "حُفظت إعدادات المتجر.";
    });
    field(editor, "اسم المتجر", "storeName", "text", true, s.storeName);
    field(editor, "العملة", "currency", "text", true, s.currency || "JOD");
    field(editor, "الدولة", "country", "text", true, s.country || "JO");
    for (const [label, key] of [["رسوم التوصيل", "shippingFee"], ["حد التوصيل المجاني", "freeShippingThreshold"], ["أيام الإرجاع", "returnsDays"]]) { const input = field(editor, label, key, "number", true, s[key]); input.min = "0"; input.step = key === "returnsDays" ? "1" : "0.001"; }
  }
  function renderAgents(data) {
    const jobForm = form(body, "مهمة للوكيل", "إضافة المهمة", async f => {
      await client.request("POST", "/admin/agent-jobs", { title: value(f, "title"), description: value(f, "description"), type: value(f, "type") });
      f.reset(); return "أُضيفت المهمة إلى قائمة الوكلاء.";
    });
    field(jobForm, "العنوان", "title", "text", true); field(jobForm, "الوصف", "description", "textarea", true);
    select(jobForm, "النوع", "type", [["audit", "تدقيق"], ["repair", "إصلاح"], ["development", "تطوير"]]);
    text(body, "المهام", "h3");
    table(body, ["المهمة", "النوع", "الحالة", "دليل الاختبار"], (data.jobs || []).map(j => { const tr = node("tr"); cell(tr, j.title); cell(tr, j.type); cell(tr, j.status); cell(tr, j.testEvidence || "—"); return tr; }));
    const keyForm = form(body, "إصدار مفتاح محدود الصلاحيات لوكيل خارجي", "إصدار المفتاح", async f => {
      const scopes = [...f.querySelectorAll('input[name="scope"]:checked')].map(input => input.value);
      if (!scopes.length) throw Error("اختر صلاحية واحدة على الأقل.");
      const result = await client.request("POST", "/admin/agent-keys", { name: value(f, "name"), scopes });
      lastAgentToken = result.token;
      f.reset(); return "أُصدر مفتاح جديد. انسخه الآن؛ لن يظهر بعد مغادرة هذه الجلسة.";
    });
    field(keyForm, "اسم الوكيل", "name", "text", true);
    for (const [id, label] of [["catalog:write", "الكتالوج"], ["inventory:write", "المخزون"], ["orders:write", "الطلبات"], ["settings:write", "الإعدادات"], ["jobs:write", "المهام"]]) {
      const wrapper = node("label", label + " "); const input = node("input"); input.type = "checkbox"; input.name = "scope"; input.value = id; wrapper.append(input); keyForm.append(wrapper);
    }
    if (lastAgentToken) { text(body, "المفتاح الصادر لمرة واحدة:", "h3"); text(body, lastAgentToken, "pre", "code"); }
    text(body, "المفاتيح", "h3");
    table(body, ["الاسم", "الصلاحيات", "آخر استخدام", "الحالة", "إجراء"], (data.keys || []).map(k => {
      const tr = node("tr"); cell(tr, k.name); cell(tr, (k.scopes || []).join("، ")); cell(tr, k.lastUsedAt || "—"); cell(tr, k.revoked ? "ملغى" : "نشط");
      const actions = cell(tr, ""); if (!k.revoked) actions.append(button("إلغاء المفتاح", () => { if (confirm("إبطال وصول هذا الوكيل؟")) void run(() => client.request("DELETE", "/admin/agent-keys/" + safeId(k.id))); }, "tiny danger")); return tr;
    }));
  }
  function renderAudit(data) {
    table(body, ["الوقت", "الفاعل", "الإجراء", "المعرّف", "تفاصيل"], (data.events || []).map(e => { const tr = node("tr"); cell(tr, e.createdAt); cell(tr, e.actorId); cell(tr, e.action); cell(tr, e.entityId); cell(tr, JSON.stringify(e.detail || {})); return tr; }));
  }
  const renderers = { overview: renderOverview, products: renderProducts, inventory: renderInventory, orders: renderOrders,
    users: renderUsers, coupons: renderCoupons, returns: renderReturns, tickets: renderTickets, settings: renderSettings,
    agents: renderAgents, audit: renderAudit };
  draw();
})();
