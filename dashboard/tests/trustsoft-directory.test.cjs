'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..','trustsoft');
function fakeNode(tag){
  return {tagName:String(tag).toUpperCase(),textContent:'',children:[],attrs:{},listeners:{},
    className:'',value:'',dataset:{},
    setAttribute(k,v){this.attrs[k]=String(v);},
    addEventListener(k,cb){this.listeners[k]=cb;},
    append(...items){this.children.push(...items);},
    replaceChildren(...items){this.children=[...items];}
  };
}
function load(){
  const ctx={document:{createElement:fakeNode},console};
  ctx.globalThis=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root,'catalog.js'),'utf8'),ctx,{filename:'catalog.js'});
  vm.runInContext(fs.readFileSync(path.join(root,'workflow-evidence.js'),'utf8'),ctx,{filename:'workflow-evidence.js'});
  vm.runInContext(fs.readFileSync(path.join(root,'directory-ui.js'),'utf8'),ctx,{filename:'directory-ui.js'});
  vm.runInContext(fs.readFileSync(path.join(root,'operations-ui.js'),'utf8'),ctx,{filename:'operations-ui.js'});
  return ctx;
}
function flatten(node){return [node,...(node.children||[]).flatMap(flatten)];}
test('all modules remain a read-only registry, accounting has exactly nine tabs',()=>{
  const {TrustSoftCatalog:lib}=load();
  for(const group of ['accounting','purchases','sales','inventory','employees','definitions','users','checks'])
    assert.ok(lib.spec[group],group);
  assert.equal(lib.tabsFor('accounting').length,9);
  assert.equal(lib.documentStages.map(x=>x.label).join(' > '),'طباعة غير مرحّل > مدقّق > مرحّل');
  assert.equal(lib.spec.accounting.tabs.at(-1)[1].includes('المدير المالي'),true);
});
test('catalog supports live metadata keys and does not duplicate names',()=>{
  const {TrustSoftCatalog:lib}=load();
  const rows=lib.normalizeCatalog([{TABLE_SCHEMA:'dbo',TABLE_NAME:'Journal_GL',COLUMN_COUNT:20},{TABLE_SCHEMA:'dbo',TABLE_NAME:'Journal_GL'},{schema_name:'dbo',object_name:'CheqMovement'}]);
  assert.equal(rows.length,2);
  assert.equal(lib.tablesFor(rows,lib.tabsFor('accounting')[0]).length,1);
  assert.equal(lib.tablesFor(rows,lib.tabsFor('accounting')[2]).length,1);
});
test('workflow stage cannot be inferred from a column or untrusted data',()=>{
  const {TrustSoftCatalog:lib}=load();
  assert.equal(lib.verifiedStage({post:1,Approved:1,Confirmed:1},null),null);
  assert.equal(lib.verifiedStage({post:1},{stage:'posted',validatedByServer:false,evidenceId:'abc',sourceTime:'x',documentId:'1'}),null);
  assert.equal(lib.verifiedStage({post:1},{stage:'posted',validatedByServer:true,evidenceId:'',sourceTime:'x',documentId:'1'}),null);
});
test('directory renders nine accounting tabs and source-limited rows without fabricating reports',()=>{
  const ctx=load(),host=fakeNode('div');
  const catalog=[{TABLE_SCHEMA:'dbo',TABLE_NAME:'Journal_GL',COLUMN_COUNT:34},{TABLE_SCHEMA:'dbo',TABLE_NAME:'Receipt',COLUMN_COUNT:70}];
  ctx.TrustSoftDirectoryUI.render({
    group:'accounting',host,
    snapshot:{state:'connected',stale:false,last_success:1783200000,data:{catalog,relations:[],sections:{accounting:{state:'sample',scope:'محدود',rows:[{مستند:'مستند اختبار'}]}}}},
    tableRenderer:rows=>{const node=fakeNode('table');node.textContent=JSON.stringify(rows);return node;}
  });
  const elements=flatten(host);
  const tabs=elements.filter(x=>x.attrs?.role==='tab');
  assert.equal(tabs.length,9);
  assert.ok(elements.some(x=>x.textContent.includes('طباعة غير مرحّل')));
  assert.ok(elements.some(x=>x.textContent.includes('المخرجات الحالية من TrustSoft')));
  assert.ok(elements.some(x=>x.textContent.includes('عينة فقط')));
  assert.ok(elements.some(x=>x.textContent.includes('الحقول')||x.textContent.includes('حقول حالة')));
});
test('static entrypoint loads safe modules before app; no new API or SQL writes',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  const dir=fs.readFileSync(path.join(root,'directory-ui.js'),'utf8');
  assert.ok(html.indexOf('./catalog.js')<html.indexOf('./workflow-evidence.js'));
  assert.ok(html.indexOf('./workflow-evidence.js')<html.indexOf('./directory-ui.js'));
  assert.ok(html.indexOf('./directory-ui.js')<html.indexOf('./app.js'));
  assert.ok(app.includes('TrustSoftDirectoryUI.render'));
  assert.ok(!/\b(fetch|XMLHttpRequest)\s*\(/.test(dir));
  assert.ok(!/\b(INSERT|UPDATE|DELETE)\s+(INTO|FROM|dbo\.)/i.test(dir));
});

