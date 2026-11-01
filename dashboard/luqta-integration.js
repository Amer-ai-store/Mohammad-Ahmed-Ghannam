/* Authenticated Luqta operations inside Amer AI Store's central dashboard. */
(() => {
  "use strict";
  const root = document.getElementById("luqta-root");
  if (!root || !window.LuqtaAPI) return;
  const client = window.LuqtaAPI.createClient();
  const tabs = [
    ["overview", "الملخص"], ["products", "الأصناف"], ["inventory", "المخزون"],
    ["offers", "العروض"], ["appearance", "التصميم والشاشات"], ["workspace", "استوديو بيئة التطبيق"],
    ["orders", "الطلبات والتتبع"], ["users", "العملاء والمحفظة"],
    ["coupons", "الخصومات"], ["returns", "المرتجعات"], ["tickets", "الدعم"],
    ["settings", "الإعدادات"], ["agents", "الوكلاء"], ["audit", "السجل"],
  ];
  const deepLinkTab = () => {
    const parts = location.hash.replace(/^#/, "").split("/");
    const candidate = parts[0] === "luqta" ? parts[1] || "overview" : "overview";
    return tabs.some(([id]) => id === candidate) ? candidate : "overview";
  };
  let tab = deepLinkTab();
  const TAB_GROUPS = [
    ["نظرة عامة", ["overview"]],
    ["الكتالوج والتصميم", ["products","inventory","offers","appearance","workspace"]],
    ["الطلبات والعملاء", ["orders","users","coupons","returns","tickets"]],
    ["الإدارة والرقابة", ["settings","agents","audit"]]
  ];
  window.addEventListener("luqta:navigate", event => {
    const requested = event.detail?.tab;
    if (!tabs.some(([id]) => id === requested) || tab === requested) return;
    tab = requested;
    draw();
  });
  let status;
  let body;
  let lastAgentToken = "";
  let bridgeHealthVerified = false;
  let jawafaSourceVerified = false;
  let bridgeCheckAt = 0;
  const reportBridge = (reason) => {
    window.dispatchEvent(new CustomEvent("luqta:bridge-state", {detail:{
      connected: client.connected, healthVerified: client.connected && bridgeHealthVerified,
      jawafaVerified: client.connected && jawafaSourceVerified,
      checkedAt: bridgeCheckAt || null, reason: reason || undefined
    }}));
  };
  async function checkLiveBridge() {
    if (!client.connected) { bridgeHealthVerified = false; jawafaSourceVerified = false; reportBridge(); return false; }
    try {
      const result = await client.request("GET", "/health");
      if (result?.ok !== true || result.service !== "luqta-commerce") throw Error("لم يجتز خادم لُقطة فحص الصحة");
      bridgeHealthVerified = true; bridgeCheckAt = Date.now();
      reportBridge();
      return true;
    } catch (error) {
      bridgeHealthVerified = false; jawafaSourceVerified = false;
      reportBridge("خادم المتجر لم يجتز فحص الاتصال (" + String(error.message || "تعذر الطلب").slice(0,90) + ").");
      return false;
    }
  }
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
      if (!client.connected) { bridgeHealthVerified = false; jawafaSourceVerified = false; draw(); return; }
      message(typeof result === "string" ? result : "اكتملت العملية وتأكد رد الخادم.");
      if (refresh) await load();
    } catch (error) {
      if (!client.connected) { bridgeHealthVerified = false; jawafaSourceVerified = false; draw(); }
      message(error.message || "تعذر تنفيذ العملية.", true);
    }
  }
  function draw() {
    root.replaceChildren();
    if (!client.connected) {
      reportBridge();
      text(root, "يرتبط هذا القسم بخادم لُقطة فقط بعد إدخال عنوان HTTPS وتسجيل دخول مدير المتجر. لا تحفظ الصفحة كلمة المرور أو رمز الجلسة في المتصفح.");
      const login = form(root, "اتصال المدير", "دخول وفحص الاتصال", async (f) => {
        const result = await client.login(value(f, "url"), value(f, "email"), value(f, "password"));
        bridgeHealthVerified = true; bridgeCheckAt = Date.now(); jawafaSourceVerified = false;
        reportBridge(); f.reset(); draw(); return `متصل بالخادم ${result.origin} بحساب ${result.user.name || result.user.email}.`;
      });
      const hostInput = field(login, "عنوان خادم لُقطة", "url", "url", true, "https://");
      field(login, "بريد المدير", "email", "email", true);
      field(login, "كلمة المرور", "password", "password", true);
      text(root, "الاتصال التجريبي لا يصبح خدمة إنتاجية إلا بعد الحصول على عنوان HTTPS مُسمّى ودائم ونسخ احتياطي مؤكد. لم تُنشر بيانات تسجيل الدخول.", "p", "small muted");
      const endpointHealth = node("p", "جارٍ التحقق من إعداد الاتصال التجريبي...", "small muted");
      root.append(endpointHealth);
      status = node("p", "بانتظار تسجيل دخول مدير المتجر.", "small"); root.append(status);
      // Runtime endpoint is public configuration only, not a secret or authentication token.
      void fetch("./luqta-runtime.json", { cache:"no-store", credentials:"omit", redirect:"error" })
        .then(async res => { if (!res.ok) throw Error("لا يوجد إعداد استضافة تجريبية."); return res.json(); })
        .then(async config => {
          const origin = window.LuqtaAPI.validateOrigin(config.origin);
          if (!root.contains(hostInput)) return;
          hostInput.value = origin;
          endpointHealth.textContent = "فحص اتصال تجريبي ("+String(config.mode || "غير معروف")+")...";
          const check = await fetch(origin + "/api/health", { credentials:"omit",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8500) });
          const info = await check.json();
          if (!check.ok || info?.service !== "luqta-commerce" || info?.ok !== true) throw Error("لا يعمل خادم لُقطة على عنوان HTTPS التجريبي.");
          if (root.contains(endpointHealth)) endpointHealth.textContent = "خادم لُقطة التجريبي متاح الآن عبر HTTPS. يلزم تسجيل دخول المدير؛ عنوان النفق مؤقت وقد يتغير.";
        }).catch(() => { if (root.contains(endpointHealth)) endpointHealth.textContent = "الرابط التجريبي غير متاح أو يحتاج تحديثًا. تأكد من تشغيل الخادم والنفق أو أدخل عنوان HTTPS آخر."; });
      return;
    }
    const header = node("div", undefined, "toolbar");
    header.append(node("span", `متصل: ${client.origin} · ${client.user.name || client.user.email}`, "pill ok"));
    reportBridge();
    header.append(button("تحديث", () => void run(async () => { await checkLiveBridge(); await load(); }, false)));
    header.append(button("تسجيل الخروج", () => void run(async () => { await client.logout(); bridgeHealthVerified = false; jawafaSourceVerified = false; lastAgentToken = ""; draw(); return "انتهت الجلسة."; }, false)));
    root.append(header);
    const nav = node("div", undefined, "luqta-nav-categories");
    nav.style.display = "grid"; nav.style.gridTemplateColumns = "repeat(auto-fit,minmax(min(100%,210px),1fr))";
    nav.style.gap = ".55rem"; nav.style.marginTop = ".9rem";
    TAB_GROUPS.forEach(([title, names]) => {
      const subgroup = node("details", undefined, "luqta-subgroup");
      subgroup.open = names.includes(tab);
      subgroup.style.border = "1px solid var(--line)"; subgroup.style.borderRadius = "10px";
      subgroup.style.background = "var(--surface-2)"; subgroup.style.padding = ".55rem";
      const heading = node("summary", title + " · " + names.length);
      heading.style.fontWeight = "700"; heading.style.cursor = "pointer"; heading.style.fontSize = ".82rem";
      heading.style.marginBottom = ".4rem"; subgroup.append(heading);
      const links = node("div", undefined, "toolbar"); links.style.gap = ".35rem";
      for (const id of names) {
        const label = tabs.find(([tabId]) => tabId === id)?.[1] || id;
        links.append(button(label, () => {
          tab = id;
          const target = "#luqta/" + id;
          if (location.hash !== target) location.hash = target;
          else draw();
        }, id === tab ? "tiny primary" : "tiny"));
      }
      subgroup.append(links); nav.append(subgroup);
    });
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
    } else if (current === "appearance") {
      result = await client.request("GET", "/admin/settings");
    } else if (current === "workspace") {
      const [settings, jobs] = await Promise.all([client.request("GET", "/admin/settings"),client.request("GET", "/admin/agent-jobs")]);
      result = { ...settings, ...jobs };
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
    table(body, ["الصنف والعائلة", "المعرّف", "السعر", "السعر السابق", "المخزون", "الحالة", "إجراء"], (data.products || []).map(p => {
      const tr = node("tr"); cell(tr, p.name + " · " + (p.familyName || p.category || "—")); cell(tr, p.id); cell(tr, money(p.price)); cell(tr, p.oldPrice == null ? "—" : money(p.oldPrice)); cell(tr, count(p.stock)); cell(tr, p.active ? "منشور" : "مؤرشف");
      const actions = cell(tr, ""); actions.append(button("تعديل", () => { editing = p.id; for (const key of Object.keys(inputs)) inputs[key].value = p[key] ?? ""; inputs.id.value = p.id; inputs.id.disabled = true; active.checked = p.active !== false; editor.scrollIntoView({ behavior: "smooth" }); }));
      if (p.active) actions.append(button("أرشفة", () => { if (confirm(`أرشفة ${p.name}؟`)) void run(() => client.request("DELETE", "/admin/products/" + safeId(p.id))); }, "tiny danger"));
      return tr;
    }));
  }
  function renderInventory(data) {
    const jawafaPanel = node("div", undefined, "panel");
    jawafaPanel.append(node("h3", "اتصال جوافة الحقيقي — قراءة فقط"));
    text(jawafaPanel, "فحص حي من خادم لُقطة إلى جسر TrustSoft المحلي؛ لا تُستورد أي كمية إلى المتجر قبل مطابقة جدول الكمية الفعلية.", "p", "small muted");
    const statusText = node("p", "لم يتم فحص اتصال جوافة بعد.", "small");
    jawafaPanel.append(statusText);
    const listing = node("pre", "", "small"); listing.style.whiteSpace = "pre-wrap"; listing.style.maxHeight = "320px"; listing.style.overflow = "auto";
    jawafaPanel.append(button("فحص اتصال Jawafa_DB", () => void run(async () => {
      const result = await client.request("GET", "/admin/jawafa/source");
      jawafaSourceVerified = result.connected === true && result.mode === "FORENSIC-READ-ONLY";
      reportBridge();
      statusText.textContent = `الاتصال: ${result.connected ? "نشط" : "متوقف"} · ${result.database} · ${result.mode} · جداول: ${result.tableCount} · خريطة الكمية: ${result.quantityMappingVerified ? "معتمدة" : "تحتاج مطابقة"}`;
      return "تأكد اتصال القراءة من خادم المتجر إلى قاعدة جوافة.";
    }, false), "primary"));
    jawafaPanel.append(button("معاينة أسماء الأصناف والعائلات من جوافة", () => void run(async () => {
      const result = await client.request("GET", "/admin/jawafa/catalog-preview");
      listing.textContent = (result.items || []).map(p => [p.itemSeq, p.code, p.name, p.family].join(" · ")).join("\n") || "لا توجد بيانات للمعاينة";
      return `تمت معاينة ${result.count} سجلًا دون كتابة.`;
    }, false)));
    jawafaPanel.append(listing);
    body.append(jawafaPanel);
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
    const jawafa = node("div", undefined, "panel");
    jawafa.append(node("h3", "مطابقة مخزون جوافة — الكمية الفعلية"));
    text(jawafa, "استيراد لقطة JSON معتمدة من جسر قراءة فقط. الكمية الفعلية = الجاهزة − مبيعات غير مرحلة. أي تعارض أو لقطة قديمة يوقف العملية. لا تُعدّل قاعدة Jawafa_DB.", "p", "small muted");
    const source = node("textarea"); source.placeholder = '{"schema":"jawafa-inventory-v1","snapshotAt":"2026-10-30T18:00:00.000Z","items":[{"id":"SKU_1","name":"صنف","price":1,"readyQuantity":12,"unpostedSalesQuantity":4,"actualQuantity":8}]}';
    source.rows = 5; source.style.width = "100%"; jawafa.append(source);
    const preview = node("pre", "لم تُجرَ معاينة.", "small"); preview.style.whiteSpace = "pre-wrap";
    jawafa.append(button("معاينة دون تعديل", () => void run(async () => {
      const snapshot = JSON.parse(source.value);
      const result = await client.request("POST", "/admin/inventory/jawafa-preview", snapshot);
      preview.textContent = `عدد الأصناف: ${result.count} · وقت اللقطة: ${result.snapshotAt}\n` + JSON.stringify(result.preview, null, 2);
      return "تمت المعاينة دون كتابة.";
    }, false), "tiny"));
    jawafa.append(button("اعتماد نقل الكمية الفعلية إلى المتجر", () => {
      if (!confirm("هل تحققت من مطابقة الأصناف والكميات؟ سيتم تغيير قاعدة المتجر فقط، وليس Jawafa_DB.")) return;
      void run(async () => {
        const snapshot = JSON.parse(source.value);
        const result = await client.request("POST", "/admin/inventory/jawafa-import", { ...snapshot, confirm: true });
        return `تم استيراد ${result.imported} صنفًا إلى قاعدة المتجر.`;
      });
    }, "primary"));
    jawafa.append(preview); body.append(jawafa);
  }
  function renderOffers(data) {
    text(body, "العروض النشطة", "h3");
    table(body, ["الصنف", "السعر السابق", "سعر العرض", "الكمية"], (data.offers || []).map(p => {
      const tr = node("tr"); cell(tr, p.name); cell(tr, money(p.oldPrice)); cell(tr, money(p.price)); cell(tr, count(p.stock)); return tr;
    }));
    const editor = form(body, "استيراد العروض إلى قاعدة المتجر", "معاينة وتأكيد العروض", async f => {
      const items = JSON.parse(value(f, "offers"));
      if (!Array.isArray(items) || !items.length) throw Error("أدخل قائمة عروض JSON صحيحة.");
      if (!confirm(`تحديث أسعار ${items.length} صنفًا في قاعدة المتجر فقط؟`)) return "أُلغي الاستيراد.";
      const result = await client.request("POST", "/admin/offers/import", { items, confirm: true });
      return `حُفظت ${result.imported} عروض في قاعدة المتجر.`;
    });
    const source = field(editor, "JSON: [{id,price,oldPrice}]. لا تنسخ أسعارًا غير معتمدة.", "offers", "textarea", true);
    source.placeholder = '[{"id":"SKU_1","price":1.25,"oldPrice":1.75}]';
  }
  function renderAppearance(data) {
    const design = data.settings?.storefront || {};
    const editor = form(body, "تحرير تصميم واجهة المتجر", "حفظ التصميم في قاعدة المتجر", async f => {
      const storefront = { accentColor: value(f, "accentColor"), heroTitle: value(f, "heroTitle"),
        heroSubtitle: value(f, "heroSubtitle"), showAssistant: f.elements.namedItem("showAssistant").checked };
      await client.request("PATCH", "/admin/settings", { storefront });
      return "تم اعتماد تصميم واجهة المتجر. سيظهر للتطبيق المرتبط عند تحديث بياناته.";
    });
    const accent = field(editor, "لون الهوية (HEX)", "accentColor", "color", true, design.accentColor || "#B94721");
    accent.style.maxWidth = "160px";
    field(editor, "عنوان الواجهة الرئيسية", "heroTitle", "text", true, design.heroTitle || "لُقطات تستحق أن تكون لك");
    field(editor, "الوصف أسفل العنوان", "heroSubtitle", "textarea", true, design.heroSubtitle || "اكتشف منتجات تُشبه ذوقك");
    const label = node("label", "إظهار قسم المساعد في الرئيسية");
    const toggle = node("input"); toggle.type = "checkbox"; toggle.name = "showAssistant"; toggle.checked = design.showAssistant !== false; label.prepend(toggle); editor.append(label);
    text(body, "التعديلات المعتمدة هنا: الهوية البصرية والنصوص وإظهار المساعد. تغيير بنية الشاشات أو إضافة مكونات جديدة يتطلب تعديل الشفرة واختبار إصدار التطبيق؛ لا يوجد محرر شيفرة إنتاجي مفتوح من المتصفح.", "p", "small muted");
  }
  function renderWorkspace(data) {
    const workspace = node("div", undefined, "command-workspace");
    text(workspace,"بيئة العمل المشتركة — لُقطة","h2");
    text(workspace,"تستخدم هذه المساحة نفس جلسة المدير ونفس قاعدة المتجر الخاصة؛ لا تُحفظ بيانات الاعتماد في GitHub Pages. الاتصال يبقى ضمن هذه الصفحة فقط ويحتاج إعادة تسجيل دخول عند تحديثها.", "p","small muted");
    const links = node("div",undefined,"toolbar");
    for(const [label,href] of [
      ["إدارة الأصناف","#luqta/products"],["معاينة المخزون","#luqta/inventory"],
      ["استيراد العروض","#luqta/offers"],["تعديل الشاشات الظاهرية","#luqta/appearance"],
      ["مهام الوكلاء","#luqta/agents"],["سجل التعديلات","#luqta/audit"]
    ]){const link = node("a",label,"btn");link.href=href;links.append(link)}
    workspace.append(links);
    body.append(workspace);
    const bridge = node("section",undefined,"panel");
    bridge.append(node("h3","التحقق من الجسر المتصل ببيئة العمل"));
    const display = node("p",bridgeHealthVerified ? "جلسة الإدارة متصلة بخادم المتجر." : "يلزم التحقق من الخادم.","small muted");
    bridge.append(display);
    bridge.append(button("اختبار اتصال خادم التطبيق",()=>void run(async()=>{
      const ok = await checkLiveBridge();
      if(!ok)throw Error("فشل اتصال خادم التطبيق.");
      display.textContent = "تم فحص /api/health بنجاح. " + new Date(bridgeCheckAt).toLocaleString("ar-JO");
      return "جسر لوحة التحكم ↔ خادم التطبيق يعمل في الجلسة الحالية.";
    },false),"primary"));
    const source = node("p","لم يُفحص مصدر جوافة في هذه الجلسة.","small muted");
    bridge.append(button("فحص جسر TrustSoft بالقراءة فقط",()=>void run(async()=>{
      const result = await client.request("GET","/admin/jawafa/source");
      jawafaSourceVerified = result.connected === true && result.mode === "FORENSIC-READ-ONLY";
      reportBridge();
      source.textContent = "جداول المصدر: " + count(result.tableCount) + " · المصدر: "
        + String(result.database || "—") + " · الكمية الفعلية: "
        + (result.quantityMappingVerified === true ? "معتمدة" : "غير معتمدة بعد");
      return "تم اختبار استجابة جسر القراءة دون تعديل بيانات جوافة.";
    },false)));
    bridge.append(source);body.append(bridge);
    const screens = node("section",undefined,"panel");
    screens.append(node("h3","الملفات والشاشات القابلة للتطوير"));
    text(screens,"يمكنك تعديل إعدادات العرض أدناه مباشرة؛ تغيير ترتيب الشاشات أو الكود يحتاج طلب تطوير ومراجعة واختبارات وإصدارًا جديدًا.", "p","small muted");
    const repo = "https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/";
    const screenLinks = [
      ["الرئيسية","luqta-mobile/src/app/index.tsx"],
      ["شاشة المدير","luqta-mobile/src/app/admin.tsx"],
      ["عروض المتجر","luqta-mobile/src/app/offers.tsx"],
      ["مكوّنات الواجهة","luqta-mobile/src/components"],
      ["خادم التجارة","luqta-mobile/server/commerce.mjs"]
    ];
    const sourceList=node("div",undefined,"command-source-links");
    sourceList.style.display="flex";sourceList.style.flexWrap="wrap";sourceList.style.gap=".45rem";
    for(const [name,path] of screenLinks){
      const link=node("a","كود "+name,"btn");link.href=repo+"tree/main/"+path;link.rel="noopener noreferrer";link.target="_blank";
      sourceList.append(link);
    }
    screens.append(sourceList);body.append(screens);
    renderAppearance({settings:data.settings || {}});
    const tasks = form(body,"طلب تعديل شاشة أو إضافة في بيئة التطبيق","تسجيل مهمة التطوير",async formNode=>{
      const target = value(formNode,"screen");
      const title = value(formNode,"title");
      const specification = value(formNode,"description");
      const acceptance = value(formNode,"acceptance");
      if(specification.length < 12 || acceptance.length < 10)throw Error("أضف وصف التعديل ومعيار قبول قابل للفحص.");
      const result = await client.request("POST","/admin/agent-jobs",{
        title:"تطوير "+target+": "+title,
        type:"development",
        description:"الشاشة: "+target+"\nالمطلوب: "+specification+"\nدليل القبول: "+acceptance+"\nشرط: لا تغيير Jawafa_DB ولا نشر إنتاجي دون اختبارات."
      });
      if(!result.job?.id)throw Error("لم يُعِد الخادم معرّفًا للمهمة.");
      formNode.reset();
      return "حُفظ طلب التطوير في خادم المتجر بالمعرّف: "+result.job.id+". لا يعني ذلك أن الكود تغير أو نُشر.";
    });
    select(tasks,"الشاشة/المجال","screen",[
      ["الرئيسية","الرئيسية"],["الأصناف والمخزون","الأصناف والمخزون"],["العروض","العروض"],
      ["الدفع والطلبات","الدفع والطلبات"],["لوحة المدير","لوحة المدير"],["شاشة جديدة","شاشة جديدة"]
    ]);
    field(tasks,"عنوان التعديل","title","text",true);
    field(tasks,"وصف التغيير المطلوب","description","textarea",true);
    field(tasks,"كيف نختبر نجاح التغيير؟","acceptance","textarea",true);
    text(body,"تُحفظ هذه الطلبات في طابور وكيل التطوير على خادم المتجر. التنفيذ الآلي للكود يحتاج وكيلًا خارجيًا متصلًا بـGitHub وصلاحية مناسبة، ولا نعتبر الطلب نسخة منشورة.", "p","small muted");
    text(body,"أحدث طلبات التطوير","h3");
    table(body,["المهمة","الحالة","التوثيق"],(data.jobs||[]).filter(j=>j.type==="development").slice(0,12).map(j=>{
      const row=node("tr");cell(row,j.title);cell(row,j.status);cell(row,j.testEvidence || "بانتظار دليل تنفيذ");return row;
    }));
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
  const renderers = { overview: renderOverview, products: renderProducts, inventory: renderInventory, offers: renderOffers, appearance: renderAppearance, workspace: renderWorkspace, orders: renderOrders,
    users: renderUsers, coupons: renderCoupons, returns: renderReturns, tickets: renderTickets, settings: renderSettings,
    agents: renderAgents, audit: renderAudit };
  window.setInterval(() => {
    if (client.connected && document.visibilityState === "visible") void checkLiveBridge();
  }, 90_000);
  draw();
})();
