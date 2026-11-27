/* AUDIT-15: native Jawafa export view, owner-only private API. No static financial data. */
import {validateAudit15,filterAudit15} from './audit15-model.mjs';
const root=document.querySelector('[data-view="jawafa-export"]');
if(root){
 const el=id=>document.getElementById(id);
 const state={report:null};
 const cell=(tr,value)=>{const td=document.createElement('td');td.textContent=String(value??'—').slice(0,320);tr.append(td)};
 const number=x=>Number(x).toLocaleString('ar-JO',{maximumFractionDigits:0});
 const status=(message,tone='bad')=>{el('audit15-status').textContent=message;el('audit15-status').className='pill '+tone};
 function empty(bodyId,cols,message){
  const body=el(bodyId);body.replaceChildren();
  const row=document.createElement('tr'),td=document.createElement('td');
  td.colSpan=cols;td.textContent=message;row.append(td);body.append(row);
 }
 function clear(message='NOT_CONNECTED'){
  state.report=null;
  for(const id of ['audit15-table-count','audit15-full-count','audit15-delta-count','audit15-history-count'])el(id).textContent='—';
  el('audit15-provenance').textContent='لا توجد لقطة موثقة متاحة عبر بوابة خاصة.';
  empty('audit15-table-body',6,'لا توجد بيانات مالية من خدمة خاصة موثوقة.');
  empty('audit15-exceptions',5,'لا توجد استثناءات موثقة من خدمة خاصة.');
  status(message,'bad');
 }
 function renderTables(){
  if(!state.report)return;
  const data=filterAudit15(state.report,el('audit15-query').value);
  const target=el('audit15-table-body');target.replaceChildren();
  for(const table of data){
   const tr=document.createElement('tr');
   const label=table.mode==='FULL'?'نسخة كاملة':'فروقات دورة';
   for(const v of [table.table,table.domain,label,number(table.export_row_count),
    number(table.source_inventory_total),'SHA-256 ✓ | CSV ✓'])cell(tr,v);
   target.append(tr);
  }
  if(!data.length)empty('audit15-table-body',6,'لا توجد جداول تطابق البحث');
 }
 function renderFindings(){
  const body=el('audit15-exceptions');body.replaceChildren();
  for(const [name,data] of Object.entries(state.report.financial_aggregate_differences)){
   const tr=document.createElement('tr');
   for(const v of ['dbo.'+name,number(data.added),number(data.changed_shared),number(data.missing_in_new),
     'فرق تاريخي فقط — يحتاج مطابقة'])cell(tr,v);
   body.append(tr);
  }
 }
 function render(){
  const d=state.report;
  el('audit15-table-count').textContent=number(d.verified_latest_tables);
  el('audit15-full-count').textContent=number(d.verified_latest_full);
  el('audit15-delta-count').textContent=number(d.verified_latest_delta);
  el('audit15-history-count').textContent=number(d.transaction_history_continuity.reconstructed_total);
  el('audit15-provenance').textContent='تصدير '+d.snapshot_name+
    ' · '+number(d.latest_export_rows_total)+' صفًا مصدّرًا · تحقق SHA لكل الملفات · بيانات تاريخية وليست SQL حيًا · الوقت والمستخدم البشري غير مثبتين';
  renderTables();renderFindings();status('VERIFIED_EXPORT_ONLY','ok');
 }
 async function refresh(){
  if(document.hidden)return;
  el('audit15-refresh').disabled=true;clear('جاري التحقق من المصدر الخاص...');
  const c=new AbortController(),timeout=setTimeout(()=>c.abort(),8000);
  try{
   const user=window.firebase?.auth?.()?.currentUser;
   if(!user||!user.emailVerified)throw Error('NOT_AUTHENTICATED');
   const token=await user.getIdToken();
   const response=await fetch('/api/jawafa/v1/audit/15',{
    headers:{Accept:'application/json',Authorization:'Bearer '+token},
    cache:'no-store',credentials:'same-origin',signal:c.signal
   });
   if(!response.ok)throw Error('PRIVATE_GATEWAY_'+response.status);
   state.report=validateAudit15(await response.json());
   render();
  }catch(err){
   clear(String(err?.message||'NOT_CONNECTED').replace(/[^A-Z0-9_]/g,'').slice(0,50)||'NOT_CONNECTED');
  }finally{clearTimeout(timeout);el('audit15-refresh').disabled=false}
 }
 el('audit15-refresh').addEventListener('click',refresh);
 el('audit15-query').addEventListener('input',()=>{if(state.report)renderTables()});
 window.addEventListener('hashchange',()=>{
  if(location.hash==='#jawafa-export')refresh();
  else if(state.report)clear('SESSION_CLEARED');
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.report)clear('SESSION_CLEARED')});
 try{window.firebase?.auth?.().onAuthStateChanged(user=>{if(!user&&state.report)clear('NOT_AUTHENTICATED')})}catch{}
 if(location.hash==='#jawafa-export')refresh();
}
