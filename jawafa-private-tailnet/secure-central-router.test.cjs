'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {createRouter,normalizeHealth,fixedStaticTarget,requireBearer}=require('./secure-central-router.cjs');
const good=()=>({ok:true,login:'user_read',database:'Jawafa_DB',reader:1,writer:0,
 mode:'READ_ONLY_LOCAL',tls_status:'LOCAL_ENCRYPTED_CERT_CHAIN_NOT_VERIFIED'});
function request(server,path,{method='GET',headers={}}={}){
 const address=server.address();
 return new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port:address.port,path,method,headers},res=>{
   let text='';res.setEncoding('utf8');res.on('data',chunk=>text+=chunk);
   res.on('end',()=>resolve({status:res.statusCode,body:text,headers:res.headers}));
  });
  req.on('error',reject);req.end();
 });
}
async function serve(router,fn){
 const server=http.createServer((req,res)=>{if(!router(req,res)){res.writeHead(404);res.end()}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{await fn(server)}finally{await new Promise(resolve=>server.close(resolve))}
}
test('static mirror only from canonical approved central dashboard',()=>{
 const target=fixedStaticTarget('/central/index.html?rev=20261112');
 assert.equal(target.origin,'https://amer-ai-store.github.io');
 assert.equal(target.pathname,'/Mohammad-Ahmed-Ghannam/index.html');
 for(const path of ['/api/jawafa/v1/dashboard','/central/../../private.js','/central/%2fexample.js',
  '/central/https://example.org/hijack.js','/central/evil.php','/central/%5cattack.js'])
   assert.equal(fixedStaticTarget(path),null,path);
});
test('no public or anonymous bearer accepted for private DB status',()=>{
 assert.throws(()=>requireBearer({headers:{}}),e=>e.status===401);
 assert.throws(()=>requireBearer({headers:{authorization:'Bearer invalid'}}),e=>e.status===401);
 assert.equal(requireBearer({headers:{authorization:'Bearer '+('x'.repeat(40))}}),'Bearer '+('x'.repeat(40)));
});
test('SQL health is explicitly partial and exports no financial records or credentials',()=>{
 const result=normalizeHealth(good());
 assert.equal(result.sql_login,'user_read');
 assert.equal(result.source_system,'Jawafa_DB');
 assert.equal(result.sql_read_proven,true);
 assert.equal(result.production_accepted,false);
 assert.equal(result.certificate_trusted,false);
 assert.equal(result.tls_status,'ENCRYPTED_UNTRUSTED_CERT');
 assert.equal(result.financial_records_returned,0);
 assert.equal(Object.hasOwn(result,'password'),false);
});
test('rejects wrong SQL login, write roles and unknown source mode',()=>{
 for(const change of [x=>x.login='sa',x=>x.writer=1,x=>x.reader=0,
  x=>x.database='master',x=>x.ok=false,x=>x.mode='READ_WRITE']){
  const data=good();change(data);
  assert.throws(()=>normalizeHealth(data),e=>e.status===503);
 }
});
test('unauthorized and invalid-auth requests do not reach local SQL',async()=>{
 let accesses=0;
 const router=createRouter({
  verifyOwner:async()=>{throw Object.assign(new Error('OWNER_AUTH_REJECTED'),{status:401})},
  fetchHealth:async()=>{accesses++;return good()},
 });
 await serve(router,async server=>{
  const a=await request(server,'/api/jawafa/v1/sql-health');
  assert.equal(a.status,401);
  const b=await request(server,'/api/jawafa/v1/sql-health',{headers:{authorization:'Bearer '+('a'.repeat(40))}});
  assert.equal(b.status,401);
  const c=await request(server,'/api/jawafa/v1/sql-health',{method:'POST'});
  assert.equal(c.status,405);
  assert.equal(accesses,0);
 });
});
test('authorized owner gets redacted SQL status only',async()=>{
 let accesses=0;
 const router=createRouter({
  verifyOwner:async()=>true,
  fetchHealth:async()=>{accesses++;return good()},
 });
 await serve(router,async server=>{
  const x=await request(server,'/api/jawafa/v1/sql-health',{headers:{authorization:'Bearer '+('b'.repeat(40))}});
  assert.equal(x.status,200);
  const doc=JSON.parse(x.body);
  assert.equal(doc.schema,'jawafa.sql-connectivity.v1');
  assert.equal(doc.production_accepted,false);
  assert.equal(doc.sql_read_proven,true);
  assert.equal(doc.financial_records_returned,0);
  assert.equal(accesses,1);
 });
});
test('approved static mirror never needs SQL or owner bearer',async()=>{
 let called=0;
 const router=createRouter({
  verifyOwner:async()=>{called++},
  fetchHealth:async()=>{called++},
  staticProxy:(_req,res,target)=>{
   assert.equal(target.hostname,'amer-ai-store.github.io');
   res.writeHead(200,{'content-type':'text/html'});res.end('STATIC_TEST_OK');
  }
 });
 await serve(router,async server=>{
  const x=await request(server,'/central/index.html');
  assert.equal(x.status,200);
  assert.equal(x.body,'STATIC_TEST_OK');
  assert.equal(called,0);
 });
});
