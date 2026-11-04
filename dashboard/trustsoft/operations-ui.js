/* Audit15 and existing server-agent workspaces: authenticated metadata display only.
 * A local Windows task result is NOT evidence that an AI model is connected,
 * a financial reconciliation succeeded, or a historical edit was caused by a user.
 * No direct fetch to loopback or untrusted origins. Never expose credentials.
 */
'use strict';
(function(){
  const allowedGroups=new Set(['audit15','agents']);
  const validKinds=new Set(['data_pipeline','forensic','monitoring','backup','command_center','operations']);
  function trusted(snapshot){
    if(snapshot?.state!=='connected'||snapshot?.stale===true)return null;
    const source=snapshot?.data?.audit15_ops;
    if(!source||source.schema!=='jawafa.audit15-agents.v1'||
      source.classification!=='PRIVATE_EVIDENCE_METADATA_ONLY_NO_BUSINESS_ROWS'||
      !Array.isArray(source.audit15?.tables)||source.audit15.tables.length!==15||
      !Array.isArray(source.existingAgents?.agents)||source.host!=='JAWAFFASVR'||
      source.database!=='Jawafa_DB')return null;
    const names=new Set();
    for(const row of source.audit15.tables){
      if(typeof row?.table!=='string'||!/^[\w]{1,128}$/.test(row.table)||names.has(row.table.toLowerCase()))return null;
      names.add(row.table.toLowerCase());
      if(!Number.isSafeInteger(Number(row.referenceRows))||
        !Number.isSafeInteger(Number(row.exportRows))||
        !Number.isSafeInteger(Number(row.laterMinusReference)))return null;
    }
    return source;
  }
  function h(tag,text,className){
    const node=document.createElement(tag);
    if(text!==undefined)node.textContent=String(text);
    if(className)node.className=className;
    return node;
  }
  function info(host,text){host.append(h('p',text,'directory-note'))}
  function render({group,snapshot,host,tableRenderer}){
    if(!host||!allowedGroups.has(group))return;
    host.replaceChildren();
    const label=group==='audit15'?'تدقيق الجداول التاريخية الـ15':'مساحات وكلاء جوافة على الخادم';
    host.append(h('h2',label));
    info(host,'هذا القسم يعمل بالقراءة فقط. لن يُعرض تقرير حي إلا إذا أعادته واجهة API المصادَق عليها للجلسة الحالية؛ تشغيل Windows المجدول لا يثبت تشغيل نموذج AI.');
    const data=trusted(snapshot);
    if(!data){
      info(host,'BLOCKED — لم يصل تقرير الجداول الـ15 والوكلاء من مصدر خاص مُصادَق عليه. نسخة التقرير المحلية على JAWAFFASVR ليست متاحة تلقائيًا من GitHub Pages.');
      if(group==='audit15'){
        info(host,'المطلوب من خدمة الربط الآمنة: إعادة schema=jawafa.audit15-agents.v1 مع سلسلة المصدر والفحص و15 جدولًا. لا تُستخدم أرقام تاريخية مخبأة في الواجهة.');
      }else{
        const categories=[
          ['المحاسبة / CFO','تدقيق القيود والسندات والمطابقة المالية'],
          ['المشتريات / CPO','تكلفة التوريد وربط الاستلام بالمخزون'],
          ['المدير العام / GM','التنسيق وإدارة حالات القبول'],
          ['التصدير والاستيراد','مهام Windows القائمة وسجلات نجاح التنفيذ'],
          ['التحقيق التاريخي','سجل فروقات الجداول الـ15']
        ];
        host.append(h('h3','مساحات الوكلاء — تعريفات غير متصلة'));
        host.append(tableRenderer(categories.map(([agent,scope])=>({المساحة:agent,المهام:scope,حالة_تشغيل_النموذج:'غير مثبت',حالة_المزامنة:'غير متصل'}))));
      }
      return;
    }
    info(host,'وقت استخراج التقرير من الخادم: '+String(data.checkedUtc||'غير متوفر'));
    if(group==='audit15'){
      const summary=data.audit15;
      const rows=summary.tables.map(row=>({
        الجدول:row.table,
        سجلات_المرجع_التاريخي:row.referenceRows,
        سجلات_استخراج_لاحق:row.exportRows,
        فرق_عدد_السجلات:row.laterMinusReference,
        مؤشرات_فروق_القيم:row.historicalValueDifferenceCandidates,
        نمط_أحدث_توثيق_تاريخي:row.priorAuditLatestMode,
        علاقات_SQL_المعلنة:row.declaredForeignKeyCount,
        حالة_التفسير:'غير مثبت — لا يُنسب لمستخدم'
      }));
      host.append(h('h3','مقارنة المصدر التاريخي — ليست نتيجة اتهام أو حذف'));
      host.append(tableRenderer(rows));
      const historical=data.historicalKeyedAnalysis;
      if(historical?.keyedTables?.length===6){
        host.append(h('h3','ستة جداول: مقارنة السجلات بالمفاتيح عبر ملفات تاريخية'));
        host.append(tableRenderer(historical.keyedTables.map(x=>({
          الجدول:x.table,مشتركة:x.sharedKeys,مضافة:x.addedKeys,
          مفقودة_لاحقًا:x.missingKeysFromLater,مشتركة_تغيّرت:x.changedSharedRecords,
          أولوية_التحقيق:x.triagePriority||'غير محدد',
          الحقول_المختلفة:(x.changedFieldCounts||[]).map(f=>f.name+':'+f.occurrences).join('، '),
          معنى_الفروق:'مقارنة CSV، ليست إثبات تعديل SQL'
        }))));
        const p=historical.postingCorrelation,c=historical.transactionHistoryContinuity;
        info(host,'مطابقة ترحيل: '+String(p?.matchedHistoryEvents??'غير مثبت')+' حدث من '+String(p?.candidatePostingChanges??'غير مثبت')+
        ' تغيير مرصود. توقيت الساعة والهوية البشرية غير موثوقين؛ لا استنتاج بشأن المسؤول.');
        info(host,'استمرارية TransactionHistory: '+String(c?.newHistoryIds??'—')+
        ' مُعرفًا جديدًا، وتسلسل المعرفات '+(c?.newIdsContiguous===true?'متصل':'غير متصل أو غير مثبت')+'.');
      }else{
        info(host,'المقارنة التاريخية بالمفاتيح لم تُحمّل من مصدر موثق في هذه الجلسة.');
      }
      info(host,'التحقق من النقل: '+String(summary.transferGuardStatus||'غير متوفر')+
        ' • فحص الملفات: '+String(summary.verifiedTransferFiles??'—')+
        '/15 • فحص الاسترجاع: '+String(summary.verifiedRoundtrips??'—')+'/15.');
      info(host,'الحالة: '+(summary.historicalRootCauseVerified===true?'أرسل المصدر نتيجة تحتاج مراجعة مستقلة':'سبب فروقات القيم والأعداد ما زال غير محسوم')+
        '. آخر تقرير سلامة نقل ليس إثباتًا لصحة القيود المحاسبية أو صحة تسلسل المعاملات.');
      return;
    }
    const rows=(data.existingAgents.agents||[])
      .filter(a=>a&&typeof a.name==='string'&&a.name.length<200)
      .map(a=>({
        الوكيل_أو_المهمة:a.name,
        المجال:validKinds.has(a.category)?a.category:'operations',
        حالة_المجدول:String(a.schedulerState||'غير معروف'),
        آخر_تشغيل_حسب_ساعة_الخادم:String(a.lastRunLocal||'غير مثبت'),
        نتيجة_المجدول:String(a.lastSchedulerResult??'غير مثبت'),
        اتصال_نموذج_AI:a.aiModelEndpointVerified===true?'يحتاج تحققًا منفصلًا':'غير مثبت'
      }));
    host.append(h('h3','وكلاء Windows الفعليون — سجلات جدولة فقط'));
    host.append(tableRenderer(rows));
    info(host,'لم يُثبت في هذا التقرير اتصال API لنموذج لغوي. مهام التصدير والتحقيق الحالية ليست بالضرورة وكلاء ذكاء اصطناعي توليدي.');
    const e=data.export;
    if(e){
      host.append(h('h3','مراقبة التصدير — حسب المصدر'));
      host.append(tableRenderer([{
        الحالة:e.mode,
        جداول_معالجة:e.processedTables,
        إجمالي_الجداول:e.totalTables,
        متبقية:e.remainingTables,
        فشل_مُعلن:e.failedTables,
        نسبة_معلنة:e.progressPercent,
        الجدول_المرجعي_غير_المصدر:(e.referenceOnlyTableNames||[]).join('، ')||'غير محدد',
        مطابقة_الجرد:e.coverageReconciled===true?'مطابقة وصفية':'غير مثبتة',
        اعتماد_الإكمال:'غير معتمد'
      }]));
    }
  }
  globalThis.TrustSoftOperationsUI=Object.freeze({render,trusted});
}());
