/** Scan large general transaction log with bounded memory, output metadata only.
 * Source must pass historical export manifest; candidate joins are not proof of edits.
 */
import {createReadStream,readFileSync} from "node:fs";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {rows,decodeCsv} from "./import-history.mjs";
const [base]=process.argv.slice(2);
if(!base)throw Error("SOURCE_EXPORT_DIRECTORY_REQUIRED");
const MANIFEST=new Map([...rows(decodeCsv(readFileSync(join(base,"manifest_sha256.csv"))))].slice(1).map(x=>[x[1][0],x[1]]));
function verifiedSmall(file){
 const buf=readFileSync(join(base,"data",file)),sha=createHash("sha256").update(buf).digest("hex").toUpperCase();
 const x=MANIFEST.get(file);
 if(!x||Number(x[1])!==buf.length||x[2].toUpperCase()!==sha)throw Error("MASTER_SOURCE_SHA_MISMATCH");
 const it=rows(decodeCsv(buf)),header=it.next().value[1],lookup=Object.fromEntries(header.map((x,i)=>[x,i]));
 const k1=new Set(),k2=new Set();let count=0;
 for(const [,a] of it){
  if(a.length!==header.length)throw Error("MASTER_ROW_LENGTH_ERROR");
  if(a[lookup.TransNo])k1.add(a[lookup.TransNo]);
  if(a[lookup.VoucherNo])k2.add(a[lookup.VoucherNo]);
  count++;
 }
 return {file,rows:count,source_sha:sha,transaction_ids:k1,voucher_ids:k2};
}
const ret=verifiedSmall("dbo.ARPReturns.csv");
const FILE="dbo.TransactionHistory.csv",expected=MANIFEST.get(FILE);
if(!expected)throw Error("HISTORY_MANIFEST_NOT_FOUND");
const src=createReadStream(join(base,"data",FILE),{highWaterMark:1<<20}),hash=createHash("sha256");
let rowNo=0,total=0,quoted=false,afterQuote=false,skipLF=false,field="",record=[],head,idx;
const hits={VoucherNo_to_return_voucher:0,VoucherNo_to_return_trans:0,
 TransNo_to_return_trans:0,TransNo_to_return_voucher:0,
 TransactionNo_to_return_trans:0,TransactionNo_to_return_voucher:0,
 Trans_No_to_return_trans:0,Trans_No_to_return_voucher:0};
const matchedFns={}, matchedAccounts=new Set(), matchedVouchers=new Set();
let matchedRows=0,missingTime=0;
function finishCell(){record.push(field);field="";}
function finishRow(){
 finishCell();rowNo++;
 if(rowNo===1){
  head=record.map(x=>x.replace(/^\xef\xbb\xbf/,''));
  idx=Object.fromEntries(head.map((x,i)=>[x,i]));
  for(const col of ["UserId","FunctionId","TransactionNo","TransactionDate","Voucher_No","Trans_No","TransNo"])
   if(!(col in idx))throw Error("HISTORY_SCHEMA_MISSING_"+col);
 }else if(record.length>1||record[0]){
  if(record.length!==head.length)throw Error("HISTORY_CSV_FIELD_COUNT_ROW_"+rowNo);
  total++;
  const v=k=>record[idx[k]]||"";
  const comparisons={
   VoucherNo_to_return_voucher:ret.voucher_ids.has(v("Voucher_No")),
   VoucherNo_to_return_trans:ret.transaction_ids.has(v("Voucher_No")),
   TransNo_to_return_trans:ret.transaction_ids.has(v("TransNo")),
   TransNo_to_return_voucher:ret.voucher_ids.has(v("TransNo")),
   TransactionNo_to_return_trans:ret.transaction_ids.has(v("TransactionNo")),
   TransactionNo_to_return_voucher:ret.voucher_ids.has(v("TransactionNo")),
   Trans_No_to_return_trans:ret.transaction_ids.has(v("Trans_No")),
   Trans_No_to_return_voucher:ret.voucher_ids.has(v("Trans_No"))
  };
  let any=false;
  for(const [k,yes] of Object.entries(comparisons))if(yes){hits[k]++;any=true}
  if(any){
   matchedRows++;matchedAccounts.add(v("UserId"));
   matchedFns[v("FunctionId")]=(matchedFns[v("FunctionId")]||0)+1;
   matchedVouchers.add(v("Voucher_No")+"|"+v("Trans_No")+"|"+v("TransactionNo"));
   if(!v("TransactionDate"))missingTime++;
  }
 }
 record=[];
}
for await(const buf of src){
 hash.update(buf);
 const s=buf.toString("latin1");
 for(let i=0;i<s.length;i++){
  const c=s[i];
  if(skipLF){skipLF=false;if(c==="\n")continue}
  if(quoted){if(c==='"'){quoted=false;afterQuote=true}else field+=c;continue}
  if(afterQuote){
   if(c==='"'){field+='"';quoted=true;afterQuote=false;continue}
   if(c!==","&&c!=="\r"&&c!=="\n")throw Error("BAD_QUOTED_FIELD_ROW_"+rowNo);
   afterQuote=false;
  }else if(c==='"'&&field===""){quoted=true;continue}
  else if(c==='"')throw Error("UNQUOTED_DOUBLE_QUOTE_ROW_"+rowNo);
  if(c===",")finishCell();
  else if(c==="\n"||c==="\r"){finishRow();if(c==="\r")skipLF=true}
  else field+=c;
 }
}
if(quoted)throw Error("TRUNCATED_CSV_QUOTE");
if(record.length||field)finishRow();
const actual=hash.digest("hex").toUpperCase();
if(Number(expected[1])!==180539706 ||expected[2].toUpperCase()!==actual)
 throw Error("LARGE_HISTORY_MANIFEST_MISMATCH");
const topFns=Object.entries(matchedFns).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([function_id,count])=>({function_id,count}));
console.log(JSON.stringify({source_file:FILE,source_sha:actual,transactions_seen:total,
 return_master_rows:ret.rows,return_source_sha:ret.source_sha,
 candidate_match_rows:matchedRows,distinct_candidate_signatures:matchedVouchers.size,
 system_accounts_in_candidates:matchedAccounts.size,missing_recorded_time:missingTime,
 matches_by_column:hits,top_function_ids:topFns,
 evidence_grade:"KEY_MATCH_ONLY_WITHOUT_BEFORE_AFTER",
 note:"Generic transaction activity cannot independently prove a purchase return amount or user-performed edit."},null,2));
