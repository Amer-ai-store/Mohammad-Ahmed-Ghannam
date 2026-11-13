/* Jawafa central-dashboard acceptance register.
 * PUBLIC STATUS METADATA ONLY. No database, private gateway, OAuth or command calls.
 * User evidence is session-only and can be manually exported/imported; never uploaded.
 */
export const REPO='Amer-ai-store/Mohammad-Ahmed-Ghannam';
export const GH='https://github.com/'+REPO;
export const STATES=['مثبت','جزئي','غير مثبت','يحتاج تحققًا إضافيًا','فرضية'];
const issue=n=>GH+'/issues/'+n;
const comment=(n,id)=>issue(n)+'#issuecomment-'+id;
const run=n=>GH+'/actions/runs/'+n;
export const ITEMS=[
  {id:'public',label:'اللوحة العامة — GitHub Pages',prior:'واجهة ومكونات موجودة؛ لا قبول لبيانات الإنتاج',current:'نشر واجهة الحالة العامة واختبار القراءة اللاحقة مثبت سابقًا',status:'مثبت',scope:'واجهة عامة ثابتة فقط',ref:'Actions #42700584654 · Issue #229',date:'2026-11-12',url:run(42700584654)},
  {id:'preview',label:'Preview الخاص',prior:'مسار معاينة مع اختبارات رفض المجهول',current:'معاينة tailnet عادت 200 و401 سابقًا؛ سجل Vercel Preview كان BLOCKED',status:'جزئي',scope:'تجربة تاريخية لا تثبت الاستمرارية',ref:'dpl_GzchyUYSiECm5AjFjs9ubD5DDxeG · #102',date:'2026-11-04',url:comment(102,6620317901)},
  {id:'production',label:'البيئة الإنتاجية الخاصة',prior:'لم يثبت قبول المسار الخاص أو البوابة المحمية',current:'Vercel backend: build-rate-limit موثق؛ لا يوجد قبول HTTPS/owner E2E',status:'غير مثبت',scope:'إنتاج خاص؛ مستقل عن GitHub Pages',ref:'Issue #229 · main 5fa30a971db9',date:'2026-11-12',url:issue(229)},
  {id:'front-auth',label:'واجهة Firebase للدخول',prior:'شاشات الدخول منفصلة',current:'إعادة استخدام جلسة Firebase في الواجهة؛ لا إثبات لدخول مالك حقيقي ناجح عبر الخدمات',status:'جزئي',scope:'واجهة فقط',ref:'Issue #219 · owner-auth.js',date:'2026-11-09',url:issue(219)},
  {id:'deny',label:'تسجيل الدخول وHTTP 401 / 403',prior:'401 تاريخيًا في المسارات الخاصة؛ بعض bridge أعاد 503',current:'اختبار 401 للمجهول مثبت في نطاقات محددة؛ رفض غير المالك 403 مع جلسة حقيقية غير مثبت',status:'جزئي',scope:'اختبارات سلبية محدودة',ref:'Issue #102 · AUDIT111-OWNER-E2E',date:'2026-11-04',url:comment(102,6620693339)},
  {id:'uid',label:'Firebase UID وربط صلاحية المالك',prior:'تعذر إثبات تهيئة UID الحقيقية في جسر الأوامر',current:'لا توثيق مستقل لـ Owner UID + claims + backend token verification + 200/403',status:'غير مثبت',scope:'لا تعرض قيمة UID أو token',ref:'Issue #219 / #102',date:'2026-11-09',url:issue(219)},
  {id:'docs',label:'إتاحة تقارير Google Docs',prior:'تقارير وفهرس ملفات موجودة بمخزن خاص',current:'لا دليل على قراءة Google Docs عبر بوابة المالك المصادقة؛ لا روابط Docs عامة',status:'غير مثبت',scope:'بيانات خاصة خارج GitHub Pages',ref:'Issue #102 · OWNER E2E',date:'2026-11-04',url:comment(102,6620456224)},
  {id:'oauth-ci',label:'إصلاح OAuth في مراجعة Claude CI',prior:'فشل Prepare the Claude token في تشغيل تاريخي',current:'إصلاح مسار مراجعة بديل دون اعتماد؛ لم يُثبت استرجاع OAuth أو استلام مراجعة Claude حقيقية',status:'جزئي',scope:'تحسين مصدر CI لا إصلاح اعتماد موفر OAuth',ref:'Issue #107 · PR #131 / #132',date:'2026-11-08',url:issue(107)},
  {id:'oauth-sso',label:'OAuth / SSO بين AAS وTrustSoft',prior:'تسجيل دخول مستقل لكل خدمة',current:'بوابة التحقق الخلفية وتبادل الجلسات بين الأصول لم تُقبلا',status:'غير مثبت',scope:'تكوين موفري الهوية لا يتغير',ref:'Issue #219',date:'2026-11-09',url:issue(219)},
  {id:'bridge',label:'Command Bridge / أوامر الوكلاء',prior:'محاكاة منفصلة وإيصالات غير إنتاجية',current:'رفض 401 و503 مثبت في اختبارات؛ لا ACK موقّع مع نجاح owner E2E على نشر محدد',status:'جزئي',scope:'لا يُرسل أي أمر من هذه الشاشة',ref:'PR #67 · Issue #102',date:'2026-11-04',url:comment(102,6612821943)},
  {id:'phone',label:'تدفقات الهاتف Android',prior:'اختبار شبكة Tailscale والواجهة المصغرة',current:'تم رصد وصول جهاز؛ لا E2E فعلي على الهاتف للدخول والتقارير والجسر',status:'يحتاج تحققًا إضافيًا',scope:'اختبار جهاز حقيقي مطلوب',ref:'AUDIT111-TAILNET-ANDROID · #102',date:'2026-11-04',url:comment(102,6620693339)},
  {id:'sql',label:'قارئ SQL بصلاحية SELECT فقط',prior:'جسر قديم بصلاحية SQL مرتفعة',current:'اختبار محلي لحساب قارئ ورفض UPDATE/DELETE وAPI محلية 401/405/404؛ اتصال HTTPS للوحة غير مقبول',status:'مثبت',scope:'دليل محلي ضيق فقط؛ ليس قبول الإنتاج',ref:'EV-JAW-READER-LOCAL-20261112',date:'2026-11-12',url:comment(57,6813499116)},
  {id:'archive',label:'فهرس الأدلة وتقارير الأرشيف',prior:'تصديرات وتطابق محدود',current:'فهرس خاص 1,596 معرف ملف؛ فحوص Hash ناجحة؛ استعادة مستقلة وأصل المحتوى لم يُقبلا',status:'جزئي',scope:'فحص فهرس لا يعني إتاحة تقارير Docs',ref:'Issue #57 · Archive receipt',date:'2026-11-12',url:comment(57,6814451435)},
  {id:'gate15',label:'GATE-15 والمطابقة المالية',prior:'غير مقبول',current:'لم يثبت قبول E2E المالي أو الاستعادة المستقلة أو توقيع Security/QA',status:'غير مثبت',scope:'لا بيانات مالية بهذه الشاشة',ref:'Issue #57 / #102',date:'2026-11-12',url:issue(57)},
  {id:'hyp',label:'فرضية مسببات رفض 401/403',prior:'لا سبب جذري مثبت',current:'قد يتعلق بالـ UID أو جمهور الرمز أو CORS؛ لا تحسم الفرضية دون سجلات هوية خاصة مخفاة',status:'فرضية',scope:'فرضية تشخيص فقط',ref:'Issue #219',date:'2026-11-13',url:issue(219)}
];
export const GATES=[
  {id:57,title:'القيادة الموحدة وGATE-15',class:'Security + QA',required:'Owner 200 / 401 / 403؛ SQL SELECT-only عبر HTTPS؛ إيصال command موقّع؛ استعادة ومطابقة مالية؛ اختبار تقارير ووثائق وهاتف.',url:issue(57)},
  {id:102,title:'اعتماد نشر الإنتاج',class:'Release Security',required:'مراجعة أمن مستقلة، خصوصية وحماية موفري النشر، HTTPS خاص، صلاحيات محدودة، استعادة مستقلة، E2E على SHA/URL محددين.',url:issue(102)},
  {id:219,title:'هوية المالك وSSO',class:'Authentication',required:'تحقق backend من Firebase UID/claims والتوقيع والجمهور والانتهاء؛ 200 مالك و401 مجهول و403 لغير المالك؛ اختبارات إبطال/هاتف.',url:issue(219)},
  {id:91,title:'الضوابط المالية وصلاحيات SQL',class:'Data Integrity',required:'إثبات حساب مستقل محدود، TLS وسجل جلسة ومبدأ SELECT فقط، ومنع SQL ديناميكي وكتابة بيانات المصدر.',url:issue(91)},
  {id:85,title:'متجر لُقطة وتدفقات الهاتف',class:'Mobile QA',required:'اختبار Android حقيقي، تحقق هوية وصلاحيات، تقارير وطلبات ومخزون/عروض عبر Backend محمي دون مساس بجوافة.',url:issue(85)},
  {id:107,title:'OAuth CI (تذكرة مغلقة)',class:'CI / Provider',required:'فصل إصلاح المصدر عن تهيئة OAuth؛ إثبات مراجعة Claude فعلية برقم تشغيل مع عدم كشف credential.',url:issue(107)}
];
export const TIMELINE=[
  {date:'2026-10-28',event:'دمج PR #67 باللوحة الأصلية مع Command Bridge في المصدر',result:'تكامل مصدر — ليس اعتمادًا إنتاجيًا',ref:'PR #67 · ab71487dd23b52fc1d2fc5d7667bde85bb4573b4',url:GH+'/pull/67'},
  {date:'2026-11-03',event:'إثبات GitHub Pages العامة ورفض بعض الاتصالات الخاصة',result:'واجهة عامة مثبتة بنطاق ضيق',ref:'Run #41675413239',url:run(41675413239)},
  {date:'2026-11-04',event:'معاينة HTTPS خاصة/401؛ متطلبات UID وAndroid لم تكتمل',result:'Preview جزئي؛ إنتاج غير معتمد',ref:'Issue #102 · comment 6620693339',url:comment(102,6620693339)},
  {date:'2026-11-09',event:'واجهة SSO مشتركة بمصدر اللوحة مع فجوات backend',result:'واجهة مطبّقة؛ Owner E2E غير مثبت',ref:'Issue #219',url:issue(219)},
  {date:'2026-11-12',event:'قارئ SQL محدود واختبار رفض التعديل محليًا',result:'LOCAL_READ_ONLY_VERIFIED',ref:'EV-JAW-READER-LOCAL-20261112',url:comment(57,6813499116)},
  {date:'2026-11-12',event:'فحص فهرس Google Drive الخاص مع بقاء الاستعادة والربط غير معتمدين',result:'أرشيف جزئي',ref:'Issue #57 · comment 6814451435',url:comment(57,6814451435)},
  {date:'2026-11-12',event:'توثيق حد بناء Vercel لمشروع البوابة الآمنة',result:'Production backend غير مثبت',ref:'Issue #229 · run #42700584654 Pages فقط',url:issue(229)}
];
export function approvalStatus(){return 'غير معتمد إنتاجيًا';}
export function safeGitHubURL(input){
 const s=String(input||'').trim();if(!s)return '';
 let u;try{u=new URL(s)}catch{throw Error('رابط الدليل غير صالح')}
 if(u.protocol!=='https:'||u.hostname!=='github.com'||u.username||u.password||u.port||u.search||!u.pathname.startsWith('/'+REPO+'/'))throw Error('يقبل فقط رابط GitHub العام للمستودع دون Query أو أسرار');
 if(u.hash&&!/^#(?:issuecomment-\d+|discussion_r\d+|step:[\d:]+)$/.test(u.hash))throw Error('مرجع الرابط غير مدعوم');
 return u.href;
}
const secretPattern=/(?:-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|AIza[0-9A-Za-z_-]{20,}|(?:sk|ghp|gho|github_pat)[-_][A-Za-z0-9_-]{12,}|(?:password|passwd|authorization|bearer|client_secret|access_token|refresh_token|id_token|api_key)\s*[:=])/i;
function safeText(raw,max,name){const s=String(raw??'').trim();if(s.length>max)throw Error(name+' أطول من المسموح');if(secretPattern.test(s))throw Error('يُمنع إدخال أسرار أو رموز اعتماد');return s;}
export function validateEvidence(input){
 const topic=safeText(input.topic,65,'البند');
 const identifier=safeText(input.identifier,90,'معرّف الدليل');
 const details=safeText(input.details,350,'الوصف');
 const sha=safeText(input.sha,40,'Commit SHA');
 const runId=safeText(input.runId,25,'Run ID');
 const checkedAt=safeText(input.checkedAt,25,'وقت التحقق');
 const url=safeGitHubURL(input.url);
 const claimedStatus=String(input.claimedStatus||'يحتاج تحققًا إضافيًا');
 if(!topic||!identifier||!url||!checkedAt)throw Error('البند والمعرّف والرابط ووقت الفحص مطلوبة');
 if(!STATES.includes(claimedStatus))throw Error('تصنيف الدليل غير مسموح');
 if(sha&&!/^[a-f0-9]{7,40}$/i.test(sha))throw Error('Commit SHA غير صالح');
 if(runId&&!/^\d{5,20}$/.test(runId))throw Error('Run ID غير صالح');
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(checkedAt)||!Number.isFinite(Date.parse(checkedAt)))throw Error('وقت فحص غير صالح');
 return {topic,identifier,details,sha,runId,checkedAt,url,claimedStatus,review:'USER_SUPPLIED_UNREVIEWED'};
}
export function parseEvidenceFile(data){
 const input=typeof data==='string'?JSON.parse(data):data;
 if(!input||input.schema!=='jawafa.acceptance.local.v1'||!Array.isArray(input.evidence)||input.evidence.length>100)throw Error('ملف أدلة غير مدعوم أو أكبر من الحد');
 const results=input.evidence.map(validateEvidence);
 if(new Set(results.map(r=>r.identifier)).size!==results.length)throw Error('معرّفات أدلة مكررة');
 return results;
}
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if(typeof document!=='undefined'){
 const root=document.getElementById('jawafa-acceptance-root');
 if(root){
 let evidence=[],editing=null,issues=new Map(),githubChecked=null,gitError='';
 root.innerHTML=String.raw`
 <div class="ja-headline"><div class="ja-metric"><small>بوابة الإنتاج</small><strong>غير معتمدة</strong><span>دون قبول مستقل Security + QA</span></div><div class="ja-metric"><small>GitHub Pages</small><strong>مثبتة بنطاق محدود</strong><span>واجهة ثابتة فقط</span></div><div class="ja-metric"><small>Firebase / الهاتف</small><strong>قبول معلّق</strong><span>لا جلسة مالك 200 موثقة</span></div></div>
 <section class="panel ja-section"><h2>مصفوفة الأدلة — السابقة والحالية</h2><p class="muted small">الحالات المرجعية مؤرخة بمصادرها؛ لا تتحول تلقائيًا إلى اعتماد بمجرد فتح Issue أو نجاح CI. «مثبت» يعني النطاق المحدد بالصف فقط.</p>
 <div class="toolbar"><label class="ja-search">بحث <input id="ja-search" type="search" placeholder="UID، OAuth، 401، Preview..."></label><label class="ja-filter">تصنيف <select id="ja-filter"><option value="">جميع الحالات</option></select></label><button id="ja-refresh" type="button">تحديث بيانات GitHub العامة (GET)</button></div><p id="ja-github-meta" class="small muted" role="status">لم يُنفذ فحص GitHub من المتصفح بعد. المصادر الموثقة تاريخية.</p><div class="table-wrap"><table><thead><tr><th>البند</th><th>الحالة السابقة</th><th>الحالة المسجلة</th><th>التصنيف والنطاق</th><th>الدليل ووقت المصدر</th></tr></thead><tbody id="ja-matrix"></tbody></table></div></section>
 <section class="panel ja-section"><h2>بوابات Security / QA المفتوحة أو المتابعة</h2><p class="small muted">حالة GitHub (open/closed) تختلف عن قبول معيار الإنتاج. إغلاق تذكرة لا يغيّر حالة الاعتماد هنا.</p><div class="table-wrap"><table><thead><tr><th>Issue</th><th>التخصص</th><th>حالة GitHub عند آخر قراءة</th><th>معيار القبول المستقل</th></tr></thead><tbody id="ja-gates"></tbody></table></div></section>
 <section class="panel ja-section"><h2>السجل الزمني للتغييرات المثبتة بالمصادر</h2><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحدث</th><th>الأثر وحدوده</th><th>المرجع</th></tr></thead><tbody id="ja-time"></tbody></table></div></section>
 <section class="panel ja-section"><h2>إدخال دليل / تعديل / إعادة استخدام (محلي فقط)</h2><p class="small muted">لا حفظ في GitHub أو الخادم أو Local Storage. البيانات في ذاكرة هذه الصفحة إلى حين التصدير اليدوي؛ لا تُدخل رموز دخول أو UID أو روابط مستندات خاصة أو بيانات مالية. الدليل المستورد يبقى غير معتمد حتى المراجعة المستقلة.</p>
 <form id="ja-form" class="ja-form"><label>البند<input name="topic" maxlength="65" required placeholder="مثال: Firebase UID"></label><label>معرّف الدليل<input name="identifier" maxlength="90" required placeholder="EV-..."></label><label>تصنيف مقدم الدليل<select name="claimedStatus" id="ja-claim"></select></label><label>رابط GitHub العام<input name="url" type="url" required placeholder="https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/issues/57"></label><label>Commit SHA (اختياري)<input name="sha" maxlength="40"></label><label>Run ID (اختياري)<input name="runId" maxlength="20"></label><label>وقت الفحص المحلي<input name="checkedAt" type="datetime-local" required></label><label class="ja-wide">وصف الدليل غير الحساس<textarea name="details" maxlength="350" rows="2" placeholder="ماذا أثبت الاختبار، وما الذي لا يثبته؟"></textarea></label><div class="ja-actions"><button class="primary" type="submit" id="ja-save">إضافة كدليل غير معتمد</button><button type="button" id="ja-cancel">إلغاء التعديل</button><button type="button" id="ja-export">تصدير JSON محلي</button><label class="ja-import">استيراد ملف أدلة<input id="ja-import" type="file" accept=".json,application/json"></label></div></form>
 <p id="ja-local-status" class="small muted" role="status"></p><div class="table-wrap"><table><thead><tr><th>معرّف الدليل</th><th>البند</th><th>حالة المراجعة</th><th>المرجع/التاريخ</th><th>تحرير</th></tr></thead><tbody id="ja-local"></tbody></table></div></section>
 <p class="small muted">تحديث بيانات GitHub يقرأ قضايا عامة فحسب، ولا يفحص الشبكات الخاصة أو Firebase أو Google Docs. لا تنفيذ أوامر Command Bridge، ولا OAuth، ولا SQL، ولا نشر.</p>
 `;
 const $=id=>root.querySelector('#'+id);
 const td=(tr,value)=>{const e=document.createElement('td');e.textContent=String(value??'');tr.append(e);return e};
 const link=(tr,url,label)=>{const e=document.createElement('td');const a=document.createElement('a');a.href=url;a.textContent=label;a.target='_blank';a.rel='noopener noreferrer';e.append(a);tr.append(e);return e};
 const table=(id,rows,format)=>{const target=$(id);target.replaceChildren();rows.forEach(item=>{const tr=document.createElement('tr');format(tr,item);target.append(tr)});if(!rows.length){const tr=document.createElement('tr'),cell=td(tr,'لا توجد نتائج');cell.colSpan=5;target.append(tr)}};
 const datetime=()=>{const d=new Date(),shift=new Date(d.getTime()-d.getTimezoneOffset()*60000);return shift.toISOString().slice(0,16)};
 const issueState=n=>{const item=issues.get(n);return item?((item.state==='open'?'مفتوحة':'مغلقة')+' · آخر تحديث GitHub '+(item.updated_at||'غير متوفر')):'غير مفحوصة مباشرة'};
 const render=()=>{
  const q=$('ja-search').value.trim().toLocaleLowerCase('ar'),f=$('ja-filter').value;
  table('ja-matrix',ITEMS.filter(i=>(!f||i.status===f)&&(!q||(i.label+' '+i.current+' '+i.ref).toLocaleLowerCase('ar').includes(q))), (tr,i)=>{
   td(tr,i.label);td(tr,i.prior);td(tr,i.current);const cell=td(tr,i.status+' — '+i.scope);cell.classList.add('ja-status');cell.dataset.status=i.status;link(tr,i.url,i.ref+' · '+i.date);
  });
  table('ja-gates',GATES,(tr,g)=>{link(tr,g.url,'#'+g.id+' · '+g.title);td(tr,g.class);td(tr,issueState(g.id));td(tr,g.required)});
  table('ja-time',TIMELINE,(tr,t)=>{td(tr,t.date);td(tr,t.event);td(tr,t.result);link(tr,t.url,t.ref)});
  table('ja-local',evidence,(tr,r)=>{td(tr,r.identifier);td(tr,r.topic+' — '+r.claimedStatus);td(tr,'مدخل محلي / غير معتمد');link(tr,r.url,r.checkedAt.replace('T',' '));const c=document.createElement('td');const edit=document.createElement('button'),del=document.createElement('button');edit.type='button';del.type='button';edit.textContent='تعديل';del.textContent='حذف';edit.dataset.edit=r.identifier;del.dataset.remove=r.identifier;c.append(edit,del);tr.append(c)});
 };
 STATES.forEach(s=>{$('ja-filter').add(new Option(s,s));$('ja-claim').add(new Option(s,s))});
 $('ja-form').elements.checkedAt.value=datetime();
 $('ja-search').addEventListener('input',render);$('ja-filter').addEventListener('change',render);
 $('ja-refresh').addEventListener('click',async()=>{
  const b=$('ja-refresh');b.disabled=true;$('ja-github-meta').textContent='جارٍ جلب بيانات القضايا العامة فقط...';
  const ids=GATES.map(g=>g.id);
  const responses=await Promise.allSettled(ids.map(async n=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
   try{const res=await fetch('https://api.github.com/repos/'+REPO+'/issues/'+n,{method:'GET',credentials:'omit',cache:'no-store',headers:{Accept:'application/vnd.github+json'},signal:controller.signal});if(!res.ok)throw Error('GitHub HTTP '+res.status);const doc=await res.json();return {number:n,state:doc.state,updated_at:doc.updated_at}}finally{clearTimeout(timer)}
  }));
  issues=new Map(responses.filter(x=>x.status==='fulfilled').map(x=>[x.value.number,x.value]));
  gitError=responses.some(x=>x.status!=='fulfilled')?' · بعض القضايا لم تُقرأ؛ النتيجة جزئية':'';
  githubChecked=new Date();
  $('ja-github-meta').textContent='فحص GitHub فقط: '+githubChecked.toLocaleString('ar-JO',{timeZone:'Asia/Amman'})+' (عمّان) · '+issues.size+'/'+ids.length+' قضايا'+gitError+'؛ لا فحص للإنتاج.';
  b.disabled=false;render();
 });
 const form=$('ja-form'),msg=$('ja-local-status');
 form.addEventListener('submit',event=>{event.preventDefault();try{
  const data=Object.fromEntries(new FormData(form));const record=validateEvidence(data);
  if(editing&&editing!==record.identifier&&evidence.some(e=>e.identifier===record.identifier))throw Error('معرّف الدليل مستخدم');
  if(!editing&&evidence.some(e=>e.identifier===record.identifier))throw Error('معرّف موجود؛ استخدم تعديل');
  evidence=editing?evidence.map(e=>e.identifier===editing?record:e):[...evidence,record];
  if(evidence.length>100)throw Error('الحد الأقصى 100 دليل');
  editing=null;form.reset();form.elements.checkedAt.value=datetime();$('ja-save').textContent='إضافة كدليل غير معتمد';
  msg.textContent='تم حفظ الدليل داخل جلسة الصفحة فقط؛ ليس إثبات اعتماد';render();
 }catch(e){msg.textContent='لم يُحفظ: '+e.message}});
 $('ja-cancel').addEventListener('click',()=>{editing=null;form.reset();form.elements.checkedAt.value=datetime();$('ja-save').textContent='إضافة كدليل غير معتمد';msg.textContent='أُلغي التعديل'});
 $('ja-local').addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;
  const key=b.dataset.edit||b.dataset.remove,record=evidence.find(x=>x.identifier===key);if(!record)return;
  if(b.dataset.remove){evidence=evidence.filter(x=>x.identifier!==key);msg.textContent='حُذف من جلسة الصفحة فقط';render();return}
  editing=record.identifier;Object.entries(record).forEach(([k,v])=>{if(form.elements[k])form.elements[k].value=v});$('ja-save').textContent='تحديث الدليل المحلي';form.scrollIntoView({block:'nearest',behavior:'smooth'});
 });
 $('ja-export').addEventListener('click',()=>{try{
  const payload=JSON.stringify({schema:'jawafa.acceptance.local.v1',classification:'LOCAL_USER_NOTES_UNREVIEWED',exportedAt:new Date().toISOString(),evidence},null,2);
  const blob=new Blob([payload],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='jawafa-acceptance-evidence-local.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
  msg.textContent='صُدّر محليًا، لا يوجد رفع إلى GitHub';
 }catch(e){msg.textContent='فشل تصدير محلي: '+e.message}});
 $('ja-import').addEventListener('change',async ev=>{
  const file=ev.target.files?.[0];if(!file)return;
  try{if(file.size>100000)throw Error('الحد الأعلى 100 كيلوبايت');const records=parseEvidenceFile(await file.text());
   evidence=records;editing=null;form.reset();form.elements.checkedAt.value=datetime();$('ja-save').textContent='إضافة كدليل غير معتمد';
   msg.textContent='استورد '+records.length+' دليلًا محليًا غير معتمد؛ لم يُرفع أي ملف';render();
  }catch(e){msg.textContent='رفض الاستيراد: '+e.message}finally{ev.target.value=''}
 });
 render();
 }
}
