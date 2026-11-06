'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict'), http=require('node:http'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createBridge,codeHash}=require('./server.cjs');
const {createSidecar}=require('./audit15-sidecar.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jawafa-test-'));let app,server,url;const secret='JAWAFA_AGENT_SIGNING_TEST_SECRET_32_BYTES_MIN';const qaSecret='JAWAFA_INDEPENDENT_QA_SIGNING_TEST_SECRET_32_BYTES';
test.before(async()=>{
  const fixture={
    schema:'jawafa.audit15-agents.v1',classification:'PRIVATE_EVIDENCE_METADATA_ONLY_NO_BUSINESS_ROWS',
    host:'JAWAFFASVR',database:'Jawafa_DB',checkedUtc:new Date().toISOString(),
    schemaCatalog:{tableCount:1024,declaredRelations:38},
    audit15:{tables:Array.from({length:15},(_,i)=>({table:'Test_'+i,referenceRows:10,exportRows:15,
      laterMinusReference:5,historicalValueDifferenceCandidates:0,priorAuditLatestMode:'FULL',declaredForeignKeyCount:0})),
      transferGuardStatus:'TRANSFER_VERIFIED_15_OF_15',verifiedTransferFiles:15,verifiedRoundtrips:15,
      previousVerifiedFull:7,previousVerifiedDelta:8},
    existingAgents:{agents:[{name:'JawafaExportAgent20Min',category:'data_pipeline',lastSchedulerResult:0,schedulerState:'Ready'}]},
    historicalKeyedAnalysis:{
      keyedComparisonSourceSha256:'a'.repeat(64),
      keyedTables:Array.from({length:6},(_,i)=>({
        table:'Test_'+i,referenceRows:10,laterComparisonRows:12,
        sharedKeys:10,addedKeys:2,missingKeysFromLater:0,changedSharedRecords:i,
        triagePriority:i<3?'P0_FORENSIC_REVIEW':'P1_FORENSIC_REVIEW',
        changedFieldCounts:[{name:'post',occurrences:i}],
        sample_keys_private:[{key:'NEVER_LEAK'}]
      })),
      postingCorrelation:{sourceSha256:'b'.repeat(64),candidatePostingChanges:126,matchedHistoryEvents:126,unmatchedJournalIds:0},
      transactionHistoryContinuity:{sourceSha256:'c'.repeat(64),baselineRows:1065770,newHistoryIds:4027,
        overlapWithBaseline:419,newIdsContiguous:false,countReconciles:true}
    },
    export:{mode:'PARTIAL_REFERENCE_ONLY',totalTables:1024,processedTables:1023,remainingTables:1,failedTables:0,progressPercent:99.9,runName:'20261104-0100',referenceOnlyTableNames:['dbo.ItemSalesSummary'],coverageReconciled:true,coverageManifestSha256:'d'.repeat(64)}
  };
  fs.writeFileSync(path.join(dir,'audit15.json'),JSON.stringify(fixture));
  const schemaFixture={
    schema:'jawafa.private.schema.v1',observedAtUtc:new Date().toISOString(),businessRowsIncluded:false,
    tables:Array.from({length:1024},(_,i)=>({schema:'dbo',table:'Test_'+String(i).padStart(4,'0'),
      columns:[{name:'Id',sqlType:'int',nullable:'NO',position:1},{name:'TransNo',sqlType:'bigint',nullable:'YES',position:2}]})),
    foreignKeys:Array.from({length:38},(_,i)=>({
      fromSchema:'dbo',fromTable:'Test_'+String(i).padStart(4,'0'),fromColumn:'Id',
      toSchema:'dbo',toTable:'Test_'+String(i+1).padStart(4,'0'),toColumn:'Id'
    }))
  };
  fs.writeFileSync(path.join(dir,'schema-catalog.json'),JSON.stringify(schemaFixture));
  app=createBridge({databaseFile:path.join(dir,'operational.db'),audit15File:path.join(dir,'audit15.json'),schemaCatalogFile:path.join(dir,'schema-catalog.json'),agentSecret:secret,qaSecret,allowedAgentIds:['worker-test'],verifyUser:async token=>{if(!token)throw Object.assign(Error('AUTH_REQUIRED'),{status:401});return token==='Bearer OWNER'?{uid:'owner-uid',role:'owner'}:{uid:'unauthorized',role:'viewer'}}});server=http.createServer(app.handler);await new Promise(ok=>server.listen(0,'127.0.0.1',ok));url='http://127.0.0.1:'+server.address().port});
