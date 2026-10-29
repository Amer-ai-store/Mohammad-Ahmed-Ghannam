"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto"),http=require("node:http"),os=require("node:os"),path=require("node:path"),fs=require("node:fs");
const {firebaseIdentity,createBridge}=require("./server.cjs");
const keypair=crypto.generateKeyPairSync("rsa",{modulusLength:2048});
const jwk={...keypair.publicKey.export({format:"jwk"}),kid:"test-jwk",use:"sig",alg:"RS256"};
const ownerEmail="owner-unit-test@example.org";
const now=()=>Math.floor(Date.now()/1000);
function signedEmailJWT(override={}){
 const h=Buffer.from(JSON.stringify({alg:"RS256",kid:"test-jwk",typ:"JWT"})).toString("base64url");
 const claims={aud:"ameraistore-1c81d",iss:"https://securetoken.google.com/ameraistore-1c81d",sub:"uid-owner-email-case",email:ownerEmail,email_verified:true,exp:now()+3600,iat:now()-60,auth_time:now()-120,...override};
 const p=Buffer.from(JSON.stringify(claims)).toString("base64url");
 const sig=crypto.sign("RSA-SHA256",Buffer.from(h+"."+p),keypair.privateKey).toString("base64url");
 return "Bearer "+h+"."+p+"."+sig;
}
const verifyFetch=async()=>({ok:true,json:async()=>({keys:[jwk]})});
const options={ownerEmail,fetchImpl:verifyFetch};
test("read-only owner email is authenticated by Firebase signature, issuer and audience",async()=>{
 const user=await firebaseIdentity(signedEmailJWT(),options);
 assert.equal(user.role,"owner_readonly");
 assert.equal(user.uid,"uid-owner-email-case");
});
test("untrusted email, expired, unverified or wrong aud tokens are rejected",async()=>{
 for(const payload of [{email:"someone-else@example.org"},{exp:now()-1},{email_verified:false},{aud:"another-project"}]){
   await assert.rejects(firebaseIdentity(signedEmailJWT(payload),options),e=>e.status===403||e.status===401);
 }
 const altered=signedEmailJWT().split(".");
 altered[1]=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(altered[1],"base64url")),email:"attacker@example.org"})).toString("base64url");
 await assert.rejects(firebaseIdentity(altered.join("."),options),e=>e.status===401);
});
test("owner UID remains necessary for command writes",async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"jawafa-ro-"));
 const service=createBridge({
  databaseFile:path.join(root,"ledger.db"),
  verifyUser:auth=>firebaseIdentity(auth,options)
 });
 const server=http.createServer(service.handler);
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 const base="http://127.0.0.1:"+server.address().port+"/api/jawafa/v1/";
 try{
  const token=signedEmailJWT();
  const get=await fetch(base+"dashboard",{headers:{Authorization:token}});
  assert.equal(get.status,200);
  const json=await get.json();
  assert.equal(json.gate.status,"NOT ACCEPTED");
  assert.equal(json.live_sql,false);
  assert.equal(json.tasks.length,97);
  const post=await fetch(base+"commands",{method:"POST",headers:{"Authorization":token,"Content-Type":"application/json"},body:JSON.stringify({request_id:"safe-preview-check-001",task_id:"JAWAFA-CHECK",operation:"CHECK_SERVER"})});
  assert.equal(post.status,403);
  assert.equal((await post.json()).error,"READ_ONLY_SESSION");
  const missing=await fetch(base+"dashboard");
  assert.equal(missing.status,401);
  const bad=await fetch(base+"dashboard",{headers:{Authorization:signedEmailJWT({email:"other@example.org"})}});
  assert.equal(bad.status,403);
 }finally{await new Promise(ok=>server.close(ok));service.close();fs.rmSync(root,{recursive:true,force:true})}
});
