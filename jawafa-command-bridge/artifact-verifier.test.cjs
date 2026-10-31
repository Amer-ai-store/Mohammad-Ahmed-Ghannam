'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createArtifactVerifier}=require('./artifact-verifier.cjs');
test('QA artifact verifier checks real bytes, independent signature and command context',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jawafa-qa-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
 const verify=createArtifactVerifier({directory:dir,publicKey:publicKey.export({format:'pem',type:'spki'})});
 const proof={request_id:'request-001',agent_id:'worker-001',operation:'CHECK_SERVER',source_version:'snapshot-001',evidence_ref:'evidence-001'};
 const payload={...proof,schema_version:'jawafa.qa-artifact.v1',reviewer_id:'reviewer-001',test_result:'PASS',checked_at:new Date().toISOString(),findings:{health:'checked'}};
 function write(p,key=privateKey){const text=JSON.stringify(p);const raw=Buffer.from(JSON.stringify({payload:text,signature:crypto.sign(null,Buffer.from(text),key).toString('base64')}));fs.writeFileSync(path.join(dir,'evidence-001.json'),raw);return crypto.createHash('sha256').update(raw).digest('hex')}
 proof.sha256=write(payload);assert.equal(await verify(proof),true);
 for(const field of ['request_id','agent_id','operation','source_version','evidence_ref'])assert.equal(await verify({...proof,[field]:'different'}),false);
 assert.equal(await verify({...proof,sha256:'0'.repeat(64)}),false);
 assert.equal(await verify({...proof,evidence_ref:'../outside'}),false);
 proof.sha256=write(payload,crypto.generateKeyPairSync('ed25519').privateKey);assert.equal(await verify(proof),false);
 for(const change of [{reviewer_id:proof.agent_id},{test_result:'FAIL'},{checked_at:'invalid'},{findings:null},{source_version:undefined}]){proof.sha256=write({...payload,...change});assert.equal(await verify(proof),false)}
 fs.unlinkSync(path.join(dir,'evidence-001.json'));assert.equal(await verify(proof),false);
 fs.writeFileSync(path.join(dir,'target.json'),'{}');fs.symlinkSync(path.join(dir,'target.json'),path.join(dir,'evidence-001.json'));assert.equal(await verify(proof),false);
});
