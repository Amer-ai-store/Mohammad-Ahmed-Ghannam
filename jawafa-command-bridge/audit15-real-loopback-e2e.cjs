'use strict';
/** AUDIT-15: real restricted server archive + private report, synthetic auth only.
 * Ephemeral loopback; no external port, no real owner credentials, no source SQL writes.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {createBridge}=require('./server.cjs');
const {createAudit111Reader}=require('./audit111-read.cjs');
const {createAudit15Reader}=require('./audit15-read.cjs');
const [privateDir,exportDir,reportFile]=process.argv.slice(2);
if(!privateDir||!exportDir||!reportFile)throw Error('AUDIT15_E2E_PRIVATE_PATHS_REQUIRED');
const audit111Reader=createAudit111Reader({
 databaseFile:path.join(privateDir,'audit111_history.sqlite'),exportDir});
const audit15Reader=createAudit15Reader({reportFile,audit111Reader});
async function check(release){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'audit15-local-qa-'));
 const bridge=createBridge({databaseFile:path.join(tmp,'safe-ledger.sqlite'),
  audit111Reader,audit15Reader,audit111ReleaseAllowed:release,
  verifyUser:async auth=>{
    if(!auth)throw Object.assign(new Error('AUTH_REQUIRED'),{status:401});
    return auth==='Bearer SYNTHETIC_OWNER'?{role:'owner',uid:'QA_ONLY'}:{role:'viewer'};
  }
 });
 const server=http.createServer(bridge.handler);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const url='http://127.0.0.1:'+server.address().port+'/api/jawafa/v1/audit/15';
  async function request(auth,method='GET'){
   const r=await fetch(url,{method,headers:auth?{Authorization:auth}:{}});
   return {status:r.status,payload:await r.json(),cache:r.headers.get('cache-control')};
  }
  const noAuth=await request(null),viewer=await request('Bearer SYNTHETIC_VIEWER'),
    owner=await request('Bearer SYNTHETIC_OWNER'),post=await request('Bearer SYNTHETIC_OWNER','POST');
  assert.equal(noAuth.status,401);assert.equal(viewer.status,403);
  assert.equal(owner.status,release?200:503);assert.equal(post.status,405);
  assert.equal(owner.cache,'no-store');
  if(release){
   assert.equal(owner.payload.tables.length,15);
   assert.equal(owner.payload.verified_latest_full,7);
   assert.equal(owner.payload.verified_latest_delta,8);
   assert.equal(owner.payload.latest_export_rows_total,526655);
   assert.equal(owner.payload.transaction_history_continuity.reconstructed_total,1069797);
   assert.equal(owner.payload.audit111_anchor_sha256,audit111Reader.verification.source_sha);
  }
  return {release,missing_auth:noAuth.status,viewer:viewer.status,synthetic_owner:owner.status,
   non_get_denied:post.status,no_store:owner.cache,passed:true};
 }finally{
  await new Promise(resolve=>server.close(resolve));bridge.close();
  fs.rmSync(tmp,{recursive:true,force:true});
 }
}
(async()=>{
 const live=await check(true),blocked=await check(false);
 console.log(JSON.stringify({passed:live.passed&&blocked.passed,source:'REAL_PRIVATE_EXPORT_DATA_SYNTHETIC_AUTH',
  cases:[live,blocked],archive_chain_verification:true,report_checksum_verification:true,
  financial_record_values_logged:false,external_https_verified:false,production_deployed:false},null,2));
})().catch(e=>{console.error('AUDIT15_REAL_LOOPBACK_FAILED',e.message);process.exitCode=1})
 .finally(()=>audit111Reader.close());
