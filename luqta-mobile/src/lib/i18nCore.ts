// Language support. Arabic is the source language: UI strings stay written in Arabic in
// the components, and this dictionary maps an Arabic string to its English rendering.
// Any string without an entry falls back to Arabic, so coverage can grow screen by
// screen without breaking anything. Pure module (no React) so node tests can import it.
export type Lang = "ar" | "en";
export const LANGS: { id: Lang; label: string }[] = [{ id: "ar", label: "العربية" }, { id: "en", label: "English" }];

export const EN: Record<string, string> = {
  // navigation
  "الرئيسية": "Home", "اكتشف": "Explore", "السلة": "Cart", "حسابي": "Account", "رجوع": "Back",
  // home
  "شو بدك اليوم؟": "What do you need today?", "تسوق بالمحادثة، أنا أجهّز لك الأفضل": "Shop by chatting — I'll prepare the best for you",
  "منتجات مميزة لك": "Featured for you", "ابدأ التسوق": "Start shopping", "الأقسام": "Categories", "عرض الكل": "View all",
  // explore / product
  "اكتشف عالمك": "Discover your world", "كل ما تحتاجه في مكان واحد": "Everything you need in one place", "مسح الفلاتر": "Clear filters",
  "المتوفر فقط": "In stock only", "أضف إلى السلة": "Add to cart", "اختر الخيار": "Choose an option", "غير متوفر": "Out of stock",
  "المواصفات": "Specifications", "قارن": "Compare", "عرض المقارنة": "View comparison", "عرض ثلاثي الأبعاد": "3D view", "مشاركة": "Share",
  // cart / checkout
  "سلة المشتريات": "Shopping cart", "مراجعة منتجاتك قبل إتمام الطلب": "Review your items before checkout", "سلتك فارغة.": "Your cart is empty.",
  "متابعة الشراء": "Continue to checkout", "تحديث السلة بالمتاح": "Update cart to available stock", "حسّن سلتي": "Optimize my basket",
  "مراجعة الطلب": "Review order", "تأكيد الطلب": "Place order", "تأكيد الطلب التجريبي": "Place demo order", "العودة إلى المتجر": "Back to store",
  "المجموع الفرعي": "Subtotal", "الخصم": "Discount", "التوصيل": "Delivery", "الإجمالي": "Total", "مجاني": "Free",
  // delivery / payment
  "وين نوصلك؟": "Where should we deliver?", "عنوان التوصيل": "Delivery address", "وقت التوصيل": "Delivery time", "حفظ العنوان والموعد": "Save address and time",
  "المدينة": "City", "الحي": "District", "الشارع": "Street", "رقم المبنى": "Building no.", "تفاصيل إضافية": "More details", "المستلم": "Recipient",
  "اسم المستلم": "Recipient name", "الهاتف": "Phone", "رقم الهاتف": "Phone number", "استخدم موقعي": "Use my location",
  "طريقة الدفع": "Payment method", "الدفع عند الاستلام": "Cash on delivery", "رصيد المتجر": "Store balance", "بطاقة ائتمان / خصم": "Credit / debit card",
  "متابعة": "Continue", "متابعة الدفع التجريبي": "Continue demo payment", "الدفع الآمن": "Secure payment",
  // orders
  "طلباتي": "My orders", "تتبع الطلب": "Track order", "إعادة الشراء": "Buy again", "طلب إرجاع": "Return request", "عرض الفاتورة": "View invoice",
  "إرسال طلب الإرجاع": "Send return request", "طلباتي والدعم": "Orders and support", "إعادة المحاولة": "Try again",
  // account
  "تسجيل الدخول": "Sign in", "إنشاء حساب": "Create account", "تسجيل الخروج": "Sign out", "اللغة والمظهر": "Language and appearance",
  "الإشعارات": "Notifications", "الخصوصية والأجهزة": "Privacy and devices", "بياناتي وعناويني": "My details and addresses", "تصدير بياناتي": "Export my data",
  "اتصال الخادم": "Server connection", "لوحة الإدارة والقيادة": "Admin and command center", "لوحة السائق": "Driver dashboard", "شخصيتي وحركتها": "My character and motion",
  "مظهر التطبيق": "App appearance", "اختر المظهر الأنسب لك. يُحفظ اختيارك على هذا الجهاز.": "Choose the look you like. Saved on this device.",
  "الوضع النهاري": "Light mode", "الوضع الليلي": "Dark mode", "حسب إعداد الجهاز": "Follow device setting", "اللغة": "Language",
  "ألوان فاتحة طوال الوقت": "Always light colors", "ألوان داكنة طوال الوقت": "Always dark colors", "يتغير تلقائيًا مع مظهر جهازك": "Changes with your device theme",
  // smart tools
  "أدوات لُقطة الذكية": "Luqta smart tools", "كل أدوات التوفير والاكتشاف في مكان واحد": "All saving and discovery tools in one place",
  "التوفير والأسعار": "Savings and prices", "نبض السوق": "Market pulse", "رادار الأسعار": "Price radar", "تنبيهات الأسعار": "Price alerts",
  "محسّن السلة": "Basket optimizer", "محفظة الكوبونات": "Coupon wallet", "رؤى الإنفاق": "Spending insights", "الكاميرا والصوت": "Camera and voice",
  "العدسة الذكية": "Smart lens", "قارئ الفواتير": "Receipt reader", "ماسح السعرات": "Calorie scanner", "البحث الصوتي": "Voice search",
  "العائلة والمكافآت": "Family and rewards", "القوائم ووضع العائلة": "Lists and family mode", "المستويات والشارات": "Levels and badges",
  "العب واربح": "Play and win", "التسوق الأخضر": "Green shopping", "اكتشف وأبدع": "Discover and create", "فيديوهات التسوق": "Shopping videos",
  "المتاجر": "Stores", "الرائج الآن": "Trending now", "الاستوديو الإبداعي": "Creative studio", "بوابة التاجر": "Merchant portal",
  "جولة تعريفية": "Guided tour", "الأذونات": "Permissions",
  "طابق الأزواج الستة بأقل عدد محاولات": "Match the six pairs in as few moves as possible", "جديدة": "New game",
  "الأوفر": "Cheapest", "فرع واحد": "One branch", "الأسرع": "Fastest", "استبدال": "Swap",
  // character
  "تخصيص شخصيتي": "Customize my character", "صمّم مظهرك وتحكّم في حركاتك وصوتك": "Design your look, control motion and voice",
  // common
  "حفظ": "Save", "إلغاء": "Cancel", "حذف": "Delete", "تم": "Done", "إغلاق": "Close", "بحث": "Search", "التالي": "Next", "تخطي": "Skip",
};

export function translate(lang: Lang, text: string): string {
  if (lang === "ar" || !text) return text;
  return EN[text] ?? EN[text.trim()] ?? text;
}
export const isLang = (v: unknown): v is Lang => v === "ar" || v === "en";
