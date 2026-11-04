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
function readSchemaCatalog(filename,requestUrl){
  if(typeof filename!=='string'||!path.isAbsolute(filename))
    throw Object.assign(Error('SCHEMA_SOURCE_NOT_CONFIGURED'),{status:503});
  let input;
  try{
    const stat=fs.lstatSync(filename);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size<100||stat.size>12*1024*1024)throw Error('invalid_file');
    input=JSON.parse(fs.readFileSync(filename,'utf8'));
  }catch{
    throw Object.assign(Error('SCHEMA_SOURCE_UNAVAILABLE'),{status:503});
  }
  if(input?.schema!=='jawafa.private.schema.v1'||input.businessRowsIncluded!==false||
    !Array.isArray(input.tables)||input.tables.length!==1024||
    !Array.isArray(input.foreignKeys)||input.foreignKeys.length!==38)
      throw Object.assign(Error('SCHEMA_SOURCE_INVALID'),{status:502});
  const params=new URL(requestUrl,'http://127.0.0.1').searchParams;
  const offsetRaw=params.get('offset')??'0',limitRaw=params.get('limit')??'50',nameRaw=params.get('name')??'';
  if(!/^\d{1,4}$/.test(offsetRaw)||!/^\d{1,3}$/.test(limitRaw)||!/^[a-zA-Z0-9_]{0,64}$/.test(nameRaw))
      throw Object.assign(Error('INVALID_SCHEMA_QUERY'),{status:422});
  const offset=Number(offsetRaw),limit=Number(limitRaw);
  if(limit<1||limit>100||offset>1024)
      throw Object.assign(Error('INVALID_SCHEMA_QUERY'),{status:422});
  const filtered=input.tables.filter(x=>typeof x?.table==='string'&&
    x.table.toLowerCase().includes(nameRaw.toLowerCase()));
  const page=filtered.slice(offset,offset+limit);
  const names=new Set(page.map(t=>(String(t.schema)+'.'+t.table).toLowerCase()));
  const rows=page.map(t=>({
    schema:String(t.schema).slice(0,128),
    name:String(t.table).slice(0,128),
    columnCount:Array.isArray(t.columns)?t.columns.length:0,
    columns:Array.isArray(t.columns)?t.columns.slice(0,250).map(c=>({
      name:String(c?.name??'').slice(0,128),
      sqlType:String(c?.sqlType??'unknown').slice(0,80),
      nullable:String(c?.nullable??'').slice(0,3),
      position:Number.isSafeInteger(Number(c?.position))?Number(c.position):null
    })):[]
  }));
  const relations=input.foreignKeys.filter(f=>
    names.has((String(f.fromSchema)+'.'+f.fromTable).toLowerCase())||
    names.has((String(f.toSchema)+'.'+f.toTable).toLowerCase())
  ).map(f=>({
    fromSchema:String(f.fromSchema).slice(0,128),fromTable:String(f.fromTable).slice(0,128),
    fromColumn:String(f.fromColumn).slice(0,128),
    toSchema:String(f.toSchema).slice(0,128),toTable:String(f.toTable).slice(0,128),
    toColumn:String(f.toColumn).slice(0,128),
    evidence:'SQL_SCHEMA_DECLARED_FK_ONLY'
  }));
  const checked=new Date(input.observedAtUtc).getTime();
  return {
    schema:'jawafa.schema.catalog.page.v1',classification:'OWNER_ONLY_SCHEMA_METADATA_NO_BUSINESS_ROWS',
    source:'JAWAFFASVR protected schema snapshot',
    observedAtUtc:input.observedAtUtc,
    stale:!Number.isFinite(checked)||Math.abs(Date.now()-checked)>30*60*1000,
    totalTables:1024,totalForeignKeys:38,matchingTables:filtered.length,
    offset,limit,rows,relationships:relations,
    note:'Declared SQL foreign keys are not sufficient proof of TrustSoft business-posting relationships.'
  };
}
module.exports={readAudit15Ops,readSchemaCatalog};
