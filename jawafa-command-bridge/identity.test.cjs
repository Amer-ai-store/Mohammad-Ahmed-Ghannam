'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {firebaseIdentity}=require('./server.cjs');
const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'fixture'};
const now=Math.floor(Date.now()/1000);
const claims={aud:'test-project',iss:'https://securetoken.google.com/test-project',exp:now+300,iat:now,auth_time:now,email_verified:true,sub:'owner'};
function token(p){const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'fixture'})).toString('base64url');const body=Buffer.from(JSON.stringify(p)).toString('base64url');return 'Bearer '+header+'.'+body+'.'+crypto.sign('RSA-SHA256',Buffer.from(header+'.'+body),privateKey).toString('base64url')}
const options={ownerUid:'owner',projectId:'test-project',fetchImpl:async()=>({ok:true,json:async()=>({keys:[jwk]})})};
test('real RSA verifier accepts correctly signed owner fixture',async()=>assert.equal((await firebaseIdentity(token(claims),options)).uid,'owner'));
test('signed tokens with absent or nonnumeric time claims fail closed',async()=>{for(const key of ['exp','iat','auth_time'])for(const value of [undefined,null,'invalid',String(now)]){await assert.rejects(firebaseIdentity(token({...claims,[key]:value}),options),{message:'TOKEN_INVALID'})}});
test('rejects wrong audience, issuer, owner, expired and tampered tokens',async()=>{for(const p of [{aud:'wrong'},{iss:'wrong'},{exp:now-1},{sub:'other'}])await assert.rejects(firebaseIdentity(token({...claims,...p}),options));const signed=token(claims).split('.');signed[1]=Buffer.from(JSON.stringify({...claims,sub:'intruder'})).toString('base64url');await assert.rejects(firebaseIdentity(signed.join('.'),options))});
