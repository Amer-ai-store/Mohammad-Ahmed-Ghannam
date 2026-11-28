"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const root=path.join(__dirname,"..");
const index=fs.readFileSync(path.join(root,"index.html"),"utf8");
const standalone=fs.readFileSync(path.join(root,"trustsoft/index.html"),"utf8");
const client=fs.readFileSync(path.join(root,"trustsoft/app.js"),"utf8");
const host=fs.readFileSync(path.join(root,"trustsoft/host-integration.js"),"utf8");
const analytics=fs.readFileSync(path.join(root,"trustsoft/analytics.js"),"utf8");
const registry=JSON.parse(fs.readFileSync(path.join(root,"trustsoft/archive-registry.json"),"utf8"));
test("full native client compiles and exposes one shared standalone + central implementation",()=>{
 for(const source of [client,host,analytics])assert.doesNotThrow(()=>new vm.Script(source));
 assert.match(client,/TrustSoftEmbedded/);
 assert.match(client,/initializeTrustSoft\(globalThis.document\)/);
 assert.match(host,/container\.shadowRoot\|\|container\.attachShadow/);
 assert.match(host,/shadow\.replaceChildren\(css,overrides,shell\)/);
 assert.match(host,/container\.hidden\|\|section\.hidden/);
 assert.match(client,/expectedGeneration!==portalGeneration/);
 assert.match(client,/acceptPortalLogin\(r,loginGeneration\)/);
 assert.match(host,/TrustSoftEmbedded\.mount/);
 assert.ok(!host.includes("createElement('iframe')") && !host.includes("frame.src"));
 assert.ok(!index.includes('id="trustsoft-frame"'));
 assert.ok(index.includes('<script src="./trustsoft/app.js" defer></script>'));
 assert.ok(index.includes('<script src="./trustsoft/analytics.js" defer></script>'));
});
test("all 12 native TrustSoft views remain present in the shared implementation",()=>{
 for(const name of ["overview","control","sales","purchases","accounting","checks","inventory","users","operations","financial","investigation","schema"]){
  assert.ok(client.includes(name+":'")||client.includes(name+":\""),"missing "+name);
  assert.ok(registry.views.some(v=>v.view===name));
 }
 assert.ok(standalone.includes('id="workspace"'));
 assert.ok(standalone.includes('id="insights"'));
});
test("secrets stay out of browser storage and archives; no unverified totals",()=>{
 assert.ok(!/localStorage|sessionStorage|indexedDB/.test(client));
 assert.ok(!/SQLPassword|sa_password|FIREBASE_PRIVATE_KEY/.test(registry.manifestFields.join(",")));
 assert.equal(registry.storage.firestore.connected,false);
 assert.equal(registry.enforce.noProductionSqlWrites,true);
 assert.equal(registry.enforce.neverStorePasswordsInDrive,true);
 assert.ok(analytics.includes("financialTotalsAllowed:false"));
 assert.ok(analytics.includes("aiProviderActive:false"));
});
test("analytic rule engine flags missing or stale data and recognizes bounded sample",()=>{
 const ctx={globalThis:{}};vm.runInNewContext(analytics,ctx);
 const calc=ctx.globalThis.TrustSoftInsights.analyze;
 const no=calc(null);assert.equal(no.evidence,"UNVERIFIED_OR_STALE");
 assert.equal(calc({state:"connected",stale:false}).evidence,"UNVERIFIED_OR_STALE");
 assert.equal(calc({state:"connected",stale:false,data:{catalog:[],sections:{}}}).evidence,"UNVERIFIED_OR_STALE");
 assert.equal(calc({state:"connected",stale:false,data:{catalog:[],sections:{checks:{state:"unverified",rows:[]}}}}).evidence,"UNVERIFIED_OR_STALE");
 const ready=calc({state:"connected",stale:false,data:{catalog:[{}],sections:{checks:{state:"sample",rows:[{},{}]}}}});
 assert.equal(ready.evidence,"AUTHENTICATED_SAMPLE_ONLY");
 assert.equal(ready.sampleRowCount,2);assert.equal(ready.tableCatalogCount,1);
 assert.equal(ready.financialTotalsAllowed,false);
});

// Regression: native TrustSoft must offer least-privilege viewer login without blocking owner admin login.
test("native TrustSoft supports explicit viewer and owner roles",()=>{
 assert.match(standalone, /id="login-role"/);
 assert.match(standalone, /value="admin"/);
 assert.match(standalone, /value="viewer"/);
 assert.match(client, /loginAsAdmin\?\x27\/api\/admin\/login\x27:\x27\/api\/login\x27/);
 assert.match(client, /portalAdmin:\x27false\x27,defaultSection:\x27overview\x27/);
 assert.match(client, /roleSelect\.value=\x27viewer\x27/);
 assert.match(client, /loginTokenLabel\.textContent/);
});

test("runtime routes viewer and owner logins separately; incomplete snapshots never claim live SQL",async()=>{
 const items=new Map(),calls=[];
 function node(){return {dataset:{},hidden:false,disabled:false,checked:false,value:'',textContent:'',append(){},replaceChildren(){},setAttribute(){},addEventListener(){}};}
 const doc={
  body:{dataset:{apiOrigin:'https://trustsoft-control.zxzx-mohammad91.workers.dev',portalAdmin:'false',defaultSection:'overview'}},
  getElementById(id){if(!items.has(id))items.set(id,node());return items.get(id);},
  querySelectorAll(){return [];},createElement(){return node();},addEventListener(){}
 };
 doc.getElementById('login-role').value='viewer';
 const sandbox={document:doc,location:{origin:'https://amer-ai-store.github.io',protocol:'https:'},
  addEventListener(){},setTimeout,clearTimeout,
  async fetch(url,opts={}){
   const p=new URL(url).pathname;
   calls.push({path:p,authorization:opts.headers?.Authorization||''});
   let body={error:'unauthorized'},code=401;
   if(p==='/api/login'||p==='/api/admin/login'){body={session:'s'.repeat(36)};code=200;}
   if(p==='/api/snapshot'&&opts.headers?.Authorization){
    code=200;body={state:'connected',stale:false,data:{sections:{checks:{state:'unverified',rows:[]}}},events:[]};
   }
   return {status:code,ok:code<400,json:async()=>body};
  }
 };
 sandbox.globalThis=sandbox;
 vm.runInNewContext(analytics,sandbox);
 vm.runInNewContext(client,sandbox);
 await new Promise(setImmediate);
 doc.getElementById('token').value='viewer-test-key';
 await doc.getElementById('login').onsubmit({preventDefault(){}});
 assert.ok(calls.some(x=>x.path==='/api/login'),'viewer must use read-only login');
 assert.ok(!calls.some(x=>x.path==='/api/admin/login'),'viewer must not escalate');
 assert.equal(doc.getElementById('workspace').hidden,false,'authenticated snapshot should mount');
 assert.equal(doc.getElementById('status').dataset.ok,'false','incomplete SQL sample is not verified');
 doc.getElementById('login-role').value='admin';
 doc.getElementById('token').value='owner-test-key';
 await doc.getElementById('login').onsubmit({preventDefault(){}});
 assert.ok(calls.some(x=>x.path==='/api/admin/login'),'owner must use distinct admin route');
 doc.getElementById('portal-exit').onclick();
 assert.equal(doc.getElementById('workspace').hidden,true,'logout clears workspace');
});
