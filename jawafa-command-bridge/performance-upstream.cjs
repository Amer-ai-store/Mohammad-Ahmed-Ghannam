'use strict';
/**
 * Private, owner-authenticated read-only performance handoff.
 * SQL access MUST remain on JAWAFFASVR behind an independently secured loopback
 * service. This module neither opens SQL nor reads credentials. Absent
 * evidence/connection it fails closed and never publishes sample amounts.
 */
const {URL}=require('node:url');
const METRICS=['sales','purchases','inventory','payables','postdated_cheques'];
const fail=(message,status=503)=>Object.assign(new Error(message),{status});
const number=x=>x===null?null:typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1e15?x:undefined;
const stamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?x:null;
function permittedOrigin(raw){
  if(typeof raw!=='string'||!raw)return false;
  try{
    const u=new URL(raw);
    return u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.port!==''&&
      u.username===''&&u.password===''&&u.pathname==='/internal/jawafa/performance'&&
      u.search===''&&u.hash==='';
  }catch{return false}
}
function normalize(source,now=Date.now()){
  if(!source||source.format!=='jawafa-performance-v1')throw fail('SQL_SOURCE_SCHEMA_INVALID',502);
  const v=source.verification||{};
  if(source.source_system!=='Jawafa_DB'||
     v.sql_login!=='user_read'||v.database!=='Jawafa_DB'||
     v.tls_encrypted!==true||v.tls_certificate_trusted!==true||
     v.read_only!==true||v.deny_write_test_passed!==true||
     v.accepted_permissions===false)
     throw fail('SQL_SECURITY_NOT_VERIFIED',503);
  const verified=stamp(v.verified_at),cutoff=stamp(source.cutoff);
  if(!verified||!cutoff)throw fail('SQL_EVIDENCE_TIMESTAMPS_MISSING',503);
  const t=Date.parse(verified),cut=Date.parse(cutoff);
  if(t>now+60000||now-t>15*60000||cut>now+60000||now-cut>15*60000)
     throw fail('SQL_READONLY_SNAPSHOT_STALE',503);
  if(!source.metrics||typeof source.metrics!=='object'||Array.isArray(source.metrics))
     throw fail('SQL_METRICS_MISSING',502);
  const metrics={};
  for(const name of METRICS){
    const x=source.metrics[name]||{},row={};
    for(const key of ['today','prior_2025','prior_2024']){
      const val=number(x[key]===undefined?null:x[key]);
      if(val===undefined)throw fail('SQL_METRICS_INVALID',502);
      row[key]=val;
    }
    metrics[name]=row;
  }
  const srcTrend=source.trend||{},labels=srcTrend.labels||[];
  if(!Array.isArray(labels)||labels.length>30||!labels.every(x=>typeof x==='string'&&x.length<=18))
    throw fail('SQL_TREND_INVALID',502);
  const trend={labels:labels.slice()};
  for(const key of ['sales_2026','sales_2025','sales_2024']){
    const seq=srcTrend[key]||[];
    if(!Array.isArray(seq)||seq.length>labels.length||seq.some(v=>number(v)===undefined))
      throw fail('SQL_TREND_INVALID',502);
    trend[key]=seq.map(number);
  }
  if(!Array.isArray(source.departments||[])||(source.departments||[]).length>10||
    !Array.isArray(source.alerts||[])||(source.alerts||[]).length>10)
    throw fail('SQL_DETAILS_INVALID',502);
  const departments=(source.departments||[]).map(item=>{
    if(typeof item.name!=='string'||item.name.length>35||!Number.isFinite(item.share)||item.share<0||item.share>100)
      throw fail('SQL_DEPARTMENTS_INVALID',502);
    return {name:item.name,share:item.share};
  });
  const alerts=(source.alerts||[]).map(item=>{
    if(typeof item.text!=='string'||item.text.length>200||
       !['info','warn','danger','success'].includes(item.level))
      throw fail('SQL_ALERTS_INVALID',502);
    return {text:item.text,level:item.level};
  });
  return {
    format:'jawafa-performance-v1',
    source_system:'Jawafa_DB',source:'Jawafa_DB / user_read',
    cutoff,verified_at:verified,
    data_verified:true,read_only:true,
    verification:{sql_login:'user_read',tls_encrypted:true,tls_certificate_trusted:true,
      deny_write_test_passed:true,verified_at:verified},
    metrics,trend,departments,alerts
  };
}
async function privatePerformance(options={}){
  const url=options.url??process.env.JAWAFA_SQL_READONLY_UPSTREAM_URL;
  const secret=options.secret??process.env.JAWAFA_SQL_GATEWAY_SHARED_SECRET;
  if(!permittedOrigin(url)||typeof secret!=='string'||secret.length<32)
    throw fail('PRIVATE_SQL_GATEWAY_NOT_CONFIGURED',503);
  const fetcher=options.fetchImpl||fetch;
  let response;
  try{
    response=await fetcher(url,{method:'GET',cache:'no-store',redirect:'error',
      headers:{'Accept':'application/json','x-jawafa-internal-key':secret},
      signal:AbortSignal.timeout(4000)});
  }catch{throw fail('PRIVATE_SQL_GATEWAY_UNREACHABLE',503)}
  if(!response.ok)throw fail('PRIVATE_SQL_GATEWAY_REJECTED',503);
  const len=Number(response.headers?.get?.('content-length'));
  if(Number.isFinite(len)&&len>50000)throw fail('SQL_RESPONSE_TOO_LARGE',502);
  let body;
  try{const raw=await response.text();if(raw.length>50000)throw Error();body=JSON.parse(raw)}
  catch{throw fail('SQL_RESPONSE_INVALID',502)}
  return normalize(body,options.now??Date.now());
}
module.exports={privatePerformance,normalize,permittedOrigin};
