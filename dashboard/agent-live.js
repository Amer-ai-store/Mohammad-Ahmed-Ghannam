/* Verified public GitHub Actions activity. Never portray a simulated agent as executing. */
(() => {
  "use strict";
  const root = document.getElementById("central-agent-live");
  if (!root) return;
  const owner = "Amer-ai-store";
  const repository = "Mohammad-Ahmed-Ghannam";
  const base = "https://api.github.com/repos/" + owner + "/" + repository;
  const allowedRunUrl = /^https:\/\/github\.com\/Amer-ai-store\/Mohammad-Ahmed-Ghannam\/actions\/runs\/[0-9]+(?:\/.*)?$/;
  const runsEl = root.querySelector("[data-agent-runs]");
  const statusEl = root.querySelector("[data-agent-status]");
  const detailEl = root.querySelector("[data-agent-detail]");
  const countEl = root.querySelector("[data-agent-running-count]");
  const lastEl = root.querySelector("[data-agent-last-check]");
  const emblem = root.querySelector("[data-agent-emblem]");
  let selected = null;
  let busy = false;
  const node = (tag, className, value) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined) el.appendChild(document.createTextNode(String(value)));
    return el;
  };
  const message = (el, value) => el.replaceChildren(document.createTextNode(value));
  const endpoint = (part) => base + part;
  const getJson = async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(url, {signal: controller.signal, headers: {Accept: "application/vnd.github+json"}, cache: "no-store"});
      if (!res.ok) throw new Error("GitHub " + res.status);
      return res.json();
    } finally {
      clearTimeout(timer);
    }
  };
  const state = (r) => r.status === "in_progress" ? "working" : (r.status === "queued" || r.status === "waiting" || r.status === "pending") ? "queued" : "finished";
  const label = (r) => state(r) === "working" ? "ينفّذ الآن" : state(r) === "queued" ? "في الانتظار" : r.conclusion === "success" ? "اكتمل بنجاح" : r.conclusion === "failure" ? "فشل" : "انتهى: " + (r.conclusion || "غير معروف");
  function setActivity(working) {
    emblem.classList.toggle("is-active", working);
    emblem.setAttribute("aria-label", working ? "تنفيذ GitHub Actions مثبت حاليًا" : "لا يوجد تنفيذ GitHub Actions مثبت حاليًا");
  }
  async function showSteps(run) {
    selected = run.id;
    detailEl.replaceChildren();
    detailEl.append(node("strong","", "مراحل المهمة: " + run.name));
    detailEl.append(node("p","cpb-note","جلب خطوات التشغيل الفعلية من GitHub، دون عرض سجلات أو أسرار."));
    const link = node("a", "", "فتح سجل التنفيذ الأصلي");
    if (allowedRunUrl.test(run.html_url || "")) {
      link.href = run.html_url; link.rel = "noopener noreferrer";link.target = "_blank";detailEl.append(link);
    }
    const steps = node("ol","cpb-agent-steps");steps.append(node("li","", "جارٍ قراءة خطوات التنفيذ..."));detailEl.append(steps);
    try {
      const result = await getJson(endpoint("/actions/runs/" + encodeURIComponent(run.id) + "/jobs?per_page=20"));
      if (selected !== run.id) return;
      steps.replaceChildren();
      const jobs = Array.isArray(result.jobs) ? result.jobs : [];
      if (!jobs.length) steps.append(node("li","","لا توجد خطوات متاحة من GitHub لهذا التشغيل."));
      for (const job of jobs.slice(0,20)) {
        const li = node("li");
        li.append(node("strong","", String(job.name || "مهمة GitHub")));
        li.append(node("small","cpb-note", " — " + (job.status === "in_progress" ? "تعمل" : job.conclusion || job.status || "غير معروف")));
        const inner = node("ul","cpb-agent-job-steps");
        for (const step of (job.steps || []).slice(0,30)) {
          inner.append(node("li","", String(step.name || "خطوة") + " — " + (step.status === "in_progress" ? "تنفذ الآن" : step.conclusion || step.status || "غير معروف")));
        }
        li.append(inner);
        steps.append(li);
      }
    } catch {
      if (selected === run.id) steps.replaceChildren(node("li","","تعذر التحقق من خطوات التشغيل؛ ارجع إلى GitHub."));
    }
  }
  async function refresh() {
    if (busy) return;
    busy = true;
    message(statusEl, "جارٍ الاستعلام عن أنشطة GitHub Actions...");
    try {
      const result = await getJson(endpoint("/actions/runs?per_page=35"));
      if (!Array.isArray(result.workflow_runs)) throw new Error("Unexpected response");
      const list = result.workflow_runs.filter(r => r && Number.isSafeInteger(r.id) && allowedRunUrl.test(r.html_url || ""));
      const active = list.filter(r => state(r) === "working");
      const queued = list.filter(r => state(r) === "queued");
      const recent = list.filter(r => state(r) === "finished");
      const display = [...active.slice(0,5), ...queued.slice(0,3), ...recent.slice(0,2)];
      setActivity(active.length > 0);
      message(countEl, String(active.length));
      message(lastEl, "آخر تحقق مباشر: " + new Date().toLocaleString("ar-JO"));
      message(statusEl, active.length
        ? "يوجد تشغيل فعلي مسجّل في GitHub الآن؛ هذه ليست مراقبة مباشرة لوكلاء ChatGPT الداخليين."
        : queued.length ? "لا توجد مهام تعمل الآن؛ هناك تشغيلات في الانتظار."
        : "لا يوجد تشغيل جارٍ مؤكد في آخر استعلام؛ تظهر أحدث عمليات GitHub فقط.");
      runsEl.replaceChildren();
      if (!display.length) runsEl.append(node("p","cpb-note","لا توجد تشغيلات ظاهرة في الاستجابة الحالية."));
      for (const run of display) {
        const card = node("button","cpb-agent-run cpb-agent-"+state(run));
        card.type = "button";
        card.append(node("strong","", String(run.name || "GitHub Workflow")));
        card.append(node("span","cpb-agent-tag", label(run)));
        card.append(node("small","cpb-note","تشغيل #" + run.run_number + " · " + String(run.event || "unknown") + " · " + String(run.created_at || "وقت غير متوفر")));
        card.addEventListener("click", () => showSteps(run));
        runsEl.append(card);
      }
      if (selected) {
        const chosen = display.find(x => x.id === selected);
        if (chosen) showSteps(chosen);
      }
    } catch {
      setActivity(false);
      message(countEl, "—");
      message(lastEl, "تعذر تأكيد الاتصال");
      message(statusEl, "الاتصال المباشر غير متاح؛ حالة الوكلاء غير مثبتة، ولا يتم تشغيل رسوم توحي بالتنفيذ.");
      runsEl.replaceChildren(node("p","cpb-note","افتح GitHub Actions للتحقق من النشاط الفعلي."));
      detailEl.replaceChildren();
    } finally { busy=false; }
  }
  const button=root.querySelector("[data-agent-refresh]");
  if (button) button.addEventListener("click",refresh);
  document.addEventListener("visibilitychange",() => {if (!document.hidden) refresh();});
  refresh();
  setInterval(() => {if (!document.hidden) refresh();},180000);
})();
