'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {staticFiles,launch}=require('./private-staging.cjs');
test('private dashboard static files allowed only inside supplied view root',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'audit111-ui-fixture-'));
 const html='<html><head><title>Central Jawafa QA</title></head><body>Native audit</body></html>';
 fs.writeFileSync(path.join(dir,'index.html'),html);
 fs.writeFileSync(path.join(dir,'audit111-ui.mjs'),'export const fake=1;');
 const srv=http.createServer(staticFiles(dir));
 await new Promise(done=>srv.listen(0,'127.0.0.1',done));
 const root='http://127.0.0.1:'+srv.address().port;
 try{
  const ok=await fetch(root+'/');
  assert.equal(ok.status,200);assert.equal(await ok.text(),html);
  assert.equal(ok.headers.get('x-frame-options'),'DENY');
  assert.match(ok.headers.get('cache-control'),'no-store');
  assert.equal((await fetch(root+'/audit111-ui.mjs')).status,200);
  assert.equal((await fetch(root+'/package.json')).status,404);
  assert.equal((await fetch(root+'/missing.html')).status,404);
  assert.equal((await fetch(root+'/.env')).status,404);
  assert.equal((await fetch(root+'/../owner-pin.json')).status,404);
 }finally{await new Promise(done=>srv.close(done));fs.rmSync(dir,{force:true,recursive:true})}
});
test('staging server cannot be started without explicit private authorization and paths',()=>{
 assert.throws(()=>launch({allowed:false}),/STAGING_RELEASE_NOT_AUTHORIZED/);
 assert.throws(()=>launch({allowed:true}),/STAGING_PRIVATE_CONFIG_MISSING/);
});
