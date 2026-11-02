# جرد ميزات تطبيق «أسواق جوافة / Aura» ودمجها في لُقطة (G14)

المصدر: الملف المرفق `remix-…-aura-ai-marketplace-new_1.zip` (تطبيق Android بلغة Kotlin/Compose، ~3 ميغابايت كود؛ أهم الملفات: `MainLayout.kt` 14,820 سطرًا، `ViewModels.kt`، `visionx/*`، `agent/*`، `data/*`).

المبدأ: نقلنا **الميزة** لا المحاكاة. كثير من منطق Aura كان بيانات وهمية داخل التطبيق (خصومات ثابتة، أسعار منافسين عشوائية، "إشعارات FCM" مُحاكاة). في لُقطة كل ميزة مبنية على قاعدة بيانات المتجر الحقيقية، ويُفصل الوضع التجريبي ويُوسم «تجريبي».

| ميزة Aura (الملف) | في لُقطة | المعرّف |
|---|---|---|
| Recharts / D3 Price Trend (RechartsPriceTrendChart.kt, D3PriceChartComponent.kt) | سجل الأسعار الحقيقي عبر Trigger على كل تغيير سعر + مخطط 30 يومًا + اتجاه بالانحدار الخطي + «أفضل وقت للشراء» في صفحة المنتج | F-G14-01 |
| Market Pulse Dashboard (MarketPulseDashboard.kt) | `/market-pulse`: تغيّر الأسعار حسب القسم، أكبر الانخفاضات/الارتفاعات، الأكثر مشاهدة، الخط الزمني | F-G14-02 |
| Price Alerts / Watched Products / FCM (PriceAlertManager.kt, WatchedProductsView.kt, PriceAlertSettingsModal.kt) | «تابع السعر» بهدف سعر؛ Trigger في SQLite يُنشئ إشعارًا مرة واحدة عند الوصول للهدف؛ شاشة `/watchlist` | F-G14-03 |
| Price Radar / Price Comparison (PriceRadarService.kt, PriceComparisonUI.kt) | `/price-radar`: سعرنا + الشحن + مخزون الفروع + أسعار منافسين **يستوردها المالك** (لا أسعار مخترعة) | F-G14-04 |
| Basket Optimizer (BasketOptimizerScreen/ViewModel, BasketCalculationService.kt) | `/basket-optimizer`: بدائل أرخص ≥5% من نفس القسم ومتوفرة، الفرع القادر على تجهيز كل السلة، فجوة التوصيل المجاني، 3 أهداف (الأوفر/فرع واحد/الأسرع) | F-G14-05 |
| Bundle Discounts (BasketCalculationService) | حزم يحددها المالك من «النمو والمحتوى» وتُطبّق في `/orders/check` و`/orders` على الخادم | F-G14-06 |
| Complementary items / Meal pairings | «يُشترى عادةً معًا» من الطلبات الفعلية | F-G14-07 |
| Spending Insights / AI money-saving | `/insights`: الإنفاق الشهري، الأقسام، ما وفّرته، نصائح | F-G14-08 |
| Offline recommendations / recently viewed / recent searches | موجودة في لُقطة سابقًا (recommendations.ts / rememberProduct) + شريط أدوات ذكية | F-G14-09 |
| Smart Lists | `/lists` قوائم بميزانية وإضافة الكل للسلة | F-G14-10 |
| Family Shopping Mode (FamilyShoppingModeCard) | قوائم عائلية برمز دعوة (حتى 12 فردًا)، المالك وحده يعدّل | F-G14-11 |
| Shopping Lens / AI Visual Camera Search (ShoppingLensCameraXView, CameraScreen, VisionXService) | `/lens` بحث بالصورة عبر Gemini **على الخادم** ثم مطابقة الكتالوج | F-G14-12 |
| Coupon Scanner / barcode | `/lens` قراءة باركود/QR عبر BarcodeDetector داخل WebView + إدخال يدوي | F-G14-13 |
| Receipt Intelligence OCR | `/receipts` تصوير (AI) أو لصق نص (محلل محلي مختبَر) → حفظ + مقارنة بأسعارنا | F-G14-14 |
| Calorie & Nutrition Scanner | `/nutrition` قيم غذائية بالباركود (حقل nutrition من لوحة القيادة) + مجموع السلة + تقدير من صورة | F-G14-15 |
| Voice Search (VoiceSearchDialog, SpeechRecognitionHelper) | `/voice` تسجيل صوتي ← تحويل لنص على الخادم ← بحث؛ بديل إملاء لوحة المفاتيح | F-G14-16 |
| AI Creative Studio / Lifestyle Virtual Studio / Image Editor | `/studio` وضع المنتج في مشاهد Aura الأربعة (مطبخ/مقهى/خارج/معيشة) أو صورتك، سحب/تكبير/تدوير/عبارة، حفظ PNG | F-G14-17 |
| TikTok Commerce Feed | `/reels` فيديوهات قصيرة يشتري منها العميل مباشرة، إعجاب ومشاهدات | F-G14-18 |
| Snapchat Social Stories | قصص 24 ساعة على الرئيسية | F-G14-19 |
| Viral Discovery / Trending Feed | `/trending` ترتيب من المشاهدات والمشاركات والطلبات | F-G14-20 |
| YouTube Promo Player | فيديو عرض من لوحة الإدارة على الرئيسية | F-G14-21 |
| Product Share Manager | مشاركة المنتج + تتبع المشاركات | F-G14-22 |
| Rewards & Levels / Achievements & Badges | مستويات برونزي→بلاتيني + 7 شارات محسوبة من البيانات | F-G14-23 |
| Daily Check-in Rewards | تسجيل يومي بسلسلة (5 + 2/يوم حتى 20) مرة يوميًا بتوقيت عمّان | F-G14-24 |
| Play & Win Memory Game | `/game` + 10 نقاط مرة يوميًا مع رفض النتائج غير المنطقية | F-G14-25 |
| Smart Coupon Wallet | `/coupons` كوبونات يظهرها المالك للعامة + تعبئة في السلة | F-G14-26 |
| Daily Flash Sales | عدّ تنازلي حي من `offerEndsAt` في المنتج والرئيسية | F-G14-27 |
| Interactive Tour / Robot Onboarding | جولة أول تشغيل مع الشخصية ثلاثية الأبعاد، قابلة للإعادة | F-G14-28 |
| Permissions onboarding | `/permissions` | F-G14-29 |
| Green Hub / Carbon Offset & Freshness | توصيل مجمّع (+10 نقاط بعد التسليم، تقدير CO₂) + تواريخ الصلاحية | F-G14-30 |
| Global Theme Switcher (Cyber Neon, Forest, Sakura, Royal Gold, Slate) | 6 سمات اختيارية، تصميم لُقطة يبقى الافتراضي | F-G14-31 |
| Localization (ar/en) | **جزئي**: لُقطة عربية بالكامل؛ الإنجليزية الكاملة لم تُترجم بعد (موثّق كعائق) | F-G14-32 |
| Merchant Portal | `/merchant` طلب انضمام، منتجات بمراجعة الإدارة قبل النشر، مبيعات، حملات | F-G14-33 |
| Admin / Governance / Agent Control Center | لُقطة لديها لوحة الإدارة وقناة الوكلاء وسجل العمليات؛ أُضيف تبويب «النمو والمحتوى» | F-G14-34 |
| Ad campaigns (AI scenario) | حملات/بانرات بموافقة الإدارة + نص مقترح بالذكاء الاصطناعي | F-G14-35 |
| Auto-Fill Sandbox Test Card | زر بطاقة 4242 في الوضع التجريبي فقط | F-G14-36 |
| Smart catalog fields | `nutrition` و`expiresAt` و`offerEndsAt` موثّقة على الخادم | F-G14-37 |
| Free Shipping Qualified | شريط تقدم في السلة + حزمة منطبقة | F-G14-38 |
| GPS Live Map / Delivery Hub / Support 24/7 / Reviews / Notifications / Orders / Recent purchases / AI Chatbot | موجودة سابقًا في لُقطة (tracking, driver, support, ProductReviews, notifications, orders, reorder, assistant) | — |

