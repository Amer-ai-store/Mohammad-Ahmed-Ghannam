'use strict';
/* Jawafa audit15 metadata sidecar. Private loopback-only, read-only.
 * Delegates REAL owner JWT verification to the existing isolated Firebase-owner
 * bridge on loopback; never accepts an unverified session, exposes SQL or stores JWT.
 * No shell command execution, no database writes, no CORS, no HTML fallback.
 */
const http=require('node:http');
const {readAudit15Ops,readSchemaCatalog}=require('./audit15-evidence.cjs');
const ROUTES=new Set(['/api/jawafa/v1/audit15-ops','/api/jawafa/v1/schema-catalog']);
const AUTH_PATH='/api/jawafa/v1/dashboard';
const defaultVerifyOwner=async bearer=>{
  let response;
  try{
    response=await fetch('http://127.0.0.1:8788'+AUTH_PATH,{
      method:'GET',redirect:'manual',
      headers:{Authorization:bearer,Accept:'application/json'},
      signal:AbortSignal.timeout(4500),
      cache:'no-store'
    });
  }catch{return {status:503,error:'OWNER_VERIFIER_UNAVAILABLE'}}
  if(response.status===401)return {status:401,error:'OWNER_AUTH_REQUIRED'};
  if(response.status===403)return {status:403,error:'OWNER_AUTH_REJECTED'};
  if(response.status!==200)return {status:503,error:'OWNER_VERIFIER_UNAVAILABLE'};
  try{
    const result=await response.json();
    if(result?.schema_version!=='jawafa.command.v1'||typeof result.source_system!=='string')
      return {status:503,error:'OWNER_VERIFIER_INVALID_RESPONSE'};
    return {status:200};
  }catch{return {status:503,error:'OWNER_VERIFIER_INVALID_RESPONSE'}}
};
const reply=(res,status,obj)=>{
  res.writeHead(status,{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store, max-age=0',
    'Pragma':'no-cache',
    'X-Frame-Options':'DENY',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
    'Vary':'Authorization'
  });
  res.end(JSON.stringify(obj));
};
function createSidecar({audit15File,schemaCatalogFile,verifyOwner=defaultVerifyOwner}={}){
  if(typeof audit15File!=='string'||typeof schemaCatalogFile!=='string')
    throw Error('AUDIT15_LOCAL_FILES_REQUIRED');
  return async(req,res)=>{
    const url=new URL(req.url||'/', 'http://127.0.0.1');
    if(!ROUTES.has(url.pathname))return reply(res,404,{error:'NOT_FOUND'});
    if(req.method!=='GET')return reply(res,405,{error:'METHOD_NOT_ALLOWED'});
    const bearer=req.headers.authorization;
    if(typeof bearer!=='string'||bearer.length>8000||
       !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(bearer))
      return reply(res,401,{error:'OWNER_AUTH_REQUIRED'});
    let status;
    try{status=await verifyOwner(bearer)}catch{status={status:503,error:'OWNER_VERIFIER_UNAVAILABLE'}}
    if(status?.status!==200)
      return reply(res,[401,403].includes(status?.status)?status.status:503,
        {error:typeof status?.error==='string'?status.error:'OWNER_AUTH_REJECTED'});
    try{
      const payload=url.pathname.endsWith('/audit15-ops')?
        readAudit15Ops(audit15File):
        readSchemaCatalog(schemaCatalogFile,req.url);
      return reply(res,200,payload);
    }catch(e){
      return reply(res,[422,502,503].includes(e.status)?e.status:503,{error:'PRIVATE_SOURCE_VALIDATION_FAILED'});
    }
  };
}
if(require.main===module){
  const host=process.env.JAWAFA_AUDIT15_BIND_HOST||'127.0.0.1';
  if(host!=='127.0.0.1'&&host!=='::1')throw Error('LOOPBACK_ONLY');
  const port=Number(process.env.JAWAFA_AUDIT15_PORT||8794);
  if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('INVALID_PRIVATE_PORT');
  const handler=createSidecar({
    audit15File:process.env.JAWAFA_AUDIT15_STATUS_PATH,
    schemaCatalogFile:process.env.JAWAFA_SCHEMA_CATALOG_PATH
  });
  http.createServer(handler).listen(port,host,()=>{
    process.stdout.write('AUDIT15_OWNER_AUTH_SIDECAR_LOOPBACK_READY port='+port+'\n');
  });
}
module.exports={createSidecar,defaultVerifyOwner};
