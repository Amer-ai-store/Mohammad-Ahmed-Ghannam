'use strict';
/* AUDIT-111 readonly private reader acceptance probe; does not print raw financial rows. */
const assert=require('node:assert/strict'), path=require('node:path');
const {createAudit111Reader}=require('./audit111-read.cjs');
const [archiveDir,exportDir]=process.argv.slice(2);
if(!archiveDir||!exportDir)throw Error('AUDIT111_QA_REQUIRES_ARCHIVE_AND_EXPORT_DIR');
const reader=createAudit111Reader({databaseFile:path.join(archiveDir,'audit111_history.sqlite'),exportDir});
try{
 const p=reader.getSnapshot({limit:3});
 assert.equal(p.schema_version,'jawafa.audit111.v1');
 assert.equal(p.classification,'PRIVATE_FINANCIAL_AUDIT');
 assert.equal(p.source_integrity_verified,true);
 assert.equal(p.live_sql,false);
 assert.equal(p.actor_attribution_verified,false);
 assert.equal(p.history_record_count,22169);
 assert.equal(p.events.length,3);
 assert(p.events.every(e=>e.evidence_level==='UNVERIFIED'&&e.actor_verified===false));
 assert(p.events.every(e=>e.sha256===p.snapshot_id &&e.event_at===null));
 console.log(JSON.stringify({passed:true,history_rows:p.history_record_count,
 checked_sample_rows:p.events.length,source_sha_matches:true,
 actor_attribution:false,live_sql:false,raw_rows_exposed:false},null,2));
}finally{reader.close()}
