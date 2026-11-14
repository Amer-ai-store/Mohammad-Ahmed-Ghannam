'use strict';
/*
 * JAWAFA Private Tailnet Bridge — status-only SQL connectivity proof.
 * Public artwork is fetched from the one approved GitHub Pages dashboard,
 * while all owner-authenticated requests stay on the existing private host.
 * NO SQL passwords, financial rows, DML, public tunnels or trust bypass.
 */
const http=require('node:http');
const https=require('node:https');
const {execFile}=require('node:child_process');
const {URL}=require('node:url');

const STATIC_BASE=new URL('https://amer-ai-store.github.io/Mohammad-Ahmed-Ghannam/');
const HEADER={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const HEALTH_SCRIPT=[
 "$ErrorActionPreference='Stop'",
 "$r=Invoke-RestMethod -UseDefaultCredentials -TimeoutSec 5 -Uri 'http://127.0.0.1:3467/health'",
 "[pscustomobject]@{ok=$r.ok;login=$r.login;database=$r.database;reader=$r.reader;writer=$r.writer;mode=$r.mode;tls_status=$r.tls_status} | ConvertTo-Json -Compress -Depth 3"
].join('\n');
const ERR=(message,status)=>Object.assign(new Error(message),{status});
function reply(res,code,payload){
 if(res.writableEnded)return;
 res.writeHead(code,{'content-type':'application/json; charset=utf-8',...HEADER});
 res.end(JSON.stringify(payload));
}
function fixedStaticTarget(raw){
 let u;
 try{u=new URL(raw,'http://localhost')}catch{return null}
 if(!u.pathname.startsWith('/central/'))return null;
 let part=u.pathname.slice('/central/'.length);
 if(!part)part='index.html';
 if(part.includes('\\')||/%2f|%5c|%00/i.test(part))return null;
 const target=new URL(part+u.search,STATIC_BASE);
 if(target.origin!==STATIC_BASE.origin||
    !target.pathname.startsWith(STATIC_BASE.pathname)||
    !/\.(?:html|css|js|mjs|cjs|json|svg|png|ico|webp|jpg|jpeg|woff2|txt|map)$/i.test(target.pathname))
   return null;
 return target;
}
function requireBearer(req){
 const value=req.headers.authorization;
 if(typeof value!=='string'||!/^Bearer [A-Za-z0-9._~-]{20,8192}$/.test(value))throw ERR('OWNER_AUTH_REQUIRED',401);
 return value;
}
function authenticateOwner(bearer){
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:8788,
    path:'/api/jawafa/v1/dashboard',method:'GET',timeout:5500,
    headers:{Accept:'application/json',Authorization:bearer}},
  res=>{
   let body='',bytes=0;
   res.on('data',c=>{bytes+=c.length;if(bytes>65536){req.destroy();return}body+=c});
   res.on('end',()=>{
    if(res.statusCode!==200)return reject(ERR('OWNER_AUTH_REJECTED',res.statusCode===403?403:res.statusCode===401?401:503));
    try{
      const v=JSON.parse(body);
      if(v.schema_version!=='jawafa.command.v1'||typeof v.source_system!=='string')throw Error();
      resolve(true);
    }catch{reject(ERR('OWNER_AUTH_RESPONSE_INVALID',503))}
   });
  });
  req.on('timeout',()=>req.destroy(ERR('OWNER_AUTH_TIMEOUT',503)));
  req.on('error',()=>reject(ERR('OWNER_AUTH_UNAVAILABLE',503)));
  req.end();
 });
}
function readWindowsHealth(){
 return new Promise((resolve,reject)=>{
  execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',HEALTH_SCRIPT],
    {timeout:7500,maxBuffer:12000,windowsHide:true},(error,stdout)=>{
     if(error)return reject(ERR('LOCAL_READER_UNAVAILABLE',503));
     try{resolve(JSON.parse(String(stdout).trim()))}
     catch{reject(ERR('LOCAL_READER_INVALID_RESPONSE',503))}
    });
 });
}
function normalizeHealth(v,now=new Date()){
 if(!v||v.ok!==true||v.login!=='user_read'||v.database!=='Jawafa_DB'||
    Number(v.reader)!==1||Number(v.writer)!==0||v.mode!=='READ_ONLY_LOCAL')
    throw ERR('USER_READ_PROOF_FAILED',503);
 const tls=v.tls_status==='LOCAL_ENCRYPTED_CERT_CHAIN_NOT_VERIFIED'?'ENCRYPTED_UNTRUSTED_CERT':
   v.tls_status==='VERIFIED_TRUSTED_CERT'?'VERIFIED_TRUSTED_CERT':'UNVERIFIED';
 return {schema:'jawafa.sql-connectivity.v1',
   sql_read_proven:true,source_system:'Jawafa_DB',sql_login:'user_read',
   reader_role:true,writer_role:false,read_only:true,checked_at:now.toISOString(),
   tls_status:tls,certificate_trusted:tls==='VERIFIED_TRUSTED_CERT',
   production_accepted:false,financial_records_returned:0,
   note:'Local SQL reader attested via Windows auth. Financial KPIs require separately verified TLS, least privilege and accepted queries.'};
}
function proxyStatic(req,res,target){
 const upstream=https.get(target,{
   timeout:6500,headers:{'accept':String(req.headers.accept||'*/*').slice(0,150),'user-agent':'JawafaPrivateCentral/1.0'}
 },up=>{
  if(up.statusCode!==200||!up.headers['content-type']){
    up.resume();return reply(res,502,{error:'PUBLIC_STATIC_SOURCE_UNAVAILABLE'});
  }
  const length=Number(up.headers['content-length']);
  if(Number.isFinite(length)&&length>8000000){up.resume();return reply(res,502,{error:'ASSET_TOO_LARGE'})}
  res.writeHead(200,{'content-type':up.headers['content-type'],...HEADER});
  let size=0;
  up.on('data',chunk=>{size+=chunk.length;if(size>8000000){up.destroy();res.destroy()}else res.write(chunk)});
  up.on('end',()=>{if(!res.writableEnded)res.end()});
 });
 upstream.on('timeout',()=>upstream.destroy());
 upstream.on('error',()=>{if(!res.headersSent)reply(res,502,{error:'STATIC_UPSTREAM_UNAVAILABLE'});else res.destroy()});
}
function createRouter({verifyOwner=authenticateOwner,fetchHealth=readWindowsHealth,staticProxy=proxyStatic}={}){
 return function route(req,res){
   let url;
   try{url=new URL(req.url,'http://localhost')}catch{reply(res,400,{error:'INVALID_URL'});return true}
   if(url.pathname==='/api/jawafa/v1/sql-health'){
     if(req.method!=='GET'){reply(res,405,{error:'READ_ONLY_GET_ONLY'});return true}
     let bearer;
     try{bearer=requireBearer(req)}catch(e){reply(res,e.status||401,{error:e.message});return true}
     (async()=>{
      await verifyOwner(bearer);
      const raw=await fetchHealth();
      reply(res,200,normalizeHealth(raw));
     })().catch(e=>reply(res,e.status||503,{error:e.message==='OWNER_AUTH_REJECTED'?'OWNER_AUTH_REJECTED':e.message||'PRIVATE_SQL_READ_UNAVAILABLE'}));
     return true;
   }
   if(url.pathname==='/central'||url.pathname==='/'){
     if(req.method!=='GET'){reply(res,405,{error:'GET_ONLY'});return true}
     res.writeHead(302,{location:'/central/index.html',...HEADER});res.end();return true;
   }
   if(url.pathname.startsWith('/central/')){
     if(req.method!=='GET'){reply(res,405,{error:'GET_ONLY'});return true}
     const target=fixedStaticTarget(req.url);
     if(!target){reply(res,404,{error:'STATIC_ASSET_DISALLOWED'});return true}
     staticProxy(req,res,target);return true;
   }
   return false;
 }
}
module.exports={createRouter,normalizeHealth,fixedStaticTarget,requireBearer};