test('complete visible catalog includes unmatched tables without inventing 1024 records',()=>{
  const lib=load().TrustSoftCatalog;
  const rows=lib.normalizeCatalog([{TABLE_NAME:'Journal_GL',TABLE_SCHEMA:'dbo'},{TABLE_NAME:'Unexpected_Table_XY',TABLE_SCHEMA:'dbo'},{TABLE_NAME:'CheqMovement',TABLE_SCHEMA:'dbo'}]);
  assert.equal(lib.tablesFor(rows,lib.tabsFor('catalog')[0]).length,3);
  const excluded=lib.tablesFor(rows,lib.tabsFor('catalog')[1]);
  assert.equal(excluded.length,1);
  assert.equal(excluded[0].name,'Unexpected_Table_XY');
});
test('document trace includes observed fields only and marks links unverified',()=>{
  const ctx=load();
  const rows=ctx.TrustSoftCatalog.normalizeCatalog([{TABLE_SCHEMA:'dbo',TABLE_NAME:'Receipt'},{TABLE_SCHEMA:'dbo',TABLE_NAME:'PurchasePostTrans'}]);
  const evidence=ctx.TrustSoftWorkflowEvidence.inspect({group:'purchases',catalog:rows});
  assert.ok(evidence.tableRows.some(row=>row['الجدول']==='Receipt'&&row['المصدر_في_جلسة_API']==='ظاهر'));
  assert.ok(evidence.candidates.some(row=>row['الحالة'].includes('لم تثبت')));
  assert.ok(evidence.tableRows.every(row=>row['حالة_الربط'].includes('غير مثبتة')));
  assert.equal(ctx.TrustSoftWorkflowEvidence.tables.Receipt.fields.includes('PostToAcc'),true);
});
test('unclassified data rows never become verified reports without a real source',()=>{
  const ctx=load(),host=fakeNode('div');
  ctx.TrustSoftDirectoryUI.render({group:'catalog',host,
    snapshot:{state:'connected',stale:false,last_success:1783200000,data:{catalog:[{schema_name:'dbo',object_name:'Unexpected_Table_XY'}],relations:[],sections:{}}},
    tableRenderer:rows=>{const n=fakeNode('table');n.textContent=JSON.stringify(rows);return n;}
  });
  const all=flatten(host);
  assert.ok(all.some(x=>x.textContent.includes('غير مصنفة: 1')));
  assert.ok(all.some(x=>x.textContent.includes('1024')));
  assert.ok(all.some(x=>x.textContent.includes('Unexpected_Table_XY')));
});

test('posting stage visualization applies to sales, purchases, stock movements and cheques',()=>{
 const ctx=load();
 for(const group of ['purchases','sales','inventory','checks']){
   const host=fakeNode('div');
   ctx.TrustSoftDirectoryUI.render({group,host,
     snapshot:{state:'disconnected',stale:true,data:{catalog:[],relations:[],sections:{}}},
     tableRenderer:rows=>{const node=fakeNode('table');node.textContent=JSON.stringify(rows);return node;}
   });
   const all=flatten(host);
   assert.ok(all.some(x=>x.textContent==='طباعة غير مرحّل'),group);
   assert.ok(all.some(x=>x.textContent==='مدقّق'),group);
   assert.ok(all.some(x=>x.textContent==='مرحّل'),group);
   assert.ok(all.some(x=>x.textContent.includes('لا تتيح هذه الشاشة ترحيلًا')),group);
 }
});

