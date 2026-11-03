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
  vm.runInContext(fs.readFileSync(path.join(root,'directory-ui.js'),'utf8'),ctx,{filename:'directory-ui.js'});
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
  assert.ok(html.indexOf('./catalog.js')<html.indexOf('./directory-ui.js'));
  assert.ok(html.indexOf('./directory-ui.js')<html.indexOf('./app.js'));
  assert.ok(app.includes('TrustSoftDirectoryUI.render'));
  assert.ok(!/\b(fetch|XMLHttpRequest)\s*\(/.test(dir));
  assert.ok(!/\b(INSERT|UPDATE|DELETE)\s+(INTO|FROM|dbo\.)/i.test(dir));
});
