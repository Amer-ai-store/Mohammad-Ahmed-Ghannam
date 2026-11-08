const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "progress-board.js"), "utf8");
const css = fs.readFileSync(path.join(root, "progress-board.css"), "utf8");
const data = JSON.parse(fs.readFileSync(path.join(root, "progress-board.json"), "utf8"));
assert.ok(html.includes('id="central-progress-board"'));
assert.ok(html.includes('data-view="home"'));
assert.ok(html.includes('src="progress-board.js"'));
assert.ok(html.includes('href="./progress-board.css"'));
for (const el of ["data-progress-percent","data-progress-items","data-progress-totals","data-progress-evidence","data-progress-date","data-progress-acceptance"]) {
  assert.ok(html.includes(el), "missing panel hook: " + el);
}
assert.equal(data.schema_version, 1);
assert.equal(data.source_type, "verified_manual_snapshot");
assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(data.as_of));
assert.ok(data.analytical_progress.percent >= 0 && data.analytical_progress.percent <= 100);
assert.equal(data.analytical_progress.verified, false);
assert.equal(data.functional_acceptance.verified, false);
assert.ok(Array.isArray(data.active_work) && data.active_work.length > 0);
assert.ok(Array.isArray(data.totals) && data.totals.length >= 3);
assert.ok(data.evidence.every(x => /^https:\/\/github\.com\/Amer-ai-store\/Mohammad-Ahmed-Ghannam\//.test(x.url)));
assert.ok(js.includes('textContent') === false || js.includes('createTextNode')); // no HTML injection
assert.ok(js.includes('createTextNode'));
assert.ok(!js.includes('innerHTML'));
assert.ok(css.includes('#central-progress-board'));
assert.ok(!JSON.stringify(data).includes("C:\\Users\\Administrator"));
console.log("PASS: central progress panel, snapshot schema, safe rendering, privacy checks");


const workflowJs = fs.readFileSync(path.join(root,"workflow-map.js"),"utf8");
assert.ok(html.includes('data-workflow-map'));
assert.ok(html.includes('data-workflow-details'));
assert.ok(html.includes('data-workflow-github'));
assert.ok(html.includes('src="workflow-map.js"'));
assert.equal(data.workflow.nodes.length,5);
assert.ok(data.workflow.nodes.some(x=>x.status==="in_progress"));
assert.ok(data.workflow.nodes.some(x=>x.status==="blocked"));
assert.ok(data.workflow.nodes.every(x=>["verified","in_progress","blocked","failed","unverified"].includes(x.status)));
assert.ok(data.workflow.nodes.every(x=>/^https:\/\/github\.com\/Amer-ai-store\/Mohammad-Ahmed-Ghannam\//.test(x.evidence_url)));
assert.ok(workflowJs.includes("api.github.com/repos/Amer-ai-store/Mohammad-Ahmed-Ghannam/pulls/"));
assert.ok(workflowJs.includes("تعذّر الاتصال المباشر"));
assert.ok(!workflowJs.includes("innerHTML"));
console.log("PASS: interactive workflow stage map, fallback and GitHub-only live state");
