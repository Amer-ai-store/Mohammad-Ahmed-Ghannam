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
