/* Owner-only JAWAFA read-only KPI adapter for the approved central dashboard.
 * No raw SQL data/credentials in public assets. Fail closed on GitHub Pages.
 */
(()=>{
 'use strict';
 const root=document.getElementById('jawafa-secure-kpis');
 if(!root)return;
 const status=document.getElementById('jawafa-secure-kpis-status');
 const refresh=document.getElementById('jawafa-secure-kpis-refresh');
 const metrics=['sales','purchases','inventory','payables','postdated_cheques'];
 const fmt=new Intl.NumberFormat('ar-JO',{maximumFractionDigits:3});
 const reset=()=>{
   metrics.forEach(k=>{const n=root.querySelector('[data-sql-kpi="'+k+'"]');if(n)n.textContent='—'});
 };
 function gatewayReady(){
   // A static host cannot protect same-origin bearer requests or proxy local SQL.
   const host=location.hostname.toLowerCase();
   return host!=='amer-ai-store.github.io'&&!host.endsWith('.github.io');
 }
 function verify(value){
   if(!value||value.format!=='jawafa-performance-v1'||
      value.source_system!=='Jawafa_DB'||value.data_verified!==true||
      value.read_only!==true||value.verification?.sql_login!=='user_read'||
      value.verification?.tls_encrypted!==true||
      value.verification?.tls_certificate_trusted!==true||
      value.verification?.deny_write_test_passed!==true)
     throw Error('SOURCE_NOT_VERIFIED');
   const result={};
   for(const key of metrics){
     const v=value.metrics?.[key]?.today;
     if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)))throw Error('INVALID_SQL_METRICS');
     result[key]=v;
   }
   return result;
 }
 async function run(){
   reset();
   if(!gatewayReady()){
     status.textContent='NOT_CONNECTED — الموقع العام يحتاج بوابة HTTPS خاصة محمية؛ لا يمكن الاتصال المباشر بـ SQL.';
     return;
   }
   let jwt=null;
   const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8000);
   try{
     const owner=window.AAS_OWNER_AUTH;
     if(!owner||typeof owner.getIdToken!=='function')throw Error('OWNER_AUTH_UNAVAILABLE');
     jwt=await owner.getIdToken();
     if(!jwt)throw Error('NOT_AUTHENTICATED');
     const opts={method:'GET',credentials:'same-origin',cache:'no-store',
       headers:{Accept:'application/json',Authorization:'Bearer '+jwt},signal:ctrl.signal};
     // Stage 1: owner-authenticated SQL connectivity proof, never raw accounting rows.
     const healthResponse=await fetch('/api/jawafa/v1/sql-health',opts);
     const health=await healthResponse.json().catch(()=>({}));
     if(!healthResponse.ok)throw Error(String(health.error||'SQL_HEALTH_'+healthResponse.status).slice(0,110));
     if(health.schema!=='jawafa.sql-connectivity.v1'||health.sql_login!=='user_read'||
       health.source_system!=='Jawafa_DB'||health.sql_read_proven!==true||
       health.read_only!==true||health.writer_role!==false)
       throw Error('SQL_HEALTH_NOT_VERIFIED');
     if(health.production_accepted!==true||health.certificate_trusted!==true){
       status.textContent='متصل محليًا بقاعدة Jawafa_DB بحساب user_read للقراءة فقط · شهادة SQL أو اعتماد الإنتاج لم يكتمل · الأرقام المالية محجوبة';
       return;
     }
     // Stage 2: accept aggregate financial KPIs only after the separate production gate.
     const res=await fetch('/api/jawafa/v1/performance',opts);
     const value=await res.json().catch(()=>({}));
     if(!res.ok)throw Error(String(value.error||'HTTP_'+res.status).slice(0,110));
     const data=verify(value);
     metrics.forEach(k=>{root.querySelector('[data-sql-kpi="'+k+'"]').textContent=data[k]===null?'غير متوفر':fmt.format(data[k])});
     status.textContent='VERIFIED • Jawafa_DB • user_read • قراءة مشفّرة فقط • آخر فحص: '+value.verified_at;
   }catch(e){reset();status.textContent='NOT_CONNECTED — '+String(e?.message||'SOURCE_UNAVAILABLE').slice(0,140)}
   finally{clearTimeout(timer);jwt=null}
 }
 refresh?.addEventListener('click',run);
 // No automatic JWT exposure or cross-site background traffic from GitHub Pages.
})();
