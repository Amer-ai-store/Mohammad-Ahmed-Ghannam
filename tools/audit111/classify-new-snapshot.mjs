/** AUDIT-111: classify a NEW, manifest-verified snapshot without touching prior evidence. */
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {verifyDictionary,severityFor,POLICY} from './classify-operations.mjs';
const [latestExport,privateDir]=process.argv.slice(2);
if(!latestExport||!privateDir)throw Error('EXPORT_AND_ARCHIVE_REQUIRED');
const source=verifyDictionary(latestExport);
const db=new DatabaseSync(join(privateDir,'audit111_history.sqlite'));
try{
 db.exec('PRAGMA busy_timeout=5000;PRAGMA foreign_keys=ON');
 const latest=db.prepare('SELECT source_sha,export_directory FROM source_snapshots ORDER BY rowid DESC LIMIT 1').get();
 if(!latest)throw Error('NO_IMPORTED_SNAPSHOT');
 if(join(latest.export_directory).toLowerCase()!==join(latestExport).toLowerCase())throw Error('LATEST_EXPORT_PATH_MISMATCH');
 const total=db.prepare('SELECT count(*) n FROM audit_events WHERE source_sha=?').get(latest.source_sha).n;
 const previous=db.prepare('SELECT count(*) n FROM audit111_event_classifications c JOIN audit_events e ON e.event_id=c.event_id WHERE e.source_sha=? AND c.policy=?').get(latest.source_sha,POLICY).n;
 if(!total)throw Error('EMPTY_LATEST_SNAPSHOT');
 if(previous>0){
  if(previous!==total)throw Error('PARTIALLY_CLASSIFIED_SOURCE_MUST_BE_REVIEWED');
  console.log(JSON.stringify({status:'ALREADY_CLASSIFIED',event_count:total,source_sha:latest.source_sha}));
 }else{
  const putType=db.prepare('INSERT OR IGNORE INTO audit111_dictionary VALUES(?,?,?,?)');
  const putEvent=db.prepare('INSERT INTO audit111_event_classifications VALUES(?,?,?,?,?,?,?)');
  const groups={P0:0,P1:0,P2:0};
  db.exec('BEGIN IMMEDIATE');
  try{
   for(const [code,label] of source.types)putType.run(source.source_sha,code,label,POLICY);
   const instant=new Date().toISOString();
   for(const e of db.prepare('SELECT event_id,transaction_type FROM audit_events WHERE source_sha=?').iterate(latest.source_sha)){
    const label=source.types.get(e.transaction_type);
    if(!label)throw Error('NATIVE_TYPE_MISSING_'+e.transaction_type);
    const severity=severityFor(e.transaction_type);
    putEvent.run(e.event_id,POLICY,source.source_sha,e.transaction_type,label,severity,instant);
    groups[severity]++;
   }
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e}
  const n=db.prepare('SELECT count(*) n FROM audit111_event_classifications c JOIN audit_events e ON e.event_id=c.event_id WHERE e.source_sha=? AND c.policy=?').get(latest.source_sha,POLICY).n;
  if(n!==total)throw Error('CLASSIFICATION_COUNT_MISMATCH_AFTER_IMPORT');
  console.log(JSON.stringify({status:'CLASSIFIED_LATEST',source_sha:latest.source_sha,source_dictionary_sha:source.source_sha,events:n,risk_counts:groups,financial_implication:'UNDETERMINED'}));
 }
}finally{db.close()}
