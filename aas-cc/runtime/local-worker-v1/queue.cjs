"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto");
const dir=__dirname, folders=["inbox","results","archive","rejected"];
for(const folder of folders)fs.mkdirSync(path.join(dir,folder),{recursive:true});
const sha=x=>crypto.createHash("sha256").update(x).digest("hex");
const lock=path.join(dir,"queue.lock");
const summary={schema:1,mode:"LOCAL_ONLY_NO_SQL_NO_REMOTE",at:new Date().toISOString(),processed:0,validated:0,replayed:0,rejected:0};
let fd;
try{fd=fs.openSync(lock,"wx")}catch(e){console.log(JSON.stringify({...summary,status:"BUSY_REQUIRES_REVIEW"}));process.exit(3);}
try{
 const items=fs.readdirSync(path.join(dir,"inbox")).filter(x=>x.endsWith(".json")).slice(0,25);
 for(const file of items){
  const full=path.join(dir,"inbox",file);
  let valid=false, requestHash="";
  try{
   if(!/^[a-z0-9][a-z0-9_-]{0,79}\.json$/.test(file))throw Error("INVALID_FILENAME");
   const stat=fs.lstatSync(full);
   if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2048)throw Error("INVALID_INPUT_FILE");
   const payload=fs.readFileSync(full,"utf8"),job=JSON.parse(payload);
   if(!job||typeof job!=="object"||Array.isArray(job))throw Error("INVALID_JOB");
   if(job.kind!=="INVENTORY_CHECK"||job.id!==file.slice(0,-5))throw Error("KIND_OR_ID_REJECTED");
   if(!job.values||Object.keys(job).sort().join(",")!=="id,kind,values")throw Error("EXTRA_FIELDS_REJECTED");
   const keys=["opening","received","sold","returned"];
   if(Object.keys(job.values).sort().join(",")!==keys.sort().join(",")||keys.some(k=>!Number.isSafeInteger(job.values[k])||job.values[k]<0||job.values[k]>1e9))throw Error("BAD_QUANTITIES");
   requestHash=sha(JSON.stringify(job));
   const run=cp.spawnSync(process.execPath,[path.join(dir,"runner.cjs")],{input:JSON.stringify(job),encoding:"utf8",timeout:6500,maxBuffer:100000,windowsHide:true});
   if(run.error||run.status!==0)throw Error("RUNNER_EXEC_FAILED");
   let receipt;
   try{receipt=JSON.parse((run.stdout||"").trim())}catch{throw Error("INVALID_RECEIPT")}
   if(receipt.id!==job.id||receipt.kind!==job.kind||receipt.state!=="VALIDATED_CALCULATION"||receipt.output_sha256!==sha(receipt.output)||receipt.request_sha256!==requestHash)throw Error("RECEIPT_VALIDATION_FAILED");
   const out=path.join(dir,"results",file);
   if(fs.existsSync(out)){
    const old=JSON.parse(fs.readFileSync(out,"utf8"));
    if(old.request_sha256!==receipt.request_sha256||old.output_sha256!==receipt.output_sha256)throw Error("RESULT_ID_CONFLICT");
    summary.replayed++;
   }else{
    fs.writeFileSync(out,JSON.stringify({schema:1,id:receipt.id,kind:receipt.kind,state:receipt.state,output:receipt.output,request_sha256:receipt.request_sha256,output_sha256:receipt.output_sha256,runner_sha256:receipt.runner_sha256,validated_at:new Date().toISOString()},null,2),{flag:"wx"});
    summary.validated++;
   }
   valid=true;
  }catch(e){
   summary.rejected++;
   const reason=String(e.message||e).slice(0,70);
   const note=path.join(dir,"rejected",file+".reason");
   if(!fs.existsSync(note))fs.writeFileSync(note,reason,{flag:"wx"});
  }finally{
   summary.processed++;
   const destination=valid?"archive":"rejected";
   const stored=path.join(dir,destination,file);
   if(fs.existsSync(stored)) {
     const existing=fs.readFileSync(stored),incoming=fs.readFileSync(full);
     if(!existing.equals(incoming)) {
       const conflict=path.join(dir,"rejected",file+".conflict");
       if(!fs.existsSync(conflict))fs.writeFileSync(conflict,"DUPLICATE_FILE_DIFFERENT_CONTENT",{flag:"wx"});
       summary.rejected++;summary.validated=Math.max(0,summary.validated-Number(valid));
     }
     fs.unlinkSync(full);
   }else fs.renameSync(full,stored);
  }
 }
 summary.status=summary.rejected?"REVIEW_REQUIRED":"OK";
 const tmp=path.join(dir,"status.json.tmp"),final=path.join(dir,"status.json");
 fs.writeFileSync(tmp,JSON.stringify(summary,null,2));
 fs.renameSync(tmp,final);
 console.log(JSON.stringify(summary));
 if(summary.rejected)process.exitCode=2;
}finally{fs.closeSync(fd);fs.unlinkSync(lock);}
