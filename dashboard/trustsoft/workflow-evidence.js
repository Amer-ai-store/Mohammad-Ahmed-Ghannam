/* Evidence ledger for TrustSoft document navigation.
 * Table column names: observed in a bounded, read-only local bridge query
 * from JAWAFFASVR on 2026-11-04. No row values or credentials are bundled.
 * No joins, foreign keys, status semantics or posting transitions validated.
 */
'use strict';
(function(){
  const observation='JAWAFFASVR /api/query/<table>?limit=1 — schema-only observation';
  const tables=Object.freeze({
    Receipt:{area:'purchases',role:'استلام/مشتريات',fields:['RecNo','RecDate','Posted','Tadkeek','PostToAcc','Cancel_PostToAcc','Post_Date','Verified','PostedSeq','FirstApproval','SecondApproval','ThirdApproval'],status:'columns_observed'},
    PurchasePostTrans:{area:'purchases',role:'حركة ترحيل المشتريات',fields:['RecNo','RecDate','Transno','TransDate','TransType'],status:'columns_observed'},
    InvPurchaseVouchersTransactionHistory:{area:'purchases',role:'سجل تغييرات مستندات المشتريات',fields:['TransNo','TransSeqNo','TransDate','TransTime','ReceiptNo','UserId','ComputerName','TransactionDesc','OldValue','NewValue'],status:'columns_observed'},
    Journal_GL:{area:'accounting',role:'قيود المحاسبة العامة',fields:['JournalNo','JournalDate','ReceiptNo','ReceiptType','RecNo','post','Confirmed','Approved','ApprovedUserNo','ConfirmedUserNo','UserId','accYear'],status:'columns_observed'},
    ARPJournal_GL:{area:'accounting',role:'قيود الذمم',fields:['JournalNo','JournalDate','ReceiptNo','ReceiptType','RecNo','post','Confirmed','Approved'],status:'columns_observed'},
    InvoiceMain:{area:'accounting',role:'مستند مالي رئيسي',fields:['TransNo','InvoiceNo','InvoiceDate','Post','Approved','Confirmed','ApprovedUserNo','ConfirmedUserNo','FromPOS'],status:'columns_observed'},
    InvoiceDetails:{area:'accounting',role:'تفاصيل المستند المالي',fields:['TransNo','SerialOrder','Acc_No','Sub_No','Debit','Credit'],status:'columns_observed'},
    ARPPayMaster:{area:'accounting',role:'سندات الصرف والقبض',fields:['Trans_No','VoucherNo','VoucherDate','Posted','Approved','Confirmed','ApprovedUserNo','ConfirmedUserNo'],status:'columns_observed'},
    ARPReturns:{area:'sales',role:'مردودات الذمم',fields:['TransNo','VoucherNo','VoucherDate','Posted','Approved','Confirmed','FromPOS'],status:'columns_observed'},
    POSJournal:{area:'sales',role:'حركة الترحيل من نقاط البيع',fields:['CashDate','PostDate','StoreId','seqId','journalno','Cancel_Post'],status:'columns_observed'},
    CheqMovement:{area:'checks',role:'حركة الشيكات',fields:['SeqId','CheqId','statusA','statusE','MoveDate','TransNo','VoucherNo','APorAR'],status:'columns_observed'},
    Receipt_Voucher_Type:{area:'definitions',role:'تعريف أنواع سندات الاستلام',fields:['RVTNo','RVTDescA','PostToItemSalesSummary','ReturnVoucher','Active'],status:'columns_observed'}
  });
  const links=Object.freeze([
    {from:'Receipt.RecNo',to:'PurchasePostTrans.RecNo',purpose:'تتبع حركة الترحيل من سند الاستلام',status:'join_unverified'},
    {from:'Receipt.RecNo',to:'Journal_GL.RecNo',purpose:'تحري إحالة سند الاستلام إلى القيد',status:'join_unverified'},
    {from:'InvoiceMain.TransNo',to:'InvoiceDetails.TransNo',purpose:'تفصيل المستند المالي الرئيسي',status:'join_unverified'},
    {from:'Journal_GL.JournalNo',to:'ARPJournal_GL.JournalNo',purpose:'تمييز مصدر الأستاذ عن الذمم قبل المطابقة',status:'join_unverified'},
    {from:'ARPPayMaster.VoucherNo',to:'CheqMovement.VoucherNo',purpose:'مطابقة السند مع حركة الشيك',status:'join_unverified'},
    {from:'Receipt.RecNo',to:'InvPurchaseVouchersTransactionHistory.ReceiptNo',purpose:'سجل تعديل سند الاستلام والمشتريات',status:'join_unverified'},
    {from:'POSJournal.journalno',to:'Journal_GL.JournalNo',purpose:'التحقق من ترحيل الصندوق إلى الأستاذ',status:'join_unverified'}
  ]);
  const flows=Object.freeze({
    accounting:[['سند المصدر','Receipt','InvoiceMain','ARPPayMaster'],['المراجعة والتدقيق','Receipt','Journal_GL','InvoiceMain'],['الترحيل المحاسبي','PurchasePostTrans','Journal_GL','POSJournal'],['الأثر التاريخي','InvPurchaseVouchersTransactionHistory']],
    purchases:[['مستند الاستلام','Receipt'],['رقابة المشتريات','Receipt','InvPurchaseVouchersTransactionHistory'],['نقل الأثر إلى المحاسبة','PurchasePostTrans','Journal_GL']],
    sales:[['المستند المالي والذمم','InvoiceMain','ARPReturns'],['صندوق نقطة البيع','POSJournal'],['الترحيل إلى الأستاذ','Journal_GL']],
    checks:[['سندات الدفع','ARPPayMaster'],['حركة الشيكات','CheqMovement'],['قيود مرتبطة مرشحة','Journal_GL']],
    inventory:[['سند الاستلام','Receipt'],['نوع السند وتعريفاته','Receipt_Voucher_Type'],['تسجيل الأثر المحاسبي','PurchasePostTrans','Journal_GL']]
  });
  function inspect({group,catalog}){
    const normalized=Array.isArray(catalog)?catalog:[];
    const present=new Set(normalized.map(row=>(row.schema+'.'+row.name).toLowerCase()));
    const stages=flows[group]||[];
    const distinct=new Set(stages.flatMap(x=>x.slice(1)));
    const tableRows=[...distinct].map(table=>{
      const item=tables[table]; if(!item)return null;
      const visible=present.has(('dbo.'+table).toLowerCase())||normalized.some(x=>x.name.toLowerCase()===table.toLowerCase());
      return {الجدول:table,الغرض:item.role,المصدر_في_جلسة_API:visible?'ظاهر':'غير ظاهر',حقول_رُصدت_على_الخادم:item.fields.join('، '),حالة_الربط:'الحقول مرصودة، العلاقة غير مثبتة'};
    }).filter(Boolean);
    const candidates=links.filter(link=>distinct.has(link.from.split('.')[0])||distinct.has(link.to.split('.')[0]));
    return {tableRows,candidates:candidates.map(link=>({من:link.from,إلى:link.to,الهدف:link.purpose,الحالة:'مرشح فقط — لم تثبت علاقة المفتاح أو تطابق السجلات'})),source:observation};
  }
  globalThis.TrustSoftWorkflowEvidence=Object.freeze({tables,links,flows,inspect,observation});
}());
