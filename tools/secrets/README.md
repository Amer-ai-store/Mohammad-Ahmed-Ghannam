# إدارة أسرار GitHub

هذه الأداة تفحص أسماء Actions secrets أو تحفظ قيمًا تدخلها مرة واحدة في مستودعات محددة. لا تسترجع القيم المحفوظة من GitHub ولا تنشئ حساب Fortify. لا تحفظ القيم في ملفات أو تطبعها؛ ترسلها إلى GitHub CLI عبر stdin، ويجري CLI التشفير.

## تشغيل على جهازك

ثبّت Python 3 و[GitHub CLI](https://cli.github.com/)، ثم سجّل الدخول:

```powershell
gh auth login --hostname github.com --web
python tools/secrets/sync_secrets.py
python tools/secrets/sync_secrets.py --apply
```

الأمر الأول للأداة يفحص فقط. الأمر الثاني يطلب FOD_CLIENT_ID وFOD_CLIENT_SECRET بإدخال مخفي. القيم تأتي من حساب Fortify الحقيقي؛ رمز GitHub ليس بديلًا لها. الحساب المستخدم مع gh يحتاج صلاحية إدارة Secrets بالمستودعات المختارة. عند استخدام fine-grained PAT، اختر المستودعات المطلوبة وصلاحية repository Secrets: read/write؛ أدخله عبر تسجيل دخول gh وليس في الكود أو الدردشة.

إضافة أكثر من مستودع:

```powershell
python tools/secrets/sync_secrets.py --repo OWNER/REPO1 --repo OWNER/REPO2 --apply
```

الأداة لا تغير أسرارًا موجودة إلا مع `--overwrite` بعد مراجعة تقرير الفحص. لا تحذف بيانات دخول قديمة تلقائيًا. إذا كانت طريقة FOD_USER/FOD_TENANT/FOD_PAT موجودة، تتوقف لمنع خلط طريقتي تسجيل الدخول في workflow الحالي.

لأسماء أخرى، كرر `--secret NAME` لكل اسم. تعمل الأداة على أسرار Actions بمستوى المستودع فقط، ولا تدعي فحص أسرار environments أو organizations أو صلاحية قيمها. لا توجد معاملة ذرية عبر المستودعات: عند الفشل الجزئي، تظهر الكتابات المقبولة ويلزم إعادة المحاولة بالقيم الأصلية نفسها. القيم السابقة لا يمكن استرجاعها للتراجع.

## التحقق النهائي

نجاح الحفظ يثبت قبول API ووجود الأسماء فقط. أعد تشغيل Fortify من Actions وتحقق من نجاح تسجيل الدخول واكتمال الفحص؛ لا تعتبر اختبار الأداة أو ظهور الأسماء دليلًا على نجاح Fortify.

```powershell
python -m unittest discover -s tools/secrets -p "test_*.py"
```

المراجع: https://cli.github.com/manual/gh_secret_set و https://docs.github.com/en/rest/actions/secrets
