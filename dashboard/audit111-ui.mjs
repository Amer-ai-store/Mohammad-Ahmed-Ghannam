/* AUDIT-111 inside the unified Jawafa dashboard. No backend deployment is implied. */
import {validateEnvelope,validateReport,visibleActor,summarize,filterEvents,DOCUMENT_TYPES} from "./audit111/model.mjs";
const root=document.querySelector('[data-view="jawafa-audit111"]');
if(root){
  const $=id=>document.getElementById(id);
  const cell=(row,value)=>{const td=document.createElement("td");td.textContent=String(value==null?"—":value).slice(0,260);row.append(td)};
  const state={events:[],verifiedAt:null,snapshot:null,riskTotals:null,total:null,report:null};
  function status(message,tone="warn"){
    const target=$("audit111-status");
    target.textContent=message;
    target.className="pill "+(tone==="ok"?"ok":tone==="bad"?"bad":"warn");
  }
  function clear(message="NOT_CONNECTED"){
    state.events=[];state.verifiedAt=null;state.snapshot=null;state.riskTotals=null;state.total=null;state.report=null;
    for(const level of ["P0","P1","P2"]) $("audit111-"+level).textContent="—";
    $("audit111-verified").textContent="—";
    $("audit111-snapshot").textContent="لا توجد لقطة متحققة";
    $("audit111-rows").replaceChildren();
    const tr=document.createElement("tr");const td=document.createElement("td");
    td.colSpan=9;td.textContent="لا توجد أحداث مالية متاحة من بوابة خاصة موثوقة.";
    tr.append(td);$("audit111-rows").append(tr);
    status(message,"bad");
    for(const id of ["audit111-report-new","audit111-report-purchases","audit111-report-returns","audit111-report-rekeys","audit111-report-cost"])
      $(id).textContent="—";
    $("audit111-report-provenance").textContent="غير متصل";
    $("audit111-report-status").textContent="NOT_CONNECTED";
    $("audit111-report-status").className="pill bad";
    for(const [id,colspan] of [["audit111-report-catalog",3],["audit111-report-records",6]]){
      const root=$(id);root.replaceChildren();
      const tr=document.createElement("tr"),td=document.createElement("td");
      td.colSpan=colspan;td.textContent="لا توجد تقارير خاصة موثقة أو جلسة مصرح بها";
      tr.append(td);root.append(tr);
    }
  }
  const displayNumber=(v,precision=2)=>typeof v==="number"&&Number.isFinite(v)?
    v.toLocaleString("ar-JO",{minimumFractionDigits:precision,maximumFractionDigits:precision}):"—";
  function renderReportRecords(){
    const report=state.report;if(!report)return;
    const kind=$("audit111-report-kind").value,rows=report.cases[kind]||[];
    const body=$("audit111-report-records");body.replaceChildren();
    for(const e of rows){
      const tr=document.createElement("tr");
      const values=kind==="purchase_changes"?
        ["فاتورة مشتريات",e.receipt,displayNumber(Number(e.old_amount),3),
         displayNumber(Number(e.new_amount),3),displayNumber(Number(e.amount_delta),3),
         "DIFF_ONLY · "+e.posted_old+" ← "+e.posted_new]:
        kind==="returns"?
        ["مردود مشتريات",e.voucher_no,"—",displayNumber(Number(e.return_amount),3),
         displayNumber(Number(e.return_amount),3),
         "CANDIDATE_GL · "+e.return_transaction]:
        ["تغيّر مرجع حركة",e.old_invoice_no,e.old_trans_no,
         (e.same_invoice_and_supplier_other_transaction_keys||[]).join(","),
         displayNumber(Number(e.old_amount),3),"REVIEW_REQUIRED · ليس حذفًا مثبتًا"];
      for(const value of values)cell(tr,value);
      body.append(tr);
    }
    if(!rows.length){const tr=document.createElement("tr"),td=document.createElement("td");
      td.colSpan=6;td.textContent="لا توجد حالات من هذا النوع";tr.append(td);body.append(tr)}
  }
  function renderReport(){
    const p=state.report;if(!p)return;const s=p.summary;
    const map={"audit111-report-new":s.new_events,"audit111-report-purchases":s.purchase_value_changed,
      "audit111-report-returns":s.posted_returns_with_gl_candidate,
      "audit111-report-rekeys":s.invoice_reference_rekeys};
    for(const [id,v] of Object.entries(map))$(id).textContent=displayNumber(v,0);
    $("audit111-report-cost").textContent=displayNumber(Number(s.net_purchase_cost_field_delta),3);
    $("audit111-report-provenance").textContent="لقطة "+p.snapshot_id.slice(0,16)+" · "+p.source_kind+" · "+p.verified_at;
    const body=$("audit111-report-catalog");body.replaceChildren();
    for(const r of p.reports){const tr=document.createElement("tr");
      for(const v of [r.title,displayNumber(r.count,0),r.state])cell(tr,v);
      body.append(tr)}
    renderReportRecords();
    $("audit111-report-status").textContent="PRIVATE_REPORT_VERIFIED";
    $("audit111-report-status").className="pill ok";
  }
  function render(){
    const counts=state.riskTotals||summarize(state.events);
    for(const level of ["P0","P1","P2"]) $("audit111-"+level).textContent=counts[level];
    $("audit111-verified").textContent=state.verifiedAt;
    $("audit111-snapshot").textContent="رقم اللقطة: "+state.snapshot+" · آخر "+state.events.length+" من "+state.total+" حدث · البحث في السجلات المعروضة فقط · وقت الخادم غير متزامن";
    const events=filterEvents(state.events,$("audit111-query").value,
      $("audit111-type").value,$("audit111-risk").value);
    const body=$("audit111-rows");body.replaceChildren();
    if(!events.length){
      const row=document.createElement("tr");const td=document.createElement("td");
      td.colSpan=9;td.textContent="لا توجد أحداث مطابقة للمرشحات في هذه اللقطة.";
      row.append(td);body.append(row);return;
    }
    for(const event of events){
      const row=document.createElement("tr");
      for(const value of [
        event.severity,event.document_type,event.document_id,
        event.event_at||(event.event_time_raw?event.event_time_raw+" (وقت المصدر غير معتمد)":"غير مثبت"),event.observed_at,visibleActor(event),
        (event.field||"—")+" : "+(event.before??"—")+" ← "+(event.after??"—"),
        event.evidence_level,event.source_ref
      ])cell(row,value);
      body.append(row);
    }
  }
  async function refresh(){
    if(document.hidden || !root.classList.contains("view"))return;
    $("audit111-refresh").disabled=true;
    clear("جاري التحقق من المصدر الخاص...");
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),8000);
    try{
      const auth=window.firebase?.auth?.();
      const user=auth?.currentUser;
      if(!user || !user.emailVerified)throw new Error("NOT_AUTHENTICATED");
      const token=await user.getIdToken();
      const res=await fetch("/api/jawafa/v1/audit/111?limit=100",{
        headers:{"Accept":"application/json","Authorization":"Bearer "+token},
        cache:"no-store",credentials:"same-origin",signal:controller.signal
      });
      if(!res.ok)throw new Error("PRIVATE_GATEWAY_"+res.status);
      const payload=validateEnvelope(await res.json());
      const reportResponse=await fetch("/api/jawafa/v1/audit/111/reports",{
        headers:{"Accept":"application/json","Authorization":"Bearer "+token},
        cache:"no-store",credentials:"same-origin",signal:controller.signal
      });
      if(!reportResponse.ok)throw new Error("PRIVATE_REPORT_GATEWAY_"+reportResponse.status);
      const report=validateReport(await reportResponse.json(),payload.snapshot_id);
      state.events=payload.events;state.verifiedAt=payload.verified_at;
      state.snapshot=payload.snapshot_id;state.riskTotals=payload.risk_totals;
      state.total=payload.history_record_count;state.report=report;
      render();renderReport();
      status("SOURCE_VERIFIED — مصدر تاريخي خاص، لا يثبت هوية الأشخاص أو الخسارة","ok");
    }catch(err){
      const code=String(err?.message||"UNKNOWN").replace(/[^A-Z0-9_]/g,"").slice(0,48);
      clear(code||"NOT_CONNECTED");
    }finally{clearTimeout(timeout);$("audit111-refresh").disabled=false}
  }
  const type=$("audit111-type");
  for(const key of DOCUMENT_TYPES){
    const option=document.createElement("option");option.value=key;option.textContent=key;
    type.append(option);
  }
  for(const id of ["audit111-type","audit111-risk","audit111-query"])
    $(id).addEventListener(id==="audit111-query"?"input":"change",()=>{if(state.verifiedAt)render()});
  $("audit111-refresh").addEventListener("click",refresh);
  $("audit111-report-kind").addEventListener("change",renderReportRecords);
  window.addEventListener("hashchange",()=>{
    if(location.hash==="#jawafa-audit111")refresh();
    else if(state.events.length)clear();
  });
  document.addEventListener("visibilitychange",()=>{if(document.hidden && state.events.length)clear("SESSION_CLEARED")});
  try{window.firebase?.auth?.().onAuthStateChanged(user=>{if(!user && state.events.length)clear("NOT_AUTHENTICATED")})}catch{}
  if(location.hash==="#jawafa-audit111")refresh();
}
