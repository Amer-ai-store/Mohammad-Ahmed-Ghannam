#!/usr/bin/env node
/* Offline immutable manifest builder for approved, pre-exported files. Never connects to SQL or cloud. */
import {createHash} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {readdir,mkdir,open,stat,lstat} from 'node:fs/promises';
import {resolve,relative,join,extname,basename,sep} from 'node:path';
import {pipeline} from 'node:stream/promises';
const allowed=new Set(['.csv','.json','.parquet','.ndjson','.gz','.zip']);
const flags=Object.fromEntries(process.argv.slice(2).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1)]}));
const root=resolve(flags['--source']||'');
const output=resolve(flags['--destination']||'');
const run=flags['--run-id'];
const sourceUtc=flags['--source-utc'];
if(!flags['--source']||!flags['--destination']||!run||!sourceUtc)throw Error('Usage: --source=PATH --destination=PATH --run-id=SAFE_ID --source-utc=ISO_UTC');
if(!/^[A-Za-z0-9_-]{8,100}$/.test(run)||!/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z/.test(sourceUtc)||!Number.isFinite(Date.parse(sourceUtc))||new Date(sourceUtc).toISOString().slice(0,19)!==sourceUtc.slice(0,19))throw Error('INVALID_RUN_ID_OR_UTC');
if(output===root||output.startsWith(root+sep))throw Error('OUTPUT_CANNOT_BE_INSIDE_SOURCE');
const sourceInfo=await lstat(root);
if(!sourceInfo.isDirectory()||sourceInfo.isSymbolicLink())throw Error('SOURCE_MUST_BE_A_REAL_DIRECTORY');
async function walk(dir){
 let files=[];
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const p=join(dir,entry.name),info=await lstat(p);
  if(info.isSymbolicLink()||entry.isSymbolicLink())throw Error('SYMLINK_REJECTED');
  if(entry.isDirectory())files.push(...await walk(p));
  else if(entry.isFile() && allowed.has(extname(entry.name).toLowerCase()))files.push(p);
 }
 return files;
}
async function sha256(file){
 const hash=createHash('sha256');
 for await(const chunk of createReadStream(file))hash.update(chunk);
 return hash.digest('hex');
}
await mkdir(output,{recursive:true});
const files=(await walk(root)).sort((a,b)=>relative(root,a).localeCompare(relative(root,b)));
if(!files.length)throw Error('NO_EXPORTS_FOUND');
let previous='0'.repeat(64);
const entries=[];
for(const file of files){
 const before=await stat(file),digest=await sha256(file),after=await stat(file);
 if(before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw Error('MUTATING_SOURCE_FILE');
 const logicalPath=relative(root,file).split(sep).join('/');
 const entry={relative_path:logicalPath,bytes:before.size,sha256:digest,extracted_at_utc:sourceUtc,rows:null,table_id:null,source_kind:'OFFLINE_EXPORT_UNVERIFIED'};
 const fingerprint=createHash('sha256').update(previous+'\n'+JSON.stringify(entry)).digest('hex');
 entries.push({...entry,previous_hash:previous,chain_hash:fingerprint});
 previous=fingerprint;
}
const manifest={format:'jawafa-immutable-manifest-v1',run_id:run,created_at_utc:new Date().toISOString(),source_time_utc:sourceUtc,verification:'LOCAL_HASH_ONLY_NOT_CLOUD_BACKUP',file_count:entries.length,chain_head:previous,entries};
const dest=join(output,'manifest-'+run+'.json');
const handle=await open(dest,'wx',0o600);
try{await handle.writeFile(JSON.stringify(manifest,null,2)+'\n')}finally{await handle.close()}
console.log(JSON.stringify({success:true,manifest:dest,file_count:entries.length,chain_head:previous,raw_data_copied:false}));
