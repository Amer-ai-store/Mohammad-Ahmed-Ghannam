/* TrustSoft read-only navigation registry.
 * This is a UI discovery map, NOT an assertion that a database table is an
 * executable TrustSoft report or that financial workflow status is verified.
 * Only authenticated /api/snapshot catalog metadata can populate the UI.
 */
'use strict';
(function () {
  const documentStages = Object.freeze([
    {id:'printed_unposted',label:'طباعة غير مرحّل'},
    {id:'audited',label:'مدقّق'},
    {id:'posted',label:'مرحّل'}
  ]);
  const accounts = [
    ['ledger','القيود والفهرس والأستاذ','journal|(^|_)gl($|_)|from_gl|to_gl|account|budget|ledger|arpjournal|post_notes'],
    ['vouchers','السندات: صرف، قبض، قيد، تسوية','voucher|receipt|payment|delivered|journal|notes|slip'],
    ['cheques','الشيكات الواردة والصادرة والبنوك','cheq|cheque|bankbill|bankloan|bank|deposit'],
    ['periodic','التقارير الدورية واليومية والشهرية','daily|weekly|month|period|journal_total|journalTotals|report'],
    ['annual','التقارير السنوية وإقفال السنة','annual|fiscal|year|budget|closing|close|yearend'],
    ['analytics','التقارير التحليلية والمطابقات','compare|history|summary|audit|reconcile|movement|analysis|report'],
    ['settings','إعدادات المحاسبة والضريبة والربط','^acc|setting|config|tax|currency|branches_account'],
    ['audit','الرقابة وسجل التدقيق والترحيل','post|confirm|cancel|modify|modification|audit|history|transaction'],
    ['cfo','وكيل المدير المالي: مقترحات تحتاج اعتمادًا','^$']
  ];
  const spec = Object.freeze({
    catalog:{label:'دليل جميع الجداول الظاهرة',tabs:[['all','كل الجداول','.*'],['unclassified','جداول تحتاج تصنيفًا','^$']]},
    accounting:{label:'المحاسبة',tabs:accounts},
    purchases:{label:'المشتريات والموردون',tabs:[
      ['documents','فواتير المشتريات وأوامر التوريد','purchase|purch|supplier|vendor|supply|invoice'],
      ['returns','مردودات المشتريات','purch.*ret|returnpurchase|ret.*purch'],
      ['receive','الاستلام والتوريد','receiv|delivery|supply|grn'],
      ['tax','الضرائب والجمارك','tax|custom|vat'],
      ['pricing','أسعار الموردين وتحليل التكلفة','cost|price|supplier|quotation'],
      ['agent','وكيل المشتريات','^$']
    ]},
    sales:{label:'المبيعات ونقاط البيع',tabs:[
      ['documents','فواتير المبيعات','sales|invoice|mpos'],
      ['returns','مردودات المبيعات','return|retail|creditnote'],
      ['pos','نقاط البيع والكاشير والصناديق','pos|cash|shift|till|cashier|close'],
      ['offers','العروض والخصومات','offer|promo|discount|coupon'],
      ['peak','ساعات الذروة واتجاه المبيعات','summary|period|hour|history|trend'],
      ['tax','ضريبة المبيعات والفوترة الإلكترونية','tax|einvoic'],
      ['agent','وكيل المبيعات','^$']
    ]},
    inventory:{label:'المواد والمستودعات',tabs:[
      ['items','تعريف المواد والأصناف والعائلات','item|family|category|barcode'],
      ['warehouses','المستودعات والتحويلات','warehouse|store|transfer|branch'],
      ['counts','الجرد والفروقات','stock|quantity|qty|count|audit'],
      ['moves','إدخال وإخراج ومردودات المخزون','voucher|receive|issue|return|transf'],
      ['expiry','الصلاحية والدفعات والتالف','expiry|batch|serial|damage'],
      ['agent','وكيل المخزون','^$']
    ]},
    employees:{label:'الموظفون والرواتب',tabs:[
      ['employees','ملفات الموظفين والأقسام','employee|emp|staff|department'],
      ['attendance','الحضور والدوام','attendance|inout|shift|clock'],
      ['payroll','الرواتب والسلف والخصميات','salary|payroll|advance|deduction|wage'],
      ['agent','وكيل الموارد البشرية','^$']
    ]},
    definitions:{label:'التعريفات الرئيسية',tabs:[
      ['masters','الفروع والعملاء والموردون','branch|customer|supplier|vendor|definition'],
      ['tax','التصنيفات والضرائب','tax|family|category|type'],
      ['config','إعدادات النظام','setting|config|option|default']
    ]},
    users:{label:'المستخدمون والصلاحيات',tabs:[
      ['users','المستخدمون وحسابات النظام','user|login|account'],
      ['groups','المجموعات والأدوار','group|role|permission|access|privilege'],
      ['pos','صلاحيات الكاشير ونقاط البيع','user|cashier|pos|branch'],
      ['audit','أثر الدخول وتغييرات الصلاحيات','login|log|history|audit|change']
    ]},
    checks:{label:'الشيكات',tabs:[
      ['incoming','الشيكات الواردة (التصنيف يحتاج ربطًا)','cheq|cheque|bill|bank'],
      ['outgoing','الشيكات الصادرة (التصنيف يحتاج ربطًا)','cheq|cheque|bill|bank'],
      ['movement','حركة وصرف وعكس الشيكات','cheq|movement|bank|bill']
    ]}
  });
  function normalizeCatalog(raw){
    if(!Array.isArray(raw)) return [];
    const seen=new Set();
    return raw.filter(row=>row&&typeof row==='object').map(row=>({
      schema:String(row.schema_name??row.TABLE_SCHEMA??'dbo').slice(0,128),
      name:String(row.object_name??row.TABLE_NAME??'').slice(0,128),
      kind:String(row.object_type??row.type??'غير محدد').slice(0,48),
      columnCount:typeof row.COLUMN_COUNT==='number'?row.COLUMN_COUNT:null
    })).filter(row=>{
      if(!row.name||!row.schema) return false;
      const key=row.schema+'.'+row.name;
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    });
  }
  function tabsFor(group){return (spec[group]||{tabs:[]}).tabs.map(([id,label,pattern])=>({id,label,pattern:new RegExp(pattern,'i')}));}
  function tablesFor(catalog,tab){
    if(tab?.id==='unclassified'){
      // Keep unclassified records visible rather than silently losing them.
      const patterns=Object.entries(spec).filter(([group])=>group!=='catalog')
        .flatMap(([,def])=>def.tabs.map(([,,pattern])=>pattern))
        .filter(pattern=>pattern!=='^$').map(pattern=>new RegExp(pattern,'i'));
      return catalog.filter(row=>!patterns.some(re=>re.test(row.name)));
    }
    return catalog.filter(row=>Boolean(tab?.pattern?.test(row.name)));
  }
  function relationshipEvidence(relations,tables){
    if(!Array.isArray(relations)||!tables.length)return [];
    const names=new Set(tables.map(t=>t.name.toLowerCase()));
    return relations.filter(rel=>{
      if(!rel||typeof rel!=='object')return false;
      const values=Object.entries(rel).filter(([key,value])=>/table|object|parent|referenced/i.test(key)&&typeof value==='string').map(([,value])=>value.toLowerCase().split('.').at(-1));
      return values.some(name=>names.has(name));
    }).slice(0,50);
  }
  // Deliberately require a server-provided, independently validated mapping.
  // The UI must never guess posted status from the name of a SQL column.
  function verifiedStage(row,mapping){
    if(!row||!mapping||mapping.validatedByServer!==true||!['printed_unposted','audited','posted'].includes(mapping.stage))return null;
    if(!mapping.evidenceId||!mapping.sourceTime||!mapping.documentId)return null;
    return {stage:mapping.stage,evidenceId:String(mapping.evidenceId),sourceTime:String(mapping.sourceTime),documentId:String(mapping.documentId)};
  }
  const agents=Object.freeze({
    accounting:{title:'وكيل المدير المالي CFO',purpose:'مطابقة الأستاذ والسندات والبنوك والشيكات ومراقبة الفجوات النقدية'},
    purchases:{title:'وكيل المشتريات',purpose:'موازنة تكلفة التوريد مع النقد والمخزون والطلب'},
    sales:{title:'وكيل المبيعات',purpose:'تحليل نقاط البيع والذروة والمرتجعات ومخاطر الخصومات'},
    inventory:{title:'وكيل المخزون',purpose:'إنذارات النقص والتكدس والصلاحية وفروق الجرد'},
    employees:{title:'وكيل الموارد البشرية',purpose:'مراجعة الحضور والمناوبات دون تعديل سجلات الموظفين'},
    users:{title:'وكيل الرقابة والصلاحيات',purpose:'مقارنة الأدوار مع الصلاحيات الفعلية وسجل الأحداث'}
  });
  globalThis.TrustSoftCatalog=Object.freeze({spec,documentStages,normalizeCatalog,tabsFor,tablesFor,relationshipEvidence,verifiedStage,agents});
}());