## مستبعد عمدًا (مع السبب)

- **Crypto Wallet (USDT)**: محفظة عملات مشفّرة تتطلب ترخيصًا ومزوّدًا منظَّمًا؛ لا تُبنى دون جهة مرخّصة. (F-G14-39)
- **Linked Bank Cards**: سياسة لُقطة لا تخزّن بيانات البطاقات؛ يتطلب بوابة دفع متوافقة مع PCI DSS تُصدر رموزًا (tokens). (F-G14-40)
- **Installed Store Signals**: قراءة التطبيقات المثبتة على جهاز العميل انتهاك للخصوصية وممنوع في Google Play.
- **مشاهدة إعلان لفتح كوبون**: يتطلب SDK إعلانات أصلي جديد؛ استُبدل بالتسجيل اليومي واللعبة.
- **Veo/Imagen لتوليد الصور والفيديو**: مكلف ويتطلب مفتاحًا ومراجعة محتوى؛ الاستوديو يعمل بالتركيب على الجهاز، ونص الحملات بالذكاء الاصطناعي متاح.
- **`aas-cc/cloudflare-recovery`**: مرشّح بنية تحتية موسوم «review-only — do not merge or deploy»؛ لم يُدمج احترامًا لتعليماته.

## الذكاء الاصطناعي

يعمل البحث بالصورة وقراءة الفواتير وتقدير السعرات والبحث الصوتي ونص الحملات عبر Gemini **من الخادم فقط** (`GEMINI_API_KEY`، اختياريًا `GEMINI_MODEL`). المفتاح لا يوضع في التطبيق ولا في APK، ويُرسل في الترويسة `x-goog-api-key`. بدون مفتاح ترجع الواجهات 503 `ai_not_configured` ويعرض التطبيق بديلًا يدويًا واضحًا.
