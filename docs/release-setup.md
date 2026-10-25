# النشر التلقائي

| الجزء | متى يُنشر | أين |
|---|---|---|
| تطبيق Android | مع كل دمج أو push إلى `main` يغيّر التطبيق (`app/`، `gradle/`، ملفات Gradle، `.env.example`) | [GitHub Releases](https://github.com/Mohammadzxzx1991/Mohammad-Ahmed-Ghannam/releases) |
| لوحة التحكم (الويب) | مع كل دمج أو push إلى `main` يغيّر `dashboard/` | https://mohammadzxzx1991.github.io/Mohammad-Ahmed-Ghannam/ |

## تطبيق Android (`.github/workflows/release.yml`)
1. يشغّل اختبارات الوحدة، وإذا فشل أي اختبار لا يُنشر شيء.
2. يبني نسخة **release** موقّعة (ليست نسخة debug).
3. ينشئ Release باسم `v1.0.<رقم التشغيل>` فيه الملف `amer-store.apk` وقائمة التغييرات تلقائياً.

رابط ثابت لأحدث نسخة دائماً:
https://github.com/Mohammadzxzx1991/Mohammad-Ahmed-Ghannam/releases/latest/download/amer-store.apk

كل نسخة تحمل `versionCode` أكبر من السابقة، فتُثبَّت كتحديث فوقها.

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
- أي PR يغيّر هذا الـ workflow أو `app/build.gradle.kts`، وكذلك التشغيل اليدوي من فرع غير `main`، يبني الـ APK ويرفعه كـ artifact دون نشر Release.
- عامل Cloudflare في `aas-cc/` لا يُنشر تلقائياً، لأنه نسخة تجريبية مُختبرة بمحاكاة فقط.
