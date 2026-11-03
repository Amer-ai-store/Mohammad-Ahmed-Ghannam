'use strict';
// Read-only owner-scope bridge for a separately generated, ACL-protected
// operations report. This module never connects to SQL or performs filesystem writes.
const fs=require('node:fs');
const path=require('node:path');
const INTEGER=n=>(typeof n==='number'||(typeof n==='string'&&n.trim()!==''))&&Number.isSafeInteger(Number(n))&&Number(n)>=0;
function readAudit15Ops(filename){
  if(typeof filename!=='string'||!path.isAbsolute(filename))
    throw Object.assign(Error('AUDIT15_SOURCE_NOT_CONFIGURED'),{status:503});
  let input;
  try{
    const stat=fs.lstatSync(filename);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size<100||stat.size>512*1024)throw Error('invalid_file');
    input=JSON.parse(fs.readFileSync(filename,'utf8'));
  }catch{
    throw Object.assign(Error('AUDIT15_SOURCE_UNAVAILABLE'),{status:503});
  }
  if(!input||input.schema!=='jawafa.audit15-agents.v1'||
    input.classification!=='PRIVATE_EVIDENCE_METADATA_ONLY_NO_BUSINESS_ROWS'||
    input.host!=='JAWAFFASVR'||input.database!=='Jawafa_DB'||
    !Array.isArray(input.audit15?.tables)||input.audit15.tables.length!==15||
    !Array.isArray(input.existingAgents?.agents)||
    !INTEGER(input.schemaCatalog?.tableCount)||
    !INTEGER(input.schemaCatalog?.declaredRelations))
    throw Object.assign(Error('AUDIT15_SOURCE_INVALID'),{status:502});
  const seen=new Set();
  const tables=input.audit15.tables.map(t=>{
    const name=t?.table;
    if(typeof name!=='string'||!/^[a-zA-Z_][\w]{0,127}$/.test(name)||
       seen.has(name.toLowerCase())||!INTEGER(t.referenceRows)||!INTEGER(t.exportRows)||
       !Number.isSafeInteger(Number(t.laterMinusReference))||
       !INTEGER(t.historicalValueDifferenceCandidates)||
       !INTEGER(t.declaredForeignKeyCount))
      throw Object.assign(Error('AUDIT15_SOURCE_INVALID'),{status:502});
    seen.add(name.toLowerCase());
    return {
      table:name,
      referenceRows:Number(t.referenceRows),exportRows:Number(t.exportRows),
      laterMinusReference:Number(t.laterMinusReference),
      historicalValueDifferenceCandidates:Number(t.historicalValueDifferenceCandidates),
      priorAuditLatestMode:['FULL','DELTA'].includes(t.priorAuditLatestMode)?t.priorAuditLatestMode:'UNVERIFIED',
      declaredForeignKeyCount:Number(t.declaredForeignKeyCount),
      historicalComparisonStatus:'CAUSE_UNRESOLVED'
    };
  });
  if(input.existingAgents.agents.length>250)throw Object.assign(Error('AUDIT15_SOURCE_INVALID'),{status:502});
  const agents=input.existingAgents.agents.map(a=>({
    name:typeof a?.name==='string'?a.name.slice(0,128):'',
    category:typeof a?.category==='string'?a.category.slice(0,60):'operations',
    schedulerState:typeof a?.schedulerState==='string'?a.schedulerState.slice(0,32):'UNKNOWN',
    lastRunLocal:a?.lastRunLocal?String(a.lastRunLocal).slice(0,30):null,
    nextRunLocal:a?.nextRunLocal?String(a.nextRunLocal).slice(0,30):null,
    lastSchedulerResult:Number.isSafeInteger(Number(a?.lastSchedulerResult))?Number(a.lastSchedulerResult):null,
    aiModelEndpointVerified:false
  }));
  const checked=new Date(input.checkedUtc).getTime();
  const stale=!Number.isFinite(checked)||Math.abs(Date.now()-checked)>30*60*1000;
  const x=input.export;
  const exportSummary=x&&['mode','totalTables','processedTables','remainingTables','failedTables','progressPercent'].every(key=>Object.hasOwn(x,key))?{
    mode:String(x.mode).slice(0,80),
    totalTables:INTEGER(x.totalTables)?Number(x.totalTables):null,
    processedTables:INTEGER(x.processedTables)?Number(x.processedTables):null,
    remainingTables:INTEGER(x.remainingTables)?Number(x.remainingTables):null,
    failedTables:INTEGER(x.failedTables)?Number(x.failedTables):null,
    progressPercent:Number.isFinite(Number(x.progressPercent))?Number(x.progressPercent):null,
    completenessAccepted:false
  }:null;
  return {
    schema:'jawafa.audit15-agents.v1',
    classification:'PRIVATE_EVIDENCE_METADATA_ONLY_NO_BUSINESS_ROWS',
    host:'JAWAFFASVR',database:'Jawafa_DB',
    checkedUtc:input.checkedUtc,stale,
    schemaCatalog:{tableCount:Number(input.schemaCatalog.tableCount),
      declaredRelations:Number(input.schemaCatalog.declaredRelations),audit15PresentCount:15},
    audit15:{
      tables,transferGuardStatus:String(input.audit15.transferGuardStatus||'UNKNOWN').slice(0,80),
      transferGuardCheckedUtc:String(input.audit15.transferGuardCheckedUtc||''),
      verifiedTransferFiles:INTEGER(input.audit15.verifiedTransferFiles)?Number(input.audit15.verifiedTransferFiles):null,
      verifiedRoundtrips:INTEGER(input.audit15.verifiedRoundtrips)?Number(input.audit15.verifiedRoundtrips):null,
      previousVerifiedFull:INTEGER(input.audit15.previousVerifiedFull)?Number(input.audit15.previousVerifiedFull):null,
      previousVerifiedDelta:INTEGER(input.audit15.previousVerifiedDelta)?Number(input.audit15.previousVerifiedDelta):null,
      historicalRootCauseVerified:false
    },
    existingAgents:{count:agents.length,agents},
    export:exportSummary,
    caveat:'Historical count or value differences do not prove deletion, fraud or user attribution. Windows scheduler status does not verify AI model execution.'
  };
}
module.exports={readAudit15Ops};
