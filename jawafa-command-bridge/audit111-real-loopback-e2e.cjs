'use strict';
/* E2E on JAWAFFASVR loopback only. Real archive, SYNTHETIC identity, no public exposure. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {createBridge}=require('./server.cjs');
const {createAudit111Reader}=require('./audit111-read.cjs');
const {createAudit111ReportReader}=require('./audit111-reports.cjs');
const [archiveDir,exportDir,reportFile]=process.argv.slice(2);
if(!archiveDir||!exportDir||!reportFile)throw Error('LOCAL_E2E_PATHS_REQUIRED');
const reader=createAudit111Reader({databaseFile:path.join(archiveDir,'audit111_history.sqlite'),exportDir});
const reportReader=createAudit111ReportReader({reportFile,audit111Reader:reader});
async function run(){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'audit111-local-e2e-'));
 const bridge=createBridge({databaseFile:path.join(tmp,'operations.sqlite'),
   audit111Reader:reader,audit111ReportReader:reportReader,audit111ReleaseAllowed:true,
   verifyUser:async auth=>{
     if(!auth)throw Object.assign(new Error('NO_AUTH'),{status:401});
     return auth==='Bearer SYNTHETIC_OWNER'?{role:'owner',uid:'local-e2e'}:{role:'viewer'};
   }});
 const server=http.createServer(bridge.handler);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{
  const root='http://127.0.0.1:'+server.address().port;
  async function call(path,auth,method){
   const res=await fetch(root+path,{method:method||'GET',headers:auth?{Authorization:auth}:{}});
   return {code:res.status,body:await res.json(),cache:res.headers.get('cache-control')};
  }
  const reportUrl='/api/jawafa/v1/audit/111/reports',historyUrl='/api/jawafa/v1/audit/111?limit=15';
  const unauth=await call(reportUrl);
  const viewer=await call(reportUrl,'Bearer SYNTHETIC_VIEWER');
  const ownerReport=await call(reportUrl,'Bearer SYNTHETIC_OWNER');
  const ownerHistory=await call(historyUrl,'Bearer SYNTHETIC_OWNER');
  const wrongMethod=await call(reportUrl,'Bearer SYNTHETIC_OWNER','POST');
  assert.equal(unauth.code,401);assert.equal(viewer.code,403);
  assert.equal(ownerReport.code,200);assert.equal(ownerHistory.code,200);
  assert.equal(wrongMethod.code,405);assert.equal(ownerReport.cache,'no-store');
  assert.equal(ownerReport.body.snapshot_id,ownerHistory.body.snapshot_id);
  assert.equal(ownerReport.body.reports.length,5);
  assert.equal(ownerHistory.body.events.length,15);
  assert.equal(ownerReport.body.summary.latest_events,22776);
  assert.equal(ownerReport.body.summary.new_events,607);
  console.log(JSON.stringify({passed:true,route_mode:'EPHEMERAL_LOOPBACK_WITH_SYNTHETIC_OWNER',
    missing_auth:unauth.code,non_owner:viewer.code,owner_report:ownerReport.code,
    owner_history:ownerHistory.code,wrong_method:wrongMethod.code,cache:ownerReport.cache,
    cross_route_snapshot_consistent:true,private_report_count:ownerReport.body.reports.length,
    tested_event_page_count:ownerHistory.body.events.length,financial_event_values_printed:false,
    production_deployed:false},null,2));
 }finally{
  await new Promise(ok=>server.close(ok));bridge.close();
  fs.rmSync(tmp,{recursive:true,force:true});
 }
}
run().catch(e=>{console.error('LOCAL_E2E_FAILED',e.message);process.exitCode=1})
 .finally(()=>reader.close());
