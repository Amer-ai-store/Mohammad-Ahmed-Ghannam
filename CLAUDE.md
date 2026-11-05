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

## نشر تطبيق لُقطة (Release)
- لأي نسخة جديدة اتبع [docs/release-runbook.md](docs/release-runbook.md) خطوة بخطوة. المفتاح الثابت والبيئة والمتغيرات مضبوطة منذ v2.0.86.
- المالك يعمل من الهاتف فقط، بلا حاسوب ولا طرفية. أعطه خطوات قصيرة من المتصفح مع روابط مباشرة، ولا تطلب منه أسرارًا في المحادثة.
- عليه خطوتان فقط: تحديث `RELEASE_APPROVED_SHA` بالـ SHA الذي ترسله، ثم الموافقة على `production` من Chrome (Desktop site)، لا من تطبيق GitHub. الباقي عليك: الدمج والتشغيل والتحقق من التوقيع `CN=Amer AI Store` ومن الإصدار ورابط التحميل.
- لا تشغّل `release-signing-setup.yml`، ولا تغيّر أسرار `SIGNING_*` أو تحذفها، ولا تعدّل شروط `publish` في `release.yml`.
- في جلسات Claude Code السحابية قد تعرف أدوات GitHub هذا المستودع بالمالك `Mohammadzxzx1991`؛ استعمل الاسم الذي تقبله الأدوات.

## الالتزامات والدمج (DCO)
- قبل أي `commit` عيّن هوية المساهم الحقيقية واستخدم `git commit -s`؛ لكل التزام يجب وجود `Signed-off-by: Name <email>` متطابق مع هوية المساهم.
- التزامات GitHub API يجب أن تحتوي تذييل `Signed-off-by:` صحيحًا. تأكد من نتيجة فحص DCO على GitHub، ولا تعطل الفحص أو تخترع توقيع مساهم آخر.
- افحص التعارضات واختبارات CI والأمان والمراجعة المستقلة قبل أي دمج. لا تنشر إنتاجيًا عند استمرار تجميد Issue #102، ولا تعدل البيانات المالية الأصلية.
