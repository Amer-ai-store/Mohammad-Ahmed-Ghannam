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
