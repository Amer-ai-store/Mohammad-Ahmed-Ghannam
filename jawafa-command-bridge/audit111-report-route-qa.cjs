'use strict';
/* Local-only synthetic integration: no public listener, production DB, or real user tokens. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {createBridge}=require('./server.cjs');
async function run(release,valid){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'audit111-route-local-'));
  const audit111Reader={verification:{source_sha:'SYNTHETIC-SNAPSHOT'},getSnapshot(){return {
    schema_version:'jawafa.audit111.v1',classification:'PRIVATE_FINANCIAL_AUDIT',
    source_integrity_verified:true,snapshot_id:'SYNTHETIC-SNAPSHOT',risk_totals:{P0:0,P1:0,P2:0},
    events:[]}}};
  const audit111ReportReader={getReport(){return {
    schema_version:'jawafa.audit111.report.v1',classification:'PRIVATE_FINANCIAL_AUDIT',
    source_integrity_verified:valid,snapshot_id:'SYNTHETIC-SNAPSHOT',
    reports:[{id:'test',count:0,title:'SYNTHETIC',state:'TEST'}]}}};
  const bridge=createBridge({databaseFile:path.join(root,'ledger.sqlite'),audit111ReleaseAllowed:release,
    audit111Reader,audit111ReportReader,verifyUser:async auth=>{
      if(!auth)throw Object.assign(new Error('NO_TOKEN'),{status:401});
      return auth==='Bearer SYNTHETIC_OWNER'?{role:'owner',uid:'qa-synthetic'}:{role:'viewer'};
    }});
  const server=http.createServer(bridge.handler);
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  try{
    const target='http://127.0.0.1:'+server.address().port+'/api/jawafa/v1/audit/111/reports';
    async function get(token,method='GET'){
      const r=await fetch(target,{method,headers:token?{Authorization:token}:{}});
      return {code:r.status,body:await r.json(),cache:r.headers.get('cache-control')};
    }
    const none=await get(null),viewer=await get('Bearer SYNTHETIC_VIEWER'),
          owner=await get('Bearer SYNTHETIC_OWNER');
    assert.equal(none.code,401);assert.equal(viewer.code,403);
    assert.equal(owner.code,release&&valid?200:503);
    assert.equal(owner.cache,'no-store');
    assert.equal((await get('Bearer SYNTHETIC_OWNER','POST')).code,405);
    if(owner.code===200)assert.equal(owner.body.reports[0].title,'SYNTHETIC');
    return {release,valid,missing_auth:none.code,viewer:viewer.code,owner:owner.code,
      post_denied:405,cache:owner.cache,passed:true};
  }finally{await new Promise(ok=>server.close(ok));bridge.close();fs.rmSync(root,{recursive:true,force:true})}
}
(async()=>{const cases=[];for(const [released,verified] of [[false,true],[true,true],[true,false]])
 cases.push(await run(released,verified));
 console.log(JSON.stringify({passed:cases.every(x=>x.passed),cases,source:'synthetic-local-loopback-only'},null,2));
})().catch(e=>{console.error('AUDIT111_LOCAL_QA_FAILED',e.message);process.exitCode=1});
