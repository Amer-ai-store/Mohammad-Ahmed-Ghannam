"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process");
const src=path.join(__dirname,"queue.cjs");
const fakeRunner=[
 '"use strict";',
 'const fs=require("node:fs"),crypto=require("node:crypto");',
 'const sha=x=>crypto.createHash("sha256").update(x).digest("hex");',
 'const j=JSON.parse(fs.readFileSync(0,"utf8"));',
 'const out=String(BigInt(j.values.opening)+BigInt(j.values.received)-BigInt(j.values.sold)+BigInt(j.values.returned));',
 'console.log(JSON.stringify({id:j.id,kind:j.kind,state:"VALIDATED_CALCULATION",output:out,request_sha256:sha(JSON.stringify(j)),output_sha256:sha(out),runner_sha256:sha("synthetic-runner")}));',
].join("\n");
function lab(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"aas-queue-"));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const expectedHash="c9b16de46ffef2092d32a59a65c124d274fe3486d66ad851c94b1cec5126c280";
 const fakeSha=require("node:crypto").createHash("sha256").update(fakeRunner).digest("hex");
 const source=fs.readFileSync(src,"utf8");
 assert.ok(source.includes(expectedHash),"trusted runner constant changed");
 fs.writeFileSync(path.join(dir,"queue.cjs"),source.replace(expectedHash,fakeSha));
 fs.writeFileSync(path.join(dir,"runner.cjs"),fakeRunner);
 fs.mkdirSync(path.join(dir,"inbox"));
 return dir;
}
function job(dir,id="test-a",values={opening:10,received:5,sold:4,returned:2},kind="INVENTORY_CHECK"){
 const body={id,kind,values};
 fs.writeFileSync(path.join(dir,"inbox",id+".json"),JSON.stringify(body));
}
function run(dir){
 const p=cp.spawnSync(process.execPath,[path.join(dir,"queue.cjs")],{encoding:"utf8",timeout:10000});
 return {exit:p.status,body:JSON.parse((p.stdout||"").trim()),stderr:p.stderr};
}
test("valid synthetic inventory is precise and archived",t=>{
 const d=lab(t);job(d);const r=run(d);
 assert.equal(r.exit,0,r.stderr);assert.equal(r.body.validated,1);
 const x=JSON.parse(fs.readFileSync(path.join(d,"results","test-a.json")));
 assert.equal(x.output,"13");assert.equal(x.state,"VALIDATED_CALCULATION");
 assert.equal(fs.existsSync(path.join(d,"archive","test-a.json")),true);
 assert.equal(fs.existsSync(path.join(d,"inbox","test-a.json")),false);
});
test("replay does not replace receipt and inventory is not re-executed",t=>{
 const d=lab(t);job(d);run(d);
 const old=fs.readFileSync(path.join(d,"results","test-a.json"));
 job(d);const r=run(d);
 assert.equal(r.exit,0);assert.equal(r.body.replayed,1);
 assert.deepEqual(fs.readFileSync(path.join(d,"results","test-a.json")),old);
});
test("different payload with same ID is rejected and preserved in quarantine",t=>{
 const d=lab(t);job(d);run(d);
 job(d,"test-a",{opening:100,received:0,sold:0,returned:0});
 const r=run(d);assert.equal(r.exit,2);assert.equal(r.body.rejected,1);
 assert.equal(fs.existsSync(path.join(d,"rejected","test-a.json")),true);
});
test("unsupported kind and surplus fields fail closed",t=>{
 const d=lab(t);job(d,"unsafe",{}, "EXEC");
 const r=run(d);assert.equal(r.exit,2);assert.equal(r.body.rejected,1);
});
test("lock collision prevents unreviewed duplicate execution",t=>{
 const d=lab(t);job(d);fs.writeFileSync(path.join(d,"queue.lock"),"simulated");
 const r=run(d);assert.equal(r.exit,3);
 assert.equal(r.body.status,"BUSY_REQUIRES_REVIEW");
 assert.equal(fs.existsSync(path.join(d,"results","test-a.json")),false);
});
test("invalid runner digest cannot become validated output",t=>{
 const d=lab(t);job(d);
 fs.writeFileSync(path.join(d,"runner.cjs"),
  'console.log(JSON.stringify({id:"test-a",kind:"INVENTORY_CHECK",state:"VALIDATED_CALCULATION",output:"13",request_sha256:"bad",output_sha256:"bad"}));');
 const r=run(d);assert.equal(r.exit,2);assert.equal(r.body.rejected,1);
 assert.equal(fs.existsSync(path.join(d,"results","test-a.json")),false);
});

test("tampering with trusted runner stops processing and preserves incoming work",t=>{
 const d=lab(t);job(d);
 fs.appendFileSync(path.join(d,"runner.cjs"),"\n// untrusted altered code\n");
 const r=run(d);
 assert.equal(r.exit,5);
 assert.equal(r.body.status,"RUNNER_INTEGRITY_FAILURE");
 assert.equal(fs.existsSync(path.join(d,"inbox","test-a.json")),true);
 assert.equal(fs.existsSync(path.join(d,"results","test-a.json")),false);
 assert.equal(fs.existsSync(path.join(d,"queue.lock")),false);
});
