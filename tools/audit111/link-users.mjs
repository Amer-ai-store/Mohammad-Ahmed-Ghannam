/** AUDIT-111: map TrustSoft numeric user IDs to historical user-table labels.
 * NEVER copy or print Upass (password/hash) or any other unrelated fields.
 * This maps a SYSTEM ACCOUNT, not a proven human operator.
 */
import {DatabaseSync} from "node:sqlite";
import {readFileSync,statSync} from "node:fs";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {rows,decodeCsv} from "./import-history.mjs";
const [srcDir,dstDir]=process.argv.slice(2);
if(!srcDir||!dstDir)throw Error("USAGE: node link-users.mjs EXPORT_DIR PRIVATE_DIR");
const FILENAME="dbo.USER.csv",name="user_directory";
const payload=readFileSync(join(srcDir,"data",FILENAME));
const sha=createHash("sha256").update(payload).digest("hex").toUpperCase();
const manifestRows=[...rows(decodeCsv(readFileSync(join(srcDir,"manifest_sha256.csv"))))];
const src=manifestRows.find((x,i)=>i>0&&x[1][0]===FILENAME);
if(!src||src[1][2].toUpperCase()!==sha||Number(src[1][1])!==statSync(join(srcDir,"data",FILENAME)).size)
  throw Error("USER_SOURCE_MANIFEST_MISMATCH");
const records=rows(decodeCsv(payload)),header=records.next().value?.[1]||[];
const needed=["Uno","Una","Ufullna"],ix=needed.map(x=>header.indexOf(x));
if(ix.some(x=>x<0))throw Error("USER_DIRECTORY_SCHEMA_MISMATCH");
const db=new DatabaseSync(join(dstDir,"audit111_history.sqlite"));
db.exec(`PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS user_directory(
 user_id TEXT NOT NULL,source_sha TEXT NOT NULL,system_login TEXT,
 display_name TEXT,observed_at TEXT NOT NULL,actor_verified INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,source_sha),CHECK(actor_verified=0));
CREATE INDEX IF NOT EXISTS audit111_user_directory_id ON user_directory(user_id);
CREATE TRIGGER IF NOT EXISTS user111_immutable_update BEFORE UPDATE ON user_directory
 BEGIN SELECT RAISE(ABORT,'AUDIT111_APPEND_ONLY'); END;
CREATE TRIGGER IF NOT EXISTS user111_immutable_delete BEFORE DELETE ON user_directory
 BEGIN SELECT RAISE(ABORT,'AUDIT111_APPEND_ONLY'); END;`);
const stmt=db.prepare("INSERT OR IGNORE INTO user_directory(user_id,source_sha,system_login,display_name,observed_at) VALUES(?,?,?,?,?)");
const when=new Date().toISOString();let imported=0;
db.exec("BEGIN IMMEDIATE");
try{
  for(const [,values] of records){
    if(values.length!==header.length)throw Error("USER_DIRECTORY_CSV_MISMATCH");
    const uid=values[ix[0]],uname=values[ix[1]],full=values[ix[2]];
    if(uid&&stmt.run(uid,sha,uname,full,when).changes)imported++;
  }
  db.exec("COMMIT");
}catch(e){db.exec("ROLLBACK");throw e}
const mapping=db.prepare(`SELECT count(*) AS mapped_rows,
count(DISTINCT e.user_id) AS mapped_ids
FROM audit_events e
WHERE EXISTS(SELECT 1 FROM user_directory u WHERE u.user_id=e.user_id)`).get();
const recordsFound=db.prepare("SELECT count(*) AS n FROM user_directory").get().n;
console.log(JSON.stringify({task:"AUDIT-111",user_source_sha:sha,system_accounts_imported:imported,
  directory_records:recordsFound,history_rows_with_account_label:mapping.mapped_rows,
  history_account_ids_matched:mapping.mapped_ids,verified_human_identities:0,
  excluded_sensitive_columns:["Upass","Tel","Mob","Emaile"]}));
db.close();
