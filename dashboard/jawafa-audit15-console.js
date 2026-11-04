/* Owner-authenticated Audit15 and server-agent workspace in the Jawafa command center.
 * No public data fallback, no secrets in storage, no direct SQL, no write endpoint.
 */
'use strict';
(()=>{
  const root=document.getElementById('jawafa-audit15-agent-console');
  if(!root)return;
  const el=(tag,text,cls)=>{
    const node=document.createElement(tag);
    if(text!==undefined)node.textContent=String(text);
    if(cls)node.className=cls;
    return node;
  };
  const title=el('h3','التحقيق التاريخي — الجداول الـ15 ووكلاء التشغيل');
  const note=el('p','مساحة قراءة محمية. لا تُعرض بيانات حية دون مصادقة المالك وخدمة خاصة موثقة.','muted');
  const toolbar=el('div',undefined,'toolbar'),status=el('span','NOT_CONNECTED','pill warn');
  const refresh=el('button','تحقق من المصدر الخاص','tiny');refresh.type='button';
  toolbar.append(refresh,status);
  const tabs=el('div',undefined,'toolbar'),content=el('div',undefined,'table-wrap');
  let current=null,tab='audit15',pending=false;
  const categories=[['audit15','الجداول الـ15'],['agents','الوكلاء المجدولون'],['security','الصلاحيات وAI']];
  for(const [id,name] of categories){
    const button=el('button',name,'tiny');button.type='button';
    button.setAttribute('aria-pressed',String(id===tab));
    button.addEventListener('click',()=>{
      tab=id;
      for(const b of tabs.children)b.setAttribute('aria-pressed',String(b===button));
      show();
    });
    tabs.append(button);
  }
  const link=el('a','فتح TrustSoft بجميع الأقسام');
  link.href='#jawafa-trustsoft';link.className='tiny';
  root.append(title,note,toolbar,tabs,content,link);
  function text(message){content.replaceChildren(el('p',message,'muted'))}
  function table(rows){
    if(!rows.length){text('لا توجد سجلات مؤيدة متاحة.');return;}
    const t=el('table'),thead=el('thead'),tbody=el('tbody'),tr=el('tr'),keys=Object.keys(rows[0]);
    for(const key of keys)tr.append(el('th',key));
    thead.append(tr);t.append(thead);
    for(const row of rows.slice(0,250)){
      const r=el('tr');
      for(const key of keys)r.append(el('td',row[key]===null||row[key]===undefined?'—':String(row[key])));
      tbody.append(r);
    }
    t.append(tbody);content.replaceChildren(t);
  }
  function show(){
    if(!current){
      text('لم تصل لقطة خاصة مصادَق عليها. لا يعني وجود الوكلاء في الخادم أن اتصالهم بلوحة GitHub Pages متاح.');
      return;
    }
    const stale=current.stale===true;
    if(tab==='audit15'){
      const a=current.audit15;
      content.replaceChildren(el('p',(stale?'لقطة قديمة — ':'لقطة خاصة حديثة — ')+
        'سلامة نقل الملفات سابقًا: '+a.transferGuardStatus+
        '؛ السبب التاريخي للتغييرات غير محسوم.','muted'));
      const body=el('div',undefined,'table-wrap');content.append(body);
      const rows=a.tables.slice().sort((x,y)=>Number(y.historicalValueDifferenceCandidates||0)-Number(x.historicalValueDifferenceCandidates||0)).map(r=>({
        الجدول:r.table,سجلات_المرجع:r.referenceRows,سجلات_استخراج_لاحق:r.exportRows,
        فرق_العدد:r.laterMinusReference,مؤشرات_فروق_القيمة:r.historicalValueDifferenceCandidates,
        نمط_النسخة:r.priorAuditLatestMode,علاقات_SQL:r.declaredForeignKeyCount,
        نسبة_السبب:'غير مثبت'
      }));
      // Sort by number of candidate differences for investigation triage, not proof of wrongdoing.
      const t=el('table'),head=el('thead'),header=el('tr'),bodyRows=el('tbody');
      const keys=Object.keys(rows[0]||{});
      for(const k of keys)header.append(el('th',k));
      head.append(header);t.append(head);
      for(const row of rows){
        const tr=el('tr');for(const k of keys)tr.append(el('td',String(row[k])));bodyRows.append(tr);
      }
      t.append(bodyRows);body.append(t);
      return;
    }
    if(tab==='agents'){
      table(current.existingAgents.agents.map(a=>({
        الوكيل:a.name,النوع:a.category,حالة_Windows:a.schedulerState,
        آخر_تشغيل:a.lastRunLocal||'غير مثبت',نتيجة_المجدول:a.lastSchedulerResult??'غير مثبت',
        نموذج_AI:a.aiModelEndpointVerified===true?'يحتاج تحققًا':'غير مثبت'
      })));
      return;
    }
    table([
      {المجال:'مصادقة المالك',الحالة:'مطلوبة من Firebase وواجهة API الخاصة'},
      {المجال:'الجداول الـ15',الحالة:'قراءة مقارنة فقط؛ لا DML أو DDL'},
      {المجال:'وكلاء Windows',الحالة:'حالة المهام ومخرجاتها لا تثبت اتصال LLM'},
      {المجال:'وكلاء CFO / CPO / GM',الحالة:'تشغيل النموذج يحتاج موفّر API خاصًا واختبارًا مستقلاً'},
      {المجال:'الربط المحاسبي',الحالة:'الفروقات التاريخية لا تثبت سببًا أو مسؤولًا'}
    ]);
  }
  function trusted(x){
    if(x?.schema!=='jawafa.audit15-agents.v1'||
       x?.classification!=='PRIVATE_EVIDENCE_METADATA_ONLY_NO_BUSINESS_ROWS'||
       x?.host!=='JAWAFFASVR'||x?.database!=='Jawafa_DB'||
       !Array.isArray(x.audit15?.tables)||x.audit15.tables.length!==15||
       !Array.isArray(x.existingAgents?.agents))return false;
    return true;
  }
  async function load(){
    if(pending)return;
    pending=true;refresh.disabled=true;status.textContent='فحص المصادقة...';
    try{
      if(window.location.origin==='https://amer-ai-store.github.io')
        throw Error('هذه النسخة على GitHub Pages لا تستضيف واجهة البيانات الخاصة.');
      const firebaseAuth=window.firebase?.auth?.();
      const user=firebaseAuth?.currentUser;
      if(!user||user.emailVerified!==true)throw Error('يلزم تسجيل دخول المالك بحساب موثّق.');
      const jwt=await user.getIdToken();
      const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),9000);
      let reply;
      try{
        reply=await fetch('/api/jawafa/v1/audit15-ops',{
          method:'GET',headers:{Accept:'application/json',Authorization:'Bearer '+jwt},
          credentials:'same-origin',cache:'no-store',signal:ctrl.signal
        });
      }finally{clearTimeout(timer)}
      if(!reply.ok)throw Error('لم تتوفر قناة Audit15 الخاصة ('+reply.status+').');
      const x=await reply.json();
      if(!trusted(x))throw Error('بيانات المصدر لم تجتز عقد التحقق.');
      current=x;status.textContent=x.stale?'STALE':'AUTHENTICATED';
      status.className='pill '+(x.stale?'warn':'ok');
      note.textContent='مصدر خاص: '+x.host+' • وقت الفحص: '+String(x.checkedUtc)+
        (x.stale?' • لقطة قديمة':' • بيانات تشغيلية مصادَق عليها، لا تثبت صحة القيود');
      show();
    }catch(e){
      current=null;status.textContent='NOT_CONNECTED';status.className='pill warn';
      note.textContent=String(e?.message||'تعذر التحقق').slice(0,220);
      show();
    }finally{pending=false;refresh.disabled=false}
  }
  refresh.addEventListener('click',load);
  window.addEventListener('hashchange',()=>{
    if(window.location.hash==='#jawafa-agents')load();
  });
  if(window.location.hash==='#jawafa-agents')load();
  show();
})();
