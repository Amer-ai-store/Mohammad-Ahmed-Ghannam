/** Forensic triage and cross-link checks; no writes to source, output only separate private report. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {rows,decodeCsv} from './import-history.mjs';
const base='C:/Export/hourly/20261026-1640',latest='C:/Export/hourly-v5/20261103-0100';
const privateFile='C:/Export/Audit111/audit15-financial-cases-20261103.json';
const expected=readFileSync(privateFile+'.sha256','utf8').trim().toUpperCase();
const bytes=readFileSync(privateFile),hash=buf=>createHash('sha256').update(buf).digest('hex').toUpperCase();
if(hash(bytes)!==expected)throw Error('PRIVATE_CASE_REPORT_TAMPERED');
const report=JSON.parse(bytes.toString());
function verifiedTable(dir,name){
 const file='dbo.'+name+'.csv',m=rows(decodeCsv(readFileSync(join(dir,'manifest_sha256.csv')))),h=m.next().value[1];
 const ref=[...m].map(([,v])=>Object.fromEntries(h.map((k,i)=>[k,v[i]]))).find(x=>x.file===file);
 const buf=readFileSync(join(dir,'data',file));
 if(!ref||hash(buf)!==ref.sha256.toUpperCase()||buf.length!==Number(ref.bytes))throw Error('BAD_SOURCE_'+name);
 const csv=rows(decodeCsv(buf)),cols=csv.next().value[1];
 return [...csv].map(([,v])=>Object.fromEntries(cols.map((k,i)=>[k,v[i]])));
}
const statuses=report.cases.ARPDocuments.changes;
const amount=x=>Number(x||0),sum=(a,k)=>a.reduce((s,x)=>s+amount(k(x)),0);
const chequeValues=statuses.map(x=>({document:x.after.DocumentNo,transaction:x.after.TransNo,
 cheque_id:x.after.CheqId,amount:amount(x.after.DocumentValue),
 bank_transaction:x.after.InBankTransNo,payment_date:x.after.PaymentDate?.slice(0,10),
 before_status:x.before.Status,after_status:x.after.Status,
 before_bank_transaction:x.before.InBankTransNo||null,after_bank_transaction:x.after.InBankTransNo||null,
 unchanged_amount:amount(x.after.DocumentValue)===amount(x.before.DocumentValue)}));
const uniqueBank=new Set(chequeValues.map(x=>x.bank_transaction));
const gl=verifiedTable(latest,'ARPJournal_GL');
const docs=verifiedTable(latest,'ARPDocuments');
const cash=report.cases.Cash.changes;
const journalByReceipt=new Map(),journalByOriginal=new Map(),journalByNo=new Map();
for(const j of gl){
 journalByNo.set(j.JournalNo,j);
 for(const [field,map] of [['ReceiptNo',journalByReceipt],['OriginalTransNo',journalByOriginal]]){
  const key=j[field];if(!key)continue;let a=map.get(key);if(!a){a=[];map.set(key,a)}a.push(j);
 }
}
const matches=chequeValues.map(d=>{
 const byBank=journalByNo.get(d.bank_transaction);
 const byReceipt=journalByReceipt.get(d.document)||[];
 const byOriginal=journalByOriginal.get(d.bank_transaction)||[];
 return {cheque:d.document,bank_transaction:d.bank_transaction,
  journal_no_matches:byBank?1:0,receipt_matches:byReceipt.length,original_bank_ref_matches:byOriginal.length,
  potential_journal_ids:[...new Set([...(byBank?[byBank.JournalNo]:[]),...byReceipt.map(x=>x.JournalNo),...byOriginal.map(x=>x.JournalNo)])].slice(0,12)};
});
const postChanges=report.cases.ARPJournal_GL.changes;
const journalCounts=postChanges.reduce((a,x)=>{
 const k=(x.before.post||'')+'->'+(x.after.post||'');a[k]=(a[k]||0)+1;return a;
},{});
const journals=report.relations.journals;
const discrepancy=journals.map(x=>({journal:x.journalNo,total:amount(x.header.Total),from:Math.round(x.computed.from_value*1000000)/1e6,to:Math.round(x.computed.to_value*1000000)/1e6,
 diff_from_to:Math.round((x.computed.from_value-x.computed.to_value)*1000000)/1e6,has_from:x.from_count>0,has_to:x.to_count>0}));
const tally={both_sides:discrepancy.filter(x=>x.has_from&&x.has_to).length,
 values_equal:discrepancy.filter(x=>x.has_from&&x.has_to&&Math.abs(x.diff_from_to)<0.00001).length,
 values_different:discrepancy.filter(x=>x.has_from&&x.has_to&&Math.abs(x.diff_from_to)>=0.00001).length,
 missing_either:discrepancy.filter(x=>!x.has_from||!x.has_to).length,
 from_matches_header:discrepancy.filter(x=>x.has_from&&Math.abs(x.from-x.total)<0.00001).length,
 to_matches_header:discrepancy.filter(x=>x.has_to&&Math.abs(x.to-x.total)<0.00001).length};
const accountChanges=report.cases.ARPFrom_gl.changes.filter(x=>['acc_no','sub_no','con_no'].some(k=>k in x.diff));
const accountEvidence=accountChanges.map(x=>{
 const j=journalByNo.get(x.after.JournalNo);
 const oldVal=x.before.amount,newVal=x.after.amount;
 return {journal:x.after.JournalNo,entry:x.after.EntryOrder,amount:amount(x.after.amount),old_amount:amount(oldVal),
  unchanged_amount:amount(oldVal)===amount(newVal),
  changed_fields:Object.keys(x.diff),source_supplier_before:x.before.con_no,source_supplier_after:x.after.con_no,
  account_before:x.before.acc_no,account_after:x.after.acc_no,
  invoice_or_receipt_reference:j?.ReceiptNo||null,journal_header_user_id:j?.UserId||null,
  document_date:j?.JournalDate?.slice(0,10)||null,posting_status:j?.post||null};
});
const specialCheques={};
for(const id of ['6792','1442','1443']){
 const matching=docs.filter(x=>x.DocumentNo===id);
 specialCheques[id]={matches:matching.length,
  items:matching.map(x=>({trans:x.TransNo,document_type:x.DocumentType,branch:x.BranchID,amount:x.DocumentValue,
    status:x.Status,check_status:x.CheckStatus,due_date:x.DueDate,payment_date:x.PaymentDate,returned:x.Returned,
    replaced:x.replaced,deleted:x.deleted,bank_ref:x.InBankTransNo})).slice(0,15)};
}
const output={
 classification:'PRIVATE_FINANCIAL_AUDIT',schema:'jawafa.audit15.triage.v1',date_generated:new Date().toISOString(),
 source_manifest_verification:'PASSED_FOR_SELECTED_CSV',case_report_sha256:expected,
 cheques:{count:statuses.length,docs:chequeValues,sum_amounts:Math.round(sum(chequeValues,x=>x.amount)*1000000)/1e6,
   unchanged_amounts:chequeValues.every(x=>x.unchanged_amount),bank_reference_nonempty:chequeValues.filter(x=>x.bank_transaction).length,
   bank_reference_unique:uniqueBank.size,link_candidates:matches,specific_earlier_cheque_numbers:specialCheques},
 cash_sessions:cash.map(x=>({cashno:x.after.cashno,date:x.after.tDate,store:x.after.StoreId,user_id:x.after.userID,
 total_before:x.before.Total,total_after:x.after.Total,net_before:x.before.Net,net_after:x.after.Net,
 physical_cash_before:x.before.RealCash,physical_cash_after:x.after.RealCash,
 difference_before:x.before.Deffirence,difference_after:x.after.Deffirence,
 close_before:x.before.Close,close_after:x.after.Close,close_date:x.after.CloseDate,
 close_time:x.after.CloseTime,sales_slips_before:x.before.Slip_Count,sales_slips_after:x.after.Slip_Count,
 last_slip_before:x.before.Last_Slip_No,last_slip_after:x.after.Last_Slip_No})),
 journal_post_changes:postChanges.length,journal_post_flow:journalCounts,
 journal_side_counts:tally,unbalanced_gl_candidates:discrepancy.filter(x=>x.has_from&&x.has_to&&Math.abs(x.diff_from_to)>=0.00001).slice(0,50),
 account_reclassifications:accountEvidence,
 caveats:['Cheque journal match is candidate linkage only: no original bank statements have been matched',
 'Cash difference fields require TrustSoft formula and close-state to calculate shortage',
 'Posting false->true may be normal late processing; event-time and user-attribution not independently established',
 'Journal From/To sums are compared for consistency without asserting debit-credit semantics.']
};
const textOut=JSON.stringify(output,null,2),where='C:/Export/Audit111/audit15-financial-triage-20261103.json';
writeFileSync(where,textOut,{flag:'wx'});writeFileSync(where+'.sha256',hash(Buffer.from(textOut)),{flag:'wx'});
console.log(JSON.stringify({status:'PRIVATE_TRIAGE_CREATED',private_file:where,sha256:hash(Buffer.from(textOut)),
  cheques:{count:output.cheques.count,nominal_sum:output.cheques.sum_amounts,amounts_unchanged:output.cheques.unchanged_amounts,
   distinct_bank_refs:output.cheques.bank_reference_unique,link_candidate_counts:matches.reduce((a,x)=>(a.with_journal_no+=x.journal_no_matches,a.with_original+=x.original_bank_ref_matches?1:0,a.with_receipt+=x.receipt_matches?1:0,a),{with_journal_no:0,with_original:0,with_receipt:0}),
   special_checks:Object.fromEntries(Object.entries(specialCheques).map(([k,x])=>[k,x.matches]))},
  cash:output.cash_sessions,
  journal:output.journal_side_counts,
  account_changes:accountEvidence,
  no_private_cheque_rows_in_public_repo:true},null,2));
