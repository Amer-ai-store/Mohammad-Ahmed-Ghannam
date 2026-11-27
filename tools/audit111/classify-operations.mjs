/** AUDIT-111: append-only categorization of native TrustSoft operation codes.
 * Read source CSV with verified SHA-256 manifest. Never alter historical audit_events.
 * Source classifications are investigative TRIAGE, not proof of impropriety.
 */
import {DatabaseSync} from "node:sqlite";
import {readFileSync,statSync} from "node:fs";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {rows,decodeCsv} from "./import-history.mjs";
const FILENAME="dbo.InvVouchersTransactionsType.csv";
export const POLICY="TRUSTSOFT_OP_V1";
export function severityFor(type){
 const n=Number(type);
 if(!Number.isInteger(n))return "P2";
 if([2,4,30].includes(n))return "P0"; // supplier, invoice number, delete item (triage)
 if([1,5,6,8,25,29,31,33,34,35,36,47,48].includes(n))return "P1";
 return "P2";
}
export function verifyDictionary(exportDir){
 const bytes=readFileSync(join(exportDir,"data",FILENAME));
 const sha=createHash("sha256").update(bytes).digest("hex").toUpperCase();
 const index=[...rows(decodeCsv(readFileSync(join(exportDir,"manifest_sha256.csv"))))].slice(1);
 const entry=index.find(x=>x[1][0]===FILENAME)?.[1];
 if(!entry || entry[2].toUpperCase()!==sha || Number(entry[1])!==statSync(join(exportDir,"data",FILENAME)).size)
  throw Error("AUDIT111_DICTIONARY_PROVENANCE_ERROR");
 const contents=rows(decodeCsv(bytes)),header=contents.next().value?.[1]||[];
 const wanted=["VoucherTypeNo","VoucherTypeNameE","TypeNo","TypeNameE"];
 if(wanted.some(k=>!header.includes(k)))throw Error("AUDIT111_DICTIONARY_SCHEMA_ERROR");
 const types=new Map();
 for(const [,values] of contents){
  const e=Object.fromEntries(header.map((k,i)=>[k,values[i]]));
  if(e.VoucherTypeNo!=="1"||e.VoucherTypeNameE!=="Purchase Invoice")
   throw Error("AUDIT111_DICTIONARY_AMBIGUOUS_VOUCHER_TYPE");
  if(!/^\d+$/.test(e.TypeNo)||types.has(e.TypeNo))throw Error("AUDIT111_DICTIONARY_DUPLICATE_TYPE");
  types.set(e.TypeNo,e.TypeNameE);
 }
 return {source_sha:sha,types};
}
export function applyClassification(db,verified){
 db.exec("PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000;");
 db.exec(`CREATE TABLE IF NOT EXISTS audit111_dictionary(
  source_sha TEXT NOT NULL,type_no TEXT NOT NULL,label_en TEXT NOT NULL,
  policy TEXT NOT NULL,PRIMARY KEY(source_sha,type_no,policy));
 CREATE TRIGGER IF NOT EXISTS dictionary111_immutable_update BEFORE UPDATE ON audit111_dictionary
  BEGIN SELECT RAISE(ABORT,'AUDIT111_APPEND_ONLY'); END;
 CREATE TRIGGER IF NOT EXISTS dictionary111_immutable_delete BEFORE DELETE ON audit111_dictionary
  BEGIN SELECT RAISE(ABORT,'AUDIT111_APPEND_ONLY'); END;
 CREATE TABLE IF NOT EXISTS audit111_event_classifications(
  event_id TEXT NOT NULL REFERENCES audit_events(event_id),policy TEXT NOT NULL,
  source_dictionary_sha TEXT NOT NULL,type_no TEXT NOT NULL,
  operation_label TEXT NOT NULL,triage TEXT NOT NULL CHECK(triage IN('P0','P1','P2')),
  classified_at TEXT NOT NULL,PRIMARY KEY(event_id,policy));
 CREATE INDEX IF NOT EXISTS audit111_triage_lookup ON audit111_event_classifications(triage,type_no);
 CREATE TRIGGER IF NOT EXISTS classification111_immutable_update BEFORE UPDATE ON audit111_event_classifications
  BEGIN SELECT RAISE(ABORT,'AUDIT111_APPEND_ONLY'); END;
 CREATE TRIGGER IF NOT EXISTS classification111_immutable_delete BEFORE DELETE ON audit111_event_classifications
  BEGIN SELECT RAISE(ABORT,'AUDIT111_APPEND_ONLY'); END;`);
 const prev=db.prepare("SELECT count(*) AS n FROM audit111_event_classifications WHERE policy=?").get(POLICY).n;
 if(prev) {
  const all=db.prepare("SELECT count(*) AS n FROM audit_events").get().n;
  if(prev!==all)throw Error("AUDIT111_PARTIAL_CLASSIFICATION_CHECK_REQUIRED");
  return {state:"ALREADY_CLASSIFIED",rows:prev};
 }
 const addDict=db.prepare("INSERT OR IGNORE INTO audit111_dictionary VALUES(?,?,?,?)");
 const add=db.prepare("INSERT INTO audit111_event_classifications VALUES(?,?,?,?,?,?,?)");
 const counts={P0:0,P1:0,P2:0},unknown=new Set(),stamp=new Date().toISOString();
 db.exec("BEGIN IMMEDIATE");
 try{
  for(const [t,label] of verified.types)addDict.run(verified.source_sha,t,label,POLICY);
  for(const e of db.prepare("SELECT event_id,transaction_type FROM audit_events").iterate()){
   const type=String(e.transaction_type),label=verified.types.get(type);
   if(!label) {unknown.add(type);throw Error("AUDIT111_UNKNOWN_NATIVE_TYPE_"+type)}
   const level=severityFor(type);
   add.run(e.event_id,POLICY,verified.source_sha,type,label,level,stamp);
   counts[level]++;
  }
  db.exec("COMMIT");
 }catch(e){db.exec("ROLLBACK");throw e}
 return {state:"CLASSIFIED",rows:Object.values(counts).reduce((a,b)=>a+b,0),
   severity:counts,source_dictionary_sha:verified.source_sha,policy:POLICY,
   explicit_warning:"Deletion of item != deletion of invoice or proof of fraud."};
}
async function main(){
 const [src,dst]=process.argv.slice(2);if(!src||!dst)throw Error("USAGE: node classify-operations.mjs EXPORT_DIR PRIVATE_DIR");
 const verified=verifyDictionary(src);
 const db=new DatabaseSync(join(dst,"audit111_history.sqlite"));
 try{
  const result=applyClassification(db,verified);
  console.log(JSON.stringify(result,null,2));
 }finally{db.close()}
}
if(process.argv[1]&&import.meta.url===new URL("file:///"+process.argv[1].replaceAll("\\","/")).href)
 main().catch(e=>{console.error("AUDIT111_CLASSIFY_FAILED",e.message);process.exitCode=1});
