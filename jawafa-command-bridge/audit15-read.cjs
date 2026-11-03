'use strict';
/** AUDIT-15: owner-scoped private report reader (metadata only, no SQL).
 * The SHA receipt protects accidental drift, not a compromised administrator.
 */
const fs=require('node:fs'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex').toUpperCase();
const EXPECTED=new Set('ARPDocuments ARPFrom_gl ARPJournal_GL ARPTo_GL Cash ItemsTransActions LogoTab NoteSlipDetail PosDeletedItems SlipInfo SlipItems slipReturns TransactionHistory UnitCode Web_Transfer_Transactions_Key'.split(' ').map(x=>'dbo.'+x));
function createAudit15Reader({reportFile,audit111Reader}={}){
 if(!reportFile||!audit111Reader?.verification?.source_sha)
  throw Error('AUDIT15_REPORT_REQUIRES_VERIFIED_PRIVATE_ARCHIVE');
 function getReport(){
  const stat=fs.statSync(reportFile);
  if(!stat.isFile()||stat.size>512000)throw Error('AUDIT15_REPORT_OVERSIZE');
  const bytes=fs.readFileSync(reportFile),expected=fs.readFileSync(reportFile+'.sha256','utf8').trim().toUpperCase();
  if(!/^[A-F0-9]{64}$/.test(expected)||sha(bytes)!==expected)throw Error('AUDIT15_REPORT_HASH_MISMATCH');
  const report=JSON.parse(bytes.toString('utf8'));
  if(report?.schema_version!=='jawafa.audit15.v1'||report.classification!=='PRIVATE_FINANCIAL_AUDIT'||
    report.source_integrity_verified!==true||report.verified_latest_tables!==15||
    report.verified_latest_full!==7||report.verified_latest_delta!==8||
    report.audit111_anchor_sha256!==audit111Reader.verification.source_sha||
    !Array.isArray(report.tables)||report.tables.length!==15)
    throw Error('AUDIT15_REPORT_UNVERIFIED');
  const seen=new Set();let n=0,full=0,delta=0;
  for(const r of report.tables){
   if(!EXPECTED.has(r.table)||seen.has(r.table)||r.verified_sha256!==true||
      r.verified_csv_count!==true|| !Number.isSafeInteger(r.export_row_count)||
      r.export_row_count<0||!Number.isSafeInteger(r.source_inventory_total)||
      r.source_inventory_total<r.export_row_count||!['FULL','DELTA'].includes(r.mode)||
      !/^[A-F0-9]{64}$/.test(r.source_sha256))
    throw Error('AUDIT15_TABLE_UNVERIFIED');
   if(r.mode==='FULL'&&r.export_row_count!==r.source_inventory_total)
    throw Error('AUDIT15_FULL_COUNT_DIFF');
   seen.add(r.table);n+=r.export_row_count;
   if(r.mode==='FULL')full++;else delta++;
  }
  const history=report.transaction_history_continuity;
  if(n!==report.latest_export_rows_total||full!==7||delta!==8||
    !history||history.reconstructed_total!==history.source_inventory_total||
    !Number.isSafeInteger(history.verified_new_identifiers))
    throw Error('AUDIT15_INCONSISTENT_REPORT_TOTALS');
  return report;
 }
 getReport();
 return {getReport};
}
module.exports={createAudit15Reader};
