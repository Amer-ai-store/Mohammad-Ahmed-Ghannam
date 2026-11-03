/** Pure client-side validation for restricted, source-backed AUDIT-15 report. */
const NAMES=new Set('ARPDocuments ARPFrom_gl ARPJournal_GL ARPTo_GL Cash ItemsTransActions LogoTab NoteSlipDetail PosDeletedItems SlipInfo SlipItems slipReturns TransactionHistory UnitCode Web_Transfer_Transactions_Key'.split(' ').map(x=>'dbo.'+x));
const integer=x=>Number.isSafeInteger(x)&&x>=0;
export function validateAudit15(report){
 if(!report||typeof report!=='object'||Array.isArray(report)||
  report.schema_version!=='jawafa.audit15.v1'||
  report.classification!=='PRIVATE_FINANCIAL_AUDIT'||report.source_integrity_verified!==true||
  report.verified_latest_tables!==15||report.verified_latest_full!==7||
  report.verified_latest_delta!==8||
  !Array.isArray(report.tables)||report.tables.length!==15||
  !/^[A-Fa-f0-9]{64}$/.test(report.audit111_anchor_sha256||''))
  throw Error('AUDIT15_INVALID_SOURCE');
 let full=0,delta=0,count=0;const seen=new Set();
 for(const t of report.tables){
  if(!t||!NAMES.has(t.table)||seen.has(t.table)||
     !['FULL','DELTA'].includes(t.mode)||!integer(t.export_row_count)||
     !integer(t.source_inventory_total)||t.verified_sha256!==true||
     t.verified_csv_count!==true||!/^[A-Fa-f0-9]{64}$/.test(t.source_sha256||'')||
     (t.mode==='FULL'&&t.export_row_count!==t.source_inventory_total)||
     (t.mode==='DELTA'&&t.export_row_count>t.source_inventory_total))
    throw Error('AUDIT15_INVALID_TABLE');
  seen.add(t.table);count+=t.export_row_count;
  if(t.mode==='FULL')full++;else delta++;
 }
 const h=report.transaction_history_continuity;
 if(count!==report.latest_export_rows_total||full!==7||delta!==8||
    !h||!integer(h.old_rows)||!integer(h.verified_new_identifiers)||
    h.old_rows+h.verified_new_identifiers!==h.reconstructed_total||
    h.reconstructed_total!==h.source_inventory_total)
  throw Error('AUDIT15_INCONSISTENT_TOTALS');
 if(!report.financial_aggregate_differences||
    typeof report.financial_aggregate_differences!=='object')
   throw Error('AUDIT15_FINANCIAL_SOURCE_MISSING');
 return report;
}
export function filterAudit15(report,q=''){
 const query=String(q||'').trim().toLowerCase();
 return report.tables.filter(t=>!query||(
   t.table+' '+t.domain+' '+t.mode).toLowerCase().includes(query));
}
