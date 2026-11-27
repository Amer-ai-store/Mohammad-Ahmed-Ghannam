/** AUDIT-111: inspect candidate FK links with source SHA and NULL safe joins.
 * Observational only: matching identifiers is not proof of document identity.
 */
import {readFileSync,statSync} from "node:fs";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {rows,decodeCsv} from "./import-history.mjs";
const [exportDir,privateDir]=process.argv.slice(2);
if(!exportDir||!privateDir)throw Error("USAGE: node inspect-document-links.mjs EXPORT_DIR PRIVATE_DIR");
const manifest=new Map([...rows(decodeCsv(readFileSync(join(exportDir,"manifest_sha256.csv"))))].slice(1).map(x=>[x[1][0],x[1]]));
function verifiedColumns(file,names){
 const path=join(exportDir,"data",file),buf=readFileSync(path),sha=createHash("sha256").update(buf).digest("hex").toUpperCase();
 const expected=manifest.get(file);
 if(!expected || String(expected[2]).toUpperCase()!==sha || Number(expected[1])!==statSync(path).size)
   throw Error("SOURCE_NOT_VERIFIED_"+file);
 const it=rows(decodeCsv(buf)),header=it.next().value?.[1]??[],indices=names.map(x=>header.indexOf(x));
 if(indices.some(n=>n<0))throw Error("SOURCE_MISSING_HEADER_"+file);
 const output=names.map(()=>new Set());let n=0;
 for(const [,vals] of it){
  if(vals.length!==header.length)throw Error("BAD_CSV_LINE_"+file);
  for(let i=0;i<indices.length;i++){const val=String(vals[indices[i]]??"").trim();if(val)output[i].add(val)}
  n++;
 }
 return {name:file,sha,rows:n,columns:Object.fromEntries(names.map((name,i)=>[name,output[i]]))};
}
const tables=[
 ["dbo.Receipt.csv",["RecNo","transno"]],
 ["dbo.ARPReturns.csv",["TransNo","VoucherNo","InvoiceNo"]],
 ["dbo.InvoiceMain.csv",["TransNo","InvoiceNo","SupplierInvNo"]],
 ["dbo.Journal_GL.csv",["JournalNo","ReceiptNo"]]
].map(x=>verifiedColumns(...x));
const db=new DatabaseSync(join(privateDir,"audit111_history.sqlite"),{readOnly:true});
db.exec("PRAGMA query_only=ON");
const totals={};
for(const table of tables)for(const key of Object.keys(table.columns))totals[table.name+":"+key]=0;
let cnt=0;const distinctDocs=new Set(),matchedDistinct={};
for(const row of db.prepare("SELECT document_key FROM audit_events").iterate()){
 cnt++;const key=String(row.document_key||"").trim();distinctDocs.add(key);
 for(const table of tables)for(const [column,values] of Object.entries(table.columns)){
  const label=table.name+":"+column;
  if(values.has(key))totals[label]++;
 }
}
for(const table of tables)for(const [column,values] of Object.entries(table.columns)){
 const label=table.name+":"+column;
 matchedDistinct[label]=[...distinctDocs].filter(x=>values.has(x)).length;
}
console.log(JSON.stringify({
 checked_at:new Date().toISOString(),source_rows:cnt,
 distinct_history_document_keys:distinctDocs.size,
 candidate_links:Object.entries(totals).map(([id,events_matched])=>({
  source:id,events_matched,distinct_keys_matched:matchedDistinct[id],
  coverage_pct:Math.round(events_matched/cnt*10000)/100,
  join_status:"CANDIDATE_ONLY_NOT_VERIFIED"
 })).sort((a,b)=>b.events_matched-a.events_matched),
 source_checks:tables.map(t=>({name:t.name,sha:t.sha,rowCount:t.rows})),
 note:"No row values or financial amounts included. Exact candidate key equality does not validate business semantics."
},null,2));db.close();