test.after(async()=>{await new Promise(ok=>server.close(ok));app.close();fs.rmSync(dir,{recursive:true,force:true})});
const api=async(path,opts={})=>{const r=await fetch(url+path,{headers:{authorization:'Bearer OWNER',...opts.headers},method:opts.method||'GET',body:opts.body?JSON.stringify(opts.body):undefined});return {status:r.status,data:await r.json()}};
const signed=(method,path,body,nonce)=>{const txt=JSON.stringify(body),t=Date.now().toString();return {method,body:txt,headers:{'x-jawafa-agent':'worker-test','x-jawafa-timestamp':t,'x-jawafa-nonce':nonce,'x-jawafa-signature':crypto.createHmac('sha256',secret).update([method,path,codeHash(Buffer.from(txt)),t,nonce].join('\n')).digest('hex')}}};
const agent=async(path,body,nonce)=>{const p=signed('POST',path,body,nonce);if(body.status==='VERIFIED'&&body.evidence_ref&&body.evidence_sha256)p.headers['x-jawafa-qa-signature']=crypto.createHmac('sha256',qaSecret).update(['test-safe-001',body.evidence_ref,body.evidence_sha256,body.test_result].join(':')).digest('hex');const r=await fetch(url+path,p);return {status:r.status,data:await r.json()}};
const prefix='/api/jawafa/v1/';
test('No credentials -> 401, viewer -> 403',async()=>{let a=await api(prefix+'dashboard',{headers:{authorization:''}});assert.equal(a.status,401);a=await api(prefix+'dashboard',{headers:{authorization:'Bearer VIEWER'}});assert.equal(a.status,403)});
test('Seven contracted GET routes return provenance and gate blocking',async()=>{for(const part of ['dashboard','gates/15','backups','tasks','evidence']){const r=await api(prefix+part);assert.equal(r.status,200)}const x=(await api(prefix+'dashboard')).data;assert.equal(x.gate.status,'NOT ACCEPTED');assert.equal(x.live_sql,false);assert.equal(x.tasks.length,97);assert.equal(x.tasks.filter(t=>t.status==='COMPLETED').length,19);assert.equal(x.tasks.filter(t=>t.status==='IN PROGRESS').length,23);assert.equal(x.tasks.filter(t=>t.status==='BLOCKED'||t.status==='BLOCKED_BY_G15').length,55);assert.equal(x.tasks.filter(t=>/^F(0[1-9]|1[0-4])$/.test(t.task_id)).length,14);assert(x.tasks.filter(t=>/^F(0[1-9]|1[0-4])$/.test(t.task_id)).every(t=>t.status==='BLOCKED_BY_G15'));assert(x.tasks.every(t=>t.checked_at===null));assert.equal(x.backup_restore.daily_latest_accepted,false)});
test('F01 bank reconciliation never queues before accepted G15',async()=>{const r=await api(prefix+'commands',{method:'POST',body:{request_id:'blocked-F01-001',task_id:'F01',operation:'RECONCILE_BANK'}});assert.equal(r.status,202);assert.equal(r.data.status,'BLOCKED');assert.equal((await api(prefix+'commands/blocked-F01-001')).data.status,'BLOCKED')});
test('Queue, idempotency, signed ACK, RUNNING, verifiable receipt, replay refusal',async()=>{const body={request_id:'test-safe-001',task_id:'TASK-SAFE-001',operation:'CHECK_SERVER',params:{},source_version:'historical'};const q=await api(prefix+'commands',{method:'POST',body});assert.equal(q.status,202);assert.equal(q.data.status,'QUEUED');const again=await api(prefix+'commands',{method:'POST',body});assert.equal(again.status,200);assert.equal(again.data.idempotent,true);const changed=await api(prefix+'commands',{method:'POST',body:{...body,operation:'CHECK_DATABASE'}});assert.equal(changed.status,409);
const queue=prefix+'agent/queue';const signedGET=signed('GET',queue,{},'nonce-queue-001');signedGET.body=undefined;signedGET.headers['x-jawafa-signature']=crypto.createHmac('sha256',secret).update(['GET',queue,codeHash(Buffer.alloc(0)),signedGET.headers['x-jawafa-timestamp'],signedGET.headers['x-jawafa-nonce']].join('\n')).digest('hex');const qresponse=await fetch(url+queue,signedGET);assert.equal(qresponse.status,200);assert.equal((await qresponse.json()).commands.length,1);const claimpath=prefix+'commands/test-safe-001/claim';const claimbody={};const claim=await agent(claimpath,claimbody,'nonce-claim-001');assert.equal(claim.status,200);assert.equal(claim.data.status,'ACKNOWLEDGED');const replay=await agent(claimpath,claimbody,'nonce-claim-001');assert.equal(replay.status,409);
const events=prefix+'commands/test-safe-001/events';const premature=await agent(events,{status:'VERIFIED',action:'x',test_result:'PASS',evidence_ref:'evidence1',evidence_sha256:'a'.repeat(64)},'nonce-early-001');assert.equal(premature.status,409);
const run=await agent(events,{status:'RUNNING',action:'health-check-running'},'nonce-run-001');assert.equal(run.status,200);let invalid=await agent(events,{status:'VERIFIED',action:'health-check',test_result:'PASS'},'nonce-no-proof');assert.equal(invalid.status,422);
const done=await agent(events,{status:'VERIFIED',action:'test-pass',test_result:'PASS',evidence_ref:'SHA-EVIDENCE-001',evidence_sha256:'a'.repeat(64)},'nonce-done-001');assert.equal(done.status,200);assert.equal(done.data.status,'VERIFIED');const result=await api(prefix+'commands/test-safe-001');assert.equal(result.data.events.length,4);assert.equal(result.data.status,'VERIFIED');assert.equal((await api(prefix+'evidence')).data.evidence.length,1)});

