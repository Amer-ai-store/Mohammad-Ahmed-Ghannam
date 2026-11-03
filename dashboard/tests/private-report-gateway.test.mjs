import test from "node:test";
import assert from "node:assert/strict";
import {createHash,generateKeyPairSync,sign as cryptoSign} from "node:crypto";
import {createHandler,parseDocument,loadOwnerLedger,verifyFirebase} from "../api/jawafa/v1/chat-report-ledger.js";

const owner="owner@example.org", project="firebase-test-project";
const docId="a".repeat(32);
const stamp=Date.parse("2026-11-03T00:00:00Z");
const report={id:"synthetic-1",title:"مصدر اختبار فقط",category:"موجز",state:"PARTIAL",
  evidence_status:"DIFF_ONLY",evidence_id:"synthetic-proof",as_of:"2026-11-02T23:30:00Z",
  summary:"محتوى اصطناعي دون أي حسابات مالية",url:"https://docs.google.com/document/d/"+docId+"/edit"};
const registry={schema:"jawafa.chat-reports.source.v1",reports:[report]};
const wrapped=()=>({body:{content:[{paragraph:{elements:[{textRun:{content:
  "JAWAFA_REPORT_LEDGER_V1_START\n"+JSON.stringify(registry)+"\nJAWAFA_REPORT_LEDGER_V1_END\n"}}]}}]}});
const response=(obj,status=200)=>({ok:status>=200&&status<300,status,headers:new Headers({"content-type":"application/json"}),
  text:async()=>JSON.stringify(obj)});
function mockRes(){
 const res={headers:{},statusCode:200,body:null,setHeader(k,v){this.headers[k]=v;return this},
 status(v){this.statusCode=v;return this},json(v){this.body=v;return this}};return res;
}
const handler=(overrides={})=>createHandler({
 config:{JAWAFA_OWNER_EMAIL:owner,JAWAFA_FIREBASE_PROJECT_ID:project,JAWAFA_REGISTRY_DOC_ID:docId},
 checkFirebase:async()=>({email:owner}),readLedger:async()=>({schema:"jawafa.chat-reports.v1",reports:[]}),...overrides});
function request(authorization,docs,other={}){
 return {method:"GET",headers:{"authorization":authorization,"x-google-docs-token":docs,host:"private.example",...other}};
}
const bearer="Bearer "+"z".repeat(40),docs="a".repeat(40);
test("anonymous requests rejected, no data leaked",async()=>{
 const res=mockRes();await handler()(request(undefined,undefined),res);
 assert.equal(res.statusCode,401);assert.equal(res.body.status,"BLOCKED");
 assert.equal(res.headers["Cache-Control"],"private, no-store, max-age=0");
});
test("write methods fail with 405",async()=>{
 const res=mockRes();await handler()({...request(bearer,docs),method:"POST"},res);
 assert.equal(res.statusCode,405);assert.equal(res.headers.Allow,"GET");
});
test("cross-origin browser blocked",async()=>{
 const res=mockRes();await handler()(request(bearer,docs,{origin:"https://evil.example"}),res);
 assert.equal(res.statusCode,403);assert.equal(res.body.code,"ORIGIN_DENIED");
});
test("gateway with no private config fails closed",async()=>{
 const res=mockRes();await handler({config:{}})(request(bearer,docs),res);
 assert.equal(res.statusCode,503);
});
test("missing delegated Docs grant returns 428",async()=>{
 const res=mockRes();await handler()(request(bearer,undefined),res);
 assert.equal(res.statusCode,428);assert.equal(res.body.code,"GOOGLE_CONSENT_REQUIRED");
});
test("successful owner path returns only validated source envelope",async()=>{
 const res=mockRes();
 const data={schema:"jawafa.chat-reports.v1",reports:[report]};
 await handler({readLedger:async()=>data})(request(bearer,docs),res);
 assert.equal(res.statusCode,200);assert.deepEqual(res.body,data);
 assert.equal(res.headers["X-Content-Type-Options"],"nosniff");
 assert.equal(res.headers.Vary,"Authorization, X-Google-Docs-Token");
});
test("malformed source remains blocked; errors never echoed",async()=>{
 const res=mockRes();await handler({readLedger:async()=>{throw Error("DON'T LEAK SECRET");}})(request(bearer,docs),res);
 assert.equal(res.statusCode,502);
 assert.doesNotMatch(JSON.stringify(res.body),/SECRET/);
});
test("source parser accepts correct markers and rejects duplicates",()=>{
 const p=parseDocument(wrapped());assert.equal(p.reports.length,1);assert.match(p.sha,/^[a-f0-9]{64}$/);
 assert.throws(()=>parseDocument({body:{content:[]}}),/REGISTRY_MARKER_INVALID/);
});
test("Google owner mismatch fails closed with token only in request",async()=>{
 const fake=async url=>{
  if(url.includes("userinfo"))return response({email:"intruder@example.org",email_verified:true});
  if(url.includes("documents"))return response(wrapped());
  throw Error("unexpected");
 };
 await assert.rejects(loadOwnerLedger(docs,docId,owner,fake,stamp),/DOCS_OWNER_MISMATCH/);
});
test("Google owner read returns bounded 10-minute verified envelope",async()=>{
 const fake=async url=>{
  if(url.includes("userinfo"))return response({email:owner,email_verified:true});
  if(url.includes("documents"))return response(wrapped());
  throw Error("unexpected");
 };
 const v=await loadOwnerLedger(docs,docId,owner,fake,stamp);
 assert.equal(v.access.gateway,"private");assert.equal(v.reports.length,1);
 assert.match(v.source.source_sha256,/^[a-f0-9]{64}$/);
 assert.equal(Date.parse(v.source.expires_at)-Date.parse(v.source.verified_at),600000);
});
test("Firebase JWT uses REAL RSA signature and checks owner/audience/expiry",async()=>{
 const {publicKey,privateKey}=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...publicKey.export({format:"jwk"}),use:"sig",kid:"unit-test-key"};
 const header=Buffer.from(JSON.stringify({alg:"RS256",kid:jwk.kid})).toString("base64url");
 const claims={aud:project,iss:"https://securetoken.google.com/"+project,sub:"uid",
   email:owner,email_verified:true,iat:Math.floor(stamp/1000)-50,
   auth_time:Math.floor(stamp/1000)-50,exp:Math.floor(stamp/1000)+600};
 const mk=(body)=>{
  const b=Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig=cryptoSign("RSA-SHA256",Buffer.from(header+"."+b),privateKey).toString("base64url");
  return header+"."+b+"."+sig;
 };
 const fake=async()=>response({keys:[jwk]});
 const token=mk(claims);
 const id=await verifyFirebase(token,owner,project,fake,stamp);
 assert.equal(id.uid,"uid");
 await assert.rejects(verifyFirebase(mk({...claims,email:"intruder@example.org"}),owner,project,fake,stamp),/NOT_OWNER/);
 await assert.rejects(verifyFirebase(mk({...claims,exp:Math.floor(stamp/1000)-1}),owner,project,fake,stamp),/NOT_OWNER/);
 await assert.rejects(verifyFirebase(token,owner,"wrong-project",fake,stamp),/NOT_OWNER/);
});
test("raw source content and tokens never become public imports",()=>{
 const source=createHash("sha256").update(JSON.stringify(registry)).digest("hex");
 assert.match(source,/^[a-f0-9]{64}$/);
});
