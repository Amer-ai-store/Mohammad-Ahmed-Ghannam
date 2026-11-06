"use strict";
const {test}=require("node:test");const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const root=path.join(__dirname,"..");const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const js=fs.readFileSync(path.join(root,"jawafa-integration.js"),"utf8");
const ids=["jawafa","jawafa-tasks","jawafa-gate15","jawafa-backups","jawafa-monitor","jawafa-accounting","jawafa-checks","jawafa-purchases","jawafa-receiving","jawafa-people","jawafa-investigations","jawafa-agents","jawafa-commands","jawafa-evidence","jawafa-reports","jawafa-errors"];
test("one existing dashboard, 16 native views in original navigation",()=>{for(const n of ids){assert.ok(html.includes('data-view="'+n+'"'),"missing "+n);assert.ok(html.includes('data-jawafa-pane="'+n+'"'),"missing "+n)}assert.ok(!html.includes('iframe src="./jawafa-gate15.html"'));assert.ok(html.includes('src="jawafa-integration.js"'));assert.ok(html.includes('id="side-nav"'));assert.ok(html.includes('id="chip-nav"'))});
test("existing host application and login are preserved",()=>{for(const term of ["function buildNav()","function show(view)","function initLive()","onAuthStateChanged","firebase-config.js","renderAll()"]){assert.ok(html.includes(term),term)}});
test("native scripts compile with no extraneous app redirect",()=>{assert.doesNotThrow(()=>new vm.Script(js));const match=html.match(/<script>\s*([\s\S]*?)<\/script>/);assert.ok(match);assert.doesNotThrow(()=>new vm.Script(match[1]));assert.ok(!js.includes('jawafa-operations.html'));assert.ok(!js.includes('guava-forensic-command-center-dhv9z9'))});
test("no false live SQL or command success and no browser secrets",()=>{assert.ok(js.includes("NOT_CONNECTED"));assert.ok(js.includes("BLOCKED_BY_G15"));assert.ok(js.includes("credentials:\"same-origin\""));assert.ok(js.includes("getIdToken()"));assert.ok(js.includes("result.request_id"));assert.ok(js.includes("result.status"));assert.ok(!/localStorage|sessionStorage|service_role|sql_password|sk-proj-/i.test(js))});
test("dated repair report remains in the native errors view and is public-safe",()=>{
 const start=html.indexOf('<section class="view" data-view="jawafa-errors"');
 assert.ok(start>=0,"jawafa-errors view missing");
 const end=html.indexOf('<!-- HOME -->',start);
 assert.ok(end>start,"end of jawafa-errors view missing");
 const view=html.slice(start,end);
 for(const s of ['id="jawafa-repair-snapshot"','JRF-001','JRF-002','JRF-008','NOT ACCEPTED','مرجع مؤرخ وليس حالة حية','صلاحية خاصة'])assert.ok(view.includes(s),s);
 for(const secret of ['SQLPassword_Decrypted','192.168.','0.0.0.0','server-hardened-candidate','CheqId','VoucherNo'])assert.ok(!view.includes(secret),"disallowed operational detail: "+secret);
});
test("snapshot tracks verified v5 manifest without claiming full export acceptance",()=>{
 const begin=html.indexOf('id="jawafa-repair-snapshot"');assert.ok(begin>=0);
 const end=html.indexOf('<!-- HOME -->',begin);assert.ok(end>begin);
 const view=html.slice(begin,end);
 for(const s of ['515/515','503 FULL','12 DELTA','FILES_VERIFIED / ACCEPTANCE_OPEN','NO_SYNC','GATE-15','فرق صفين'])assert.ok(view.includes(s),s);
 assert.ok(view.includes('لا يثبت اكتمال البيانات'));
});

test("historical security v147 card is integrated and public-safe",()=>{
 const card='id="jawafa-security-v147"';
 assert.ok(html.includes(card),"security card not mounted in native Jawafa dashboard");
 assert.ok(html.includes('href="./jawafa-security-v147.html"'),"security report link missing");
 const start=html.indexOf(card);
 const end=html.indexOf('id="jawafa-continuity-entry"',start);
 assert.ok(start>=0&&end>start,"security card not adjacent to Jawafa continuity view");
 const dashboardCard=html.slice(start,end);
 const report=fs.readFileSync(path.join(root,"jawafa-security-v147.html"),"utf8");
 for(const text of ["لقطة تاريخية","ليست مراقبة مباشرة","لا يعني ذلك إثبات خلو النظام"])
   assert.ok(report.includes(text),"missing historical caveat: "+text);
 for(const published of [dashboardCard,report]){
   for(const privateTerm of ["docs.google.com/document/d/","Private/Public","SQL sa","192.168.","0.0.0.0","CheqId","VoucherNo","SQLPassword_Decrypted"])
     assert.ok(!published.includes(privateTerm),"restricted operational detail in public report: "+privateTerm);
 }
});