test('default Firebase verifier denies missing bearer before owner configuration check', async()=>{
  const {firebaseIdentity}=require('./server.cjs');
  const saved=process.env.JAWAFA_OWNER_UID;
  delete process.env.JAWAFA_OWNER_UID;
  try{
    await assert.rejects(
      ()=>firebaseIdentity(undefined,{ownerUid:''}),
      e=>e.status===401&&e.message==='AUTH_REQUIRED'
    );
    await assert.rejects(
      ()=>firebaseIdentity('Bearer invalid',{ownerUid:''}),
      e=>e.status===503&&e.message==='OWNER_UID_NOT_CONFIGURED'
    );
  }finally{
    if(saved===undefined)delete process.env.JAWAFA_OWNER_UID;
    else process.env.JAWAFA_OWNER_UID=saved;
  }
});

test('Private Audit15 endpoint verifies owner and excludes unsafe internal file paths',async()=>{
  const owner=await api(prefix+'audit15-ops');
  assert.equal(owner.status,200);
  assert.equal(owner.data.schema,'jawafa.audit15-agents.v1');
  assert.equal(owner.data.audit15.tables.length,15);
  assert.equal(owner.data.schemaCatalog.tableCount,1024);
  assert.equal(owner.data.existingAgents.agents[0].name,'JawafaExportAgent20Min');
  assert.equal(owner.data.audit15.historicalRootCauseVerified,false);
  assert.equal(owner.data.existingAgents.agents[0].aiModelEndpointVerified,false);
  assert.equal(owner.data.export.completenessAccepted,false);
  assert.equal(owner.data.export.referenceOnlyTableNames[0],'dbo.ItemSalesSummary');
  assert.equal(owner.data.export.coverageReconciled,true);
  assert.equal(owner.data.export.completenessAccepted,false);
  assert.equal(owner.data.historicalKeyedAnalysis.keyedTables.length,6);
  assert.equal(owner.data.historicalKeyedAnalysis.keyedTables[0].triagePriority,'P0_FORENSIC_REVIEW');
  assert.equal(owner.data.historicalKeyedAnalysis.keyedTables[0].changedFieldCounts[0].name,'post');
  assert.equal(owner.data.historicalKeyedAnalysis.postingCorrelation.matchedHistoryEvents,126);
  assert.equal(owner.data.historicalKeyedAnalysis.postingCorrelation.humanIdentityVerified,false);
  assert.equal(owner.data.historicalKeyedAnalysis.transactionHistoryContinuity.newIdsContiguous,false);
  assert.ok(!JSON.stringify(owner.data).includes('NEVER_LEAK'));
  assert.ok(!Object.hasOwn(owner.data,'sourceFiles'));
  const noAuth=await api(prefix+'audit15-ops',{headers:{authorization:''}});
  assert.equal(noAuth.status,401);
  const viewer=await api(prefix+'audit15-ops',{headers:{authorization:'Bearer VIEWER'}});
  assert.equal(viewer.status,403);
});

test('Owner-only paginated schema index has 1024 tables, 38 FKs and no SQL values',async()=>{
  const first=await api(prefix+'schema-catalog?offset=0&limit=50');
  assert.equal(first.status,200);
  assert.equal(first.data.schema,'jawafa.schema.catalog.page.v1');
  assert.equal(first.data.totalTables,1024);
  assert.equal(first.data.totalForeignKeys,38);
  assert.equal(first.data.rows.length,50);
  assert.equal(first.data.rows[0].columns[0].name,'Id');
  assert.ok(first.data.relationships.length>0);
  assert.ok(!Object.hasOwn(first.data,'databasePassword'));
  const last=await api(prefix+'schema-catalog?offset=1000&limit=50');
  assert.equal(last.status,200);
  assert.equal(last.data.rows.length,24);
  const filtered=await api(prefix+'schema-catalog?name=Test_0012');
  assert.equal(filtered.status,200);
  assert.equal(filtered.data.matchingTables,1);
  assert.equal(filtered.data.rows[0].name,'Test_0012');
  const denied=await api(prefix+'schema-catalog',{headers:{authorization:''}});
  assert.equal(denied.status,401);
  const viewer=await api(prefix+'schema-catalog',{headers:{authorization:'Bearer VIEWER'}});
  assert.equal(viewer.status,403);
  const invalid=await api(prefix+'schema-catalog?limit=501');
  assert.equal(invalid.status,422);
});

