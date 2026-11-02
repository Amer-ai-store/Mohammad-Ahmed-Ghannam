'use strict';
/** AUDIT-111: PRIVATE read-only snapshot adapter for the existing Jawafa command bridge.
 * Never write to Jawafa_DB. Do not serve this reader without owner JWT + approved
 * authenticated private HTTPS gateway. Uses only manifest-verified historical export.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const fail=msg=>{throw Error(msg)};
const SOURCE_FILE='dbo.InvPurchaseVouchersTransactionHistory.csv';
const DICTIONARY_FILE='dbo.InvVouchersTransactionsType.csv';
const POLICY='TRUSTSOFT_OP_V1';
function manifestEntry(file){
 const txt=fs.readFileSync(file,'utf8').replace(/^\ufeff/,'');
 const lines=txt.split(/\r?\n/);
 const values=new Map();
 for(const line of lines.slice(1)){
  const match=line.match(/^"([^"]+)","(\d+)","([a-fA-F0-9]{64})"/);
  if(match)values.set(match[1],{bytes:Number(match[2]),sha:match[3].toUpperCase()});
 }
 return values;
}
function verifySource(exportDir,snapshot){
 const manifest=manifestEntry(path.join(exportDir,'manifest_sha256.csv'));
 for(const filename of [SOURCE_FILE,DICTIONARY_FILE]){
  const expected=manifest.get(filename);
  if(!expected)fail('AUDIT111_MANIFEST_ENTRY_MISSING');
  const bytes=fs.readFileSync(path.join(exportDir,'data',filename));
  const actual=hash(bytes).toUpperCase();
  if(expected.sha!==actual||expected.bytes!==bytes.length)fail('AUDIT111_FILE_INTEGRITY_FAILURE');
  if(filename===SOURCE_FILE && actual!==snapshot.source_sha)fail('AUDIT111_HISTORY_SHA_MISMATCH');
 }
}
function validateArchive(db,exportDir){
 db.exec('PRAGMA query_only=ON');
 const ok=db.prepare('PRAGMA integrity_check').all().every(x=>Object.values(x)[0]==='ok');
 if(!ok)fail('AUDIT111_SQLITE_INTEGRITY_FAILURE');
 const snapshots=db.prepare('SELECT source_sha,filename,export_directory FROM source_snapshots').all();
 if(snapshots.length!==1||snapshots[0].filename!==SOURCE_FILE ||
     path.resolve(snapshots[0].export_directory)!==path.resolve(exportDir))
  fail('AUDIT111_SOURCE_MISMATCH');
 verifySource(exportDir,snapshots[0]);
 const receipt=db.prepare('SELECT source_row_count,final_chain_sha FROM import_receipts WHERE source_sha=?').get(snapshots[0].source_sha);
 if(!receipt)fail('AUDIT111_RECEIPT_MISSING');
 let chain='GENESIS',n=0;
 const events=db.prepare('SELECT event_id,source_sha,source_row,original_json,chain_sha FROM audit_events ORDER BY rowid');
 for(const e of events.iterate()){
  if(e.source_sha!==snapshots[0].source_sha)fail('AUDIT111_UNEXPECTED_EVENT_SOURCE');
  const original=JSON.parse(e.original_json);
  const id=hash(e.source_sha+':'+e.source_row+':'+JSON.stringify(Object.values(original)));
  if(id!==e.event_id)fail('AUDIT111_EVENT_ID_FAILURE');
  chain=hash(chain+':'+e.event_id+':'+hash(e.original_json));
  if(chain!==e.chain_sha)fail('AUDIT111_CHAIN_FAILURE');
  n++;
 }
 if(n!==receipt.source_row_count ||chain!==receipt.final_chain_sha)fail('AUDIT111_RECEIPT_VALIDATION_FAILURE');
 const cl=db.prepare('SELECT count(*) AS n FROM audit111_event_classifications WHERE policy=?').get(POLICY)?.n;
 if(cl!==n)fail('AUDIT111_CLASSIFICATIONS_INCOMPLETE');
 const labels=db.prepare('SELECT count(*) AS n, count(DISTINCT type_no) AS u FROM audit111_dictionary WHERE policy=?').get(POLICY);
 if(!labels?.n ||labels.n!==labels.u)fail('AUDIT111_DICTIONARY_INVALID');
 const bad=db.prepare(`SELECT count(*) n FROM audit_events a
 LEFT JOIN audit111_event_classifications c ON a.event_id=c.event_id AND c.policy=?
 LEFT JOIN audit111_dictionary d ON d.type_no=a.transaction_type AND d.source_sha=c.source_dictionary_sha AND d.policy=?
 WHERE c.event_id IS NULL OR d.type_no IS NULL OR d.label_en<>c.operation_label`).get(POLICY,POLICY).n;
 if(bad)fail('AUDIT111_NATIVE_CLASSIFICATION_MISMATCH');
 return {source_sha:snapshots[0].source_sha,record_count:n,chain_sha:chain};
}
function createAudit111Reader({databaseFile,exportDir}={}){
 if(!databaseFile||!exportDir)fail('AUDIT111_CONFIG_REQUIRED');
 const db=new DatabaseSync(databaseFile,{readOnly:true});
 let verification;
 try{verification=validateArchive(db,exportDir)}catch(e){db.close();throw e}
 const getSnapshot=({limit=100}={})=>{
  const count=Math.max(1,Math.min(100,Number(limit)||100));
  const stmt=db.prepare(`SELECT e.event_id,e.source_sha,e.document_key,e.trans_date,e.trans_time,
      e.user_id,e.old_value,e.new_value,e.observed_at,c.operation_label,c.triage,
      (SELECT u.system_login FROM user_directory u WHERE u.user_id=e.user_id
         ORDER BY u.observed_at DESC LIMIT 1) system_login
    FROM audit_events e JOIN audit111_event_classifications c ON c.event_id=e.event_id
    WHERE c.policy=? ORDER BY e.trans_date DESC,e.trans_time DESC,e.source_row DESC LIMIT ?`);
  const rows=stmt.all(POLICY,count);
  const clean=v=>typeof v==='string'?v.slice(0,240):null;
  const events=rows.map(e=>({
   event_id:e.event_id,document_type:'purchase_invoice',document_id:e.document_key,
   observed_at:e.observed_at,event_at:null,
   event_time_raw:[e.trans_date,e.trans_time].filter(Boolean).join(' '),
   system_user:e.system_login||e.user_id,actor_verified:false,
   field:e.operation_label,before:clean(e.old_value),after:clean(e.new_value),
   before_truncated:(e.old_value||'').length>240,
   after_truncated:(e.new_value||'').length>240,
   severity:e.triage,evidence_level:'UNVERIFIED',
   source_ref:'TRUSTSOFT_HISTORY_EXPORT_SHA256:'+e.source_sha.slice(0,16),
   sha256:e.source_sha
  }));
  return {schema_version:'jawafa.audit111.v1',
    classification:'PRIVATE_FINANCIAL_AUDIT',private_access_verified:true,
    source_integrity_verified:true,snapshot_id:verification.source_sha,
    verified_at:new Date().toISOString(),
    source_status:'EXPORT_MANIFEST_AND_INTERNAL_CHAIN_VERIFIED_NOT_LIVE_SQL',
    history_record_count:verification.record_count,
    archive_final_chain_sha:verification.chain_sha,
    live_sql:false,actor_attribution_verified:false,
    events};
 };
 return {getSnapshot,close:()=>db.close(),verification};
}
module.exports={createAudit111Reader,verifySource};
