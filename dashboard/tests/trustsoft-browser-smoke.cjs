"use strict";
/* Browser-level native TrustSoft integration smoke: localhost only, no credentials or production API calls. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const os = require("node:os");
const {spawn,execFileSync} = require("node:child_process");
const dashboard = path.resolve(__dirname,"..");
const injection = String.raw\`
<script>
(() => {
  function result(pass,reason) {
    const tag=document.createElement('output');
    tag.id='trustsoft-real-browser-result';
    tag.dataset.verdict=pass?'PASS':'FAIL';
    tag.textContent=reason;
    document.body.appendChild(tag);
  }
  async function check() {
    const section=document.querySelector('section.view[data-view="jawafa-trustsoft"]');
    const toggle=document.getElementById('trustsoft-toggle');
    const host=document.getElementById('trustsoft-container');
    if(!section||!toggle||!host)return result(false,'missing-host');
    if(section.hidden)return result(false,'trustsoft-section-not-shown');
    if(host.hidden)toggle.click();
    for(let attempt=0;attempt<80;attempt++) {
      if(host.shadowRoot?.querySelectorAll('nav button').length===12)break;
      await new Promise(r=>setTimeout(r,75));
    }
    const shadow=host.shadowRoot;
    if(!shadow)return result(false,'no-shadowroot');
    if(shadow.querySelectorAll('nav button').length!==12)return result(false,'not-twelve-screens');
    if(document.getElementById('trustsoft-frame') || document.querySelector('iframe#trustsoft-frame'))return result(false,'iframe-still-present');
    if(!shadow.getElementById('insights'))return result(false,'insights-not-mounted');
    if(shadow.getElementById('login-role')?.value!=='viewer')return result(false,'viewer-default-not-enforced');
    if(toggle.getAttribute('aria-expanded')!=='true')return result(false,'toggle-not-expanded');
    toggle.click();
    if(!host.hidden || toggle.getAttribute('aria-expanded')!=='false')return result(false,'panel-not-closed');
    result(true,'12-native-views; ShadowRoot; viewer-default; no-iframe; closes');
  }
  window.addEventListener('load',()=>setTimeout(()=>check().catch(e=>result(false,String(e))),200),{once:true});
})();
</script>\`;
const chrome = process.env.CHROME||["google-chrome","chromium","chromium-browser"].find(c=>{
  try{execFileSync("which",[c],{stdio:"ignore"});return true;}catch{return false;}
});
assert.ok(chrome,"Chrome/Chromium binary missing");
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".mjs":"text/javascript; charset=utf-8"};
function serve(req,res){
 let url;
 try{url=new URL(req.url,"http://127.0.0.1");}catch{res.writeHead(400).end();return;}
 const rel=url.pathname==="/"?"/index.html":url.pathname;
 const file=path.resolve(dashboard,"."+rel);
 if(!file.startsWith(dashboard+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,buffer)=>{
  if(error){res.writeHead(404).end();return;}
  let body=buffer;
  if(rel==="/index.html"){
   const source=buffer.toString("utf8");
   assert.ok(source.includes("</body>"),"main index needs closing body for browser probe");
   body=Buffer.from(source.replace("</body>",injection+"\n</body>"),"utf8");
  }
  res.writeHead(200,{"Content-Type":types[path.extname(file)]||"application/octet-stream","Cache-Control":"no-store"});
  res.end(body);
 });
}
(async()=>{
 const server=http.createServer(serve);
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const url="http://127.0.0.1:"+server.address().port+"/index.html#jawafa-trustsoft";
 const child=spawn(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--no-first-run","--disable-background-networking","--disable-extensions","--virtual-time-budget=12000","--dump-dom",url],{stdio:["ignore","pipe","ignore"]});
 let stdout="",stderr="";
 child.stdout.on("data",chunk=>{stdout+=chunk.toString();if(stdout.length>15*1024*1024)child.kill();});
 child.stderr.on("data",chunk=>{stderr+=chunk.toString().slice(0,2500);});
 const timeout=setTimeout(()=>child.kill(),65000);
 try{
  const code=await new Promise((resolve,reject)=>{child.on("close",resolve);child.on("error",reject);});
  assert.equal(code,0,"Chrome failed "+stderr.slice(-1500));
  const match=stdout.match(/<output id="trustsoft-real-browser-result" data-verdict="(PASS|FAIL)">([^<]+)<\/output>/);
  assert.ok(match,"TrustSoft browser probe failed to render a result");
  assert.equal(match[1],"PASS",match[2]);
  console.log("PASS: "+match[2]);
 }finally{clearTimeout(timeout);await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
