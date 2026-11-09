// TrustSoft forensic export evidence in JAWAFA ONE AI.
// Public GitHub Pages: aggregate-only, dated snapshot; NEVER a live SQL feed.
// Private CSV files: selected locally, validated by SHA-256, never sent/stored.
export const TRUSTSOFT_SUMMARY_URL = "./trustsoft-public-summary.json";
export const AUDIT_STATES = Object.freeze({
  verified:"مثبت من التصدير", verified_difference:"فارق مثبت - سببه غير مثبت",
  correlated:"ارتباط زمني - يحتاج إسنادًا", needs_verification:"يحتاج تحققًا"
});
const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.append(document.createTextNode(String(text)));
  return e;
};
export function validatePublicSummary(raw) {
  if (!raw || raw.schema !== "jawafa.trustsoft.audit.public-summary.v1"
    || raw.classification !== "PUBLIC_AGGREGATE_ONLY_NO_IDENTIFIERS_NO_AMOUNTS"
    || raw.analysis_completion_verified !== false
    || raw.provenance?.live_db_connected !== false
    || !Array.isArray(raw.findings) || !Array.isArray(raw.evidence_files)) throw Error("INVALID_PUBLIC_EVIDENCE_SCHEMA");
  const allowed = new Set(Object.keys(AUDIT_STATES));
  if (!raw.findings.every(f => /^[a-z-]+$/.test(f.id) && allowed.has(f.status)
      && Array.isArray(f.facts) && f.facts.every(p => Array.isArray(p) && p.length === 2
      && typeof p[0] === "string" && Number.isSafeInteger(p[1]) && p[1] >= 0))) throw Error("INVALID_PUBLIC_EVIDENCE_FACT");
  if (!raw.evidence_files.every(f => /^[a-z0-9]+$/.test(f.id) && /^[A-Za-z0-9_]+\.csv$/.test(f.file)
      && /^[a-f0-9]{64}$/.test(f.sha256) && Number.isSafeInteger(f.rows))) throw Error("INVALID_PRIVATE_FILE_REGISTRY");
  return raw;
}
// RFC4180-like parser, including escaped quotes and embedded newlines; no network involved.
export function parsePrivateCsv(text, maxRows = 1500) {
  if (typeof text !== "string" || text.length > 2_000_000) throw Error("FILE_TOO_LARGE");
  const out=[];let row=[],field="",quoted=false;
  text=text.replace(/^\uFEFF/,"");
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){
      if(c === '"' && text[i+1] === '"'){field+='"';i++;}
      else if(c === '"')quoted=false;
      else field+=c;
    }else if(c === '"'){
      if(field !== "")throw Error("MALFORMED_CSV");
      quoted=true;
    }else if(c === ","){row.push(field);field="";}
    else if(c === "\r" || c === "\n"){
      row.push(field);field="";
      if(row.some(v=>v!==""))out.push(row);
      if(out.length>maxRows+1)throw Error("TOO_MANY_ROWS");
      row=[];if(c==="\r" && text[i+1]==="\n")i++;
    }else field+=c;
  }
  if(quoted)throw Error("UNTERMINATED_CSV_QUOTE");
  if(field || row.length){row.push(field);out.push(row);}
  if(!out.length || !out[0].length)throw Error("EMPTY_CSV");
  if(out.some(r=>r.length!==out[0].length))throw Error("INCONSISTENT_CSV_COLUMNS");
  return {headers:out[0],rows:out.slice(1)};
}
export async function fingerprintSha256(buffer) {
  if(!globalThis.crypto?.subtle)throw Error("SHA256_NOT_AVAILABLE");
  const digest=await globalThis.crypto.subtle.digest("SHA-256",buffer);
  return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,"0")).join("");
}
const make = (parent,tag,className,text) => {
  const n=el(tag,className,text);parent.append(n);return n;
};
function safePlainRow(headers, row) {
  return headers.slice(0,12).map((h,i)=>({name:h,value:String(row[i]??"").slice(0,300)}));
}
function installPrivateReader(target,registry){
  const area=make(target,"section","ts-panel");
  make(area,"h3","","ملفات الأدلة الخاصة — عرض محلي فقط");
  make(area,"p","ts-note","اختر تقرير CSV محفوظًا على جهاز مصرح به. لا يرفع التطبيق الملف ولا يخزنه في Firebase أو المتصفح، ويتحقق من SHA256 قبل العرض.");
  const input=make(area,"input","ts-file-input");
  input.type="file";input.accept=".csv,text/csv";input.setAttribute("aria-label","استيراد ملف دليل CSV خاص للعرض المحلي");
  const status=make(area,"p","ts-note","لم يتم اختيار ملف خاص.");
  const clear=make(area,"button","ts-clear","مسح العرض المحلي");
  clear.type="button";
  const details=make(area,"div","ts-private-results");
  let nonce=0;
  const reset=()=>{nonce++;input.value="";details.replaceChildren();status.textContent="لا توجد بيانات معاملة محملة في الواجهة.";};
  clear.addEventListener("click",reset);
  input.addEventListener("change",async()=>{
    const generation=++nonce;
    details.replaceChildren();
    const file=input.files?.[0];if(!file){status.textContent="لم يتم اختيار ملف.";return;}
    const entry=registry.find(x=>x.file===file.name);
    if(!entry){status.textContent="الملف غير موجود ضمن سجل الأدلة المعتمدة. لا عرض.";return;}
    if(file.size>2_000_000){status.textContent="الملف أكبر من الحد الآمن. لا عرض.";return;}
    status.textContent="فحص بصمة الملف قبل العرض...";
    try {
      const buffer=await file.arrayBuffer();
      const hash=await fingerprintSha256(buffer);
      if(generation!==nonce)return;
      if(hash!==entry.sha256){status.textContent="البصمة لا تطابق النسخة المرجعية؛ رُفض العرض.";return;}
      const csv=parsePrivateCsv(new TextDecoder("utf-8",{fatal:true}).decode(buffer));
      if(csv.rows.length!==entry.rows)throw Error("ROW_COUNT_MISMATCH");
      status.textContent="بصمة الملف وعدد الأسطر مطابقان. عرض محلي مؤقت لـ"+csv.rows.length+" سجلًا.";
      const cap=make(details,"p","ts-note","الجدول للقراءة فقط، وأقصى عرض 50 صفًا. أغلق الصفحة أو اضغط «مسح العرض المحلي» لإزالة البيانات من الشاشة.");
      const wrapper=make(details,"div","ts-scroll");
      const table=make(wrapper,"table","ts-table");
      const th=make(table,"thead","");
      const tr=make(th,"tr","");
      for(const h of csv.headers.slice(0,12))make(tr,"th","",h);
      const body=make(table,"tbody","");
      for(const row of csv.rows.slice(0,50)){
        const tr=make(body,"tr","");
        for(const cell of safePlainRow(csv.headers,row))make(tr,"td","",cell.value);
      }
    } catch {
      if(generation===nonce){details.replaceChildren();status.textContent="تعذر قراءة الملف أو التحقق من سلامته. لم يُعرض أي سجل.";}
    }
  });
}
function evidenceCards(root,data){
  const grid=make(root,"div","ts-grid");
  for(const f of data.findings){
    const card=make(grid,"article","ts-panel");
    make(card,"h3","",f.area);
    make(card,"div","ts-heading",f.headline);
    make(card,"span","ts-status",AUDIT_STATES[f.status]);
    const dl=make(card,"dl","ts-facts");
    for(const [name,value] of f.facts){
      const dt=make(dl,"dt","",name);make(dl,"dd","",value.toLocaleString("ar-JO"));
    }
    make(card,"p","ts-note",f.caveat);
  }
}
export function renderTrustsoftEvidence(target){
  target.replaceChildren();
  const root=make(target,"section","ts-evidence");
  make(root,"h2","","تحليل TrustSoft — أدلة النسخ التاريخية");
  make(root,"p","ts-note","مصدر: تصديرات CSV تاريخية على خادم جوافة. ليست قاعدة بيانات مباشرة ولا قبولًا محاسبيًا؛ لا تُعرض مبالغ أو أرقام معاملات خاصة في الموقع العام.");
  const status=make(root,"p","ts-note","جارٍ تحميل ملخص الأدلة المؤرخ...");
  fetch(TRUSTSOFT_SUMMARY_URL,{cache:"no-store",credentials:"same-origin"})
    .then(async res=>{if(!res.ok)throw Error("SUMMARY_NOT_FOUND");return validatePublicSummary(await res.json());})
    .then(data=>{
      status.textContent="مصدر: "+data.source_class+" · فحص "+data.assessed_at+" · لا يوجد اتصال LIVE.";
      make(root,"p","ts-warning","نطاق الـ25% محدد من صاحب المشروع وليس نسبة تقدم تم قياسها أو اعتمادها.");
      const dates=make(root,"p","ts-note","لقطتا المصدر: "+data.snapshots.join(" / "));
      evidenceCards(root,data);
      const next=make(root,"div","ts-panel");
      make(next,"h3","","الإثبات المطلوب قبل الإغلاق");
      const ol=make(next,"ol","ts-next");
      for(const task of data.verification_next)make(ol,"li","",task);
      const registry=make(root,"div","ts-panel");
      make(registry,"h3","","فهرس ملفات الأدلة المحفوظة بشكل خاص");
      make(registry,"p","ts-note","الملفات غير مستضافة في GitHub Pages؛ القائمة تعرض الاسم والبصمة فقط.");
      const ul=make(registry,"ul","ts-registry");
      for(const entry of data.evidence_files)make(ul,"li","",entry.title+" — SHA256: "+entry.sha256);
      installPrivateReader(root,data.evidence_files);
    }).catch(()=>{status.textContent="تعذر تحميل الأدلة والتحقق من مخططها؛ لا تُعرض أي أرقام بديلة أو نتائج وهمية.";});
}
