'use strict';
/** Private AUDIT-111 report adapter; the only source is an ACL-restricted local file.
 * Integrity uses a separate SHA receipt and independent historical archive checks.
 * This SHA receipt does not protect against a privileged administrator modifying both.
 */
const fs=require('node:fs'),crypto=require('node:crypto');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex').toUpperCase();
function createAudit111ReportReader({reportFile,audit111Reader}={}){
 if(!reportFile||!audit111Reader?.verification)throw Error('AUDIT111_REPORT_READER_NOT_CONFIGURED');
 function getReport(){
  const stat=fs.statSync(reportFile);
  if(!stat.isFile()||stat.size>1024*1024)throw Error('AUDIT111_REPORT_INVALID_SIZE');
  const buffer=fs.readFileSync(reportFile),receipt=fs.readFileSync(reportFile+'.sha256','utf8').trim().toUpperCase();
  if(!/^[A-F0-9]{64}$/.test(receipt)||digest(buffer)!==receipt)
   throw Error('AUDIT111_REPORT_SHA_MISMATCH');
  const report=JSON.parse(buffer.toString('utf8'));
  const verified=audit111Reader.verification;
  if(report?.schema_version!=='jawafa.audit111.report.v1'||
   report.classification!=='PRIVATE_FINANCIAL_AUDIT'||
   report.source_integrity_verified!==true||
   report.snapshot_id!==verified.source_sha||
   report.evidence?.latest_history_sha!==verified.source_sha||
   report.summary?.latest_events!==verified.record_count||
   !Array.isArray(report.reports)||report.reports.length!==5||
   report.summary?.risk_totals?.P0!==verified.riskCounts.P0||
   report.summary?.risk_totals?.P1!==verified.riskCounts.P1||
   report.summary?.risk_totals?.P2!==verified.riskCounts.P2||
   !Array.isArray(report.cases?.purchase_changes)||report.cases.purchase_changes.length!==10||
   !Array.isArray(report.cases?.returns)||report.cases.returns.length!==11||
   !Array.isArray(report.cases?.invoice_rekeys)||report.cases.invoice_rekeys.length!==2)
   throw Error('AUDIT111_REPORT_SOURCE_NOT_ACCEPTED');
  // Returns JSON copy, no raw database handles or filesystem locations.
  return report;
 }
 getReport(); // fail closed at initialization
 return {getReport};
}
module.exports={createAudit111ReportReader};
