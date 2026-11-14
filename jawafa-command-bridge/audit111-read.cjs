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
 if(!db.prepare('PRAGMA integrity_check').all().every(x=>Object.values(x)[0]==='ok'))
  fail('AUDIT111_SQLITE_INTEGRITY_FAILURE');
 const snapshots=db.prepare('SELECT source_sha,filename,export_directory FROM source_snapshots ORDER BY rowid').all();
 if(!snapshots.length||snapshots.some(x=>x.filename!==SOURCE_FILE) ||
    path.resolve(snapshots.at(-1).export_directory)!==path.resolve(exportDir))
  fail('AUDIT111_SOURCE_MISMATCH');
 let chain='GENESIS',archiveCount=0;
 const events=db.prepare('SELECT event_id,source_sha,source_row,original_json,chain_sha FROM audit_events WHERE source_sha=? ORDER BY rowid');
 const receipt=db.prepare('SELECT source_row_count,final_chain_sha FROM import_receipts WHERE source_sha=?');
 for(const snapshot of snapshots){
  verifySource(snapshot.export_directory,snapshot);
  const saved=receipt.get(snapshot.source_sha);if(!saved)fail('AUDIT111_RECEIPT_MISSING');
  let n=0;
  for(const e of events.iterate(snapshot.source_sha)){
   const sourceData=JSON.parse(e.original_json);
   const actualID=hash(e.source_sha+':'+e.source_row+':'+JSON.stringify(Object.values(sourceData)));
   if(actualID!==e.event_id)fail('AUDIT111_EVENT_ID_FAILURE');
   chain=hash(chain+':'+e.event_id+':'+hash(e.original_json));
   if(chain!==e.chain_sha)fail('AUDIT111_CHAIN_FAILURE');
   n++;
  }
  if(n!==saved.source_row_count||chain!==saved.final_chain_sha)
   fail('AUDIT111_RECEIPT_VALIDATION_FAILURE');
  archiveCount+=n;
 }
 const total=db.prepare('SELECT count(*) n FROM audit_events').get().n;
 if(total!==archiveCount)fail('AUDIT111_UNACCOUNTED_EVENTS');
 const latest=snapshots.at(-1),recordCount=receipt.get(latest.source_sha).source_row_count;
 const joined=db.prepare(`SELECT count(*) n FROM audit111_event_classifications c
  JOIN audit_events e ON e.event_id=c.event_id
  WHERE c.policy=? AND e.source_sha=?`).get(POLICY,latest.source_sha).n;
 if(joined!==recordCount)fail('AUDIT111_LATEST_CLASSIFICATIONS_INCOMPLETE');
 const dictionary=db.prepare(`SELECT count(*) n FROM audit_events e
  LEFT JOIN audit111_event_classifications c ON c.event_id=e.event_id AND c.policy=?
  LEFT JOIN audit111_dictionary d ON d.type_no=e.transaction_type
    AND d.source_sha=c.source_dictionary_sha AND d.policy=?
  WHERE e.source_sha=? AND (c.event_id IS NULL OR d.type_no IS NULL OR d.label_en<>c.operation_label)`);
 if(dictionary.get(POLICY,POLICY,latest.source_sha).n)fail('AUDIT111_NATIVE_CLASSIFICATION_MISMATCH');
 const riskRows=db.prepare(`SELECT c.triage,count(*) n FROM audit111_event_classifications c
  JOIN audit_events e ON e.event_id=c.event_id
  WHERE e.source_sha=? AND c.policy=? GROUP BY c.triage`).all(latest.source_sha,POLICY);
 const riskCounts=Object.fromEntries(['P0','P1','P2'].map(x=>[x,0]));
 for(const r of riskRows) {if(!(r.triage in riskCounts))fail('AUDIT111_RISK_LABEL_UNKNOWN');riskCounts[r.triage]=r.n}
 return {source_sha:latest.source_sha,record_count:recordCount,
   total_archive_records:archiveCount,chain_sha:chain,riskCounts,
   checked_at:new Date().toISOString()};
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
    WHERE c.policy=? AND e.source_sha=? ORDER BY e.trans_date DESC,e.trans_time DESC,e.source_row DESC LIMIT ?`);
  const rows=stmt.all(POLICY,verification.source_sha,count);
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
    verified_at:verification.checked_at,
    source_status:'EXPORT_MANIFEST_AND_INTERNAL_CHAIN_VERIFIED_NOT_LIVE_SQL',
    history_record_count:verification.record_count,
    archive_total_records:verification.total_archive_records,
    risk_totals:verification.riskCounts,
    clock_reliability:'UNVERIFIED_FREE_RUNNING_CLOCK',
    archive_final_chain_sha:verification.chain_sha,
    live_sql:false,actor_attribution_verified:false,
    events};
 };
 return {getSnapshot,close:()=>db.close(),verification};
}
module.exports={createAudit111Reader,verifySource};
