import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateAudit15,filterAudit15} from "../audit15-model.mjs";
const NAMES="ARPDocuments ARPFrom_gl ARPJournal_GL ARPTo_GL Cash ItemsTransActions LogoTab NoteSlipDetail PosDeletedItems SlipInfo SlipItems slipReturns TransactionHistory UnitCode Web_Transfer_Transactions_Key".split(" ");
function fixture(){
 const tables=NAMES.map((name,i)=>({table:"dbo."+name,domain:"QA synthetic",
   mode:i<7?"FULL":"DELTA",export_row_count:i<7?10:3,
   source_inventory_total:i<7?10:100,verified_sha256:true,verified_csv_count:true,
   source_sha256:"A".repeat(64)}));
 return {schema_version:"jawafa.audit15.v1",classification:"PRIVATE_FINANCIAL_AUDIT",
 source_integrity_verified:true,audit111_anchor_sha256:"A".repeat(64),
 verified_latest_tables:15,verified_latest_full:7,verified_latest_delta:8,
 latest_export_rows_total:94,tables,
 transaction_history_continuity:{old_rows:100,verified_new_identifiers:4,
  reconstructed_total:104,source_inventory_total:104},
 financial_aggregate_differences:{Cash:{added:0,changed_shared:2,missing_in_new:0}}};
}
test("15-table FULL/DELTA envelope validates without embedded finance rows",()=>{
 const x=validateAudit15(fixture());assert.equal(x.tables.length,15);
 assert.equal(x.latest_export_rows_total,94);
});
test("invalid provenance, duplicates, missing SHA, or mode mismatch fail closed",()=>{
 const patch=[
  x=>x.classification="PUBLIC",
  x=>x.source_integrity_verified=false,
  x=>x.tables[0].source_sha256="",
  x=>x.tables[1].table=x.tables[0].table,
  x=>x.tables[0].mode="DELTA",
  x=>x.latest_export_rows_total=200,
  x=>x.transaction_history_continuity.reconstructed_total=999
 ];
 for(const fn of patch){const x=fixture();fn(x);assert.throws(()=>validateAudit15(x))}
});
test("search filters metadata without relying on account/financial values",()=>{
 const x=fixture();assert.equal(filterAudit15(x,"Cash").length,1);
 assert.equal(filterAudit15(x,"DELTA").length,8);
 assert.equal(filterAudit15(x,"nonexistent").length,0);
});
test("screen is nested in the existing Jawafa export dashboard",()=>{
 const h=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 assert.match(h,/data-view="jawafa-export"/);
 assert.match(h,/id="audit15-recovery-panel"/);
 assert.match(h,/id="audit15-table-body"/);
 assert.match(h,/src="\.\/audit15-ui\.mjs"/);
 assert.doesNotMatch(h,/data-view="jawafa-audit15"/); // no parallel dashboard
});
