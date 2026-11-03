# تعليمات Claude لهذا المستودع

## اللغة
- تواصل دائماً بالعربية: في الردود والتقارير، وفي تعليقات GitHub ومراجعات الـ PR ووصفها.
- اترك الكود وأسماء الملفات والدوال والأوامر كما هي (بالإنجليزية).

## المشروع
- `app/`: تطبيق Android (Kotlin وJetpack Compose وRoom وFirebase Auth/Firestore).
- `dashboard/`: لوحة الويب المركزية؛ إعادة نشر GitHub Pages متجمدة حاليًا بموجب Issue #102، ولا تُفتح دون أدلة القبول والموافقة المستقلة.
- `.github/workflows/`: البناء والاختبارات (`android-build.yml`)، وبناء APK (`release.yml`) مع إبقاء النشر الإنتاجي مشروطًا بالبوابات الأمنية، ومراجعة الكود (`claude-code-review.yml`).
- أمر البناء والاختبار المستخدم في CI: `gradle :app:compileDebugKotlin :app:testDebugUnitTest :app:assembleDebug`.
- الإعداد موثّق في `docs/`: `firebase-setup.md` و`release-setup.md` و`code-review-setup.md`.

## الالتزامات والدمج (DCO)
- قبل أي `commit` عيّن هوية المساهم الحقيقية واستخدم `git commit -s`؛ لكل التزام يجب وجود `Signed-off-by: Name <email>` متطابق مع هوية المساهم.
- التزامات GitHub API يجب أن تحتوي تذييل `Signed-off-by:` صحيحًا. تأكد من نتيجة فحص DCO على GitHub، ولا تعطل الفحص أو تخترع توقيع مساهم آخر.
- افحص التعارضات واختبارات CI والأمان والمراجعة المستقلة قبل أي دمج. لا تنشر إنتاجيًا عند استمرار تجميد Issue #102، ولا تعدل البيانات المالية الأصلية.
