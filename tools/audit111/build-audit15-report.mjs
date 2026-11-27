/** AUDIT-15: recompute verification of the 15 recovered tables (no production SQL).
 * Emits only private, source-backed aggregate evidence; never commit generated JSON.
 */
import {readFileSync,writeFileSync,statSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {rows,decodeCsv} from './import-history.mjs';
const NAMES="ARPDocuments ARPFrom_gl ARPJournal_GL ARPTo_GL Cash ItemsTransActions LogoTab NoteSlipDetail PosDeletedItems SlipInfo SlipItems slipReturns TransactionHistory UnitCode Web_Transfer_Transactions_Key".split(' ');
const [base,newest,repair,financialFile,continuityFile,out]=process.argv.slice(2);
if(!base||!newest||!repair||!financialFile||!continuityFile||!out)throw Error('USAGE: node build-audit15-report.mjs OLD NEW REPAIR FINANCIAL_JSON CONTINUITY_JSON OUTPUT_JSON');
const sha=b=>createHash('sha256').update(b).digest('hex').toUpperCase();
function meta(dir,file){
 const it=rows(decodeCsv(readFileSync(join(dir,file))));
 const h=it.next().value?.[1]||[];
 return [...it].map(([,v])=>Object.fromEntries(h.map((x,i)=>[x,v[i]])));
}
const inv=new Map(meta(newest,'inventory_tables.csv').map(x=>[x.table,x]));
const exports=new Map(meta(newest,'export_results.csv').map(x=>[x.table,x]));
const hashes=new Map(meta(newest,'manifest_sha256.csv').map(x=>[x.file,x]));
const oldManifest=new Map(meta(base,'manifest_sha256.csv').map(x=>[x.file,x]));
const oldInventory=new Map(meta(base,'inventory_tables.csv').map(x=>[x.table_name,x]));
function countRecords(buf){
 let inside=false,count=0,last=-1;
 for(const v of buf){if(v===34)inside=!inside;else if(v===10&&!inside)count++;last=v}
 if(inside)throw Error('CSV_UNBALANCED_QUOTES');
 return count+(last===10?0:1)-1;
}
const roles={
 ARPDocuments:'شيكات ومستندات القبض والصرف وحالاتها',
 ARPFrom_gl:'أطراف القيود المدينة/الدائنة (جهة المصدر) والمطابقة',
 ARPJournal_GL:'رؤوس القيود والمستخدم والترحيل',
 ARPTo_GL:'طرف القيد المقابل وحالة التسوية',
 Cash:'الصناديق والإقفال والفروقات',
 ItemsTransActions:'تاريخ تغيير الأصناف ومن نفذه بالنظام',
 LogoTab:'حركات POS المقرونة بالمستخدم والجهاز ووظيفة التنفيذ',
 NoteSlipDetail:'وسائل دفع المبيعات والشيكات والحذف',
 PosDeletedItems:'حذف أصناف نقطة البيع ومستخدم التفويض',
 SlipInfo:'فواتير المبيعات وتوقيتاتها وقيمها',
 SlipItems:'بنود المبيعات والكميات والخصومات والضريبة',
 slipReturns:'مردودات المبيعات وتعديلات الترحيل',
 TransactionHistory:'تاريخ عمليات TrustSoft ومعرفات المستخدم والجهاز',
 UnitCode:'رموز الوحدات ومفاتيح تتبعها',
 Web_Transfer_Transactions_Key:'مرجع نقل الحركة وتطابق المصدر'
};
const entries=[];
for(const table of NAMES){
 const filename='dbo.'+table+'.csv',source=join(newest,'data',filename);
 const metaRow=exports.get('dbo.'+table),index=inv.get(table),manifest=hashes.get(filename),old=oldManifest.get(filename);
 if(!metaRow||!index||!manifest||!old||metaRow.status!=='OK'||!existsSync(source)||!existsSync(join(base,'data',filename)))
  throw Error('AUDIT15_SOURCE_MISSING_OR_FAILED_'+table);
 const bytes=readFileSync(source),hash=sha(bytes),csvRows=countRecords(bytes);
 const valid=hash===manifest.sha256.toUpperCase()&&bytes.length===Number(manifest.bytes)&&csvRows===Number(metaRow.rows);
 const mode=metaRow.mode;if(!['FULL','DELTA'].includes(mode))throw Error('BAD_EXPORT_MODE_'+table);
 if(!valid||(mode==='FULL'&&csvRows!==Number(index.rows))||(mode==='DELTA'&&csvRows>Number(index.rows)))
  throw Error('AUDIT15_UNVERIFIED_EXPORT_'+table);
 entries.push({table:'dbo.'+table,domain:roles[table],mode,
  export_row_count:csvRows,source_inventory_total:Number(index.rows),
  source_sha256:hash,source_bytes:bytes.length,verified_sha256:true,verified_csv_count:true,
  previous_legacy_inventory:Number(oldInventory.get(table)?.row_count??0),
  previous_file_manifest_sha256:old.sha256,previous_file_sha_independently_rechecked:false,
  forensic_coverage:mode==='FULL'?'LATEST_FULL_CSV_CHECKED':'DELTA_CHAIN_REQUIRES_CHECK'});
}
const early=['20261026-1547','20261026-1558','20261026-1622','20261026-1636'];
const snapshots=early.map(n=>{
 const root=join(base,'..',n);
 return {snapshot:n,files_present:NAMES.filter(t=>existsSync(join(root,'data','dbo.'+t+'.csv'))).length}
});
if(snapshots.some(x=>x.files_present!==0))throw Error('EARLY_COVERAGE_CHANGED');
const repairResult=new Map(meta(repair,'export_results.csv').map(x=>[x.table,x]));
const continuityBytes=readFileSync(continuityFile),continuity=JSON.parse(continuityBytes.toString());
const expectedReceipt=readFileSync(continuityFile.replace(/\.json$/i,'.sha256'),'utf8').trim();
if(sha(continuityBytes)!==expectedReceipt||continuity.source!=='TransactionHistory'||
 continuity.newly_seen_since_base!==4027||continuity.row_count_reconciles!==true||
 continuity.baseline.rows+continuity.newly_seen_since_base!==inv.get('TransactionHistory')?.rows*1)
 throw Error('AUDIT15_TRANS_HISTORY_NOT_ACCEPTED');
const finBytes=readFileSync(financialFile),financial=JSON.parse(finBytes.toString());
if(financial.result_count!==6||financial.results.some(x=>x.error))throw Error('AUDIT15_FINANCE_KEYED_CHECK_FAILED');
const overview=Object.fromEntries(financial.results.map(x=>[x.name,{
 old_rows:x.old_rows,new_rows:x.new_rows,added:x.added,missing_in_new:x.missing_in_new,
 changed_shared:x.changed_shared,changed_fields:x.changed_fields,money_change_directional_counts:Object.fromEntries(
 Object.entries(x.money_changes||{}).map(([k,m])=>[k,{increases:m.increases,decreases:m.decreases}]))
}]));
const report={
 schema_version:'jawafa.audit15.v1',classification:'PRIVATE_FINANCIAL_AUDIT',
 generated_at:new Date().toISOString(),clock_time_authoritative:false,source_integrity_verified:true,
 source_kind:'VERIFIED_EXPORTS_NOT_ATOMIC_SQL_SNAPSHOTS',
 snapshot_name:newest.split(/[\\/]/).at(-1),
 audit111_anchor_sha256:hashes.get('dbo.InvPurchaseVouchersTransactionHistory.csv')?.sha256||null,
 early_attempts:snapshots,recovered_baseline_tables_present:NAMES.length,
 verified_latest_tables:entries.length,verified_latest_full:entries.filter(x=>x.mode==='FULL').length,
 verified_latest_delta:entries.filter(x=>x.mode==='DELTA').length,
 latest_export_rows_total:entries.reduce((a,x)=>a+x.export_row_count,0),
 tables:entries,transaction_history_continuity:{
  old_rows:continuity.baseline.rows,delta_unique_identifiers:continuity.delta_identifiers_unique,
  overlap_with_base:continuity.overlap_with_base_unique,verified_new_identifiers:continuity.newly_seen_since_base,
  reconstructed_total:continuity.baseline.rows+continuity.newly_seen_since_base,
  source_inventory_total:inv.get('TransactionHistory').rows*1,
  id_sequence_contiguous:continuity.new_ids_contiguous,
  verified_source_report_sha256:sha(continuityBytes)
 },
 financial_aggregate_differences:overview,
 source_evidence:{
  current_export_manifest_sha256:sha(readFileSync(join(newest,'manifest_sha256.csv'))),
  earlier_export_manifest_sha256:sha(readFileSync(join(base,'manifest_sha256.csv'))),
  keyed_comparison_report_sha256:sha(finBytes)
 },
 caveats:['The initial inventory multiplied row counts approximately by column count: original query not yet independently inspected.',
   'Eight DELTA files contain only selected extraction windows; repeated rows are common.',
   'System-account identity and server wall clock are not independently corroborated.',
   'No count, posting change or amount difference alone proves fraud or an accounting loss.',
   'Never publish private financial rows or personal identity in public GitHub Pages.']
};
if(report.verified_latest_tables!==15||report.verified_latest_full!==7||report.verified_latest_delta!==8||report.latest_export_rows_total!==526655)
 throw Error('AUDIT15_SUMMARY_CHANGED');
const content=JSON.stringify(report,null,2),receipt=sha(Buffer.from(content));
writeFileSync(out,content,{flag:'wx'});
writeFileSync(out+'.sha256',receipt,{flag:'wx'});
console.log(JSON.stringify({passed:true,report_path:out,report_sha256:receipt,
 rows:report.latest_export_rows_total,full:report.verified_latest_full,delta:report.verified_latest_delta,
 historic_users:report.transaction_history_continuity.reconstructed_total,private_records_printed:false},null,2));
