# النشر التلقائي

| الجزء | متى يُنشر | أين |
|---|---|---|
| تطبيق Android المدموج «لُقطة» | مع كل دمج أو push إلى `main` يغيّر `luqta-mobile/` | [GitHub Releases](https://github.com/Mohammadzxzx1991/Mohammad-Ahmed-Ghannam/releases) |
| لوحة التحكم (الويب) | مع كل دمج أو push إلى `main` يغيّر `dashboard/` | https://mohammadzxzx1991.github.io/Mohammad-Ahmed-Ghannam/ |

## تطبيق Android (`.github/workflows/release.yml`)
يُنشر الآن التطبيق المدموج في `luqta-mobile/` (Expo وReact Native)، بدل تطبيق Kotlin القديم في `app/`.
يبقى تطبيق Kotlin في المستودع، ويُبنى ويُختبر في `android-build.yml`، لكنه لا يُنشر.

1. يشغّل فحص الأنواع والـ lint واختبارات الخادم، وإذا فشل أي منها لا يُنشر شيء.
2. يولّد مشروع Android الأصلي (`expo prebuild`)، ثم يبني نسخة **release** لمعالجات arm64 وarmv7، ويوقّعها بمفتاح الرفع، ويتحقق من التوقيع.
3. ينشئ Release باسم `v2.0.<رقم التشغيل>` فيه الملف `amer-store.apk` وقائمة التغييرات تلقائيًا.

رابط ثابت لأحدث نسخة دائمًا (لم يتغيّر):
https://github.com/Mohammadzxzx1991/Mohammad-Ahmed-Ghannam/releases/latest/download/amer-store.apk

كل نسخة تحمل `versionCode` أكبر من السابقة، فتُثبَّت كتحديث فوقها.
اسم الحزمة `com.luqta.store` يختلف عن تطبيق Kotlin القديم، فيُثبَّت التطبيق الجديد بجانب القديم، ويمكن حذف القديم يدويًا.

### عنوان خادم المتجر داخل التطبيق (اختياري)
أضف متغيرًا (وليس سرًا) في **Settings → Secrets and variables → Actions → Variables** باسم `LUQTA_API_URL`، وقيمته عنوان خادم المتجر العام بصيغة HTTPS، مثل `https://store.example.com`.
بدونه يفتح التطبيق شاشة «إعداد الاتصال» ليُدخل المستخدم العنوان.

### اختبارات المتصفح (`luqta-jawafa-ci.yml`)
في كل PR يغيّر التطبيق أو لوحة التحكم:
- 44 اختبارًا تشغّل التطبيق في Chromium.
- 25 اختبارًا تشغّل لوحة التحكم المركزية.
- يرفض العمل إذا بقيت أي ميزة من الـ125 دون اختبار ناجح على كل واجهة تخصها.
لقطات الشاشة للخطوات الفاشلة، والملف `feature-status.json`، تُرفع كـ artifact.

## مفتاح التوقيع (مرة واحدة، مُوصى به)
بدون مفتاح ثابت يوقَّع كل APK بمفتاح جديد مؤقت، فيرفض الهاتف التحديث حتى تُحذف النسخة السابقة (وتُحذف بياناتها معها).
لتثبيت التحديثات فوق بعضها أضف مفتاحاً ثابتاً:

1. أنشئ المفتاح على حاسوبك (مرة واحدة، واحتفظ بنسخة منه في مكان آمن؛ ضياعه يعني أن المستخدمين لن يستطيعوا التحديث):
   ```
   keytool -genkeypair -keystore upload-key.jks -storetype PKCS12 -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
   الاسم المستعار (alias) يجب أن يكون `upload`.
2. حوّله إلى نص: `base64 -w0 upload-key.jks` (على macOS: `base64 -i upload-key.jks`).
3. في GitHub: **Settings → Secrets and variables → Actions → New repository secret**، وأضف:
   - `SIGNING_KEYSTORE_BASE64`: النص الناتج من الخطوة 2
   - `SIGNING_STORE_PASSWORD`: كلمة مرور المفتاح
   - `SIGNING_KEY_PASSWORD`: كلمة مرور الـ alias (اتركه إن كانت نفسها)

لا تضع ملف المفتاح أو كلمات مروره في المستودع.

## ملاحظات
- `ADMIN_PASSWORD` لا يدخل أي APK منشور، لأن الإصدارات عامة ويمكن لأي شخص تنزيلها.
- أي PR يغيّر هذا الـ workflow أو إعدادات التطبيق الأصلية (`luqta-mobile/app.json` و`app.config.js` و`package.json` و`plugins/`)، وكذلك التشغيل اليدوي من فرع غير `main`، يبني الـ APK ويرفعه كـ artifact دون نشر Release.
- عامل Cloudflare في `aas-cc/` لا يُنشر تلقائياً، لأنه نسخة تجريبية مُختبرة بمحاكاة فقط.
