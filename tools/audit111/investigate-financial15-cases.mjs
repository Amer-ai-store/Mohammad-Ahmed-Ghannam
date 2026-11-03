/** Financial investigation of FULL, SHA-verified restored TrustSoft tables.
 * Export-only, no source SQL. Private detailed JSON; stdout compact aggregates only.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {rows,decodeCsv} from './import-history.mjs';
const dirs={old:'C:/Export/hourly/20261026-1640',latest:'C:/Export/hourly-v5/20261103-0100'};
const output='C:/Export/Audit111/audit15-financial-cases-20261103.json';
const digest=x=>createHash('sha256').update(x).digest('hex').toUpperCase();
function readRows(root,name){
 const file='dbo.'+name+'.csv';
 const manifest=new Map([...rows(decodeCsv(readFileSync(join(root,'manifest_sha256.csv'))))].slice(1).map(x=>[x[1][0],x[1]]));
 const buf=readFileSync(join(root,'data',file)),ref=manifest.get(file),sha=digest(buf);
 if(!ref||sha!==ref[2].toUpperCase()||buf.length!==Number(ref[1]))throw Error('BAD_MANIFEST_'+file);
 const csv=rows(decodeCsv(buf)),first=csv.next();
 const header=first.value?.[1]||[];
 let result=[];
 for(const [num,values] of csv){
  if(header.length!==values.length)throw Error('SCHEMA_OR_ROW_LENGTH_'+file+'_'+num);
  result.push(Object.fromEntries(header.map((k,i)=>[k,values[i]])));
 }
 return {data:result,sha,header};
}
const normalize=x=>String(x??'').trim().replace(/\.0{1,7}$/,'');
const changed=(a,b,k)=>normalize(a?.[k])!==normalize(b?.[k]);
const watch=[
 {name:'ARPDocuments',key:['TransNo','DocumentNo'],fields:['DocumentValue','FDocumentValue','DocumentType','Status','CheckStatus','PaymentDate','PaidDate','deleted','replaced','NewDocNo','CheqId','InDeposit','Returned','InDepositTransNo','InBankTransNo']},
 {name:'ARPJournal_GL',key:['JournalNo'],fields:['Total','post','JournalDate','Approved','Confirmed','UserId','ApprovedUserNo','ConfirmedUserNo','OriginalTransNo','ReceiptNo','ReceiptType','JournalType']},
 {name:'Cash',key:['cashno'],fields:['Total','Net','RealCash','Deffirence','Close','CloseDate','CloseTime','tDate','userID','OpenUser','CloseUser','Cash','Check','StoreId','Last_Slip_No','Slip_Count']},
 {name:'ARPFrom_gl',key:['JournalNo','EntryOrder'],fields:['amount','famount','RemainValue','Closed','acc_no','sub_no','con_no','name_acc','CostCenter']},
 {name:'ARPTo_GL',key:['JournalNo','EntryOrder'],fields:['Amount','famount','RemainValue','Closed','Acc_No','sub_No','Con_no','Name_Acc','CostCenter']},
 {name:'slipReturns',key:['RetId','SId'],fields:['TotalPrice','Qty','VatValue','ItemCode','posted','RetDate','userID','AdminId','StoreId','SlipID']}
];
const out={schema:'jawafa.financial15.cases.v1',created_at:new Date().toISOString(),source:'MANIFEST_VERIFIED_HISTORICAL_CSV',classification:'PRIVATE_FINANCIAL_AUDIT',tables:{},cases:{},checks:[]};
const cache={};
for(const w of watch){
 const a=readRows(dirs.old,w.name),b=readRows(dirs.latest,w.name),key=r=>JSON.stringify(w.key.map(k=>normalize(r[k])));
 const old=new Map(),dupsOld=[],newKey=new Set(),dupsNew=[];
 for(const row of a.data){const k=key(row);if(old.has(k))dupsOld.push(k);old.set(k,row)}
 const changes=[],added=[];let matched=0;
 for(const row of b.data){
  const k=key(row);if(newKey.has(k)){dupsNew.push(k);continue}newKey.add(k);
  const prior=old.get(k);
  if(!prior){added.push({key:k,document:row.DocumentNo||row.ReceiptNo||row.JournalNo||row.cashno||row.RetId});continue}
  matched++;
  const diffs=Object.fromEntries(w.fields.filter(f=>f in row && changed(prior,row,f)).map(f=>[f,{before:prior[f],after:row[f]}]));
  if(Object.keys(diffs).length)changes.push({key:k,document:row.DocumentNo||row.ReceiptNo||row.JournalNo||row.cashno||row.RetId,
   before:prior,after:row,diff:diffs});
 }
 if(dupsOld.length||dupsNew.length)throw Error('DUPLICATE_BUSINESS_KEY_'+w.name);
 const missing=[...old.keys()].filter(k=>!newKey.has(k));
 out.tables[w.name]={before_rows:a.data.length,after_rows:b.data.length,matched,added:added.length,missing:missing.length,
  altered:changes.length,sha_before:a.sha,sha_after:b.sha,join_key:w.key};
 out.cases[w.name]={changes,added,missing};
 cache[w.name]={old:a,latest:b};
}
const journals=new Map(cache.ARPJournal_GL.latest.data.map(x=>[x.JournalNo,x]));
const glFrom=cache.ARPFrom_gl.latest.data,glTo=cache.ARPTo_GL.latest.data;
const glAmount=(rows,col)=>rows.reduce((s,x)=>s+Number(x[col]||0),0);
const affectedJournalIds=new Set();
for(const w of ['ARPDocuments','ARPJournal_GL','Cash','ARPFrom_gl','ARPTo_GL','slipReturns']){
 for(const r of out.cases[w].changes)if(w==='ARPJournal_GL'||w==='ARPFrom_gl'||w==='ARPTo_GL')
   affectedJournalIds.add(r.after.JournalNo);
}
const ledgerCases=[];
for(const journalNo of affectedJournalIds){
 const header=journals.get(journalNo);if(!header)continue;
 const from=glFrom.filter(x=>x.JournalNo===journalNo),
       to=glTo.filter(x=>x.JournalNo===journalNo);
 const vals={from_value:glAmount(from,'amount'),to_value:glAmount(to,'Amount'),
  from_abs:from.reduce((sum,r)=>sum+Math.abs(Number(r.amount||0)),0),
  to_abs:to.reduce((sum,r)=>sum+Math.abs(Number(r.Amount||0)),0)};
 ledgerCases.push({journalNo,header,from_count:from.length,to_count:to.length,computed:vals});
}
out.relations={affected_journal_ids:[...affectedJournalIds],journals:ledgerCases,
 limits:['FROM/TO relation based on JournalNo only; direction debits/credits not inferred until posting semantics verified',
 'Differences between independent exports do not show actual operation execution time',
 'TrustSoft account does not identify a human operator']};
writeFileSync(output,JSON.stringify(out,null,2),{flag:'wx'});
const file=readFileSync(output);writeFileSync(output+'.sha256',digest(file),{flag:'wx'});
const fieldBreakdown={};for(const w of watch){
 const counts={};for(const r of out.cases[w.name].changes)for(const k of Object.keys(r.diff))counts[k]=(counts[k]||0)+1;
 fieldBreakdown[w.name]=counts;
}
const highlights={
 document_updates:out.cases.ARPDocuments.changes.map(x=>({trans:x.after.TransNo,number:x.after.DocumentNo,doc_type:x.after.DocumentType,value:x.after.DocumentValue,
  payment_before:x.before.PaymentDate,payment_after:x.after.PaymentDate,status_before:x.before.Status,status_after:x.after.Status,cheq_id:x.after.CheqId,changed_fields:Object.keys(x.diff)})),
 cash_updates:out.cases.Cash.changes.map(x=>({cashno:x.after.cashno,store:x.after.StoreId,tDate:x.after.tDate,user_id:x.after.userID,
  before:{Total:x.before.Total,Net:x.before.Net,RealCash:x.before.RealCash,Deffirence:x.before.Deffirence,Close:x.before.Close,CloseDate:x.before.CloseDate,CloseTime:x.before.CloseTime},
  after:{Total:x.after.Total,Net:x.after.Net,RealCash:x.after.RealCash,Deffirence:x.after.Deffirence,Close:x.after.Close,CloseDate:x.after.CloseDate,CloseTime:x.after.CloseTime}})),
 account_rekeys:out.cases.ARPFrom_gl.changes.filter(x=>['acc_no','sub_no','con_no'].some(f=>f in x.diff)).map(x=>({journalNo:x.after.JournalNo,entry:x.after.EntryOrder,changes:Object.fromEntries(Object.entries(x.diff).filter(([f])=>['acc_no','sub_no','con_no','name_acc','amount'].includes(f))),amount:x.after.amount,ledger_header:journals.get(x.after.JournalNo)?{JournalDate:journals.get(x.after.JournalNo).JournalDate,ReceiptNo:journals.get(x.after.JournalNo).ReceiptNo,Total:journals.get(x.after.JournalNo).Total,UserId:journals.get(x.after.JournalNo).UserId}:null})),
 journal_post_groups:{},
 returns_item_code_replacement:out.cases.slipReturns.changes.filter(x=>'ItemCode' in x.diff).map(x=>({return_no:x.after.RetId,source_slip:x.after.SlipID,row_id:x.after.SId,changed:x.diff.ItemCode,price:x.after.TotalPrice,quantity:x.after.Qty,user_id:x.after.userID,date:x.after.RetDate}))
};
for(const x of out.cases.ARPJournal_GL.changes){
 const k=(x.before.post||'(empty)')+'->'+(x.after.post||'(empty)');
 highlights.journal_post_groups[k]=(highlights.journal_post_groups[k]||0)+1;
}
console.log(JSON.stringify({status:'PRIVATE_FORENSIC_CASE_FILE_WRITTEN',report:output,sha256:digest(file),
 tables:out.tables,field_changes:fieldBreakdown,highlights,ledger_cases:ledgerCases.length,
 note:'No human wrongdoing established; source SQL and original exports unchanged.'},null,2));
