/* JAWAFA ONE — public GitHub repository work evidence only.
   No GitHub token, write API, workflow dispatch, secrets or financial records. */
const API="https://api.github.com/repos/Amer-ai-store/Mohammad-Ahmed-Ghannam";
const REPO="https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam";
const VALID=/^https:\/\/github\.com\/Amer-ai-store\/Mohammad-Ahmed-Ghannam\/(?:actions\/runs\/[0-9]+|pull\/[0-9]+|issues\/[0-9]+)(?:\?.*)?$/;
const LOCALE="ar-JO";
const ttl=3*60*1000;
let cache=null;
let loading=null;
const node=(tag,klass,txt)=>{const n=document.createElement(tag);if(klass)n.className=klass;if(txt!==undefined)n.textContent=String(txt);return n;};
const add=(parent,tag,klass,txt)=>{const el=node(tag,klass,txt);parent.append(el);return el;};
const label=(obj)=>{
 if(obj.status==="in_progress")return "يعمل الآن";
 if(["queued","waiting","pending","requested"].includes(obj.status))return "بانتظار التشغيل";
 if(obj.conclusion==="success")return "نجاح مثبت في GitHub";
 if(obj.conclusion==="failure")return "فشل مسجل";
 if(obj.conclusion==="cancelled")return "ألغي";
 if(obj.conclusion==="skipped")return "تخطاه الشرط";
 return "لا توجد نتيجة مؤكدة";
};
export function normalizeGithubWork(a,b,c){
 const runs=(Array.isArray(a?.workflow_runs)?a.workflow_runs:[]).filter(x=>Number.isSafeInteger(x.id)&&VALID.test(x.html_url||""))
  .slice(0,15).map(x=>({kind:"run",name:String(x.name||"Workflow").slice(0,140),url:x.html_url,status:x.status,conclusion:x.conclusion,updated:x.updated_at,description:"Run #"+x.run_number}));
 const prs=(Array.isArray(b)?b:[]).filter(x=>Number.isSafeInteger(x.number)&&VALID.test(x.html_url||""))
  .slice(0,12).map(x=>({kind:"pr",name:String(x.title||"Pull request").slice(0,140),url:x.html_url,status:x.state,conclusion:x.merged_at?"merged":null,updated:x.updated_at,description:"PR #"+x.number+(x.draft?" · مسودة":"")}));
 const issues=(Array.isArray(c)?c:[]).filter(x=>Number.isSafeInteger(x.number)&&!x.pull_request&&VALID.test(x.html_url||""))
  .slice(0,12).map(x=>({kind:"issue",name:String(x.title||"Issue").slice(0,140),url:x.html_url,status:x.state,conclusion:null,updated:x.updated_at,description:"Issue #"+x.number}));
 return {runs,prs,issues};
}
async function fetchJSON(part){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),11000);
 try{
  const res=await fetch(API+part,{signal:controller.signal,cache:"no-store",headers:{Accept:"application/vnd.github+json"}});
  if(!res.ok)throw Error("GitHub API "+res.status);
  return res.json();
 } finally{clearTimeout(timeout);}
}
async function getFeed(force=false){
 if(!force&&cache&&Date.now()-cache.at<ttl)return cache;
 if(loading)return loading;
 loading=(async()=>{
  const [a,b,c]=await Promise.all([
   fetchJSON("/actions/runs?per_page=15"),
   fetchJSON("/pulls?state=all&sort=updated&direction=desc&per_page=12"),
   fetchJSON("/issues?state=all&sort=updated&direction=desc&per_page=20")
  ]);
  cache={at:Date.now(),items:normalizeGithubWork(a,b,c)};
  return cache;
 })().finally(()=>{loading=null;});
 return loading;
}
function renderList(root,title,items){
 const section=add(root,"section","ts-panel");
 add(section,"h3","",title);
 const ul=add(section,"ul","jw-repo-list");
 if(!items.length)add(ul,"li","ts-note","لا توجد عناصر ضمن أحدث استجابة عامة.");
 for(const x of items){
  const li=add(ul,"li","jw-repo-item");
  const link=add(li,"a","jw-repo-link",x.name);
  link.href=x.url;link.target="_blank";link.rel="noopener noreferrer";
  add(li,"span","ts-status",x.kind==="run"?label(x):x.kind==="pr"
   ?(x.conclusion==="merged"?"مدمج":x.status==="open"?"طلب دمج مفتوح":"طلب مغلق")
   :(x.status==="open"?"مهمة مفتوحة":"مهمة مغلقة"));
  add(li,"small","ts-note",x.description+" · "+(x.updated?new Date(x.updated).toLocaleString(LOCALE):"وقت غير متاح"));
 }
}
export function renderGithubWork(target,{force=false}={}){
 target.replaceChildren();
 const root=add(target,"section","ts-evidence jw-github");
 add(root,"h2","","مستودع العمل — GitHub");
 add(root,"p","ts-note","قراءة حالة إجراءات GitHub Actions وطلبات الدمج والمهام العامة من GitHub API. لا تعني الحالة نجاح SQL أو قبول جوافة إنتاجيًا.");
 const actions=add(root,"div","toolbar");
 const refresh=add(actions,"button","","تحديث مباشر الآن");refresh.type="button";
 const status=add(root,"p","ts-note","جارٍ الاستعلام عن GitHub...");
 const content=add(root,"div","jw-feed");
 const show=async(forceNow)=>{
  const token=Symbol("request");root._request=token;
  status.textContent="التحقق من الحالة الحقيقية عبر GitHub...";
  content.replaceChildren();
  try{
   const response=await getFeed(forceNow);
   if(root._request!==token)return;
   const {runs,prs,issues}=response.items;
   const running=runs.filter(x=>x.status==="in_progress").length;
   const failed=runs.filter(x=>x.conclusion==="failure").length;
   status.textContent="آخر استعلام: "+new Date(response.at).toLocaleString(LOCALE)+" · تنفيذ جارٍ: "+running+" · فشل في آخر "+runs.length+" تشغيل: "+failed+".";
   renderList(content,"أحدث إجراءات البناء والاختبار",runs);
   renderList(content,"طلبات الدمج ومراجعة الكود",prs);
   renderList(content,"المهام والمشكلات المسجلة",issues);
  }catch{
   if(root._request!==token)return;
   status.textContent="لا يمكن تأكيد GitHub API حاليًا (اتصال أو حد استعلامات). لا تُعرض حالة قديمة كأنها مباشرة.";
   add(content,"p","ts-warning","تعذّر التحقق. افتح مستودع GitHub الرسمي.");
   const a=add(content,"a","","مستودع العمل");
   a.href=REPO;a.target="_blank";a.rel="noopener noreferrer";
  }
 };
 refresh.addEventListener("click",()=>show(true));
 show(force);
 return root;
}
