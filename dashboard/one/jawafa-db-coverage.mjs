/* Jawafa_DB evidence and coverage rules are deterministic, read-only and client-side.
 * No financial data is mutated; this is NOT a substitute for native TrustSoft enforcement.
 */
export const RULES=Object.freeze([
 {id:"R-01",tables:["Receipt","RecLine"],title:"مطابقة رؤوس الاستلام بالتفاصيل",state:"partial",requires:"تصدير كامل متزامن. RecLine التفاضلي لا يثبت حذف التفاصيل."},
 {id:"R-02",tables:["Receipt"],title:"فحص تكرار رقم فاتورة المورد داخل السنة",state:"partial",requires:"الأصل الضريبي والمورد والسنة ونوع المستند قبل الحظر."},
 {id:"R-03",tables:["Receipt","InvPurchaseVouchersTransactionHistory"],title:"الفروق التاريخية قبل/بعد وإسناد التعديل",state:"partial",requires:"ربط الحدث بالحقل والاعتماد واسم المستخدم من السجل الأصلي."},
 {id:"R-04",tables:["Journal_GL","ARPFrom_gl","ARPTo_GL"],title:"توازن القيود والمطابقة مع مصدرها",state:"needs_verification",requires:"تعريف مفاتيح السنة وأنواع القيود وحالة الترحيل واعتماد مستقل."},
 {id:"R-05",tables:["ARPDocuments","ARPJournal_GL"],title:"دورة حياة الشيك وربطه بكشف البنك",state:"needs_verification",requires:"رقم الشيك وحالة الصرف والكشف البنكي الأصلي لا مجرد غياب الحركة."},
 {id:"R-06",tables:["SlipInfo","SlipItems","PosDeletedItems","Cash"],title:"مطابقة المبيعات والحذوفات والإقفال",state:"needs_verification",requires:"مطابقة يوم/فرع/صندوق/هوية وكاشير وسجل الإذن."},
 {id:"R-07",tables:["Items","ItemsTransActions","RecLine"],title:"تتبع الصنف والكميات والوحدات والمردودات",state:"needs_verification",requires:"الوحدات والتجميع وتحويل الكمية ورصيد أول المدة والباركود."},
 {id:"R-08",tables:["InvoiceMain","ARPJournal_GL"],title:"الضريبة والنسب التعاقدية للاستثمارات",state:"needs_verification",requires:"الربط بالعقد والفرع والفترة وتعريف الضريبة قبل الحساب."},
 {id:"R-09",tables:["TransactionHistory"],title:"سجل تدقيق غير قابل للمحو",state:"blocked",requires:"سجل أحداث مستقل append-only واحتفاظ تاريخي وتوقيت مرجعي."},
 {id:"R-10",tables:["Receipt","Journal_GL"],title:"منع التعديل المالي من التطبيق",state:"app_readonly",requires:"طبقة API وSQL SELECT فقط مع اختبار منع الكتابة على الخادم."}
]);
const VALID_STATES=Object.freeze({
 partial:"مطبق جزئيًا على نسخ التصدير",
 needs_verification:"يحتاج اختبار المصدر والعلاقة",
 blocked:"محجوب حتى تنفيذ حماية مستقلة",
 app_readonly:"واجهة القراءة فقط؛ لا إثبات SQL إنتاجي"
});
const element=(tag,klass,text)=>{const e=document.createElement(tag);if(klass)e.className=klass;if(text!==undefined)e.textContent=String(text);return e;};
const add=(p,tag,k,t)=>{const e=element(tag,k,t);p.append(e);return e;};
export function validateCoverage(raw){
 if(raw?.schema!=="jawafa.db.coverage.v1" || raw?.target_percent!==90 || raw?.percent_goal_achieved!==false
  || raw?.live_sql!==false || raw?.data_mutated!==false || !Array.isArray(raw.stages))throw Error("INVALID_COVERAGE_SCHEMA");
 if(!raw.stages.every(s=>Number.isSafeInteger(s.denominator)||s.denominator===null))throw Error("INVALID_COVERAGE_UNIT");
 return raw;
}
export function normalizeInvoiceRef(v){return String(v??"").trim().toLowerCase().replace(/[\s\-\/]/g,"");}
export function assessPrivateEvidence(kind,headers,rows){
 const col=Object.fromEntries(headers.map((s,i)=>[s,i]));
 const field=(row,key)=>col[key]===undefined?"":String(row[col[key]]??"");
 if(kind==="receipt54"){
  if(!["ChangedFieldNames","FinancialChange","RecNo"].every(x=>x in col))return {status:"needs_verification",reason:"أعمدة التقرير غير مكتملة."};
  const financial=rows.filter(r=>field(r,"FinancialChange").toLowerCase()==="true").length;
  return {status:"correlated",reason:"الفروق مثبتة بين النسختين؛ يجب مطابقة أحداث التعديل مع كل حقل.",counts:[["السجلات المفحوصة",rows.length],["سجلات مالية متغيرة",financial]]};
 }
 if(kind==="crossyear650"){
  if(!["SupplierNo","OriginalInv","RecDate"].every(x=>x in col))return {status:"needs_verification",reason:"تعذر فحص مفتاح المورد والفاتورة والسنة."};
  const grouped=new Map();
  for(const r of rows){const k=field(r,"SupplierNo")+"|"+normalizeInvoiceRef(field(r,"OriginalInv"));if(!grouped.has(k))grouped.set(k,new Set());grouped.get(k).add(field(r,"RecDate").slice(0,4));}
  const multiYear=[...grouped.values()].filter(y=>y.size>1).length;
  return {status:"needs_verification",reason:"إعادة استعمال المرجع بين سنوات ليست إثبات ازدواج دفع أو تزوير.",
    counts:[["المجموعات ضمن التقرير",grouped.size],["مجموعات متعددة السنوات",multiYear]]};
 }
 if(kind==="history360"){
  if(!("ReceiptNo" in col))return {status:"needs_verification",reason:"رقم مرجع الاستلام غير متاح."};
  const keys=new Set(rows.map(r=>field(r,"ReceiptNo")).filter(Boolean));
  return {status:"needs_verification",reason:"المرجع غير مطابق للتصدير المتاح؛ يلزم استعلام تاريخي أصلي.",
    counts:[["عدد الأحداث",rows.length],["المراجع المختلفة",keys.size]]};
 }
 return {status:"needs_verification",reason:"تم التحقق من بصمة التقرير، ولم تُطبق عليه قاعدة حسابية تلقائية."};
}
export async function renderJawafaCoverage(target){
 target.replaceChildren();
 const root=add(target,"section","ts-evidence jw-coverage");
 add(root,"h2","","خريطة قاعدة Jawafa_DB وخطة الوصول إلى 90%");
 add(root,"p","ts-note","القياس يميز بين فهرسة تعريفات التصدير والتحليل الدلالي والعلاقات والتكامل الإنتاجي. لا تُحسب النسب غير المقاسة أو اختبارات المحاكاة كقبول إنتاجي.");
 const status=add(root,"p","ts-note","جارٍ التحقق من مصدر قياس التغطية...");
 try{
  const res=await fetch("./jawafa-db-coverage.json",{cache:"no-store",credentials:"same-origin"});
  if(!res.ok)throw Error("MISSING_DATA");
  const data=validateCoverage(await res.json());
  status.textContent="المصدر: "+data.source+" · هدف التحليل "+data.target_percent+"% · الوصول للهدف: غير مثبت.";
  const grid=add(root,"div","ts-grid");
  for(const stage of data.stages){
   const card=add(grid,"article","ts-panel");
   add(card,"h3","",stage.name_ar);
   const measurable=stage.verified&&stage.denominator&&Number.isSafeInteger(stage.numerator);
   const amount=measurable?stage.numerator+"/"+stage.denominator:"لم يُقَس بعد";
   add(card,"strong","jw-coverage-score",amount);
   add(card,"p","ts-note",stage.measurement);
   add(card,"p","ts-warning",stage.limitation);
  }
  if(data.priority_relation_snapshot && Array.isArray(data.priority_relation_snapshot.relationships)){
    const src=data.priority_relation_snapshot;
    const box=add(root,"section","ts-panel");
    add(box,"h3","","المطابقات المرجعية المجرّبة فعليًا");
    add(box,"p","ts-note","تم اختبار "+src.join_checks_run+" علاقات على تصدير 8 نوفمبر؛ "+src.matched_within_snapshot+" متطابقة في اللقطة و"+src.require_investigation+" تحتاج تحققًا. ليست مفاتيح SQL الرسمية ولا توازنًا محاسبيًا مثبتًا.");
    const grid=add(box,"div","jw-rules");
    for(const rel of src.relationships){
      const c=add(grid,"article","jw-rule");
      add(c,"b","",rel.label);
      add(c,"span","ts-status",rel.classification==="snapshot_linked"?"مفتاح مرتبط في اللقطة":"يحتاج مراجعة");
      add(c,"p","ts-note","سجلات الجدول المرتبط: "+rel.source_rows.toLocaleString("ar-JO")+" · مراجع مختلفة: "+rel.distinct_references.toLocaleString("ar-JO")+" · مراجع دون مقابل: "+rel.without_parent.toLocaleString("ar-JO"));
      add(c,"p","ts-note",rel.caveat);
    }
  }
  const rules=add(root,"section","ts-panel");
  add(rules,"h3","","قواعد التحقق والشاشات المرتبطة — لا كتابة لقاعدة TrustSoft");
  const list=add(rules,"div","jw-rules");
  for(const rule of RULES){
   const item=add(list,"article","jw-rule");
   add(item,"b","",rule.id+" — "+rule.title);
   add(item,"span","ts-status",VALID_STATES[rule.state]);
   add(item,"p","ts-note","مصادر البيانات: "+rule.tables.join(" ⇄ "));
   add(item,"p","ts-note","شرط الإغلاق: "+rule.requires);
  }
  const checks=add(root,"section","ts-panel");
  add(checks,"h3","","اختبارات القبول قبل إعلان 90%");
  const ol=add(checks,"ol","ts-next");
  for(const str of data.acceptance)add(ol,"li","",str);
 }catch{
  status.textContent="تعذر التحقق من مصدر القياس؛ لا تعرض نسبة تقدم تخمينية.";
 }
}