test('Audit15 panels reject unsourced and stale financial history',()=>{
  const ctx=load(),host=fakeNode('div');
  const sample={schema:'jawafa.audit15-agents.v1',
    classification:'PRIVATE_EVIDENCE_METADATA_ONLY_NO_BUSINESS_ROWS',
    host:'JAWAFFASVR',database:'Jawafa_DB',
    audit15:{tables:Array.from({length:15},(_,i)=>({table:'Test'+i,referenceRows:10,exportRows:10,laterMinusReference:0}))},
    existingAgents:{agents:[]}};
  const renderer=rows=>{const node=fakeNode('table');node.textContent=JSON.stringify(rows);return node;};
  ctx.TrustSoftOperationsUI.render({group:'audit15',host,tableRenderer:renderer,
    snapshot:{state:'connected',stale:true,data:{audit15_ops:sample}}});
  let nodes=flatten(host);
  assert.ok(nodes.some(x=>x.textContent.includes('BLOCKED')));
  assert.ok(!nodes.some(x=>x.textContent.includes('Test14')));
  ctx.TrustSoftOperationsUI.render({group:'audit15',host,tableRenderer:renderer,
    snapshot:{state:'connected',stale:false,data:{audit15_ops:{...sample,classification:'PUBLIC',audit15:{tables:[]}}}}});
  nodes=flatten(host);
  assert.ok(nodes.some(x=>x.textContent.includes('BLOCKED')));
});
test('genuine authenticated Audit15 metadata can render 15 rows and agent tasks',()=>{
  const ctx=load(),host=fakeNode('div');
  const status={schema:'jawafa.audit15-agents.v1',classification:'PRIVATE_EVIDENCE_METADATA_ONLY_NO_BUSINESS_ROWS',
    host:'JAWAFFASVR',database:'Jawafa_DB',checkedUtc:'2026-11-04T00:00:00Z',
    audit15:{tables:Array.from({length:15},(_,i)=>({table:'Test'+i,referenceRows:9,exportRows:10,laterMinusReference:1,
      historicalValueDifferenceCandidates:0,priorAuditLatestMode:'FULL',declaredForeignKeyCount:0})),
      transferGuardStatus:'TRANSFER_VERIFIED_15_OF_15',verifiedTransferFiles:15,verifiedRoundtrips:15,historicalRootCauseVerified:false},
    existingAgents:{agents:[{name:'JawafaExportAgent20Min',category:'data_pipeline',
      schedulerState:'Ready',lastSchedulerResult:0,lastRunLocal:'2026-11-04T02:30:30',aiModelEndpointVerified:false}]},
    export:{mode:'PARTIAL_REFERENCE_ONLY',processedTables:1023,totalTables:1024,remainingTables:1,failedTables:0,progressPercent:99.9}};
  const snapshot={state:'connected',stale:false,data:{audit15_ops:status}};
  const renderer=rows=>{const node=fakeNode('table');node.textContent=JSON.stringify(rows);return node;};
  assert.ok(ctx.TrustSoftOperationsUI.trusted(snapshot));
  ctx.TrustSoftOperationsUI.render({group:'audit15',host,snapshot,tableRenderer:renderer});
  let nodes=flatten(host);
  assert.ok(nodes.some(x=>x.textContent.includes('Test14')));
  assert.ok(nodes.some(x=>x.textContent.includes('غير محسوم')));
  ctx.TrustSoftOperationsUI.render({group:'agents',host,snapshot,tableRenderer:renderer});
  nodes=flatten(host);
  assert.ok(nodes.some(x=>x.textContent.includes('JawafaExportAgent20Min')));
  assert.ok(nodes.some(x=>x.textContent.includes('غير مثبت')));
  assert.ok(nodes.some(x=>x.textContent.includes('PARTIAL_REFERENCE_ONLY')));
});
test('operations UI is passive and available before app startup',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  const ops=fs.readFileSync(path.join(root,'operations-ui.js'),'utf8');
  assert.ok(html.indexOf('./operations-ui.js')<html.indexOf('./app.js'));
  assert.ok(app.includes("selected==='audit15'||selected==='agents'"));
  assert.ok(!/\b(fetch|XMLHttpRequest|WebSocket)\s*\(/.test(ops));
  assert.ok(!/\b(INSERT|UPDATE|DELETE)\s+(INTO|FROM|dbo\.)/i.test(ops));
});
