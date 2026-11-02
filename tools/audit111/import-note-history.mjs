/** AUDIT-111 append-only export of TrustSoft purchase invoice note edits, without SQL changes. */
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {rows,decodeCsv} from "./import-history.mjs";
const digest=x=>createHash("sha256").update(x).digest("hex"),SOURCE="dbo.Inv_Vouchers_Notes_Modifications.csv";
function source(base){
 const file=readFileSync(join(base,"data",SOURCE));
 const sha=digest(file).toUpperCase();
 const manifest=[...rows(decodeCsv(readFileSync(join(base,"manifest_sha256.csv"))))].slice(1).find(x=>x[1][0]===SOURCE)?.[1];
 if(!manifest||manifest[2].toUpperCase()!==sha||Number(manifest[1])!==file.length)
  throw Error("AUDIT111_NOTE_SOURCE_INTEGRITY_FAILED");
 const it=rows(decodeCsv(file)),header=it.next().value?.[1]||[];
 for(const f of ["TransNo","TransDate","TransTime","UserId","Voucher_Type_No","Voucher_Type_Name","Voucher_No","Old_Note","New_Note"])
  if(!header.includes(f))throw Error("AUDIT111_NOTE_SCHEMA_MISMATCH");
 return {sha,bytes:file.length,header,it};
}
function schema(db){
 db.exec(`PRAGMA busy_timeout=5000;PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS audit111_note_events(
  event_id TEXT PRIMARY KEY,source_sha TEXT NOT NULL,source_row INTEGER NOT NULL,
  trans_no TEXT,voucher_type TEXT,voucher_type_label TEXT,voucher_no TEXT,
  native_date TEXT,native_time TEXT,system_user TEXT,old_note TEXT,new_note TEXT,
  event_json TEXT NOT NULL,recorded_at TEXT NOT NULL,chain_sha TEXT NOT NULL,
  UNIQUE(source_sha,source_row));
 CREATE TRIGGER IF NOT EXISTS note111_immutable_update BEFORE UPDATE ON audit111_note_events
   BEGIN SELECT RAISE(ABORT,'AUDIT111_APPEND_ONLY'); END;
 CREATE TRIGGER IF NOT EXISTS note111_immutable_delete BEFORE DELETE ON audit111_note_events
   BEGIN SELECT RAISE(ABORT,'AUDIT111_APPEND_ONLY'); END;
 CREATE TABLE IF NOT EXISTS audit111_note_receipts(
  source_sha TEXT PRIMARY KEY,source_name TEXT NOT NULL,source_bytes INTEGER NOT NULL,
  rows_count INTEGER NOT NULL,final_chain_sha TEXT NOT NULL,completed_at TEXT NOT NULL);
 CREATE TRIGGER IF NOT EXISTS note_receipt111_immutable_update BEFORE UPDATE ON audit111_note_receipts
   BEGIN SELECT RAISE(ABORT,'AUDIT111_APPEND_ONLY'); END;
 CREATE TRIGGER IF NOT EXISTS note_receipt111_immutable_delete BEFORE DELETE ON audit111_note_receipts
   BEGIN SELECT RAISE(ABORT,'AUDIT111_APPEND_ONLY'); END;`);
}
function execute(base,privateDir){
 const verified=source(base),db=new DatabaseSync(join(privateDir,"audit111_history.sqlite"));
 let result;
 try{
  schema(db);
  if(db.prepare("SELECT 1 FROM audit111_note_receipts WHERE source_sha=?").get(verified.sha))
   return {state:"ALREADY_IMPORTED",sha:verified.sha};
  const insert=db.prepare(`INSERT INTO audit111_note_events VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const record=db.prepare("INSERT INTO audit111_note_receipts VALUES(?,?,?,?,?,?)");
  let chain="GENESIS",count=0,changed=0;
  const at=new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try{
   for(const [rowNumber,vals] of verified.it){
    if(vals.length!==verified.header.length)throw Error("AUDIT111_BAD_NOTE_ROW");
    const obj=Object.fromEntries(verified.header.map((k,i)=>[k,vals[i]]));
    const json=JSON.stringify(obj),eid=digest(verified.sha+":"+rowNumber+":"+json);
    chain=digest(chain+":"+eid+":"+digest(json));
    insert.run(eid,verified.sha,rowNumber,obj.TransNo,obj.Voucher_Type_No,
      obj.Voucher_Type_Name,obj.Voucher_No,obj.TransDate,obj.TransTime,
      obj.UserId,obj.Old_Note,obj.New_Note,json,at,chain);
    if(obj.Old_Note!==obj.New_Note)changed++;
    count++;
   }
   record.run(verified.sha,SOURCE,verified.bytes,count,chain,at);
   db.exec("COMMIT");
  }catch(e){db.exec("ROLLBACK");throw e}
  result={state:"IMPORTED",sha:verified.sha,rows:count,changed_note_pairs:changed,
    final_chain_sha:chain,evidence:"NATIVE_NOTES_HISTORY_EXPORT_UNVERIFIED_AS_TO_HUMAN_IDENTITY"};
 }finally{db.close()}
 return result;
}
const [base,privateDir]=process.argv.slice(2);
if(!base||!privateDir)throw Error("USAGE: node import-note-history.mjs EXPORT_DIR PRIVATE_DIR");
console.log(JSON.stringify(execute(base,privateDir),null,2));
