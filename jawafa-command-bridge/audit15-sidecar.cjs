'use strict';
/* Jawafa audit15 metadata sidecar. Private loopback-only, read-only.
 * Delegates REAL owner JWT verification to the existing isolated Firebase-owner
 * bridge on loopback; never accepts an unverified session, exposes SQL or stores JWT.
 * No shell command execution, no database writes, no CORS, no HTML fallback.
 */
const http=require('node:http');
const {readAudit15Ops,readSchemaCatalog}=require('./audit15-evidence.cjs');
const ROUTES=new Set(['/api/jawafa/v1/audit15-ops','/api/jawafa/v1/schema-catalog','/api/jawafa/v1/live-schema-proof']);
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
async function fetchFreshLocalSchemaProof(){
  let response;
  try{
    response=await fetch('http://127.0.0.1:3456/api/schema-graph',{
      method:'GET',redirect:'error',cache:'no-store',
      signal:AbortSignal.timeout(6000),
      headers:{Accept:'application/json'}
    });
    if(response.status!==200)throw Error('LOCAL_SQL_BRIDGE_UNAVAILABLE');
    const payload=await response.json();
    if(payload?.ok!==true||
       !Array.isArray(payload.tables)||payload.tables.length!==1024||
       !Array.isArray(payload.relationships)||payload.relationships.length!==38||
       !payload.tables.every(t=>typeof t?.schema==='string'&&typeof t?.name==='string'))
      throw Error('LOCAL_SQL_BRIDGE_SCHEMA_INVALID');
    const generated=Date.parse(payload.generatedAt||'');
    const now=Date.now();
    if(!Number.isFinite(generated)||generated>now+30000||now-generated>30000)
      throw Error('LOCAL_SQL_BRIDGE_RESPONSE_STALE');
    // Actual bounded read against the local SQL bridge. Drop values immediately;
    // never send rows, personal values, or credentials to the browser.
    const sampleResponse=await fetch('http://127.0.0.1:3456/api/query/TransactionHistory?limit=1',{
      method:'GET',redirect:'error',cache:'no-store',
      signal:AbortSignal.timeout(6000),headers:{Accept:'application/json'}
    });
    if(sampleResponse.status!==200)throw Error('LOCAL_SQL_BRIDGE_SAMPLE_UNAVAILABLE');
    const sample=await sampleResponse.json();
    if(sample?.ok!==true||sample?.table!=='TransactionHistory'||sample?.count!==1||
       !Array.isArray(sample.data)||sample.data.length!==1)
      throw Error('LOCAL_SQL_BRIDGE_SAMPLE_INVALID');
    return {
      schema:'jawafa.private.live-schema-proof.v1',
      classification:'OWNER_ONLY_SCHEMA_METADATA_NO_BUSINESS_ROWS',
      sourceType:'JAWAFFASVR_LOCAL_SCHEMA_BRIDGE_GET',
      sourceEndpoint:'/api/schema-graph',
      databaseIntended:'Jawafa_DB',
      observedAtUtc:new Date(now).toISOString(),
      bridgeGeneratedAtUtc:payload.generatedAt,
      schemaTableCount:1024,declaredSqlForeignKeys:38,
      financialRowsExposed:false,transactionHistoryBoundedSampleRead:true,sampleRowValuesReturned:false,databasePrincipalLeastPrivilegeVerified:false,
      browserDirectSQL:false,authenticatedFinancialRowReadVerified:false,
      disclaimer:'Fresh local schema and one bounded TransactionHistory record read via bridge; SQL principal least privilege and owner E2E require independent verification.'
    };
  }catch{
    throw Object.assign(Error('LOCAL_SCHEMA_BRIDGE_READING_FAILED'),{status:503});
  }
}
function createSidecar({audit15File,schemaCatalogFile,verifyOwner=defaultVerifyOwner,readLiveSchema=fetchFreshLocalSchemaProof}={}){
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
        url.pathname.endsWith('/schema-catalog')?
          readSchemaCatalog(schemaCatalogFile,req.url):
          await readLiveSchema();
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
module.exports={createSidecar,defaultVerifyOwner,fetchFreshLocalSchemaProof};
