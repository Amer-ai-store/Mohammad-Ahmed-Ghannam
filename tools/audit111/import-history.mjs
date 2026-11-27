/**
 * AUDIT-111 restricted historical importer. Runs locally on JAWAFFASVR.
 * Source SQL and existing exports are READ ONLY. Destination is a separate SQLite DB.
 * Never print raw events, credentials, or financial values. Verify manifest BEFORE import.
 * Sample: node import-history.mjs C:\\Export\\hourly\\20261026-1640 C:\\Export\\Audit111
 */
import {readFileSync,statSync,mkdirSync,writeFileSync} from "node:fs";
import {join,basename,resolve} from "node:path";
import {createHash} from "node:crypto";
import {DatabaseSync} from "node:sqlite";

const FILENAME="dbo.InvPurchaseVouchersTransactionHistory.csv";
const REQUIRED=["TransNo","TransSeqNo","TransDate","TransTime","ReceiptNo","BranchNo","UserId",
  "ComputerName","WindowsLoginName","SSVersion","TypeNo","Barcode","TransactionDesc",
  "OldValue","NewValue","OldValueNo","NewValueNo","RecLineNo"];
const digest = value => createHash("sha256").update(value).digest("hex");
const fail = msg => {throw new Error(msg)};
export function* rows(text) {
  let fields=[],value="",quoted=false,afterQuote=false,rowNum=0,skipLF=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(skipLF){skipLF=false;if(ch==="\n")continue}
    if(quoted){
      if(ch==='"') {quoted=false;afterQuote=true;} else value+=ch;
      continue;
    }
    if(afterQuote){
      if(ch==='"'){value+='"';quoted=true;afterQuote=false;continue}
      if(ch!==',' && ch!=="\n" && ch!=="\r")fail("INVALID_CSV_QUOTE");
      afterQuote=false;
    }else if(ch==='"' && value===""){quoted=true;continue}
    else if(ch==='"')fail("INVALID_CSV_UNQUOTED_QUOTE");
    if(ch===','){fields.push(value);value="";continue}
    if(ch==="\r"||ch==="\n"){
      fields.push(value);value="";rowNum++;
      if(ch==="\r")skipLF=true;
      if(fields.length>1 || fields[0])yield [rowNum,fields];
      fields=[];
    }else value+=ch;
  }
  if(quoted)fail("CSV_UNCLOSED_QUOTE");
  if(fields.length||value){fields.push(value);rowNum++;yield [rowNum,fields]}
}
export function risk(event) {
  const desc=String(event.TransactionDesc||"").toLocaleLowerCase();
  if(/delete|deleted|cancel|void|reverse|reversal|حذف|إلغاء|الغاء|عكس/.test(desc))return "P0";
  if(/tax|vat|discount|supplier|total|amount|invoice|ضريب|خصم|مورد|إجمالي|اجمالي|فاتور/.test(desc))
    return "P1";
  if(event.OldValue && event.NewValue && event.OldValue!==event.NewValue)return "P1";
  return "P2";
}
export function decodeCsv(input) {
  if(input.length>=3 && input[0]===0xef && input[1]===0xbb && input[2]===0xbf)
    return new TextDecoder("utf-8",{fatal:true}).decode(input).replace(/^\ufeff/,"");
  // SQL Server exporter was configured with ANSI codepage; preserve numeric fields precisely.
  // windows-1256 reconstructs Arabic display fields, not an attribution guarantee.
  return new TextDecoder("windows-1256").decode(input);
}
export function prepareSource(exportDir) {
  const file=join(exportDir,"data",FILENAME),manifest=join(exportDir,"manifest_sha256.csv");
  const actual=readFileSync(file),sha=digest(actual).toUpperCase(),n=statSync(file).size;
  const manifestText=decodeCsv(readFileSync(manifest));
  const manifestRows=[...rows(manifestText)].slice(1).map(x=>x[1]);
  const entry=manifestRows.find(r=>r[0]===FILENAME);
  if(!entry||Number(entry[1])!==n||String(entry[2]).toUpperCase()!==sha)
    fail("MANIFEST_SHA256_OR_SIZE_MISMATCH");
  const data=decodeCsv(actual),iterator=rows(data),first=iterator.next();
  if(first.done||REQUIRED.some((f,i)=>first.value[1][i]!==f))fail("HISTORY_SCHEMA_MISMATCH");
  return {file,sha,byteSize:n,iterator,headers:first.value[1]};
}
export function ensureSchema(db) {
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS source_snapshots(
      source_sha TEXT PRIMARY KEY,filename TEXT NOT NULL,export_directory TEXT NOT NULL,
      bytes INTEGER NOT NULL,verified_manifest INTEGER NOT NULL CHECK(verified_manifest=1),
      imported_at TEXT NOT NULL,expected_record_count INTEGER
    );
    CREATE TABLE IF NOT EXISTS audit_events(
      event_id TEXT PRIMARY KEY,source_sha TEXT NOT NULL REFERENCES source_snapshots(source_sha),
      source_row INTEGER NOT NULL,document_kind TEXT NOT NULL,document_key TEXT NOT NULL,
      trans_no TEXT,sequence_no TEXT,receipt_no TEXT,branch_no TEXT,user_id TEXT,
      computer_name TEXT,windows_login TEXT,trans_date TEXT,trans_time TEXT,
      transaction_type TEXT,transaction_description TEXT,old_value TEXT,new_value TEXT,
      old_value_no TEXT,new_value_no TEXT,original_json TEXT NOT NULL,
      observed_at TEXT NOT NULL,severity TEXT NOT NULL CHECK(severity IN('P0','P1','P2')),
      evidence_level TEXT NOT NULL DEFAULT 'NATIVE_HISTORY_EXPORT_UNVERIFIED',
      actor_verified INTEGER NOT NULL DEFAULT 0 CHECK(actor_verified=0),
      chain_sha TEXT NOT NULL,UNIQUE(source_sha,source_row)
    );
    CREATE INDEX IF NOT EXISTS audit111_document ON audit_events(document_key,trans_date);
    CREATE INDEX IF NOT EXISTS audit111_user ON audit_events(user_id,trans_date);
    CREATE INDEX IF NOT EXISTS audit111_severity ON audit_events(severity,trans_date);
    CREATE TRIGGER IF NOT EXISTS audit111_immutable_update BEFORE UPDATE ON audit_events
      BEGIN SELECT RAISE(ABORT,'AUDIT111_APPEND_ONLY'); END;
    CREATE TRIGGER IF NOT EXISTS audit111_immutable_delete BEFORE DELETE ON audit_events
      BEGIN SELECT RAISE(ABORT,'AUDIT111_APPEND_ONLY'); END;
    CREATE TRIGGER IF NOT EXISTS source111_immutable_update BEFORE UPDATE ON source_snapshots
      BEGIN SELECT RAISE(ABORT,'AUDIT111_APPEND_ONLY'); END;
    CREATE TRIGGER IF NOT EXISTS source111_immutable_delete BEFORE DELETE ON source_snapshots
      BEGIN SELECT RAISE(ABORT,'AUDIT111_APPEND_ONLY'); END;
    CREATE TABLE IF NOT EXISTS import_receipts(
      source_sha TEXT PRIMARY KEY,source_row_count INTEGER NOT NULL,
      completed_at TEXT NOT NULL,final_chain_sha TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS receipt111_immutable_update BEFORE UPDATE ON import_receipts
      BEGIN SELECT RAISE(ABORT,'AUDIT111_APPEND_ONLY'); END;
    CREATE TRIGGER IF NOT EXISTS receipt111_immutable_delete BEFORE DELETE ON import_receipts
      BEGIN SELECT RAISE(ABORT,'AUDIT111_APPEND_ONLY'); END;`);
}
export function importSource(db,src,exportDir){
  ensureSchema(db);
  if(db.prepare("SELECT 1 FROM source_snapshots WHERE source_sha=?").get(src.sha))
    return {status:"ALREADY_IMPORTED",source_sha:src.sha};
  const insertSource=db.prepare(`INSERT INTO source_snapshots VALUES(?,?,?,?,?,?,?)`);
  const insertEvent=db.prepare(`INSERT INTO audit_events(
    event_id,source_sha,source_row,document_kind,document_key,
    trans_no,sequence_no,receipt_no,branch_no,user_id,computer_name,windows_login,
    trans_date,trans_time,transaction_type,transaction_description,old_value,new_value,
    old_value_no,new_value_no,original_json,observed_at,severity,chain_sha)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const observedAt=new Date().toISOString();
  let rowsCount=0,chain=db.prepare("SELECT chain_sha FROM audit_events ORDER BY rowid DESC LIMIT 1").get()?.chain_sha||"GENESIS";
  const counts={P0:0,P1:0,P2:0},typeCounts={};
  db.exec("BEGIN IMMEDIATE");
  try {
    // Number of records is unknown until EOF. Write metadata before events for FK.
    insertSource.run(src.sha,FILENAME,resolve(exportDir),src.byteSize,1,observedAt,null);
    for(const [rowNum,values] of src.iterator){
      if(values.length!==src.headers.length)fail("ROW_COLUMN_COUNT_MISMATCH_LINE_"+rowNum);
      const obj=Object.fromEntries(src.headers.map((h,i)=>[h,values[i]]));
      const eventId=digest(src.sha+":"+rowNum+":"+JSON.stringify(values));
      const documentKey=obj.ReceiptNo||obj.TransNo;
      const severity=risk(obj), payload=JSON.stringify(obj);
      chain=digest(chain+":"+eventId+":"+digest(payload));
      insertEvent.run(eventId,src.sha,rowNum,"purchase_voucher_history",documentKey,
        obj.TransNo,obj.TransSeqNo,obj.ReceiptNo,obj.BranchNo,obj.UserId,
        obj.ComputerName,obj.WindowsLoginName,obj.TransDate,obj.TransTime,
        obj.TypeNo,obj.TransactionDesc,obj.OldValue,obj.NewValue,
        obj.OldValueNo,obj.NewValueNo,payload,observedAt,severity,chain);
      counts[severity]++;rowsCount++;
      typeCounts[obj.TypeNo]=(typeCounts[obj.TypeNo]||0)+1;
    }
    // The receipt table is created in ensureSchema; its rows are append-only.
    db.prepare("INSERT INTO import_receipts VALUES(?,?,?,?)").run(src.sha,rowsCount,new Date().toISOString(),chain);
    db.exec("COMMIT");
    return {status:"IMPORTED",source_sha:src.sha,row_count:rowsCount,
      counts_by_triage:counts,counts_by_native_type:typeCounts,
      final_chain_sha:chain,coverage:"HISTORICAL_EXPORT_ONLY",actor_attribution:"NOT_VERIFIED"};
  }catch(e){db.exec("ROLLBACK");throw e}
}
async function main(){
  const [exportDir,targetDir]=process.argv.slice(2);
  if(!exportDir||!targetDir)fail("USAGE: node import-history.mjs EXPORT_DIR PRIVATE_DIR");
  const src=prepareSource(exportDir);
  mkdirSync(targetDir,{recursive:true});
  const db=new DatabaseSync(join(targetDir,"audit111_history.sqlite"));
  try{
    const result=importSource(db,src,exportDir);
    console.log(JSON.stringify({task:"AUDIT-111",...result},null,2));
  }finally{db.close()}
}
if(process.argv[1] && import.meta.url===new URL("file:///"+resolve(process.argv[1]).replaceAll("\\","/")).href){
  main().catch(e=>{console.error("AUDIT111_FAILED:",e.message);process.exitCode=1});
}
