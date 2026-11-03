'use strict';
/** Restricted on-host source verification; never print private financial rows. */
const assert=require('node:assert/strict');
const path=require('node:path');
const {createAudit111Reader}=require('./audit111-read.cjs');
const {createAudit111ReportReader}=require('./audit111-reports.cjs');
const [archiveDir,exportDir,reportFile]=process.argv.slice(2);
if(!archiveDir||!exportDir||!reportFile)throw Error('AUDIT111_QA_ARGS_REQUIRED');
const source=createAudit111Reader({
  databaseFile:path.join(archiveDir,'audit111_history.sqlite'),exportDir});
try{
  const read=createAudit111ReportReader({reportFile,audit111Reader:source});
  const report=read.getReport();
  assert.equal(report.schema_version,'jawafa.audit111.report.v1');
  assert.equal(report.source_integrity_verified,true);
  assert.equal(report.summary.latest_events,source.verification.record_count);
  assert.equal(report.summary.latest_events,22776);
  assert.equal(report.summary.new_events,607);
  assert.equal(report.reports.length,5);
  assert.equal(report.cases.purchase_changes.length,10);
  assert.equal(report.cases.returns.length,11);
  assert.equal(report.cases.invoice_rekeys.length,2);
  assert.equal(report.snapshot_id,source.verification.source_sha);
  assert.equal(report.clock_verified,false);
  console.log(JSON.stringify({
   passed:true,source_sha_matches:true,source_chain_checked:true,
   private_report_receipt_checked:true,snapshot:report.snapshot_id.slice(0,16),
   report_count:report.reports.length,event_count:report.summary.latest_events,
   new_events:report.summary.new_events,
   tested_category_counts:[10,11,2],financial_records_printed:false,
   release_status:'NON_PRODUCTION_READONLY_QA_ONLY'
  },null,2));
}finally{source.close()}
