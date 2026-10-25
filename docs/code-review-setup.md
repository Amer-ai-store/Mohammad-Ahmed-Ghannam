# مراجعة الكود التلقائية بـ Claude

مع كل Pull Request (عند فتحه، وعند كل push جديد عليه، وعند إعادة فتحه) يشغّل `.github/workflows/claude-code-review.yml`
مراجعة بـ Claude، فتظهر على الـ PR:
- تعليق «جارٍ العمل» يتحدّث أثناء المراجعة،
- تعليقات على الأسطر التي فيها مشاكل،
- تعليق ملخّص بالمشاكل مرتبة حسب الخطورة والحكم النهائي، بالعربية.

مسودات الـ PR (Draft) لا تُراجَع حتى تُعلَّم «Ready for review».

## الإعداد (مرة واحدة)
تحتاج المراجعة إلى سرّ واحد في المستودع: **Settings → Secrets and variables → Actions → New repository secret**

- **باشتراك Claude (Pro أو Max):** على حاسوبك شغّل `claude setup-token`، وانسخ الرمز الناتج إلى سرّ باسم `CLAUDE_CODE_OAUTH_TOKEN`.
- **أو بمفتاح API:** أنشئ مفتاحاً من https://console.anthropic.com وضعه في سرّ باسم `ANTHROPIC_API_KEY`.

بدون أحدهما يمرّ فحص «Claude code review» دون مراجعة، مع ملاحظة «Claude review skipped» في صفحة الفحص.

## ملاحظات
- التعليقات تظهر باسم `github-actions`، لأن الـ workflow يستخدم الرمز المدمج في GitHub بدل تطبيق Claude؛ هكذا تعمل المراجعة أيضاً على الـ PR التي تعدّل ملفات الـ workflows.
- كل مراجعة تستهلك من اشتراكك أو رصيد الـ API.
- طلب مراجعة بتعليق (مثل «Leave and review») لا يشغّل شيئاً؛ المراجعة تبدأ تلقائياً مع كل push.
