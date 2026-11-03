import test from "node:test";
import assert from "node:assert/strict";
import {LEDGER_SCHEMA,privateDriveUrl,normalizeLedger} from "../jawafa-chat-reports-model.mjs";
const now=Date.parse("2026-11-03T00:00:00Z");
const good=()=>({
  schema:LEDGER_SCHEMA,
  access:{authenticated:true,role:"owner",scope:"jawafa.reports.read",gateway:"private"},
  source:{kind:"google_drive_private",integrity:"verified",time_authority:"independent_utc",
    snapshot_id:"synthetic-only",verified_at:"2026-11-02T23:50:00Z",
    expires_at:"2026-11-03T02:00:00Z",source_sha256:"a".repeat(64)},
  reports:[{id:"synthetic-01",title:"تقرير تجريبي",category:"موجز",
    state:"PARTIAL",evidence_status:"DIFF_ONLY",evidence_id:"synthetic-evidence",
    as_of:"2026-11-02T23:30:00Z",summary:"بيانات اصطناعية للاختبار فقط",
    url:"https://docs.google.com/document/d/"+"b".repeat(35)+"/edit"}]
});
test("valid private owner envelope is parsed; report links must be Drive",()=>{
  const v=normalizeLedger(good(),now);
  assert.equal(v.count,1);
  assert.equal(v.reports[0].state,"PARTIAL");
  assert.equal(v.reports[0].url.startsWith("https://docs.google.com/"),true);
});
test("anonymous, reader and public gateway all fail closed",()=>{
  for(const p of [{authenticated:false},{role:"reader"},{gateway:"public"},{scope:"jawafa.write"}]){
    const d=good();Object.assign(d.access,p);assert.throws(()=>normalizeLedger(d,now));
  }
});
test("old, future, oversized and unsigned snapshots are rejected",()=>{
  const old=good();old.source.expires_at="2026-11-02T23:59:00Z";
  assert.throws(()=>normalizeLedger(old,now));
  const future=good();future.source.verified_at="2026-11-03T02:00:00Z";
  assert.throws(()=>normalizeLedger(future,now));
  const long=good();long.reports=Array.from({length:101},()=>good().reports[0]);
  assert.throws(()=>normalizeLedger(long,now));
  const nohash=good();nohash.source.source_sha256="not-a-hash";
  assert.throws(()=>normalizeLedger(nohash,now));
});
test("untrusted links, protocol downgrade and duplicate records are rejected",()=>{
  for(const url of ["http://docs.google.com/document/d/a/edit","https://evil.example/report",
    "https://docs.google.com.evil.example/document/d/aaaaaaaaaaaaaaaaaaaa/edit",
    "javascript:alert(1)","https://example.org","https://user:pass@drive.google.com/file/d/aaaaaaaaaaaaaaaaaaaa/view"]){
    assert.equal(privateDriveUrl(url),null);
    const d=good();d.reports[0].url=url;assert.throws(()=>normalizeLedger(d,now));
  }
  const d=good();d.reports.push({...d.reports[0]});
  assert.throws(()=>normalizeLedger(d,now));
});
test("invalid claim or stage is rejected, unknown extra fields are discarded",()=>{
  for(const key of ["state","evidence_status"]){
    const d=good();d.reports[0][key]="DONE";assert.throws(()=>normalizeLedger(d,now));
  }
  const d=good();d.reports[0].secret="should-never-surface";
  assert.equal(Object.hasOwn(normalizeLedger(d,now).reports[0],"secret"),false);
});
test("invalid timestamps, forged source type, URL fragment and note are rejected",()=>{
  const d=good();d.source.time_authority="jawafa_server";assert.throws(()=>normalizeLedger(d,now));
  const e=good();e.reports[0].as_of="yesterday";assert.throws(()=>normalizeLedger(e,now));
  const f=good();f.reports[0].summary="x".repeat(601);assert.throws(()=>normalizeLedger(f,now));
  assert.equal(privateDriveUrl("https://drive.google.com/file/d/"+"a".repeat(30)+"/view#secret"),null);
});
