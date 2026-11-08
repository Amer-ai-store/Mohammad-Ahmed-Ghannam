/* Central dashboard public-safe progress snapshot; never infer live database state. */
(() => {
  "use strict";
  const root = document.getElementById("central-progress-board");
  if (!root) return;
  const safe = (value) => document.createTextNode(String(value == null ? "" : value));
  const put = (selector, value) => {
    const el = root.querySelector(selector);
    if (el) el.replaceChildren(safe(value));
  };
  const addText = (parent, tag, value, className) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.appendChild(safe(value));
    parent.appendChild(el);
    return el;
  };
  async function refresh() {
    put("[data-progress-state]", "جارٍ التحقق من لقطة الإنجاز...");
    try {
      const response = await fetch("./progress-board.json", { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const d = await response.json();
      if (d.schema_version !== 1 || d.source_type !== "verified_manual_snapshot" ||
          !Array.isArray(d.totals) || !Array.isArray(d.active_work)) {
        throw new Error("Invalid snapshot");
      }
      const p = d.analytical_progress;
      if (!p || !Number.isFinite(p.percent) || p.percent < 0 || p.percent > 100) throw new Error("Invalid progress");
      const bar = root.querySelector("[data-progress-bar]");
      bar.value = p.percent;
      bar.setAttribute("aria-valuetext", "تقدير تحليلي " + p.percent + " بالمئة، ليس قبولاً وظيفيًا");
      put("[data-progress-percent]", p.percent + "%");
      put("[data-progress-basis]", p.basis);
      put("[data-progress-date]", d.as_of + " · لقطة موثقة يدويًا وليست بثًا حيًا");
      put("[data-progress-acceptance]", d.functional_acceptance.passed_modules + " من " + d.functional_acceptance.total_modules);
      const items = root.querySelector("[data-progress-items]");
      items.replaceChildren();
      for (const t of d.active_work) addText(items, "li", t);
      const total = root.querySelector("[data-progress-totals]");
      total.replaceChildren();
      for (const t of d.totals) {
        const item = document.createElement("div");
        item.className = "cpb-metric";
        addText(item, "span", t.label, "cpb-label");
        addText(item, "strong", t.value, "cpb-value");
        addText(item, "small", t.detail, "cpb-detail");
        total.appendChild(item);
      }
      const evidence = root.querySelector("[data-progress-evidence]");
      evidence.replaceChildren();
      for (const item of d.evidence || []) {
        if (!/^https:\/\/github\.com\/Amer-ai-store\/Mohammad-Ahmed-Ghannam\//.test(item.url)) continue;
        const a = document.createElement("a");
        a.href = item.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.appendChild(safe(item.label));
        evidence.appendChild(a);
      }
      put("[data-progress-safety]", d.safety_note);
      put("[data-progress-state]", "بيانات من لقطة تحقق محددة التاريخ");
    } catch (err) {
      put("[data-progress-state]", "تعذر تحميل بيانات موثقة — لا تُعرض نسبة بديلة");
      put("[data-progress-date]", "حالة البيانات: غير متاحة");
      put("[data-progress-percent]", "—");
      root.querySelector("[data-progress-bar]").removeAttribute("value");
      put("[data-progress-basis]", "لم يُثبت تحديث البيانات. حاول إعادة التحميل.");
    }
  }
  const reload = root.querySelector("[data-progress-refresh]");
  if (reload) reload.addEventListener("click", refresh);
  refresh();
})();
