#!/usr/bin/env node
/* Offline archive verifier: checks source bytes + previous-hash chain; trusted head is supplied separately. */
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat,readdir,readFile} from 'node:fs/promises';
import {resolve,relative,join,extname,sep} from 'node:path';

const flags=Object.fromEntries(process.argv.slice(2).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
if(!flags['--source']||!flags['--manifest'])throw Error('Usage: --source=PATH --manifest=PATH [--expected-head=SHA256]');
const root=resolve(flags['--source']),manifestFile=resolve(flags['--manifest']);
const expectedHead=flags['--expected-head']||null;
if(expectedHead&&!/^[0-9a-f]{64}$/.test(expectedHead))throw Error('INVALID_EXPECTED_HEAD');
const statRoot=await lstat(root);
if(!statRoot.isDirectory()||statRoot.isSymbolicLink())throw Error('SOURCE_MUST_BE_A_REAL_DIRECTORY');
const manifest=JSON.parse(await readFile(manifestFile,'utf8'));
if(manifest.format!=='jawafa-immutable-manifest-v1'||manifest.verification!=='LOCAL_HASH_ONLY_NOT_CLOUD_BACKUP')throw Error('UNSUPPORTED_MANIFEST');
if(!Array.isArray(manifest.entries)||manifest.entries.length===0||manifest.file_count!==manifest.entries.length)throw Error('INVALID_ENTRY_COUNT');
const allowed=new Set(['.csv','.json','.parquet','.ndjson','.gz','.zip']);
async function walk(dir){
 const files=[];
 for(const item of await readdir(dir,{withFileTypes:true})){
  const full=join(dir,item.name),info=await lstat(full);
  if(info.isSymbolicLink())throw Error('SYMLINK_REJECTED');
  if(info.isDirectory())files.push(...await walk(full));
  else if(info.isFile()&&allowed.has(extname(item.name).toLowerCase()))files.push(relative(root,full).split(sep).join('/'));
 }
 return files;
}
const actual=(await walk(root)).sort((a,b)=>a.localeCompare(b));
const indexed=manifest.entries.map(e=>e.relative_path);
if(actual.length!==indexed.length||actual.some((x,i)=>x!==indexed[i]))throw Error('FILE_SET_MISMATCH');
async function sha256(file){
 const h=createHash('sha256');
 for await(const chunk of createReadStream(file))h.update(chunk);
 return h.digest('hex');
}
let previous='0'.repeat(64),checked=0;
for(const entry of manifest.entries){
 if(typeof entry.relative_path!=='string'||!entry.relative_path||typeof entry.bytes!=='number'||entry.bytes<0||!Number.isSafeInteger(entry.bytes)||!(/^[0-9a-f]{64}$/).test(entry.sha256))throw Error('INVALID_MANIFEST_ENTRY');
 if(entry.previous_hash!==previous||entry.extracted_at_utc!==manifest.source_time_utc||entry.rows!==null||entry.table_id!==null||entry.source_kind!=='OFFLINE_EXPORT_UNVERIFIED')throw Error('INVALID_CHAIN_METADATA');
 const file=resolve(root,entry.relative_path);
 if(!file.startsWith(root+sep))throw Error('PATH_OUTSIDE_SOURCE');
 const before=await lstat(file);
 if(!before.isFile()||before.isSymbolicLink()||before.size!==entry.bytes)throw Error('FILE_CHANGED');
 const digest=await sha256(file),after=await lstat(file);
 if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||digest!==entry.sha256)throw Error('FILE_HASH_MISMATCH');
 const payload={relative_path:entry.relative_path,bytes:entry.bytes,sha256:entry.sha256,extracted_at_utc:entry.extracted_at_utc,rows:entry.rows,table_id:entry.table_id,source_kind:entry.source_kind};
 const next=createHash('sha256').update(previous+'\n'+JSON.stringify(payload)).digest('hex');
 if(next!==entry.chain_hash)throw Error('HASH_CHAIN_MISMATCH');
 previous=next;checked++;
}
if(previous!==manifest.chain_head)throw Error('CHAIN_HEAD_MISMATCH');
if(expectedHead&&previous!==expectedHead)throw Error('TRUSTED_HEAD_MISMATCH');
console.log(JSON.stringify({success:true,files_verified:checked,chain_head:previous,verification:expectedHead?'ANCHOR_MATCH_LOCAL_SOURCE':'LOCAL_CONSISTENCY_ONLY',cloud_backup_verified:false,restore_verified:false,raw_data_copied:false}));
