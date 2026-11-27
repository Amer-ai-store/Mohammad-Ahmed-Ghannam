'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const http=require('node:http'),os=require('node:os'),fs=require('node:fs'),path=require('node:path');
const {createBridge}=require('./server.cjs');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'audit111-qa-'));
let instances=[];
async function make({release=false,verified=true}={}){
 const app=createBridge({
  databaseFile:path.join(temp,'qa-'+instances.length+'.sqlite'),
  verifyUser:async token=>{
   if(!token)throw Object.assign(new Error('AUTH_REQUIRED'),{status:401});
   return token==='Bearer OWNER'?{role:'owner',uid:'test-owner'}:{role:'viewer'};
  },audit111ReleaseAllowed:release,
  audit111Reader:{getSnapshot:()=>({
   schema_version:'jawafa.audit111.v1',classification:'PRIVATE_FINANCIAL_AUDIT',
   private_access_verified:true,source_integrity_verified:verified,
   snapshot_id:'SYNTHETIC',verified_at:new Date().toISOString(),events:[]
  })}
 });
 const server=http.createServer(app.handler);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 instances.push({app,server});
 return 'http://127.0.0.1:'+server.address().port+'/api/jawafa/v1/audit/111';
}
test.after(async()=>{
 for(const {app,server} of instances){await new Promise(r=>server.close(r));app.close()}
 fs.rmSync(temp,{recursive:true,force:true});
});
async function req(url,auth='Bearer OWNER',method='GET'){
 const r=await fetch(url,{method,headers:auth?{authorization:auth}:{}});
 return {status:r.status,body:await r.json(),cache:r.headers.get('cache-control')};
}
test('never enables audit source by default',async()=>{
 const uri=await make();
 const r=await req(uri);
 assert.equal(r.status,503);assert.equal(r.body.error,'AUDIT111_PRIVATE_RELEASE_NOT_APPROVED');
});
test('403 nonowner and 401 missing bearer even when QA reader injected',async()=>{
 const uri=await make({release:true});
 assert.equal((await req(uri,'')).status,401);
 assert.equal((await req(uri,'Bearer VIEWER')).status,403);
});
test('owner can read synthetic snapshot only after review switch',async()=>{
 const uri=await make({release:true});
 const res=await req(uri);
 assert.equal(res.status,200);
 assert.equal(res.body.events.length,0);
 assert.equal(res.body.snapshot_id,'SYNTHETIC');
 assert.equal(res.cache,'no-store');
});
test('unverified upstream content is not served',async()=>{
 const uri=await make({release:true,verified:false});
 assert.equal((await req(uri)).status,503);
});
test('bounds query and rejects POST operation',async()=>{
 const uri=await make({release:true});
 assert.equal((await req(uri+'?limit=0')).status,422);
 assert.equal((await req(uri+'?limit=101')).status,422);
 assert.equal((await req(uri+'?limit=NaN')).status,422);
 assert.equal((await req(uri,'Bearer OWNER','POST')).status,405);
});
