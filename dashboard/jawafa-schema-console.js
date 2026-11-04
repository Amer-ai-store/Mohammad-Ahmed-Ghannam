/* Authenticated, paginated 1024-table schema metadata inspector.
 * Rendered only in the central Jawafa agents workspace. No business rows,
 * no SQL queries, no local credential handling, no API writes.
 */
'use strict';
(()=>{
  const root=document.getElementById('jawafa-audit15-agent-console');
  if(!root)return;
  const el=(tag,text,cls)=>{
    const x=document.createElement(tag);
    if(text!==undefined)x.textContent=String(text);
    if(cls)x.className=cls;return x;
  };
  const section=el('section',undefined,'panel');
  section.append(el('h3','قاموس الجداول — 1024 جدولًا / العلاقات المعلنة'));
  section.append(el('p','القاموس خاص بالمالك ويُقرأ على صفحات من 50 جدولًا. يُعرض وصف الأعمدة والعلاقات فقط، ولا يتضمن سجلات مالية.','muted'));
  const toolbar=el('div',undefined,'toolbar'),query=el('input');
  query.type='search';query.placeholder='ابحث باسم جدول (إنجليزي)';query.maxLength=64;
  query.setAttribute('aria-label','البحث في أسماء الجداول');
  const load=el('button','عرض الفهرس','tiny');load.type='button';
  const previous=el('button','السابق','tiny');previous.type='button';previous.disabled=true;
  const next=el('button','التالي','tiny');next.type='button';next.disabled=true;
  const status=el('span','لا يوجد مصدر مصادَق عليه','muted');
  toolbar.append(query,load,previous,next,status);
  const body=el('div',undefined,'table-wrap');body.append(el('p','التحميل متوقف لحماية بيانات المخطط حتى تسجيل دخول المالك.','muted'));
  section.append(toolbar,body);
  root.append(section);
  let offset=0,busy=false,latest=null;
  const text=t=>body.replaceChildren(el('p',t,'muted'));
  function tabular(rows){
    const wrap=el('div',undefined,'table-wrap');
    if(!rows.length){wrap.append(el('p','لا توجد بيانات مطابقة.','muted'));return wrap;}
    const t=el('table'),th=el('thead'),tr=el('tr'),tb=el('tbody');
    const names=Object.keys(rows[0]);
    for(const key of names)tr.append(el('th',key));
    th.append(tr);t.append(th);
    for(const row of rows){
      const r=el('tr');for(const key of names)r.append(el('td',String(row[key]??'—')));tb.append(r);
    }
    t.append(tb);wrap.append(t);return wrap;
  }
  function render(x){
    body.replaceChildren();
    const pageInfo=el('p','المعروض '+x.rows.length+' من '+x.matchingTables+
      ' نتيجة • الجداول المفهرسة: '+x.totalTables+' • العلاقات المعلنة: '+x.totalForeignKeys+
      (x.stale?' • فهرس قديم':' • بيانات وصفية حديثة'),'muted');
    body.append(pageInfo);
    const rows=x.rows.map(row=>{
      const fk=x.relationships.filter(r=>
        r.fromTable===row.name||r.toTable===row.name).length;
      return {المخطط:row.schema,الجدول:row.name,عدد_الأعمدة:row.columnCount,العلاقات_المعلنة_في_الصفحة:fk};
    });
    body.append(tabular(rows));
    const details=el('div');
    for(const row of x.rows){
      const item=el('details'),summary=el('summary',row.schema+'.'+row.name+' — الأعمدة');
      item.append(summary);
      item.append(tabular((row.columns||[]).map(c=>({الحقل:c.name,النوع:c.sqlType,يسمح_بالفراغ:c.nullable,الترتيب:c.position}))));
      details.append(item);
    }
    body.append(details);
    if(x.relationships?.length){
      body.append(el('h4','مفاتيح أجنبية معلنة في المخطط'));
      body.append(tabular(x.relationships.map(r=>({
        من:r.fromTable+'.'+r.fromColumn,إلى:r.toTable+'.'+r.toColumn,
        الدليل:'مفتاح SQL معلن؛ علاقة الأعمال تحتاج تحققًا'
      }))));
    }
    previous.disabled=offset===0;
    next.disabled=offset+x.rows.length>=x.matchingTables||x.rows.length===0;
  }
  async function fetchPage(){
    if(busy)return;
    busy=true;load.disabled=true;next.disabled=true;previous.disabled=true;status.textContent='جارٍ التحقق...';
    try{
      if(window.location.origin==='https://amer-ai-store.github.io')
        throw Error('GitHub Pages لا يملك API خاصًا؛ يلزم استضافة القيادة الخاصة.');
      const user=window.firebase?.auth?.()?.currentUser;
      if(!user||user.emailVerified!==true)throw Error('تحتاج جلسة مالك مُصادَق عليها.');
      const token=await user.getIdToken();
      const name=query.value.trim();
      if(!/^[A-Za-z0-9_]{0,64}$/.test(name))throw Error('اسم الجدول يحتوي رموزًا غير مسموحة.');
      const params=new URLSearchParams({offset:String(offset),limit:'50',name});
      const ac=new AbortController(),timeout=setTimeout(()=>ac.abort(),10000);
      let reply;
      try{
        reply=await fetch('/api/jawafa/v1/schema-catalog?'+params.toString(),{
          method:'GET',credentials:'same-origin',cache:'no-store',
          headers:{Accept:'application/json',Authorization:'Bearer '+token},signal:ac.signal
        });
      }finally{clearTimeout(timeout)}
      if(!reply.ok)throw Error('تعذر وصول المالك إلى فهرس الجداول ('+reply.status+').');
      const value=await reply.json();
      if(value?.schema!=='jawafa.schema.catalog.page.v1'||
         value?.classification!=='OWNER_ONLY_SCHEMA_METADATA_NO_BUSINESS_ROWS'||
         value?.totalTables!==1024||value?.totalForeignKeys!==38||
         !Array.isArray(value.rows)||value.rows.length>50||
         !Array.isArray(value.relationships))throw Error('فشل التحقق من عقد فهرس الجداول.');
      latest=value;status.textContent=value.stale?'فهرس قديم':'مصادقة صالحة — مخطط موثق';
      render(value);
    }catch(e){
      latest=null;status.textContent='NOT_CONNECTED';text(String(e?.message||'غير متوفر').slice(0,220));
    }finally{
      busy=false;load.disabled=false;
      if(latest){previous.disabled=offset===0;next.disabled=offset+latest.rows.length>=latest.matchingTables;}
    }
  }
  load.addEventListener('click',()=>{offset=0;fetchPage()});
  previous.addEventListener('click',()=>{offset=Math.max(0,offset-50);fetchPage()});
  next.addEventListener('click',()=>{offset+=50;fetchPage()});
})();
