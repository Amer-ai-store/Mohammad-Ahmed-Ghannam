"use strict";
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const script=path.join(__dirname,'build-manifest.mjs');
test('offline builder hashes exports with previous-hash chain and never copies raw CSV',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ts-archive-'));
 try{
  const source=path.join(temp,'source'),out=path.join(temp,'output');fs.mkdirSync(source);
  fs.writeFileSync(path.join(source,'fictional-cheques.csv'),'cheque,amount\n1,25\n');
  fs.writeFileSync(path.join(source,'fictional-ledger.csv'),'id,date\n1,2026-11-01\n');
  const cmd=['--source='+source,'--destination='+out,'--run-id=example_20261103','--source-utc=2026-11-03T00:00:00Z'];
  const first=cp.spawnSync(process.execPath,[script,...cmd],{encoding:'utf8'});
  assert.equal(first.status,0,first.stderr);
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest-example_20261103.json'),'utf8'));
  assert.equal(manifest.file_count,2);
  assert.equal(manifest.verification,'LOCAL_HASH_ONLY_NOT_CLOUD_BACKUP');
  assert.equal(manifest.entries[1].previous_hash,manifest.entries[0].chain_hash);
  assert.ok(!JSON.stringify(manifest).includes('1,25'));
  assert.equal(fs.existsSync(path.join(out,'fictional-cheques.csv')),false);
  const repeat=cp.spawnSync(process.execPath,[script,...cmd],{encoding:'utf8'});
  assert.notEqual(repeat.status,0,'manifest must not overwrite existing evidence');
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});

test('independent verifier detects file mutation and checks externally anchored chain head',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ts-verify-'));
 try{
  const source=path.join(temp,'source'),out=path.join(temp,'out');
  fs.mkdirSync(source);fs.writeFileSync(path.join(source,'record.csv'),'id,amount\n1,10\n');
  const build=cp.spawnSync(process.execPath,[script,'--source='+source,'--destination='+out,'--run-id=test_20261104','--source-utc=2026-11-04T00:00:00Z'],{encoding:'utf8'});
  assert.equal(build.status,0,build.stderr);
  const manifestFile=path.join(out,'manifest-test_20261104.json');
  const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  const verifier=path.join(__dirname,'verify-manifest.mjs');
  const args=[verifier,'--source='+source,'--manifest='+manifestFile,'--expected-head='+manifest.chain_head];
  const good=cp.spawnSync(process.execPath,args,{encoding:'utf8'});
  assert.equal(good.status,0,good.stderr);
  assert.equal(JSON.parse(good.stdout).verification,'ANCHOR_MATCH_LOCAL_SOURCE');
  const withoutAnchor=cp.spawnSync(process.execPath,args.slice(0,-1),{encoding:'utf8'});
  assert.equal(JSON.parse(withoutAnchor.stdout).verification,'LOCAL_CONSISTENCY_ONLY');
  fs.appendFileSync(path.join(source,'record.csv'),'2,100\n');
  const tampered=cp.spawnSync(process.execPath,args,{encoding:'utf8'});
  assert.notEqual(tampered.status,0,'tampered source must be rejected');
  fs.writeFileSync(path.join(source,'record.csv'),'id,amount\n1,10\n');
  manifest.entries[0].chain_hash='f'.repeat(64);
  fs.writeFileSync(manifestFile,JSON.stringify(manifest));
  const tamperedManifest=cp.spawnSync(process.execPath,args,{encoding:'utf8'});
  assert.notEqual(tamperedManifest.status,0,'tampered manifest must be rejected');
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
test('manifest builder rejects a symlink source root',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ts-symlink-'));
 try{
  const real=path.join(temp,'real'),alias=path.join(temp,'alias');fs.mkdirSync(real);
  fs.writeFileSync(path.join(real,'record.csv'),'id\n1\n');
  fs.symlinkSync(real,alias,'dir');
  const result=cp.spawnSync(process.execPath,[script,'--source='+alias,'--destination='+path.join(temp,'out'),'--run-id=test_20261104','--source-utc=2026-11-04T00:00:00Z'],{encoding:'utf8'});
  assert.notEqual(result.status,0,'source symlink must be rejected');
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
