# إعداد Firebase للمتجر الحي

بعد هذه الخطوات يرسل التطبيق بيانات المتجر (المستخدمون، المنتجات، الطلبات، النزاعات) إلى Firestore مع كل تغيير،
وتعرضها لوحة الويب مباشرة لمالك المتجر فقط. الوقت: نحو 15 دقيقة، وكلها تعمل من متصفح الهاتف.

الكود جاهز في المستودع، وينتظر هذه الإعدادات فقط:
- `app/src/main/java/com/example/data/FirestoreSync.kt`: المزامنة من التطبيق.
- `dashboard/index.html` و`dashboard/firebase-config.js`: المتجر الحي في اللوحة.
- `firestore.rules`: قواعد الأمان.
- `.github/workflows/pages.yml`: نشر اللوحة على GitHub Pages.

## 1. إنشاء المشروع
1. افتح https://console.firebase.google.com وسجّل الدخول بحساب Google الخاص بك.
2. **Create a project**، وسمّه مثلاً `amer-ai-store`. Google Analytics اختياري.

## 2. قاعدة البيانات Firestore
1. **Build → Firestore Database → Create database**، واختر **Production mode** وأقرب منطقة لك.
2. في تبويب **Rules** احذف الموجود، والصق محتوى الملف `firestore.rules` من المستودع كما هو، ثم **Publish**.
   القواعد تسمح بالقراءة لحساب `zxzx.mohammad91@gmail.com` فقط. إن كان حسابك على Google مختلفاً فغيّره في الملف.

## 3. تسجيل الدخول
1. **Build → Authentication → Get started → Sign-in method**.
2. فعّل **Google**، وهو دخولك أنت إلى اللوحة.
3. فعّل **Anonymous**، وبه يكتب التطبيق البيانات.
4. **Settings → Authorized domains → Add domain**، وأضف: `mohammadzxzx1991.github.io`

## 4. تطبيق Android
1. ⚙️ **Project settings → General → Your apps → Add app → Android**.
2. اسم الحزمة (Android package name): `com.aistudio.aicommerce.kpqzjx`
3. نزّل `google-services.json`. **لا ترفعه إلى GitHub**، تحتاج منه ثلاث قيم فقط:
   - `current_key` (داخل `api_key`): هي `FIREBASE_API_KEY`
   - `mobilesdk_app_id`: هي `FIREBASE_APP_ID`
   - `project_id`: هي `FIREBASE_PROJECT_ID`
4. في GitHub افتح المستودع، ثم **Settings → Secrets and variables → Actions → New repository secret**،
   وأضف الأسرار الثلاثة بالأسماء أعلاه. بعدها يبني GitHub Actions ملف APK والمزامنة فيه مفعّلة.
5. للبناء على جهازك: ضع القيم نفسها في ملف `.env`.

`ADMIN_PASSWORD` لا يُضاف كسرّ في GitHub، لأن ملف APK الناتج يستطيع تنزيله أي شخص من المستودع العام. ضعه في `.env` على جهازك فقط.

## 5. تطبيق الويب (اللوحة)
1. ⚙️ **Project settings → Your apps → Add app → Web (</>)**، وسمّه `dashboard`. لا تحتاج Hosting.
2. انسخ كائن `firebaseConfig` الذي يظهر، والصقه في `dashboard/firebase-config.js` مكان `null`،
   أو أرسله إلى Claude ليضيفه. هذه القيم تعرّف المشروع وليست سرية، والحماية من قواعد Firestore.

## 6. نشر اللوحة على GitHub Pages
1. في GitHub افتح المستودع، ثم **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Actions → Deploy dashboard to GitHub Pages → Run workflow**. بعدها تُنشر اللوحة تلقائياً مع كل تغيير في `dashboard/`.
3. الرابط: https://mohammadzxzx1991.github.io/Mohammad-Ahmed-Ghannam/#store

## 7. التجربة
1. ثبّت ملف APK المبني بعد إضافة الأسرار، وافتح التطبيق مع اتصال بالإنترنت.
2. افتح رابط اللوحة، ثم **لوحة المتجر → تسجيل الدخول بـ Google**.
3. أضف طلباً في التطبيق، فيظهر في اللوحة خلال ثوانٍ.

## ملاحظات
- الصفحة المنشورة على Claude لا تتصل بالإنترنت، فالمتجر الحي يعمل على رابط GitHub Pages فقط، وفيها زر يفتحه.
- أي نسخة مثبتة من التطبيق تستطيع الكتابة في Firestore. هذا مقبول للتجربة، وقبل الإطلاق أضف Firebase App Check.
- البيانات التي حُذفت من التطبيق وهو مغلق لا تُحذف من Firestore تلقائياً.
