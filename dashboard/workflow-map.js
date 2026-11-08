/* Public-safe workflow path; GitHub PR statuses are queried live, DB work remains dated snapshot. */
(() => {
  "use strict";
  const panel = document.getElementById("central-progress-board");
  if (!panel) return;
  const flow = panel.querySelector("[data-workflow-map]");
  const details = panel.querySelector("[data-workflow-details]");
  const status = panel.querySelector("[data-workflow-connection]");
  const github = panel.querySelector("[data-workflow-github]");
  const statuses = { verified: "مثبت", in_progress: "جارٍ العمل", blocked: "بانتظار تحقق", failed: "فشل", unverified: "غير مثبت" };
  const allowedEvidence = /^https:\/\/github\.com\/Amer-ai-store\/Mohammad-Ahmed-Ghannam\//;
  const text = (node, value) => node.appendChild(document.createTextNode(String(value ?? "")));
  const add = (parent, tag, label, className) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    text(node, label);
    parent.appendChild(node);
    return node;
  };
  function show(node) {
    details.replaceChildren();
    add(details, "strong", node.title);
    add(details, "p", node.detail);
    add(details, "small", "حالة مسار العمل: " + (statuses[node.status] || "غير مثبت") + " — من لقطة مؤرخة، وليست حالة SQL حية.", "cpb-note");
    if (allowedEvidence.test(node.evidence_url || "")) {
      const a = add(details, "a", "فتح مرجع المراجعة");
      a.href = node.evidence_url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
  }
  async function load() {
    flow.replaceChildren();
    details.replaceChildren();
    status.replaceChildren();
    text(status, "جارٍ تحميل مسار العمل...");
    try {
      const response = await fetch("./progress-board.json", {cache: "no-store"});
      if (!response.ok) throw new Error("Snapshot unavailable");
      const data = await response.json();
      const nodes = data.workflow && data.workflow.nodes;
      if (!Array.isArray(nodes) || !nodes.length) throw new Error("Missing workflow");
      for (const [index, node] of nodes.entries()) {
        if (!Object.hasOwn(statuses,node.status)) throw new Error("Unknown workflow state");
        const card = add(flow, "button", "", "cpb-step cpb-step-" + node.status);
        card.type = "button";
        card.setAttribute("aria-label", node.title + "، " + statuses[node.status]);
        add(card, "span", String(index + 1).padStart(2,"0"), "cpb-step-number");
        add(card, "strong", node.title);
        add(card, "span", statuses[node.status], "cpb-step-status");
        add(card, "small", node.subtitle, "cpb-step-subtitle");
        card.addEventListener("click", () => {
          for (const el of flow.querySelectorAll(".cpb-step")) el.setAttribute("aria-pressed", "false");
          card.setAttribute("aria-pressed", "true");
          show(node);
        });
        if (index === 0) {
          card.setAttribute("aria-pressed", "true");
          show(node);
        } else card.setAttribute("aria-pressed", "false");
      }
      status.replaceChildren();
      text(status, "مسار موثق بتاريخ " + data.workflow.as_of + " · حالة المعاملات ليست حية");
    } catch {
      flow.replaceChildren();
      details.replaceChildren();
      status.replaceChildren();
      text(status, "تعذر التحقق من مسار العمل؛ لن نعرض مسارًا تقديريًا.");
    }
  }
  async function refreshGitHub() {
    github.replaceChildren();
    add(github, "small", "جارٍ فحص طلبات الدمج مباشرة من GitHub...", "cpb-note");
    const ids = [188, 191];
    try {
      const results = await Promise.all(ids.map(async number => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
          const res = await fetch("https://api.github.com/repos/Amer-ai-store/Mohammad-Ahmed-Ghannam/pulls/" + number,
            {signal: controller.signal, headers: {Accept: "application/vnd.github+json"}});
          if (!res.ok) throw new Error("HTTP " + res.status);
          const payload = await res.json();
          return {number, state:payload.merged_at?"مدمج":payload.draft?"مسودة":payload.state==="open"?"مفتوح":payload.state==="closed"?"مغلق":"غير معروف", updated_at:payload.updated_at};
        } finally {clearTimeout(timeout);}
      }));
      github.replaceChildren();
      add(github, "small", "اتصال GitHub مباشر · آخر تحقق: " + new Date().toLocaleTimeString("ar-JO"), "cpb-note");
      for (const p of results) {
        const link = add(github,"a","PR #"+p.number+" — "+p.state);
        link.href="https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/pull/"+p.number;
        link.target="_blank"; link.rel="noopener noreferrer";
      }
    } catch {
      github.replaceChildren();
      add(github, "small", "تعذّر الاتصال المباشر بـGitHub؛ الحالات الحالية غير مثبتة.", "cpb-note");
      for (const n of ids) {
        const link=add(github,"a","فتح PR #"+n);
        link.href="https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/pull/"+n;
        link.target="_blank";link.rel="noopener noreferrer";
      }
    }
  }
  const refresh=panel.querySelector("[data-workflow-refresh]");
  if (refresh) refresh.addEventListener("click", () => {load();refreshGitHub();});
  document.addEventListener("visibilitychange", () => {if (!document.hidden) refreshGitHub();});
  load();
  refreshGitHub();
  setInterval(() => {if (!document.hidden) refreshGitHub();},300000);
})();
