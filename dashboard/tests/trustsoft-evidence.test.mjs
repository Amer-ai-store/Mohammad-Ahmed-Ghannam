import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {parsePrivateCsv,validatePublicSummary,fingerprintSha256,AUDIT_STATES} from "../one/trustsoft-evidence.mjs";

const dirname=path.dirname(fileURLToPath(import.meta.url));
const one=path.resolve(dirname,"../one");
const src=fs.readFileSync(path.join(one,"app.js"),"utf8");
const index=fs.readFileSync(path.join(one,"index.html"),"utf8");
const sw=fs.readFileSync(path.join(one,"sw.js"),"utf8");
const mod=fs.readFileSync(path.join(one,"trustsoft-evidence.mjs"),"utf8");
const manifest=JSON.parse(fs.readFileSync(path.join(one,"trustsoft-public-summary.json"),"utf8"));

test("public summary is a dated redacted offline aggregate, never a completion claim",()=>{
  const data=validatePublicSummary(manifest);
  assert.equal(data.findings.length,7);
  assert.equal(data.analysis_completion_verified,false);
  assert.match(data.owner_requested_slice,/25%/);
  assert.equal(data.provenance.live_db_connected,false);
  assert.equal(data.provenance.individual_user_attribution_verified,false);
  assert.equal(data.provenance.bank_originals_reconciled,false);
  assert.equal(data.original_financial_records_modified,false);
  assert.ok(data.findings.every(f=>Object.hasOwn(AUDIT_STATES,f.status)));
  assert.deepEqual(data.findings.find(f=>f.id==="historical-changes").facts.slice(0,2),
    [["رؤوس قديمة تغيرت",54],["رؤوس ذات حقول مالية تغيرت",13]]);
  assert.equal(data.findings.find(f=>f.id==="audit-events").facts.find(p=>p[0]==="أحداث في الفترة")[1],326);
  assert.equal(data.findings.find(f=>f.id==="invoice-reuse").facts.find(p=>p[0]==="مجموعات تكرار داخل نفس السنة")[1],0);
});
test("private CSV registry is hash-bound without copying any financial values into public site",()=>{
  assert.equal(manifest.evidence_files.length,6);
  assert.ok(manifest.evidence_files.every(f=>f.sha256.length===64));
  const serialized=JSON.stringify(manifest);
  assert.ok(!/C:\\\\Users|JAWAFFASVR\\\\|@gmail|\bsa_password\b/i.test(serialized));
  assert.ok(!/"(?:RecNo|SupplierNo|OldTax|NewTax|OldTotalCost_JDS)"\s*:/.test(serialized));
  assert.ok(!/https:\/\/drive\.google\.com/.test(serialized));
});
test("RFC-style private CSV parser supports BOM, escaped quotes, embedded newline",()=>{
  const d=parsePrivateCsv('\uFEFF"RecNo","Remark"\r\n"123","A ""quoted"" value\nwith newline"\r\n"456","normal"\r\n');
  assert.deepEqual(d.headers,["RecNo","Remark"]);
  assert.deepEqual(d.rows,[["123",'A "quoted" value\nwith newline'],["456","normal"]]);
  assert.throws(()=>parsePrivateCsv('a,b\n1'),/INCONSISTENT_CSV_COLUMNS/);
  assert.throws(()=>parsePrivateCsv('a\n"oops'),/UNTERMINATED_CSV_QUOTE/);
});
test("SHA-256 is verifiable and fails closed for missing WebCrypto",async()=>{
  const input=new TextEncoder().encode("trustsoft-public-safe");
  const digest=await fingerprintSha256(input);
  assert.match(digest,/^[a-f0-9]{64}$/);
  assert.notEqual(digest,manifest.evidence_files[0].sha256);
});
test("JAWAFA ONE route, service worker and DOM are wired safely",()=>{
  assert.match(src,/from "\.\/trustsoft-evidence\.mjs"/);
  assert.match(src,/renderTrustsoftEvidenceView/);
  assert.match(src,/"trustsoft-evidence": renderTrustsoftEvidenceView/);
  assert.match(index,/data-view="trustsoft-evidence"/);
  assert.match(sw,/trustsoft-public-summary\.json/);
  assert.match(mod,/file\.arrayBuffer\(\)/);
  assert.match(mod,/hash!==entry\.sha256/);
  assert.match(mod,/parsePrivateCsv/);
  assert.match(mod,/document\.createTextNode/);
  assert.doesNotMatch(mod,/\.innerHTML\s*=/);
  assert.doesNotMatch(mod,/\b(?:window\.)?(?:localStorage|sessionStorage)\s*[.(]|\b(?:firebase|firestore)\s*\.\s*(?:collection|app|firestore)|\.upload\s*\(/i);
  assert.doesNotMatch(mod,/fetch\(file|fetch\(buffer|FormData|XMLHttpRequest/);
});
