'use strict';
/* Private owner-only AUDIT111 review, over Tailscale Serve HTTPS.
 * Binds to loopback ONLY. Never publishes a listener, public dashboard, or source SQL.
 * Parent code is the existing unified dashboard; no separate UI is created.
 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {createBridge}=require('./server.cjs');
const {createAudit111Reader}=require('./audit111-read.cjs');
const {createAudit111ReportReader}=require('./audit111-reports.cjs');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.json':'application/json; charset=utf-8','.svg':'image/svg+xml',
 '.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg',
 '.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2'};
function staticFiles(root){
 const rootAbs=path.resolve(root);
 if(!fs.statSync(rootAbs).isDirectory())throw Error('DASHBOARD_ROOT_NOT_DIRECTORY');
 return function(req,res){
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"frame-ancestors 'none'; base-uri 'self'");
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
  let urlPath;
  try{urlPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);res.end();return}
  if(urlPath==='/'||urlPath==='/dashboard')urlPath='/index.html';
  const parts=urlPath.split('/');
  if(parts.some(x=>x==='..'||x.startsWith('.'))){res.writeHead(404);res.end();return}
  const full=path.resolve(rootAbs,'.'+urlPath);
  if(!full.startsWith(rootAbs+path.sep)){res.writeHead(404);res.end();return}
  const ext=path.extname(full).toLowerCase(),type=MIME[ext];
  if(!type){res.writeHead(404);res.end();return}
  let stat;
  try{stat=fs.statSync(full)}catch{res.writeHead(404);res.end();return}
  if(!stat.isFile()||stat.size>12*1024*1024){res.writeHead(404);res.end();return}
  res.writeHead(200,{'Content-Type':type,'Content-Length':stat.size});
  if(req.method==='HEAD'){res.end();return}
  fs.createReadStream(full).pipe(res);
 };
}
function launch(config={}){
 if(config.allowed!==true)throw Error('STAGING_RELEASE_NOT_AUTHORIZED');
 const required=['databaseFile','exportDir','reportFile','ledgerFile','dashboardDir','ownerEmail','uidPinFile'];
 if(required.some(x=>!config[x]))throw Error('STAGING_PRIVATE_CONFIG_MISSING');
 const {createAudit111Reader}=require('./audit111-read.cjs');
 const history=createAudit111Reader({databaseFile:config.databaseFile,exportDir:config.exportDir});
 let reports,command;
 try{
  reports=createAudit111ReportReader({reportFile:config.reportFile,audit111Reader:history});
  // Exact Google email is enforced inside verified signed Firebase JWT validator.
  process.env.JAWAFA_OWNER_EMAIL=config.ownerEmail;
  process.env.JAWAFA_OWNER_UID_FILE=config.uidPinFile;
  command=createBridge({databaseFile:config.ledgerFile,
    audit111Reader:history,audit111ReportReader:reports,
    audit111ReleaseAllowed:true});
 }catch(e){history.close();throw e}
 const staticHandler=staticFiles(config.dashboardDir);
 const server=http.createServer((req,res)=>{
  const p=new URL(req.url,'http://localhost').pathname;
  return p.startsWith('/api/jawafa/v1/')?command.handler(req,res):staticHandler(req,res);
 });
 const port=config.port||8791;
 if(port<1024||port>65535)throw Error('STAGING_INVALID_PORT');
 server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({
  status:'PRIVATE_LOOPBACK_QA_READY',bind:'127.0.0.1',port,
  archive_integrity_verified:true,private_report_checksum_verified:true,
  public_listener:false,production_release:false
 })));
 return {server,close:async()=>{await new Promise(ok=>server.close(ok));command.close();history.close()}};
}
if(require.main===module){
 launch({
  allowed:process.env.JAWAFA_PRIVATE_QA_ENABLE==='true',
  databaseFile:process.env.JAWAFA_AUDIT_ARCHIVE,
  exportDir:process.env.JAWAFA_AUDIT_EXPORT,
  reportFile:process.env.JAWAFA_AUDIT_REPORT,
  ledgerFile:process.env.JAWAFA_AUDIT_QA_LEDGER,
  dashboardDir:process.env.JAWAFA_DASHBOARD_STAGE_DIR,
  ownerEmail:process.env.JAWAFA_OWNER_EMAIL,
  uidPinFile:process.env.JAWAFA_OWNER_UID_FILE,
  port:Number(process.env.JAWAFA_PRIVATE_QA_PORT||8791)
 });
}
module.exports={launch,staticFiles};
