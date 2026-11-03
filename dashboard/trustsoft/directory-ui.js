/* TrustSoft read-only navigation from authenticated metadata. */
'use strict';
(function () {
  const core=globalThis.TrustSoftCatalog;
  if(!core)throw Error('TrustSoft catalog registry is missing');
  const selectedTabs=new Map(),searchTexts=new Map(),pages=new Map();
  const proposals=Object.freeze({
    accounting:['مطابقة تسلسل السندات والقيود مع سجل الترحيل، دون افتراض أن أي رقم مفقود يعني حذفًا.','كشف قيود غير مدققة أو متأخرة الترحيل بعد التحقق من دلالة الحالات.','مطابقة الأستاذ مع البنوك والشيكات والتسويات وفروقات التواريخ.','توقع السيولة النقدية 7/14/30 يومًا مع تأثير المستحقات على المشتريات.'],
    purchases:['فواتير الموردين غير المربوطة بسند استلام أو قيد محاسبي.','فروق أسعار الشراء والخصومات والضريبة ومردودات الموردين.','اقتراح توقيت طلبات الشراء بموازنة المخزون المتاح والسيولة.'],
    sales:['مطابقة مبيعات الصناديق مع سندات القبض والإيداعات البنكية.','تقرير ذروة المبيعات وساعات انخفاض الطلب ومتوسط الفاتورة.','تحليل أثر العروض والخصومات ومردودات المبيعات على هامش الربح.'],
    inventory:['مطابقة حركة الأصناف مع المشتريات والمبيعات وسندات الإدخال والإخراج.','تنبيه بضاعة راكدة، أصناف قاربت صلاحيتها، وفروق الجرد.','توقع النفاد والحد الأدنى للطلب دون تعطيل السيولة.'],
    employees:['ربط دوام الموظفين بنقاط البيع وسجلات الصلاحيات والورديات.','تمييز العمل الإضافي وفرق الرواتب بعد مطابقة سياسة المنشأة.'],
    definitions:['كشف التعريفات المكررة أو المتعارضة دون دمج أو حذف.'],
    users:['مصفوفة صلاحيات مجموعات المستخدمين مقابل الأدوار الفعلية.','تدقيق فصل مهام الطباعة والتدقيق والترحيل وإعادة فتح المستند.','مراجعة منح صلاحيات الكاشير على مستوى الفرع ونقطة البيع.'],
    checks:['مطابقة الشيك الوارد والصادر مع الحساب البنكي والسند والمستفيد.','مراقبة الشيكات القريبة الاستحقاق والمرتجعة والمعكوسة.']
  });
  const candidateFields={
    Journal_GL:['JournalNo','JournalDate','post','Confirmed','Approved','ApprovedUserNo','ConfirmedUserNo','UserId'],
    ARPJournal_GL:['JournalNo','JournalDate','post','Confirmed','Approved','ApprovedUserNo','ConfirmedUserNo'],
    InvoiceMain:['TransNo','InvoiceDate','Post','Confirmed','Approved','ApprovedUserNo','ConfirmedUserNo'],
    Receipt:['RecNo','RecDate','Posted','Tadkeek','PostToAcc','Verified','FirstApproval','SecondApproval','ThirdApproval'],
    CheqMovement:['CheqId','MoveDate','statusA','statusE','TransNo','VoucherNo'],
    PurchasePostTrans:['RecNo','RecDate','Transno','TransDate','TransType'],
    InvPurchaseVouchersTransactionHistory:['TransNo','TransDate','TransTime','UserId','TransactionDesc','OldValue','NewValue']
  };
  function element(tag,txt,cls){
    const n=document.createElement(tag);
    if(txt!==undefined)n.textContent=String(txt);
    if(cls)n.className=cls;
    return n;
  }
  function note(text){return element('p',text,'directory-note');}
  function tag(text){return element('span',text,'directory-chip');}
  function rowValues(item){return Object.fromEntries(Object.entries(item).filter(([,v])=>v!==null&&v!==undefined));}
  function render({group,snapshot,host,tableRenderer}){
    if(!host)return;
    host.replaceChildren();
    const def=core.spec[group];
    if(!def)return;
    const live=snapshot?.state==='connected'&&!snapshot?.stale;
    const data=snapshot?.data;
    const catalog=core.normalizeCatalog(data?.catalog);
    const tabs=core.tabsFor(group);
    let active=selectedTabs.get(group)||tabs[0]?.id;
    if(!tabs.some(t=>t.id===active))active=tabs[0]?.id;
    selectedTabs.set(group,active);
    const current=tabs.find(t=>t.id===active);
    const source=element('div',undefined,'directory-summary');
    source.append(element('h2',def.label));
    source.append(note(live?'استجابة حديثة من واجهة TrustSoft المصادَق عليها.':'المصدر غير متصل أو البيانات قديمة؛ القوائم التالية للاكتشاف فقط.'));
    source.append(tag('تبويبات القسم: '+tabs.length));
    source.append(tag('عناصر الفهرس المتاحة عبر API: '+catalog.length));
    source.append(tag('آخر قراءة: '+(snapshot?.last_success?new Date(snapshot.last_success*1000).toLocaleString('ar'):'غير مثبتة')));
    source.append(note('الفهرس المعروض هو ما أرسله API لهذه الجلسة فقط، وقد يكون عينة من القاعدة. أسماء الجداول لا تعني وجود تقرير جاهز ولا تثبت الربط أو صلاحيات الوصول.'));
    host.append(source);
    const tabsWrap=element('div',undefined,'directory-tabs');
    tabsWrap.setAttribute('role','tablist');
    tabsWrap.setAttribute('aria-label','تبويبات '+def.label);
    for(const tab of tabs){
      const count=core.tablesFor(catalog,tab).length;
      const b=element('button',tab.label+' ('+count+')','directory-tab');
      b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(tab.id===active));
      b.dataset.subtab=tab.id;
      b.addEventListener('click',()=>{
        selectedTabs.set(group,tab.id);pages.set(group,0);render({group,snapshot,host,tableRenderer});
      });
      tabsWrap.append(b);
    }
    host.append(tabsWrap);
    const body=element('section',undefined,'directory-detail');
    body.append(element('h3',current?.label||def.label));
    if(group==='accounting'){
      const steps=element('div',undefined,'posting-workflow');
      for(const step of core.documentStages){
        const c=element('div',undefined,'posting-stage');
        c.append(element('strong',step.label),element('small','مرحلة في نظام TrustSoft — حالة السند الفردي غير مستنتجة هنا'));
        steps.append(c);
      }
      body.append(steps);
      body.append(note('التسلسل الأصلي: طباعة غير مرحّل ← مدقّق ← مرحّل. لا تتيح هذه الشاشة ترحيلًا أو فكًا أو عكسًا. يجب إثبات حالات Approved وConfirmed وPost وغيرها، ومعرفة ترتيبها الحقيقي لكل نوع سند قبل تحويلها إلى حالات رسمية.'));
    }
    if(current?.id==='cfo'||current?.id==='agent'){
      const agent=core.agents[group]||core.agents.accounting;
      body.append(element('h3',agent.title));
      body.append(note(agent.purpose));
      body.append(note('حالة الوكيل: غير مفعّل. ربط API والتوكن الخاص والمراجعة المستقلة وصلاحيات القراءة لم تُثبت. لا يوجد تنفيذ آلي للمقترحات أو الوصول إلى البيانات من هذه الشاشة.'));
    }
    if(group==='users')body.append(note('مصفوفة الصلاحيات الحالية مقترح تنظيمي فقط؛ لا تُغيِّر حسابات أو أدوار أو قواعد صلاحيات TrustSoft أو نقاط البيع.'));
    if(group==='purchases'||group==='sales'||group==='inventory'){
      body.append(note('أي انتقال من مستند حركة إلى قيد محاسبي يحتاج دليلًا من جدول المصدر وجدول الترحيل وسجل الحركة. لا يعتبر نجاح الطباعة أو الإدخال ترحيلًا محاسبيًا.'));
    }
    // Column observations do not attest row matches or actual posting status.
    const evidence=globalThis.TrustSoftWorkflowEvidence?.inspect({group,catalog});
    if(evidence?.tableRows?.length){
      const evidenceSection=element('section',undefined,'workflow-evidence');
      evidenceSection.append(element('h3','خريطة المستندات وحقول الربط — تحقق وصفي فقط'));
      evidenceSection.append(note('رُصدت أسماء الحقول في 4 نوفمبر 2026 عبر جسر محلي. لا تُعرض قيم مالية أو بيانات اعتماد. إثبات ظهور الجدول يخص فهرس API الحالي فقط.'));
      evidenceSection.append(tableRenderer(evidence.tableRows));
      if(evidence.candidates.length){
        evidenceSection.append(element('h4','علاقات مرشحة تحتاج إثبات المفاتيح والتطابق'));
        evidenceSection.append(tableRenderer(evidence.candidates));
      }
      evidenceSection.append(note('لا يُستنتج الترحيل أو التدقيق من مجرد أسماء الحقول، ولا تتاح أي أوامر تعديل أو عكس من هذه الشاشة.'));
      body.append(evidenceSection);
    }
    if(group==='catalog'){
      const classified=new Set(Object.keys(core.spec).filter(key=>key!=='catalog').flatMap(key=>
        core.tabsFor(key).flatMap(tab=>core.tablesFor(catalog,tab).map(t=>t.schema+'.'+t.name))));
      source.append(tag('مصنفة أوليًا: '+classified.size));
      source.append(tag('غير مصنفة: '+Math.max(0,catalog.length-classified.size)));
      source.append(note('العدد من استجابة API الحالية فقط؛ لا يثبت عرض 1024 جدولًا على الخادم حتى إجراء مطابقة مستقلة.'));
    }
    const matches=core.tablesFor(catalog,current);
    const searchBar=element('div',undefined,'directory-search');
    const input=element('input');input.type='search';input.setAttribute('aria-label','ابحث في الجداول المرتبطة');input.placeholder='بحث باسم الجدول أو المخطط';input.value=searchTexts.get(group)||'';
    searchBar.append(input);
    const tally=element('span',undefined,'directory-tally');
    searchBar.append(tally);body.append(searchBar);
    const listing=element('div',undefined,'directory-results');
    body.append(listing);
    function paint(){
      const query=input.value.trim().toLocaleLowerCase();
      searchTexts.set(group,input.value);
      const filtered=matches.filter(t=>(t.name+' '+t.schema).toLocaleLowerCase().includes(query));
      tally.textContent='الجداول المطابقة: '+filtered.length+' / '+matches.length;
      listing.replaceChildren();
      if(!filtered.length){listing.append(note(catalog.length?'لم تُطابق أي جداول مستلمة هذا التبويب. يلزم مراجعة الربط الفعلي.':'لا توجد بيانات مخطط مصادَق عليها متاحة لهذه الجلسة.'));return;}
      const size=60;
      const page=Math.min(pages.get(group)||0,Math.ceil(filtered.length/size)-1);
      pages.set(group,page);
      const pageRows=filtered.slice(page*size,(page+1)*size).map(t=>rowValues({المخطط:t.schema,الجدول:t.name,النوع:t.kind,عدد_الأعمدة:t.columnCount}));
      listing.append(tableRenderer(pageRows));
      const pager=element('div',undefined,'directory-pagination');
      pager.append(tag('صفحة '+(page+1)+' من '+Math.ceil(filtered.length/size)));
      if(page>0){const prev=element('button','السابق');prev.type='button';prev.onclick=()=>{pages.set(group,page-1);paint();};pager.append(prev);}
      if((page+1)*size<filtered.length){const next=element('button','التالي');next.type='button';next.onclick=()=>{pages.set(group,page+1);paint();};pager.append(next);}
      listing.append(pager);
      const related=core.relationshipEvidence(data?.relations,filtered);
      if(related.length){listing.append(element('h4','علاقات موثقة في الفهرس المستلم'));listing.append(tableRenderer(related));}
      else listing.append(note('لم تُعرض علاقة مفاتيح أجنبية موثقة لهذه المجموعة في اللقطة الحالية. العلاقات التجارية تحتاج إثباتًا منفصلًا.'));
      const verifiedCandidates=filtered.filter(t=>candidateFields[t.name]).slice(0,10);
      if(verifiedCandidates.length){
        listing.append(element('h4','حقول حالة مرشحة من فحص خادم جوافة'));
        listing.append(tableRenderer(verifiedCandidates.map(t=>({الجدول:t.name,حقول_موجودة_بفحص_قراءة: candidateFields[t.name].join(', '),تفسير_الحالة:'قيد المطابقة مع سلوك TrustSoft'}))));
      }
    }
    input.addEventListener('input',()=>{pages.set(group,0);paint();});
    paint();
    // Preserve existing authenticated TrustSoft section rows while adding the directory.
    // These are explicitly source-limited samples, never a complete accounting report.
    const section=data?.sections?.[group];
    if(section?.rows?.length){
      body.append(element('h3','المخرجات الحالية من TrustSoft — عينة فقط'));
      body.append(note('حالة العينة: '+String(section.state||'غير محددة')+' • '+String(section.scope||'نطاق غير محدد')+' • ليست إجمالي تقرير مالي ولا تحقق تسلسل الترحيل.'));
      body.append(tableRenderer(section.rows.slice(0,200)));
    } else {
      body.append(note('لا توجد صفوف تشغيلية مثبتة لهذا القسم في الاستجابة الحالية؛ عرض الجداول الوصفية وحده لا يعني ربط التقارير.'));
    }
    const info=element('div',undefined,'directory-proposals');
    info.append(element('h3','تقارير رقابية وتحليلية مقترحة — ليست تقارير مشغّلة'));
    const list=element('ul');
    (proposals[group]||[]).forEach(s=>list.append(element('li',s)));
    info.append(list);
    body.append(info);
    host.append(body);
  }
  globalThis.TrustSoftDirectoryUI=Object.freeze({render});
}());
