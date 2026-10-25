# تعليمات Claude لهذا المستودع

## اللغة
- تواصل دائماً بالعربية: في الردود والتقارير، وفي تعليقات GitHub ومراجعات الـ PR ووصفها.
- اترك الكود وأسماء الملفات والدوال والأوامر كما هي (بالإنجليزية).

## المشروع
- `app/`: تطبيق Android (Kotlin وJetpack Compose وRoom وFirebase Auth/Firestore).
- `dashboard/`: لوحة الويب، تُنشر على GitHub Pages عند كل تغيير على `main`.
- `.github/workflows/`: البناء والاختبارات (`android-build.yml`)، والنشر التلقائي للتطبيق (`release.yml`)، ومراجعة الكود (`claude-code-review.yml`).
- أمر البناء والاختبار المستخدم في CI: `gradle :app:compileDebugKotlin :app:testDebugUnitTest :app:assembleDebug`.
- الإعداد موثّق في `docs/`: `firebase-setup.md` و`release-setup.md` و`code-review-setup.md`.
