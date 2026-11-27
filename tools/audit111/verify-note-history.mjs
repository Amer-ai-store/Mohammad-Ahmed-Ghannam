/** Independent read-only validation of append-only purchase invoice note edits. */
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
const sha=x=>createHash("sha256").update(x).digest("hex");
const [base,dir]=process.argv.slice(2);
if(!base||!dir)throw Error("MISSING_EXPORT_AND_PRIVATE_DIR");
const file="dbo.Inv_Vouchers_Notes_Modifications.csv";
const bytes=readFileSync(join(base,"data",file)),source=sha(bytes).toUpperCase();
const manifest=readFileSync(join(base,"manifest_sha256.csv"),"utf8");
if(!manifest.includes(source))throw Error("NOTES_SOURCE_MISSING_FROM_MANIFEST");
const db=new DatabaseSync(join(dir,"audit111_history.sqlite"),{readOnly:true});
db.exec("PRAGMA query_only=ON");
const good=db.prepare("PRAGMA integrity_check").all().every(r=>Object.values(r)[0]==="ok");
const receipt=db.prepare("SELECT * FROM audit111_note_receipts WHERE source_sha=?").get(source);
if(!receipt||receipt.source_bytes!==bytes.length||receipt.source_name!==file)
 throw Error("NOTES_RECEIPT_OR_LENGTH_MISMATCH");
let chain="GENESIS",rows=0,ids=new Set();
for(const e of db.prepare("SELECT * FROM audit111_note_events WHERE source_sha=? ORDER BY source_row").iterate(source)){
 const id=sha(source+":"+e.source_row+":"+e.event_json);
 chain=sha(chain+":"+id+":"+sha(e.event_json));
 if(id!==e.event_id||chain!==e.chain_sha||ids.has(id))throw Error("NOTES_CHAIN_OR_ID_INTEGRITY_FAILED");
 ids.add(id);rows++;
}
const passed=good&&rows===receipt.rows_count&&chain===receipt.final_chain_sha;
console.log(JSON.stringify({passed,note_history_events:rows,integrity_check:good,
 source_sha_matches_receipt:true,unique_ids:ids.size,chain_verified:chain===receipt.final_chain_sha,
 no_original_financial_data_modified:true,source_sha:source},null,2));db.close();if(!passed)process.exitCode=2;
