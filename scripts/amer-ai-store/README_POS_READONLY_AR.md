# استخراج أصناف POS — Amer Ai Store

مسار السكربت على الخادم: `C:\ProgramData\SentinelXService\workspace\AAS_POS_READONLY.ps1`

التجربة المنفذة بتاريخ 23 نوفمبر 2026: نجح في قراءة 10,000 صف من نهاية `Jawafa_DB.dbo.MPOSSales` و13,421 صفًا من `MPOSReturn` باستخدام HTTP GET محلي فقط، وأعاد نتائج 6 لحوم و4 ألبان و4 محمص و0 خضار؛ تاريخ أحدث بيع مرصود 2026-11-20. تطابق 14/14 مرشحًا مع استخراج مستقل من 200,000 صف. الملف الناتج: `AAS_POS_LATEST_READONLY.json`.

## التشغيل

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\ProgramData\SentinelXService\workspace\AAS_POS_READONLY.ps1" -RecentRows 10000
```

**حدود الاستعمال:** هذا السكربت يشغّل استعلامات GET للقراءة فقط ولا يحتاج كلمة مرور مكتوبة فيه؛ ملف النتائج **PARTIAL_READ_ONLY** ويُمنع اعتباره إثباتًا بأن مبيعات اليوم مكتملة، ولا يُستخدم لإصدار فواتير أو تشغيل عمليات مالية. قبل تغيير حالة المبيعات إلى VERIFIED يجب فحص كامل تاريخ اليوم، جميع الفروع والمردودات وإجراء مطابقة وثائقية على مستوى الصنف والوحدة. لا يُعدّ فشل SQL Agent `MDS_juava_Sync` دليلًا أنها وظيفة استيراد POS حتى تتم مراجعة خطوات msdb.

إصدار لوحة المالك الداعمة: https://souq-almalakiya.vercel.app/owner.html
سجل الأدلة: https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/issues/270
