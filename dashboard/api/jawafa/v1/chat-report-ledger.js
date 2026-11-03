/* Owner-only read-only Google Docs registry; no access to Jawafa_DB or production write APIs. */
import {createPublicKey,verify as rsaVerify,createHash} from "node:crypto";
import {normalizeLedger} from "../../../jawafa-chat-reports-model.mjs";

const GOOGLE_KEYS="https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const GOOGLE_ID="https://openidconnect.googleapis.com/v1/userinfo";
const START="JAWAFA_REPORT_LEDGER_V1_START", END="JAWAFA_REPORT_LEDGER_V1_END";
let keysCache={expires:0,keys:[]};
const deny=(code,status=403)=>Object.assign(new Error(code),{code,status});
const email=s=>typeof s==="string"?s.trim().toLowerCase():"";
const json=s=>{try{return JSON.parse(s)}catch{throw deny("SOURCE_INVALID",502)}};
async function googleFetch(url,token=null,fetcher=fetch){
  const response=await fetcher(url,{headers:token?{Authorization:"Bearer "+token,Accept:"application/json"}:{Accept:"application/json"},
    cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});
  if(response.status===401||response.status===403)throw deny("GOOGLE_CONSENT_REQUIRED",428);
  if(!response.ok)throw deny("GOOGLE_UPSTREAM_ERROR",503);
  if(Number(response.headers.get("content-length")||0)>524288)throw deny("SOURCE_TOO_LARGE",502);
  const body=await response.text();
  if(body.length>524288)throw deny("SOURCE_TOO_LARGE",502);
  return json(body);
}
const unpack=s=>{
  if(!/^[A-Za-z0-9_-]+$/.test(s)||s.length>8192)throw deny("FIREBASE_TOKEN_INVALID");
  return json(Buffer.from(s,"base64url").toString("utf8"));
};
export async function verifyFirebase(token,owner,project,fetcher=fetch,now=Date.now()){
  if(typeof token!=="string"||token.length>8192||token.split(".").length!==3)throw deny("FIREBASE_TOKEN_INVALID");
  const [a,b,c]=token.split(".");
  const header=unpack(a),claims=unpack(b);
  if(header.alg!=="RS256"||typeof header.kid!=="string"||header.kid.length>160)throw deny("FIREBASE_TOKEN_INVALID");
  if(keysCache.expires<now){
    const jwks=await googleFetch(GOOGLE_KEYS,null,fetcher);
    if(!Array.isArray(jwks.keys)||jwks.keys.length>30)throw deny("GOOGLE_KEYS_INVALID",503);
    keysCache={expires:now+900000,keys:jwks.keys};
  }
  const jwk=keysCache.keys.find(k=>k.kid===header.kid&&k.kty==="RSA"&&k.use==="sig");
  if(!jwk)throw deny("FIREBASE_TOKEN_INVALID");
  let verified=false;
  try{verified=rsaVerify("RSA-SHA256",Buffer.from(a+"."+b),createPublicKey({key:jwk,format:"jwk"}),Buffer.from(c,"base64url"))}catch{}
  const seconds=now/1000;
  if(!verified||claims.iss!=="https://securetoken.google.com/"+project||claims.aud!==project||
    typeof claims.sub!=="string"||!claims.sub||claims.sub.length>128||
    !Number.isFinite(claims.exp)||claims.exp<=seconds||
    !Number.isFinite(claims.iat)||claims.iat>seconds+300||
    !Number.isFinite(claims.auth_time)||claims.auth_time>seconds+300||
    claims.email_verified!==true||email(claims.email)!==email(owner))throw deny("NOT_OWNER");
  return {email:email(claims.email),uid:claims.sub};
}
function textRuns(obj,result){
  if(!obj||typeof obj!=="object")return;
  if(obj.textRun&&typeof obj.textRun.content==="string")result.push(obj.textRun.content);
  for(const [k,v] of Object.entries(obj))if(k!=="textRun")textRuns(v,result);
}
export function parseDocument(doc){
  const parts=[];
  if(doc.body)textRuns(doc.body,parts);
  else if(Array.isArray(doc.tabs))textRuns(doc.tabs,parts);
  const body=parts.join("");
  const s=body.indexOf(START),e=body.indexOf(END,s+START.length);
  if(s<0||e<0||body.indexOf(START,s+START.length)>=0||body.indexOf(END,e+END.length)>=0)
    throw deny("REGISTRY_MARKER_INVALID",502);
  const payload=body.slice(s+START.length,e).trim();
  if(payload.length>150000)throw deny("SOURCE_TOO_LARGE",502);
  const source=json(payload);
  if(source.schema!=="jawafa.chat-reports.source.v1"||!Array.isArray(source.reports)||
     source.reports.length<1||source.reports.length>100)throw deny("REGISTRY_SCHEMA_INVALID",502);
  return {reports:source.reports,sha:createHash("sha256").update(payload).digest("hex")};
}
export async function loadOwnerLedger(docsToken,docId,owner,fetcher=fetch,now=Date.now()){
  const identity=await googleFetch(GOOGLE_ID,docsToken,fetcher);
  if(email(identity.email)!==email(owner)||identity.email_verified!==true)throw deny("DOCS_OWNER_MISMATCH");
  if(!/^[A-Za-z0-9_-]{15,}$/.test(docId||""))throw deny("REGISTRY_NOT_CONFIGURED",503);
  const document=await googleFetch("https://docs.googleapis.com/v1/documents/"+docId,docsToken,fetcher);
  const {reports,sha}=parseDocument(document);
  const response={
    schema:"jawafa.chat-reports.v1",
    access:{authenticated:true,role:"owner",scope:"jawafa.reports.read",gateway:"private"},
    source:{kind:"google_drive_private",integrity:"verified",time_authority:"independent_utc",
      source_sha256:sha,snapshot_id:"drive-"+sha.slice(0,20),
      verified_at:new Date(now).toISOString(),expires_at:new Date(now+600000).toISOString()},
    reports
  };
  normalizeLedger(response,now); // fail closed on ANY malformed/stale/untrusted record
  return response;
}
export function createHandler({config=process.env,fetcher=fetch,clock=()=>Date.now(),
  checkFirebase=verifyFirebase,readLedger=loadOwnerLedger}={}){
  return async function handler(req,res){
    res.setHeader("Cache-Control","private, no-store, max-age=0");
    res.setHeader("Pragma","no-cache");
    res.setHeader("X-Content-Type-Options","nosniff");
    res.setHeader("Referrer-Policy","no-referrer");
    res.setHeader("Content-Security-Policy","default-src 'none'");
    res.setHeader("Vary","Authorization, X-Google-Docs-Token");
    const send=(status,code)=>res.status(status).json({status:"BLOCKED",code});
    if(req.method!=="GET"){res.setHeader("Allow","GET");return send(405,"READ_ONLY")}
    if(req.headers.origin&&req.headers.origin!=="https://"+req.headers.host)return send(403,"ORIGIN_DENIED");
    const bearer=/^Bearer ([A-Za-z0-9._~-]{30,8192})$/.exec(req.headers.authorization||"");
    if(!bearer)return send(401,"NOT_AUTHENTICATED");
    const owner=email(config.JAWAFA_OWNER_EMAIL),project=config.JAWAFA_FIREBASE_PROJECT_ID,
      docId=config.JAWAFA_REGISTRY_DOC_ID;
    if(!owner||!project||!docId)return send(503,"GATEWAY_NOT_CONFIGURED");
    try{
      await checkFirebase(bearer[1],owner,project,fetcher,clock());
      const docsToken=req.headers["x-google-docs-token"];
      if(typeof docsToken!=="string"||docsToken.length>2048||!/^[A-Za-z0-9._~-]+$/.test(docsToken))
        throw deny("GOOGLE_CONSENT_REQUIRED",428);
      const ledger=await readLedger(docsToken,docId,owner,fetcher,clock());
      return res.status(200).json(ledger);
    }catch(e){
      const codes=new Set(["FIREBASE_TOKEN_INVALID","NOT_OWNER","GOOGLE_CONSENT_REQUIRED","GOOGLE_UPSTREAM_ERROR",
      "GOOGLE_KEYS_INVALID","DOCS_OWNER_MISMATCH","REGISTRY_NOT_CONFIGURED","REGISTRY_MARKER_INVALID",
      "SOURCE_TOO_LARGE","SOURCE_INVALID","REGISTRY_SCHEMA_INVALID"]);
      // Never emit exception text, tokens, file contents, or internal URLs.
      return send(Number.isInteger(e?.status)?e.status:502,codes.has(e?.code)?e.code:"SOURCE_NOT_VERIFIED");
    }
  };
}
export default createHandler();
