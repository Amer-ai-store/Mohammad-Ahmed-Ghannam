/** Investigative context. Uses only the verified export manifest and private audit database.
 * No raw supplier, user, amount or voucher numbers leave the server.
 */
import {DatabaseSync} from "node:sqlite";
import {readFileSync,statSync} from "node:fs";
import {createHash} from "node:crypto";
import {join} from "node:path";
import {rows,decodeCsv} from "./import-history.mjs";
const [base,privateDir]=process.argv.slice(2);
if(!base||!privateDir)throw Error("EXPORT_DIR_AND_PRIVATE_DIR_REQUIRED");
const name="dbo.Receipt.csv",file=join(base,"data",name),buf=readFileSync(file);
const sha=createHash("sha256").update(buf).digest("hex").toUpperCase();
const idx=[...rows(decodeCsv(readFileSync(join(base,"manifest_sha256.csv"))))].slice(1).find(x=>x[1][0]===name)?.[1];
if(!idx||idx[2].toUpperCase()!==sha||Number(idx[1])!==statSync(file).size)throw Error("RECEIPT_SOURCE_HASH_FAILURE");
const it=rows(decodeCsv(buf)),heads=it.next().value[1];
const map=new Map(),duplicate=new Set();
let receiptRows=0;
for(const [,cols] of it){
 if(cols.length!==heads.length)throw Error("CSV_SCHEMA_BROKEN");
 const pick=n=>cols[heads.indexOf(n)],key=pick("RecNo");
 if(!key)continue;
 if(map.has(key))duplicate.add(key);
 map.set(key,{recType:pick("RecType"),posted:pick("Posted"),postToAcc:pick("PostToAcc"),verified:pick("Verified"),hasReturn:pick("HaveReturn"),returnNo:pick("ReturnNo"),branch:pick("BranchNo")});
 receiptRows++;
}
const db=new DatabaseSync(join(privateDir,"audit111_history.sqlite"),{readOnly:true});db.exec("PRAGMA query_only=ON");
const context={total_event_count:0,with_unique_receipt:0,unmatched:0,receipt_key_collisions:0,
 risk_by_type:{},unique_documents:new Set(),flagged_documents:new Set(),recType:{},posted_current:{},postToAcc_current:{},
 p0_events_matched:0,p0_event_keys:new Set(),p0_accounts:new Set()};
const numericTypes=new Set(["25","31","33","34","35","36","47","48"]),numbers={};
for(const row of db.prepare(`SELECT a.document_key AS doc,a.user_id,a.transaction_type AS type,a.old_value,a.new_value,c.triage
 FROM audit_events a JOIN audit111_event_classifications c ON c.event_id=a.event_id AND c.policy='TRUSTSOFT_OP_V1'`).iterate()){
 context.total_event_count++;context.unique_documents.add(row.doc);
 const candidate=map.get(row.doc);
 if(duplicate.has(row.doc))context.receipt_key_collisions++;
 else if(!candidate)context.unmatched++;
 else{
  context.with_unique_receipt++;
  const group=candidate.recType||"(missing)",posted=candidate.posted||"(missing)",postToAcc=candidate.postToAcc||"(missing)";
  context.recType[group]=(context.recType[group]||0)+1;
  context.posted_current[posted]=(context.posted_current[posted]||0)+1;
  context.postToAcc_current[postToAcc]=(context.postToAcc_current[postToAcc]||0)+1;
  if(row.triage==="P0")context.p0_events_matched++;
 }
 if(row.triage==="P0"){
  context.risk_by_type[row.type]=(context.risk_by_type[row.type]||0)+1;
  context.flagged_documents.add(row.doc);
  context.p0_event_keys.add(row.doc);context.p0_accounts.add(row.user_id);
 }
 if(numericTypes.has(row.type)){
  const n=numbers[row.type]??={events:0,numeric_pairs:0,changed:0,increased:0,decreased:0,equal:0};
  n.events++;
  const valid=v=>typeof v==="string"&&/^[+-]?(?:\d+)(?:\.\d{1,8})?$/.test(v.trim());
  if(valid(row.old_value)&&valid(row.new_value)){
   n.numeric_pairs++;
   const x=Number(row.old_value),y=Number(row.new_value);
   if(y>x){n.changed++;n.increased++}
   else if(y<x){n.changed++;n.decreased++}
   else n.equal++;
  }
 }
}
const obj={source_sha:sha,receipt_rows:receiptRows,receipt_duplicate_keys:duplicate.size,events:context.total_event_count,
receipt_candidates:{events_with_unique_key:context.with_unique_receipt,unmatched_events:context.unmatched,events_with_duplicate_receipt_key:context.receipt_key_collisions},
distinct_history_docs:context.unique_documents.size,
p0_distinct_document_keys:context.flagged_documents.size,p0_distinct_system_accounts:context.p0_accounts.size,
p0_events_with_unique_receipt:context.p0_events_matched,p0_native_operation_counts:context.risk_by_type,
current_document_types:context.recType,current_posting_flags:context.posted_current,
current_post_to_account_flags:context.postToAcc_current,
numeric_field_coverage_by_type:numbers,
caveat:"Posting status is from historical export current state, NOT necessarily status at edit time; candidate key match does not establish causality."};
console.log(JSON.stringify(obj,null,2));db.close();
