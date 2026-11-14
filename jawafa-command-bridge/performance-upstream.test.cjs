'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {permittedOrigin,normalize,privatePerformance}=require('./performance-upstream.cjs');
const SECRET='x'.repeat(48);
const URL='http://127.0.0.1:8790/internal/jawafa/performance';
function good(now=Date.now()){
  const ts=new Date(now-120000).toISOString(),m=()=>({today:1,prior_2025:2,prior_2024:3});
  return {format:'jawafa-performance-v1',source_system:'Jawafa_DB',cutoff:ts,
    verification:{sql_login:'user_read',database:'Jawafa_DB',tls_encrypted:true,
      tls_certificate_trusted:true,read_only:true,deny_write_test_passed:true,
      accepted_permissions:true,verified_at:ts},
    metrics:{sales:m(),purchases:m(),inventory:m(),payables:m(),postdated_cheques:m()},
    trend:{labels:['2026-11-01','2026-11-02'],sales_2026:[1,2],sales_2025:[2,1],sales_2024:[1,1]},
    departments:[{name:'Markets',share:100}],alerts:[{level:'info',text:'read-only test'}],
    raw_private_bank_record:{account:'MUST_NOT_LEAK'},password:'MUST_NOT_LEAK'};
}
test('private upstream allowlist is loopback only, strict fixed path',()=>{
  assert.equal(permittedOrigin(URL),true);
  for(const bad of ['https://evil.test/internal/jawafa/performance',
    'http://localhost:8790/internal/jawafa/performance',
    'http://127.0.0.1:8790/private/secret',
    'http://127.0.0.1:8790/internal/jawafa/performance?token=x',
    'http://127.0.0.1:8790@evil.test/internal/jawafa/performance',
    'file:///test']) assert.equal(permittedOrigin(bad),false,bad);
});
test('unconfigured gateway returns 503 before any network request',async()=>{
  let fetched=false;
  await assert.rejects(privatePerformance({url:'',secret:SECRET,fetchImpl:()=>{fetched=true}}),
    e=>e.status===503&&e.message==='PRIVATE_SQL_GATEWAY_NOT_CONFIGURED');
  assert.equal(fetched,false);
});
test('source verification rejects wrong SQL login, missing grants, insecure TLS and old data',()=>{
  const now=Date.now();
  for(const bad of [
    d=>d.verification.sql_login='sa',
    d=>d.verification.accepted_permissions=false,
    d=>delete d.verification.accepted_permissions,
    d=>d.verification.tls_certificate_trusted=false,
    d=>d.verification.tls_encrypted=false,
    d=>d.verification.deny_write_test_passed=false,
    d=>d.cutoff=new Date(now-86400000).toISOString(),
    d=>d.verification.verified_at=new Date(now-86400000).toISOString()
  ]){
    const value=good(now);bad(value);
    assert.throws(()=>normalize(value,now),e=>e.status===503);
  }
});
test('only aggregate whitelist leaves the private upstream',async()=>{
 const now=Date.now();let sentHeader=false;
 const data=await privatePerformance({url:URL,secret:SECRET,now,fetchImpl:async(url,options)=>{
   assert.equal(url,URL);sentHeader=options.headers['x-jawafa-internal-key']===SECRET;
   return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(good(now))}
 }});
 assert.equal(sentHeader,true);
 assert.equal(data.data_verified,true);assert.equal(data.source_system,'Jawafa_DB');
 assert.equal(data.verification.sql_login,'user_read');assert.equal(data.metrics.sales.today,1);
 assert.equal(data.raw_private_bank_record,undefined);assert.equal(data.password,undefined);
 assert.equal(data.verification.accepted_permissions,undefined);
});
test('rejects malicious metric types and excessive data size',async()=>{
 const bad=good();bad.metrics.sales.today='100000';
 assert.throws(()=>normalize(bad),e=>e.status===502);
 await assert.rejects(privatePerformance({url:URL,secret:SECRET,fetchImpl:async()=>({
   ok:true,headers:{get:()=>null},text:async()=>('a'.repeat(60000))
 })}),e=>e.status===502);
});
