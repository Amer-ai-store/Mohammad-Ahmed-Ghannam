import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {RULES,validateCoverage,normalizeInvoiceRef,assessPrivateEvidence} from "../one/jawafa-db-coverage.mjs";
import {normalizeGithubWork} from "../one/github-work.mjs";
const here=path.dirname(fileURLToPath(import.meta.url));
const one=path.resolve(here,"../one");
const coverage=JSON.parse(fs.readFileSync(path.join(one,"jawafa-db-coverage.json"),"utf8"));
const app=fs.readFileSync(path.join(one,"app.js"),"utf8");
const html=fs.readFileSync(path.join(one,"index.html"),"utf8");
const sw=fs.readFileSync(path.join(one,"sw.js"),"utf8");
test("1000 exported schema headers are not misrepresented as 90% semantic coverage",()=>{
 const d=validateCoverage(coverage);
 assert.equal(d.stages.find(x=>x.id==="schema").numerator,1000);
 assert.equal(d.stages.find(x=>x.id==="schema").denominator,1000);
 assert.equal(d.schema_columns_total,15566);
 assert.equal(d.priority_tables.length,17);
 assert.equal(d.priority_relation_snapshot.relationships.length,6);
 assert.equal(d.priority_relation_snapshot.matched_within_snapshot,5);
 assert.equal(d.priority_relation_snapshot.require_investigation,1);
 assert.equal(d.priority_relation_snapshot.verified_semantic_fk_count,0);
 assert.ok(d.priority_relation_snapshot.relationships.some(r=>r.parent==="Cash" && r.without_parent===0 && r.placeholder_cash_key_events===12495));
 assert.ok(d.priority_relation_snapshot.relationships.some(r=>r.child==="InvPurchaseVouchersTransactionHistory" && r.without_parent===4));

 assert.equal(d.target_percent,90);
 assert.equal(d.percent_goal_achieved,false);
 assert.equal(d.stages.find(x=>x.id==="semantic").numerator,null);
 assert.equal(d.stages.find(x=>x.id==="integrations").verified,false);
 assert.equal(d.live_sql,false);
 assert.equal(d.data_mutated,false);
});
test("read-only business rules are explicit and not falsely marked as SQL-enforced",()=>{
 assert.equal(RULES.length,10);
 assert.ok(RULES.every(r=>["partial","needs_verification","blocked","app_readonly"].includes(r.state)));
 assert.ok(RULES.some(r=>r.id==="R-10"&&r.state==="app_readonly"));
});
test("supplier duplicate scanner is year-aware and does not label cross-year reuse fraud",()=>{
 assert.equal(normalizeInvoiceRef(" AB / - 03 "),"ab03");
 const x=assessPrivateEvidence("crossyear650",["SupplierNo","OriginalInv","RecDate"],
 [["A","009-1","2025-03-01"],["A","009/1","2026-05-01"],["B","0091","2025-07-08"]]);
 assert.equal(x.status,"needs_verification");
 assert.deepEqual(x.counts,[["المجموعات ضمن التقرير",2],["مجموعات متعددة السنوات",1]]);
});
test("private history and snapshot checks return only aggregates without record IDs",()=>{
 const a=assessPrivateEvidence("receipt54",["RecNo","ChangedFieldNames","FinancialChange"],
 [["12","Tax","True"],["13","Posted","False"]]);
 assert.equal(a.status,"correlated");
 assert.deepEqual(a.counts,[["السجلات المفحوصة",2],["سجلات مالية متغيرة",1]]);
 const h=assessPrivateEvidence("history360",["ReceiptNo","TypeNo"],[["4001","29"],["4001","31"],["4002","29"]]);
 assert.deepEqual(h.counts,[["عدد الأحداث",3],["المراجع المختلفة",2]]);
 assert.equal(JSON.stringify(h).includes("4001"),false);
});
test("GitHub work feed accepts only repository URLs and filters PRs from Issues",()=>{
 const prefix="https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam";
 const [a,b,c]=[
 {workflow_runs:[{id:21,name:"Build",html_url:prefix+"/actions/runs/21",status:"in_progress",conclusion:null,run_number:21},
  {id:22,name:"foreign",html_url:"https://evil.example/actions/runs/22",status:"completed",conclusion:"success"}]},
 [{number:214,title:"TrustSoft",html_url:prefix+"/pull/214",state:"open",draft:true}],
 [{number:101,title:"Review",html_url:prefix+"/issues/101",state:"open"},{number:214,title:"PR embedded",html_url:prefix+"/issues/214",pull_request:{url:"some"}}]
 ];
 const x=normalizeGithubWork(a,b,c);
 assert.deepEqual([x.runs.length,x.prs.length,x.issues.length],[1,1,1]);
 assert.equal(x.runs[0].status,"in_progress");
});
test("JAWAFA ONE nav, sw and evidence reader run without unapproved write routes",()=>{
 for(const id of ["github-work","jawafa-coverage"]){
  assert.ok(html.includes('data-view="'+id+'"'));
  assert.ok(app.includes('"'+id+'"'));
 }
 for(const item of ["github-work.mjs","jawafa-db-coverage.mjs","jawafa-db-coverage.json"])assert.ok(sw.includes(item));
 const code=fs.readFileSync(path.join(one,"github-work.mjs"),"utf8");
 assert.ok(code.includes("https://api.github.com/repos/"));
 assert.doesNotMatch(code,/\b(?:PATCH|POST|PUT|DELETE)\b.*fetch\(/);
 assert.doesNotMatch(code,/Authorization\s*:/i);
 const local=fs.readFileSync(path.join(one,"trustsoft-evidence.mjs"),"utf8");
 assert.match(local,/assessPrivateEvidence\(entry\.id,csv\.headers,csv\.rows\)/);
 assert.doesNotMatch(local,/\.innerHTML\s*=/);
});
