'use strict';
/* Separate, loopback-only Audit15 preview gateway.
 * Keeps existing JAWAFFASVR production/private gateways unchanged.
 * Audit15 and schema requests go to the owner-verifying sidecar (8794).
 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(process.env.JAWAFA_AUDIT15_PREVIEW_ROOT||'C:\\ProgramData\\JawafaReadOnly\\audit15-private-preview');
const PORT=Number(process.env.JAWAFA_AUDIT15_PREVIEW_PORT||3463),HOST='127.0.0.1';
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const routes=new Set(['/api/jawafa/v1/audit15-ops','/api/jawafa/v1/schema-catalog']);
function baseHeaders(res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
}
function error(res,status,message){
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify({error:message}));
}
function proxy(req,res,port,targetPath=req.url){
  const up=http.request({hostname:'127.0.0.1',port,path:targetPath,method:req.method,
    timeout:7000,headers:{Authorization:req.headers.authorization||'',Accept:'application/json'}},r=>{
      res.writeHead(r.statusCode||502,{
        'Content-Type':r.headers['content-type']||'application/json; charset=utf-8',
        'Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff',
        'Vary':'Authorization'
      });
      r.pipe(res);
    });
  up.once('timeout',()=>up.destroy(Error('UPSTREAM_TIMEOUT')));
  up.once('error',()=>{if(!res.headersSent)error(res,503,'PRIVATE_GATEWAY_UNAVAILABLE');else res.end()});
  req.pipe(up);
}
function handler(req,res){
  baseHeaders(res);
  let url;
  try{url=new URL(req.url,'http://127.0.0.1')}catch{return error(res,400,'INVALID_URL')}
  if(routes.has(url.pathname))return proxy(req,res,8794);
  if(url.pathname==='/api/jawafa/v1/live-schema-proof')return proxy(req,res,8795);
  if(url.pathname.startsWith('/api/jawafa/v1/'))return proxy(req,res,8788);
  if(url.pathname==='/api/export-status')return proxy(req,res,3461,'/api/status');
  if(!['GET','HEAD'].includes(req.method))return error(res,405,'METHOD_NOT_ALLOWED');
  let pathname;
  try{pathname=decodeURIComponent(url.pathname)}catch{return error(res,400,'INVALID_PATH')}
  if(pathname==='/'||pathname==='')pathname='/index.html';
  if(!/^[a-zA-Z0-9_./-]+$/.test(pathname))return error(res,404,'NOT_FOUND');
  const filename=path.resolve(ROOT,'.'+pathname);
  if(!filename.startsWith(ROOT+path.sep)||!Object.hasOwn(MIME,path.extname(filename).toLowerCase()))
    return error(res,404,'NOT_FOUND');
  let stat;
  try{stat=fs.lstatSync(filename)}catch{return error(res,404,'NOT_FOUND')}
  if(!stat.isFile()||stat.isSymbolicLink())return error(res,404,'NOT_FOUND');
  res.writeHead(200,{'Content-Type':MIME[path.extname(filename).toLowerCase()],
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD')return res.end();
  const stream=fs.createReadStream(filename);
  stream.on('error',()=>{if(!res.headersSent)error(res,503,'READ_FAILED');else res.destroy()});
  stream.pipe(res);
}
if(require.main===module){
  if(!Number.isSafeInteger(PORT)||PORT<1024||PORT>65535)throw Error('INVALID_PORT');
  http.createServer(handler).listen(PORT,HOST,()=>process.stdout.write('AUDIT15_PRIVATE_PREVIEW_LOOPBACK '+PORT+'\n'));
}
module.exports={handler};