test('Private SQL-free metadata sidecar rejects unauthenticated callers and serves only owner-approved aggregates',async()=>{
  const handler=createSidecar({
    audit15File:path.join(dir,'audit15.json'),
    schemaCatalogFile:path.join(dir,'schema-catalog.json'),
    verifyOwner:async bearer=>bearer==='Bearer owner.test.signature'?{status:200}:{status:403,error:'OWNER_AUTH_REJECTED'}
  });
  const service=http.createServer(handler);
  await new Promise(ok=>service.listen(0,'127.0.0.1',ok));
  const base='http://127.0.0.1:'+service.address().port+'/api/jawafa/v1/';
  try{
    let response=await fetch(base+'audit15-ops');
    assert.equal(response.status,401);
    response=await fetch(base+'audit15-ops',{headers:{Authorization:'Bearer other.test.signature'}});
    assert.equal(response.status,403);
    response=await fetch(base+'audit15-ops',{headers:{Authorization:'Bearer owner.test.signature'}});
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'no-store, max-age=0');
    assert.equal(response.headers.get('access-control-allow-origin'),null);
    const data=await response.json();
    assert.equal(data.audit15.tables.length,15);
    assert.equal(data.historicalKeyedAnalysis.keyedTables.length,6);
    assert.equal(data.historicalKeyedAnalysis.postingCorrelation.humanIdentityVerified,false);
    assert.equal(data.export.completenessAccepted,false);
    assert.ok(!Object.hasOwn(data,'sourceFiles'));
    response=await fetch(base+'schema-catalog?offset=1000&limit=50',{headers:{Authorization:'Bearer owner.test.signature'}});
    assert.equal(response.status,200);
    assert.equal((await response.json()).rows.length,24);
    response=await fetch(base+'audit15-ops',{method:'POST',headers:{Authorization:'Bearer owner.test.signature'}});
    assert.equal(response.status,405);
    response=await fetch(base+'unknown',{headers:{Authorization:'Bearer owner.test.signature'}});
    assert.equal(response.status,404);
  }finally{
    await new Promise(ok=>service.close(ok));
  }
});

test('Live SQL metadata proof is owner-only and never returns original TransactionHistory values',async()=>{
  let called=0;
  const handler=createSidecar({
    audit15File:path.join(dir,'audit15.json'),
    schemaCatalogFile:path.join(dir,'schema-catalog.json'),
    verifyOwner:async b=>b==='Bearer owner.test.signature'?{status:200}:{status:403,error:'OWNER_AUTH_REJECTED'},
    readLiveSchema:async()=>{
      called++;
      return {
        schema:'jawafa.private.live-schema-proof.v1',
        classification:'OWNER_ONLY_SCHEMA_METADATA_NO_BUSINESS_ROWS',
        schemaTableCount:1024,declaredSqlForeignKeys:38,
        transactionHistoryBoundedSampleRead:true,sampleRowValuesReturned:false,
        observedAtUtc:new Date().toISOString(),
        databasePrincipalLeastPrivilegeVerified:false,
        financialRowsExposed:false
      };
    }
  });
  const service=http.createServer(handler);
  await new Promise(ok=>service.listen(0,'127.0.0.1',ok));
  const url='http://127.0.0.1:'+service.address().port+'/api/jawafa/v1/live-schema-proof';
  try{
    let res=await fetch(url);
    assert.equal(res.status,401);
    assert.equal(called,0,'unauthorized calls do not query local bridge');
    res=await fetch(url,{headers:{Authorization:'Bearer viewer.test.signature'}});
    assert.equal(res.status,403);
    assert.equal(called,0);
    res=await fetch(url,{headers:{Authorization:'Bearer owner.test.signature'}});
    assert.equal(res.status,200);
    assert.equal(called,1);
    assert.equal(res.headers.get('access-control-allow-origin'),null);
    const result=await res.json();
    assert.equal(result.schemaTableCount,1024);
    assert.equal(result.transactionHistoryBoundedSampleRead,true);
    assert.equal(result.financialRowsExposed,false);
    assert.equal(result.databasePrincipalLeastPrivilegeVerified,false);
    assert.ok(!JSON.stringify(result).includes('AccountName'));
    res=await fetch(url,{method:'POST',headers:{Authorization:'Bearer owner.test.signature'}});
    assert.equal(res.status,405);
  }finally{await new Promise(ok=>service.close(ok));}
});
