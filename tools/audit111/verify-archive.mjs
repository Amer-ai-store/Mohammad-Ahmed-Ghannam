/** AUDIT-111 private archive verifier. Emits aggregates only; no raw financial rows. */
import {DatabaseSync} from "node:sqlite";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const hash=value=>createHash("sha256").update(value).digest("hex");
const dir=process.argv[2],srcDir=process.argv[3];
if(!dir||!srcDir)throw Error("USAGE: node verify-archive.mjs PRIVATE_DIR EXPORT_DIR");
const db=new DatabaseSync(join(dir,"audit111_history.sqlite"),{readOnly:true});
db.exec("PRAGMA query_only=ON");
const integrity=db.prepare("PRAGMA integrity_check").all().map(x=>Object.values(x)[0]);
const source=db.prepare("SELECT * FROM source_snapshots ORDER BY imported_at DESC LIMIT 1").get();
const receipt=db.prepare("SELECT * FROM import_receipts WHERE source_sha=?").get(source.source_sha);
const count=db.prepare("SELECT count(*) AS n,count(DISTINCT event_id) AS unique_ids,count(DISTINCT document_key) AS documents,count(DISTINCT user_id) AS accounts,min(trans_date) AS first_date,max(trans_date) AS last_date FROM audit_events").get();
const severities=db.prepare("SELECT severity,count(*) AS n FROM audit_events GROUP BY severity").all();
const actual=createHash("sha256").update(readFileSync(join(srcDir,"data",source.filename))).digest("hex").toUpperCase();
let chain="GENESIS",iterated=0,chainOk=true,idsOk=true;
for(const row of db.prepare("SELECT event_id,source_sha,source_row,original_json,chain_sha FROM audit_events ORDER BY rowid").iterate()){
  const vals=Object.values(JSON.parse(row.original_json));
  const id=hash(row.source_sha+":"+row.source_row+":"+JSON.stringify(vals));
  if(id!==row.event_id)idsOk=false;
  chain=hash(chain+":"+row.event_id+":"+hash(row.original_json));
  if(chain!==row.chain_sha)chainOk=false;
  iterated++;
}
const triggers=db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE '%111_%' ORDER BY name").all().map(x=>x.name);
const passed=integrity.every(x=>x==="ok") && actual===source.source_sha && count.n===count.unique_ids &&
  count.n===receipt.source_row_count && count.n===iterated && chainOk && idsOk &&
  receipt.final_chain_sha===chain && triggers.length>=4;
const result={passed,source_hash_matches:actual===source.source_sha,integrity,
  records:count.n,unique_events:count.unique_ids,document_keys:count.documents,
  user_ids:count.accounts,first_date:count.first_date,last_date:count.last_date,
  by_triage:severities,chain_verified:chainOk,identity_verified:false,
  receipt_verified:receipt.final_chain_sha===chain,required_triggers_present:triggers.length>=4};
console.log(JSON.stringify(result,null,2));db.close();if(!passed)process.exitCode=2;
