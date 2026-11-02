import json
S="src/"; A="src/app/"; C="src/components/"; L="src/lib/"; SV="server/"
def f(title, src, tokens, test=None, status=None, note=None, evidence=None, screen=None):
    d={"title":title,"source":{"file":src,"contains":tokens}}
    if test: d["test"]={"file":test[0],"name":test[1]}
    if evidence: d["evidence"]=evidence
    if screen: d["design"]=screen
    d["status"]=status or ("verified-auto" if test else "verified-source")
    if note: d["note"]=note
    return d
groups=[
("G01","نظام التصميم والتنقل",[
 f("ألوان وتوكنات مأخوذة من التصاميم (بنفسجي/مرجاني)",L+"theme.tsx",["#FE585C","#F6F2FE","#1F0A47"]),
 f("رأس العلامة: شعار لُقطة وAmer AI Store",C+"design/kit.tsx",["Amer AI Store","logoMark","brand-logo"]),
 f("زر «شخصيتي» في الرأس يفتح التخصيص",C+"design/kit.tsx",["شخصيتي","/character"]),
 f("شريط سفلي بأربعة تبويبات مع حالة نشطة",C+"Shell.tsx",["الرئيسية","اكتشف","السلة","حسابي","tabActive"]),
 f("شارة عدد المنتجات على تبويب السلة",C+"Shell.tsx",["cartCount","badge"]),
 f("خلفية متدرجة كما في التصاميم",C+"Shell.tsx",["LinearGradient","backgroundDeep"]),
 f("زر الإجراء الرئيسي (CTA) بحالات التعطيل والانشغال",C+"design/kit.tsx",["export function CTA","busy","ActivityIndicator"]),
 f("حالة تحميل موحدة",C+"design/kit.tsx",["export function LoadingBlock","accessibilityLiveRegion"]),
 f("حالة خطأ موحدة مع إعادة المحاولة",C+"design/kit.tsx",["export function ErrorBlock","إعادة المحاولة"]),
 f("تنبيه انقطاع الخادم مع إعادة المحاولة",C+"Shell.tsx",["showOffline","refreshCatalog"]),
]),
("G02","الشاشة الرئيسية",[
 f("العنوان «شو بدك اليوم؟» والوصف",A+"index.tsx",["شو بدك اليوم؟","تسوق بالمحادثة"],screen="home"),
 f("بحث نصي يرسل السؤال للمساعد",A+"index.tsx",["home-search","/assistant"]),
 f("زر البحث بصورة المنتج",A+"index.tsx",["home-camera","mode: \"photo\""]),
 f("زر الصوت يوجّه للإملاء الصوتي من لوحة المفاتيح",A+"index.tsx",["home-mic","ميكروفون لوحة المفاتيح"],note="الإدخال الصوتي يعتمد على إملاء لوحة المفاتيح؛ لا توجد وحدة تعرّف كلام مدمجة"),
 f("أربع بطاقات أقسام بأيقونات التصميم",A+"index.tsx",["catFood","catElectronics","catFashion","catHome"]),
 f("منتجات مميزة مع «عرض الكل»",A+"index.tsx",["منتجات مميزة لك","عرض الكل"]),
 f("«أضف إلى السلة» مع منع غير المتوفر",C+"ProductCard.tsx",["أضف إلى السلة","غير متوفر","disabled={out}"]),
 f("فقاعة الشخصية وزر «ابدأ التسوق»",A+"index.tsx",["مستعد أساعدك","ابدأ التسوق","<Companion"]),
]),
("G03","الاستكشاف والفروع",[
 f("اختيار الفرع وحفظه على الجهاز",A+"explore.tsx",["BranchPill","setBranch","اختر الفرع"]),
 f("البحث عن منتجات أو علامات تجارية",A+"explore.tsx",["explore-search","searchCatalog"]),
 f("فلترة حسب السعر",A+"explore.tsx",["budgets","setMaxPrice"]),
 f("فلترة المتوفر في الفرع المختار",A+"explore.tsx",["stockOnly","المتوفر فقط"]),
 f("الترتيب بأربعة خيارات",A+"explore.tsx",["sorts","السعر: من الأقل","الأعلى تقييمًا"]),
 f("ستة أقسام بصور التصميم مع تمييز النشط",A+"explore.tsx",["tileImages","tileActive","exSports"]),
 f("قائمة القسم مع عرض الكل/أقل",A+"explore.tsx",["showAll","عرض أقل"]),
 f("بطاقة منتج مصغرة مع زر +",C+"ProductCard.tsx",["export function MiniProductCard","mini-add-"]),
 f("المخزون حسب الفرع في القوائم",A+"explore.tsx",["branchAware","branchStock"]),
 f("حالة لا توجد نتائج",A+"explore.tsx",["لا توجد منتجات مطابقة"]),
 f("الشخصية تدفع عربة التسوق بجانب العنوان",A+"explore.tsx",["action=\"cart\""]),
]),
("G04","صفحة المنتج والعرض ثلاثي الأبعاد",[
 f("معرض صور مع مصغرات قابلة للاختيار",A+"product/[id].tsx",["thumbActive","setImageIndex"],screen="product"),
 f("مصغّر الفيديو/360 يفتح العرض ثلاثي الأبعاد",A+"product/[id].tsx",["فيديو وعرض 360°","/view3d/"]),
 f("مشاركة المنتج",A+"product/[id].tsx",["Share.share","مشاركة"]),
 f("المفضلة من صفحة المنتج",A+"product/[id].tsx",["toggleFavorite","حفظ في المفضلة"]),
 f("شارة التوفر (تجريبي/متوفر/متبقي/غير متوفر)",A+"product/[id].tsx",["توفر تجريبي","متبقي"]),
 f("اختيار اللون",A+"product/[id].tsx",["swatches","اللون"]),
 f("الكمية بحدود المخزون والفرع",A+"product/[id].tsx",["QtyStepper","remaining"]),
 f("المواصفات (3 أعمدة وتفاصيل)",A+"product/[id].tsx",["specIcons","المواصفات"]),
 f("قارن",A+"product/[id].tsx",["toggleCompare","قارن"]),
 f("عارض ثلاثي الأبعاد: تدوير/تقريب/تبعيد/إعادة","web-engines/viewer.js",["zoomIn","zoomOut","reset","rotate"],evidence="evidence/avatar/viewer-chair-3d.png"),
 f("«في غرفتي»: المقاس الحقيقي داخل غرفة بجانب شخص 175 سم","web-engines/viewer.js",["trueScale","room.visible"],evidence="evidence/avatar/viewer-chair-room.png",note="ليس واقعًا معززًا بالكاميرا (AR)"),
]),
("G05","السلة",[
 f("صفوف بصورة واسم ووحدة وسعر",A+"cart.tsx",["cart-row-","unit"],screen="cart"),
 f("تعديل الكمية بحدود المخزون",A+"cart.tsx",["QtyStepper","max={max}"]),
 f("حذف صنف من السلة",A+"cart.tsx",["cart-remove-","Trash2"]),
 f("إزالة أصناف لم تعد متاحة",A+"cart.tsx",["missing","إزالة الأصناف غير المتاحة"]),
 f("رمز الخصم (من الخادم، أو رمز تجريبي واضح)",A+"cart.tsx",["/coupons/validate","DEMO_COUPON"]),
 f("ربط الخصم بمحتوى السلة",L+"checkout.ts",["cartSignatureOf"],test=(L+"checkout.test.mjs","F-G05-06")),
 f("المجموع الفرعي مع «بيانات تجريبي» و«يُعاد التحقق عند التأكيد»",A+"cart.tsx",["بيانات تجريبي","يُعاد التحقق عند التأكيد"]),
 f("متابعة الشراء إلى العنوان والموعد",A+"cart.tsx",["/delivery","متابعة الشراء"]),
 f("مواصلة التسوق وحالة السلة الفارغة",A+"cart.tsx",["مواصلة التسوق","سلتك فارغة"]),
]),
("G06","التسوق بالمحادثة",[
 f("فقاعات محادثة للمستخدم والمساعد",A+"assistant.tsx",["userBubble","botBubble"],screen="chat"),
 f("اقتراحات جاهزة للبدء",A+"assistant.tsx",["جهّز لي سلة بـ 20 دينار","prompt-"]),
 f("فهم طلب «سلة بميزانية» بالأرقام العربية واللاتينية",L+"basket.ts",["parseBasketRequest"],test=(L+"basket.test.mjs","F-G06-03")),
 f("بناء سلة ضمن الميزانية تحترم المخزون",L+"basket.ts",["buildBasket"],test=(L+"basket.test.mjs","F-G06-04")),
 f("بطاقة «مقترحات السلة» مع أزرار أضف",A+"assistant.tsx",["مقترحات السلة","suggest-add-"]),
 f("المجموع التقديري و«راجع السلة المقترحة»",A+"assistant.tsx",["المجموع التقديري","review-basket"]),
 f("مساعد الخادم الاختياري أو التوصيات المحلية",A+"assistant.tsx",["checkAssistant","recommendProducts"]),
 f("إرسال صورة منتج",A+"assistant.tsx",["pickPhoto","خدمة الرؤية"],status="partial",note="الصورة تُختار؛ التعرف عليها يحتاج خدمة رؤية على الخادم غير مفعّلة"),
 f("إيقاف/تشغيل الصوت",A+"assistant.tsx",["إيقاف الصوت","sound"]),
]),
("G07","العنوان والدفع ومراجعة الطلب",[
 f("«استخدم موقعي» عبر GPS بإذن المستخدم",A+"delivery.tsx",["requestForegroundPermissionsAsync","use-location"],status="needs-device",screen="address"),
 f("خريطة توضيحية و«حدد على الخريطة»",A+"delivery.tsx",["MapArt","pick-on-map"]),
 f("تفاصيل العنوان: مدينة/حي/شارع/مبنى/مستلم/هاتف",A+"delivery.tsx",["المدينة","الحي","رقم المبنى","addr-phone"]),
 f("حفظ العنوان على الخادم للمستخدم المسجّل",A+"delivery.tsx",["api.post<{ address: Address }>(\"/addresses\""]),
 f("فترات التوصيل: صباحًا/بعد الظهر/مساءً",L+"commerce-types.ts",["deliverySlots","بعد الظهر"]),
 f("ثلاث طرق دفع: بطاقة/عند الاستلام/رصيد المتجر",A+"payment.tsx",["بطاقة بنكية","الدفع عند الاستلام","رصيد المتجر"],screen="payment"),
 f("نموذج بطاقة تجريبي مع تحقق Luhn والتاريخ",L+"checkout.ts",["luhnValid","expiryValid"],test=(L+"checkout.test.mjs","F-G07-07")),
 f("البطاقة غير مقبولة في الطلبات الحقيقية ولا تُحفظ أو تُرسل",A+"payment.tsx",["cardAllowed = demo","لا تُحفظ بيانات البطاقة"],status="blocked-external",note="يلزم ربط بوابة دفع مرخّصة"),
 f("ملخص المجموع والخصم والتوصيل",L+"checkout.ts",["computeTotals"],test=(L+"checkout.test.mjs","F-G07-09")),
 f("مراجعة الطلب: العنوان والوقت والدفع مع تعديل",A+"checkout.tsx",["عنوان التوصيل","وقت التوصيل","طريقة الدفع","تعديل"],screen="review"),
 f("لا تأكيد دون الشروط والعنوان والتحقق",L+"checkout.ts",["canConfirmOrder"],test=(L+"checkout.test.mjs","F-G07-11")),
 f("تحقق الخادم من السعر والمخزون قبل التأكيد",A+"checkout.tsx",["checkCart","expectedSubtotal"],test=(SV+"dashboardSync.test.mjs","F-G13-04/05")),
]),
("G08","الطلبات والتتبع والمرتجعات",[
 f("طلب تجريبي «محاكاة» محلي دون شحن أو تحصيل",L+"store.tsx",["createDemoOrder","LQ-DEMO-","simulated"]),
 f("بطاقة رقم الطلب وتاريخه",A+"tracking/[id].tsx",["رقم الطلب","تاريخ الطلب"],screen="tracking"),
 f("مراحل الطلب: استلام/تجهيز/بالطريق/تسليم",A+"tracking/[id].tsx",["استلام","تجهيز","بالطريق","تسليم"]),
 f("خريطة المسار من المتجر إلى العنوان",C+"design/MapArt.tsx",["route","truck"]),
 f("آخر تحديث للطلب",A+"tracking/[id].tsx",["آخر تحديث"]),
 f("إلغاء الطلب حين يسمح الخادم",A+"tracking/[id].tsx",["/cancel","إلغاء الطلب"]),
 f("طلباتي: الحالية/السابقة/المرتجعات",A+"orders.tsx",["الحالية","السابقة","المرتجعات"],screen="orders"),
 f("إعادة الشراء بالأسعار الحالية",L+"reorder.ts",["reorderCart"],test=(L+"reorder.test.mjs","reorder")),
 f("طلب إرجاع بالمنتجات والسبب وصورة",A+"orders.tsx",["ReturnForm","pickImageDataUrl"],test=(SV+"photos.test.mjs","return and support photos")),
 f("الخريطة الحية لموقع السائق",A+"live/[id].tsx",["DeliveryMap","fetchDrivingRoute"],status="needs-device"),
]),
("G09","الدعم والإشعارات",[
 f("تبويبا الدعم والإشعارات",A+"support.tsx",["الدعم","الإشعارات","Segmented"],screen="support"),
 f("محادثة الدعم عبر تذاكر الخادم",A+"support.tsx",["/tickets","المحادثة الحالية"]),
 f("إرفاق صورة برسالة الدعم",SV+"commerce.mjs",["ticket_photos","ticketPhoto"],test=(SV+"photos.test.mjs","return and support photos")),
 f("«طلب موظف»",A+"support.tsx",["ask-agent","موظف"]),
 f("أحدث الإشعارات وتعليمها كمقروءة",A+"support.tsx",["/notifications/","read: true"]),
 f("تعيين الكل كمقروء",A+"support.tsx",["read-all"]),
 f("إعدادات الإشعارات",A+"notification-settings.tsx",["إعدادات الإشعارات","AsyncStorage"]),
 f("إشعارات الهاتف (Push)",A+"notification-settings.tsx",["Push"],status="blocked-external",note="يلزم مزود إشعارات (FCM) غير مربوط"),
]),
("G10","الحساب والخصوصية",[
 f("بطاقة الملف و«تعديل الملف»",A+"profile.tsx",["عضو في Amer AI Store","تعديل الملف"],screen="account"),
 f("النقاط و«استبدال»",A+"profile.tsx",["/rewards","استبدال"]),
 f("قائمة الحساب الستة كما في التصميم",A+"profile.tsx",["بياناتي وعناويني","شخصيتي وحركتها","اللغة والمظهر","الخصوصية والأجهزة","تصدير بياناتي"]),
 f("تسجيل الخروج",A+"profile.tsx",["session.logout","تسجيل الخروج"]),
 f("حذف الحساب",A+"profile.tsx",["/delete-account","حذف الحساب"]),
 f("حذف الصور والبيانات مع الحساب",SV+"commerce.mjs",["DELETE FROM return_photos","DELETE FROM ticket_photos"],test=(SV+"photos.test.mjs","removed with the account")),
 f("الخصوصية والأجهزة",A+"privacy.tsx",["حذف الصورة","مسح البيانات المحلية"]),
 f("تصدير بياناتي",A+"export.tsx",["Share.share","تصدير ومشاركة"]),
 f("اتصال الخادم وأدوات المدير والسائق",A+"profile.tsx",["/connection","/admin","/driver"]),
]),
("G11","إنشاء الشخصية من صورة المستخدم",[
 f("خطوات: صورة/معاينة/تخصيص",A+"character-create.tsx",["صورة","معاينة","تخصيص"],screen="create"),
 f("التقاط صورة بالكاميرا الأمامية",C+"character/captureHtml.ts",["capture=\"user\"","toDataURL"],status="needs-device"),
 f("رفع صورة من الجهاز",A+"character-create.tsx",["upload-photo","getDocumentAsync"]),
 f("موافقة صريحة قبل استخدام الصورة",A+"character-create.tsx",["photo-consent","أوافق على استخدام صورتي"]),
 f("معالجة الوجه على الجهاز فقط (قص 256 بكسل)","web-engines/avatar.js",["processFace","faceProcessed"],evidence="evidence/avatar/pose-photo-face.png"),
 f("أخذ لون البشرة والشعر من الصورة","web-engines/avatar.js",["skin = sample","hairC"]),
 f("تعقيم الملف المحفوظ",L+"characterProfile.ts",["sanitizeCharacter"],test=(L+"characterProfile.test.mjs","F-G11-07")),
 f("حذف الصورة والشخصية في أي وقت",L+"character.tsx",["removePhoto","reset"]),
 f("«تخطي الآن» ومثال الشخصية",A+"character-create.tsx",["create-skip","هكذا ستبدو"]),
]),
("G12","الشخصية ثلاثية الأبعاد: الهيكل والحركة والأمان",[
 f("هيكل عظمي: 17 عظمة THREE.Bone ومفصلا الإبهام (19 مفصلًا متحركًا)","web-engines/avatar.js",["new T.Bone()","new T.Skeleton("],evidence="evidence/avatar/avatar-evidence.json"),
 f("المشي بحركة مفاصل فعلية (ورك/ركبة/كاحل/كتف)","web-engines/avatar.js",["function gait","thighL","kneeL"],evidence="evidence/avatar/walk.mp4"),
 f("القفز (تحفّز/انطلاق/طيران/هبوط)","web-engines/avatar.js",["jump:","crouch("],evidence="evidence/avatar/pose-jump.png"),
 f("التنقل: الدخول إلى الخانة مشيًا مع الالتفات",C+"character/Companion.tsx",["Animated.timing","facing"]),
 f("النوم","web-engines/avatar.js",["sleep:","pillow"],evidence="evidence/avatar/pose-sleep.png"),
 f("الاستيقاظ والتمطّي","web-engines/avatar.js",["wake:"],evidence="evidence/avatar/pose-wake.png"),
 f("التسوق بعربة","web-engines/avatar.js",["cart:","buildCart"],evidence="evidence/avatar/pose-cart.png"),
 f("حركات إضافية وتقليل الحركة واحترام إعداد النظام","web-engines/avatar.js",["thumbs:","think:","reduceMotion"]),
 f("حجم يقارب الربع افتراضيًا وقابل للتعديل 25–100%",L+"characterProfile.ts",["scale: 0.25","clampScale"],test=(L+"characterProfile.test.mjs","F-G12-07")),
 f("لا تحجب الأزرار: خانة مستقلة وتمرير اللمس",C+"character/Companion.tsx",["pointerEvents=\"none\"","importantForAccessibility"]),
 f("لا شراء دون تأكيد: الشخصية للعرض فقط",C+"character/Companion.tsx",["display-only","no access to the cart"]),
]),
("G13","مزامنة لوحة القيادة والتشغيل",[
 f("استيراد المنتجات والصور والأسعار والكميات والفروع",SV+"commerce.mjs",["dashboardSync","section === 'dashboard-sync'"],test=(SV+"dashboardSync.test.mjs","F-G13-01/02/03")),
 f("منع التكرار بالمعرّف أو SKU أو الباركود",SV+"commerce.mjs",["duplicatesMerged","findExisting"],test=(SV+"dashboardSync.test.mjs","F-G13-01/02/03")),
 f("معاينة دون كتابة ورفض الصفوف غير الصالحة",SV+"commerce.mjs",["dryRun","rejected.push"],test=(SV+"dashboardSync.test.mjs","F-G13-01/02/03")),
 f("فحص السلة حسب الفرع قبل التأكيد",SV+"commerce.mjs",["checkCart","/api/orders/check"],test=(SV+"dashboardSync.test.mjs","F-G13-04/05")),
 f("حارس تغيّر السعر عند إنشاء الطلب",SV+"commerce.mjs",["expectedSubtotal","price_changed"],test=(SV+"dashboardSync.test.mjs","F-G13-04/05")),
 f("إدارة الفروع",SV+"commerce.mjs",["validateBranches","section === 'branches'"],test=(SV+"dashboardSync.test.mjs","F-G13-06")),
 f("التراجع عن آخر مزامنة عبر سجل الاستيراد",SV+"commerce.mjs",["'dashboard-sync'","inventory_imports"],test=(SV+"dashboardSync.test.mjs","reversible through the inventory undo log")),
 f("فصل البيانات التجريبية عن الإنتاج",S+"data/products.ts",["SAMPLE catalogue","demo: true"]),
]),
]
out={"version":"2.0.0","groups":[]}
total=0
for gid,name,items in groups:
    g={"id":gid,"name":name,"features":[]}
    for i,it in enumerate(items,1):
        it={"id":f"F-{gid}-{i:02d}",**it}; g["features"].append(it); total+=1
    out["groups"].append(g)
out["total"]=total
json.dump(out,open(__import__('os').path.join(__import__('os').path.dirname(__file__),'..','ledger','features.json'),'w'),ensure_ascii=False,indent=1)
print(total,len(groups))
