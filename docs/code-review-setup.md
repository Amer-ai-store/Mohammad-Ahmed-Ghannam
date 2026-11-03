# مراجعة PR مجانية، دون Anthropic API أو اشتراك Claude

## القرار
المراجعة التلقائية الإلزامية تعتمد الآن على **Free PR quality and security gate** في
`.github/workflows/free-pr-review.yml`. لا تحتاج إلى مفاتيح API أو دفع أو تسجيل دخول في Semgrep.

- مهمة `quality`: `npm ci` ثم TypeScript وESLint واختبارات الخادم والواجهة الثابتة واختبارات دليل الوكلاء.
- مهمة `security`: تشغيل Semgrep Community Edition بالإصدار المثبت `1.182.0`، مع `--error` وأثر JSON لكل تشغيل.
- مهمة `free-pr-gate`: تفشل إذا فشلت أو تخطّت أي من مهمتي الجودة أو الأمان؛ لا تمنح نجاحًا صوريًا.
- فحوص مستقلة باقية: `Open-source security scan / Semgrep source security`، وCodeQL عبر إعداد GitHub الافتراضي،
  و`Luqta storefront and Jawafa inventory validation / e2e`، و`test`، وDCO.
- **هذه أدوات تحليل آلي وليست مراجعة LLM أو تدقيقًا أمنيًا مستقلاً.** إن وُجدت مطالبة بمراجعة بشرية مستقلة أو قبول Security/E2E، فلا تستبدلها بهذه النتيجة.

## كيف تُطبق قاعدة الدمج
1. افتح PR في GitHub، واجعله Ready for review. انتظر ظهور `free-pr-gate = success` واختبارات E2E وبقية الفحوص المطلوبة على **نفس HEAD SHA**.
2. في Settings → Rules → Rulesets أو Branch protection، اجعل `free-pr-gate` وبقية الفحوص المستقلة ذات الصلة مطلوبة.
   إذا كان `Claude code review / review` مطلوبًا في إعدادات الحماية السابقة، استبدل **الشرط نفسه**
   باسم `free-pr-gate`؛ لا تعطل قاعدة الحماية كاملة، ولا تعامل `skipped` كنجاح.
3. لا تدمج ما دام أي فحص إلزامي فاشلاً أو معلقاً، أو كان التدقيق المستقل المطلوب غير مكتمل.
   لا تستخدم `--admin` أو تعطيل حماية الفرع للتجاوز.
4. **Issue #102 / GATE-15:** الموافقة على دمج الشيفرة ليست إذن نشر إنتاجي أو إثبات قبول البيانات المالية.
   يبقى إصدار Android والنشر العام خاضعين للبوابات الخاصة بهما. لا تكتب إلى `Jawafa_DB` أو القيود الأصلية.

## لماذا هذا المسار مجاني؟
GitHub Actions مجاني على المشغّلات القياسية للمستودعات العامة، وCodeQL متاح للمستودعات العامة.
Semgrep Community Edition مفتوح المصدر ويعمل من CLI دون حساب Semgrep؛ يستخدم هذا المستودع قواعد `p/ci`.
التكاليف المحتملة مستقبلاً تخص تغيير الاستضافة إلى مشغلات أكبر أو مستودع خاص أو استخدام خدمة إضافية مدفوعة، وليست جزءًا من هذه البوابة.

## Claude متاح اختيارياً فقط
- أزيل `.github/workflows/claude-code-review.yml` من فرع دمج Luqta؛ لا ينبغي أن تستدعي PR الجديدة خدمة Anthropic تلقائيًا.
- بقيت أوامر `@claude` القديمة في `.github/workflows/claude.yml` **معطلة افتراضيًا**.
  لا تُشغّل إلا إذا ضبط المالك متغير Actions `PAID_CLAUDE_ENABLED=true` عمدًا، بالإضافة إلى توفر اعتماد صالح ورصيد.
- لا حاجة لإضافة `ANTHROPIC_API_KEY` أو `CLAUDE_CODE_OAUTH_TOKEN` لتشغيل المراجعة المجانية.
  لا تنسخ الأسرار إلى الملفات أو التعليقات أو سجل CI.
- فشل مراجعة Claude السابقة `Credit balance is too low` لا يعني فشل الشيفرة؛ لكنه ليس مراجعة ناجحة.
  سجل الأصل: https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/actions/runs/41671772130

## أدلة القبول
سجّل رابط التشغيل، SHA، نتائج quality/security/free-pr-gate وCodeQL/E2E، وموافقة التدقيق المستقل حيث يلزم.
`NO EVIDENCE = NO DONE`. لا تعلن MERGED أو DEPLOYED إلا بعد قراءة حالة GitHub/البيئة الفعلية.
