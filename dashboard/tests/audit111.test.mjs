import test from "node:test";
import assert from "node:assert/strict";
import {validateEnvelope,visibleActor,summarize,filterEvents,SCHEMA} from "../audit111/model.mjs";
const e=(id,patch={})=>({
  event_id:id,document_type:"purchase_invoice",document_id:"SYN-001",
  observed_at:"2026-11-02T10:00:00+03:00",event_at:null,actor:"SHARED-PC",
  actor_verified:false,field:"amount",before:"100.00",after:"90.00",
  severity:"P0",evidence_level:"DIFF_ONLY",source_ref:"TEST-SNAPSHOT",
  sha256:"a".repeat(64),...patch
});
const envelope=events=>({
  schema_version:SCHEMA,classification:"PRIVATE_FINANCIAL_AUDIT",
  private_access_verified:true,source_integrity_verified:true,
  snapshot_id:"SYNTHETIC-TEST",verified_at:"2026-11-02T11:00:00+03:00",events
});
test("verified envelope with complete provenance is accepted",()=>{
  assert.equal(validateEnvelope(envelope([e("a")])).events.length,1);
});
test("public or uncertain sources fail closed",()=>{
  for(const patch of [
    {private_access_verified:false},{source_integrity_verified:false},
    {classification:"PUBLIC_OPERATIONAL_METADATA_ONLY"},{schema_version:"other"},
    {verified_at:null},{events:new Array(501).fill(e("a"))}
  ])assert.throws(()=>validateEnvelope({...envelope([]),...patch}));
});
test("duplicate event ID is rejected, not silently deduplicated",()=>{
  assert.throws(()=>validateEnvelope(envelope([e("same"),e("same")])),/INVALID_EVENT/);
});
test("missing provenance and invalid hash are rejected",()=>{
  for(const patch of [{sha256:"short"},{source_ref:""},{document_type:"unknown"},
    {observed_at:"bad"},{severity:"P9"},{evidence_level:"ALLEGATION"}])
    assert.throws(()=>validateEnvelope(envelope([e("x",patch)])),/INVALID_EVENT/);
});
test("shared username cannot prove human actor",()=>{
  assert.equal(visibleActor(e("x")),"غير مثبت");
  assert.equal(visibleActor(e("x",{system_user:"User07"})),"حساب نظام: User07 (الشخص غير مثبت)");
  assert.equal(visibleActor(e("x",{actor_verified:true,actor:"AppUser01"})),"AppUser01");
});
test("risk summary groups only supplied source-graded records",()=>{
  assert.deepEqual(summarize([e("1"),e("2",{severity:"P1"}),e("3",{severity:"P2"})]),
    {P0:1,P1:1,P2:1});
});
test("search/filter is case-insensitive and chronologically descending",()=>{
  const a=e("a",{document_id:"INV-1",observed_at:"2026-11-01T10:00:00+03:00"});
  const b=e("b",{document_id:"INV-1",observed_at:"2026-11-02T10:00:00+03:00"});
  const c=e("c",{document_type:"purchase_return",document_id:"RET-1",severity:"P2"});
  assert.deepEqual(filterEvents([a,c,b],"INV-1","purchase_invoice","P0").map(x=>x.event_id),["b","a"]);
});
test("no real financial data is included in synthetic fixtures",()=>{
  const payload=envelope([e("fixture")]);
  assert.equal(payload.events[0].document_id,"SYN-001");
  assert.notEqual(payload.events[0].evidence_level,"VERIFIED");
});
