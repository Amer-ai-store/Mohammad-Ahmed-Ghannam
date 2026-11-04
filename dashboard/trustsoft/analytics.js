/* Deterministic, read-only TrustSoft analysis. No LLM claims or accounting totals from samples. */
(()=>{
 "use strict";
 function analyze(snapshot){
  const data=snapshot?.data;
  const sections=data && data.sections && typeof data.sections==='object' ? Object.entries(data.sections) : [];
  const rows=sections.map(([name,value])=>({
   section:String(name),
   sampleRows:Array.isArray(value?.rows)?value.rows.length:0,
   state:String(value?.state||'unverified'),
   scope:String(value?.scope||'غير معتمد')
  }));
  const catalog=Array.isArray(data?.catalog)?data.catalog:[];
  const ok=snapshot?.state==='connected' && snapshot?.stale===false && (catalog.length>0||sections.length>0);
  const stale=!ok;
  const anomalies=[];
  if(!data)anomalies.push('لم يصل أي سجل مصدر مصادق عليه');
  if(rows.some(r=>r.sampleRows>=200))anomalies.push('هناك عينات بلغت سقف 200 صف، فلا تصلح كإجماليات');
  if(rows.some(r=>r.state!=='sample'&&r.state!=='ready'&&r.state!=='verified'))anomalies.push('أقسام بلا ربط بيانات معتمد');
  if(stale)anomalies.push('القراءة الحية غير مثبتة أو قديمة');
  return Object.freeze({
   evidence:ok?'AUTHENTICATED_SAMPLE_ONLY':'UNVERIFIED_OR_STALE',
   tableCatalogCount:catalog.length,
   sampleRowCount:rows.reduce((n,r)=>n+r.sampleRows,0),
   sections:rows,
   anomalies,
   sourceTime:snapshot?.last_success||null,
   financialTotalsAllowed:false,
   aiProviderActive:false
  });
 }
 globalThis.TrustSoftInsights=Object.freeze({analyze});
})();