'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {verifyFirebaseOwner}=require('./owner-auth.cjs');
const {firebaseIdentity}=require('./server.cjs');
const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const kid='local-qa-kid',project='ameraistore-1c81d',now=1793667600;
const key={...publicKey.export({format:'jwk'}),kid,use:'sig',alg:'RS256'};
const trust=async()=>({ok:true,headers:{get:k=>k==='date'?new Date(now*1000).toUTCString():null},json:async()=>({keys:[key]})});
function token({uid='qa-owner-id-12345',email='owner-test@example.invalid',provider='google.com',claims={}}={}){
 const h=Buffer.from(JSON.stringify({alg:'RS256',kid})).toString('base64url');
 const p=Buffer.from(JSON.stringify({
  aud:project,iss:'https://securetoken.google.com/'+project,
  sub:uid,email,email_verified:true,exp:now+3200,iat:now-25,auth_time:now-60,
  firebase:{sign_in_provider:provider},...claims
 })).toString('base64url');
 const sig=crypto.sign('RSA-SHA256',Buffer.from(h+'.'+p),privateKey).toString('base64url');
 return 'Bearer '+h+'.'+p+'.'+sig;
}
test('valid signed Google Firebase owner pins UID once, same UID returns role owner',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'audit111-owner-qa-'));
 try{
  const file=path.join(root,'owner-pin.json'),options={
   ownerEmail:'owner-test@example.invalid',ownerUidFile:file,fetchImpl:trust
  };
  const a=await verifyFirebaseOwner(token(),options);
  assert.equal(a.role,'owner');assert.equal(a.method,'FIREBASE_SIGNED_OWNER_UID');
  assert.equal(fs.existsSync(file),true);
  assert.equal((await verifyFirebaseOwner(token(),options)).uid,a.uid);
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).uid,a.uid);
  await assert.rejects(()=>verifyFirebaseOwner(token({uid:'different-owner-id'}),options),{status:403});
  await assert.rejects(()=>verifyFirebaseOwner(token({email:'other@example.invalid'}),options),{status:403});
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
test('fail closed without server-side owner configuration',async()=>{
 await assert.rejects(()=>verifyFirebaseOwner(token(),{fetchImpl:trust}),{status:503});
});
test('owner refuses unsigned, altered, expired or wrong project tokens',async()=>{
 const opts={ownerUid:'qa-owner-id-12345',fetchImpl:trust};
 await assert.rejects(()=>verifyFirebaseOwner('Bearer malformed',opts),{status:401});
 await assert.rejects(()=>verifyFirebaseOwner(token({claims:{aud:'different'}}),opts),{status:401});
 await assert.rejects(()=>verifyFirebaseOwner(token({claims:{exp:now-1}}),opts),{status:401});
 await assert.rejects(()=>verifyFirebaseOwner(token({claims:{email_verified:false}}),opts),{status:401});
 const signed=token();
 await assert.rejects(()=>verifyFirebaseOwner(signed.slice(0,-12)+'fake.invalid',opts),{status:401});
});
test('remote TLS-protected time source unavailable must refuse access',async()=>{
 const noDate=async()=>({ok:true,headers:{get:()=>null},json:async()=>({keys:[key]})});
 await assert.rejects(()=>verifyFirebaseOwner(token(),{ownerUid:'qa-owner-id-12345',fetchImpl:noDate}),{status:503});
});
test('server firebaseIdentity delegates to same signed validator',async()=>{
 const user=await firebaseIdentity(token(),{ownerUid:'qa-owner-id-12345',fetchImpl:trust});
 assert.equal(user.role,'owner');
});
test('email bootstrap does not allow stale Google login or password provider',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'audit111-owner-qa-'));
 try{
  const opts={ownerEmail:'owner-test@example.invalid',ownerUidFile:path.join(root,'pin.json'),fetchImpl:trust};
  await assert.rejects(()=>verifyFirebaseOwner(token({provider:'password'}),opts),{status:403});
  await assert.rejects(()=>verifyFirebaseOwner(token({claims:{auth_time:now-3600}}),opts),{status:401});
  assert.equal(fs.existsSync(opts.ownerUidFile),false);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
