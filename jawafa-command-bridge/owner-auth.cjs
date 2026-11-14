'use strict';
/* AUDIT-111 authenticated owner enrollment.
 * Only Google-signed Firebase tokens; never accept email claims without signature.
 * One-time UID pin is stored in an ACL-restricted private file, not the public repo.
 */
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
function err(message,status){return Object.assign(new Error(message),{status})}
const safeEmail=v=>typeof v==='string'?v.trim().toLowerCase():'';
function readPin(filename,emailHash){
 try{
  const p=JSON.parse(fs.readFileSync(filename,'utf8'));
  if(p.version!==1||p.email_sha256!==emailHash||typeof p.uid!=='string'||p.uid.length<4)
   throw err('OWNER_PIN_INVALID',503);
  return p.uid;
 }catch(e){
  if(e.code==='ENOENT')return null;
  if(e.status)throw e;
  throw err('OWNER_PIN_READ_FAILED',503);
 }
}
function writePin(filename,uid,emailHash){
 const body=JSON.stringify({version:1,uid,email_sha256:emailHash,pinned_at:new Date().toISOString()});
 if(!fs.existsSync(path.dirname(filename)))throw err('OWNER_PIN_DIR_MISSING',503);
 try{
  const fd=fs.openSync(filename,'wx',0o600);
  try{fs.writeFileSync(fd,body,'utf8');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
 }catch(e){
  if(e.code==='EEXIST'){
   const prev=readPin(filename,emailHash);
   if(prev!==uid)throw err('OWNER_PIN_MISMATCH',403);
   return;
  }
  if(e.status)throw e;
  throw err('OWNER_PIN_WRITE_FAILED',503);
 }
}
async function verifyFirebaseOwner(auth,options={}){
 const project=options.projectId||process.env.JAWAFA_FIREBASE_PROJECT_ID||'ameraistore-1c81d';
 const expectedUid=options.ownerUid||process.env.JAWAFA_OWNER_UID||'';
 const email=safeEmail(options.ownerEmail||process.env.JAWAFA_OWNER_EMAIL);
 const pinFile=options.ownerUidFile||process.env.JAWAFA_OWNER_UID_FILE;
 if(!expectedUid&&!email)throw err('OWNER_IDENTITY_NOT_CONFIGURED',503);
 if(typeof auth!=='string'||!auth.startsWith('Bearer ')||auth.length>14000)
  throw err('AUTH_REQUIRED',401);
 let header,claim,parts;
 try{
  parts=auth.slice(7).split('.');
  if(parts.length!==3)throw Error('FORMAT');
  header=JSON.parse(Buffer.from(parts[0],'base64url'));
  claim=JSON.parse(Buffer.from(parts[1],'base64url'));
 }catch{throw err('TOKEN_INVALID',401)}
 if(header?.alg!=='RS256'||typeof header.kid!=='string'||!header.kid||
    claim?.aud!==project||claim?.iss!=='https://securetoken.google.com/'+project||
    typeof claim.sub!=='string'||claim.sub.length<4||claim.email_verified!==true||
    !Number.isFinite(claim.exp)||!Number.isFinite(claim.iat)||!Number.isFinite(claim.auth_time))
  throw err('TOKEN_INVALID',401);
 let jwks,serverTime;
 try{
  const res=await (options.fetchImpl||fetch)(
   'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
   {cache:'no-store',signal:AbortSignal.timeout(4500)});
  if(!res.ok)throw Error('JWK_HTTP');
  // Signed Firebase token time checked against TLS-protected Google response time,
  // not the local JAWAFFASVR clock (NTP unverified).
  serverTime=Date.parse(res.headers.get('date'))/1000;
  if(!Number.isFinite(serverTime))throw Error('NO_TRUSTED_TIME');
  const obj=await res.json();
  jwks=obj?.keys;
 }catch{throw err('OWNER_JWKS_OR_TRUSTED_TIME_UNAVAILABLE',503)}
 if(!Array.isArray(jwks))throw err('TOKEN_INVALID',401);
 const jwk=jwks.find(x=>x.kid===header.kid&&x.kty==='RSA');
 let valid=false;
 try{
  if(jwk)valid=crypto.verify('RSA-SHA256',
   Buffer.from(parts[0]+'.'+parts[1]),crypto.createPublicKey({key:jwk,format:'jwk'}),
   Buffer.from(parts[2],'base64url'));
 }catch{}
 if(!valid)throw err('TOKEN_INVALID',401);
 if(claim.exp<=serverTime||claim.iat>serverTime+60||
    claim.auth_time>serverTime+60||claim.iat<serverTime-3600)
  throw err('TOKEN_EXPIRED_OR_TIME_INVALID',401);
 const emailHash=crypto.createHash('sha256').update(email).digest('hex');
 let pinnedUid=expectedUid;
 if(!pinnedUid){
  if(!pinFile)throw err('OWNER_UID_PIN_PATH_REQUIRED',503);
  pinnedUid=readPin(pinFile,emailHash);
  if(safeEmail(claim.email)!==email||claim.firebase?.sign_in_provider!=='google.com')
   throw err('NOT_OWNER',403);
  if(!pinnedUid){
   if(serverTime-claim.auth_time>1800)throw err('OWNER_RECENT_GOOGLE_LOGIN_REQUIRED',401);
   writePin(pinFile,claim.sub,emailHash);
   pinnedUid=claim.sub;
  }
 }
 if(claim.sub!==pinnedUid)throw err('NOT_OWNER',403);
 if(email&&safeEmail(claim.email)!==email)throw err('NOT_OWNER',403);
 return {uid:claim.sub,role:'owner',method:'FIREBASE_SIGNED_OWNER_UID'};
}
module.exports={verifyFirebaseOwner};
