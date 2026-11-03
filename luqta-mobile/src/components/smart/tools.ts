// Catalogue of the G14 smart tools (features merged from the أسواق جوافة / Aura app).
import { Apple, Bell, Camera, Compass, FileText, Film, Flame, Gamepad2, Leaf, Mic, Palette, PiggyBank, Radar, ShieldCheck, ShoppingBasket, Store, Ticket, TrendingUp, Trophy, Users, Building2 } from "lucide-react-native";
import type { Tool } from "./Bits";

export const SMART_GROUPS: { title: string; tools: Tool[] }[] = [
  { title: "التوفير والأسعار", tools: [
    { key: "market-pulse", title: "نبض السوق", detail: "اتجاهات الأسعار والأقسام لآخر 30 يومًا", icon: TrendingUp, href: "/market-pulse" },
    { key: "price-radar", title: "رادار الأسعار", detail: "قارن السعر بفروعنا والمتاجر الأخرى", icon: Radar, href: "/price-radar" },
    { key: "watchlist", title: "تنبيهات الأسعار", detail: "تابع منتجًا ويصلك تنبيه عند هدفك", icon: Bell, href: "/watchlist" },
    { key: "basket-optimizer", title: "محسّن السلة", detail: "بدائل أرخص وحزم توفير وأفضل فرع", icon: ShoppingBasket, href: "/basket-optimizer" },
    { key: "coupons", title: "محفظة الكوبونات", detail: "كوبونات متاحة تطبقها بلمسة", icon: Ticket, href: "/coupons" },
    { key: "insights", title: "رؤى الإنفاق", detail: "إنفاقك الشهري ونصائح توفير", icon: PiggyBank, href: "/insights" },
  ] },
  { title: "الكاميرا والصوت", tools: [
    { key: "lens", title: "العدسة الذكية", detail: "امسح باركود أو ابحث بالصورة", icon: Camera, href: "/lens" },
    { key: "receipts", title: "قارئ الفواتير", detail: "حوّل فاتورتك لقائمة وقارن الأسعار", icon: FileText, href: "/receipts" },
    { key: "nutrition", title: "ماسح السعرات", detail: "القيم الغذائية للمنتج وسلتك", icon: Apple, href: "/nutrition" },
    { key: "voice", title: "البحث الصوتي", detail: "قل ما تريد وسنبحث عنه", icon: Mic, href: "/voice" },
  ] },
  { title: "العائلة والمكافآت", tools: [
    { key: "lists", title: "القوائم ووضع العائلة", detail: "قوائم مشتركة بميزانية ورمز دعوة", icon: Users, href: "/lists" },
    { key: "rewards", title: "المستويات والشارات", detail: "تسجيل يومي ومستوى وشارات", icon: Trophy, href: "/rewards" },
    { key: "game", title: "العب واربح", detail: "لعبة الذاكرة ونقاط يومية", icon: Gamepad2, href: "/game" },
    { key: "green", title: "التسوق الأخضر", detail: "توصيل مجمّع وأثر كربوني أقل", icon: Leaf, href: "/green" },
  ] },
  { title: "اكتشف وأبدع", tools: [
    { key: "reels", title: "فيديوهات التسوق", detail: "مقاطع قصيرة تشتري منها مباشرة", icon: Film, href: "/reels" },
    { key: "vendors", title: "المتاجر", detail: "لُقطة والتجار المعتمدون", icon: Building2, href: "/vendors" },
    { key: "trending", title: "الرائج الآن", detail: "الأكثر مشاهدة وطلبًا هذا الأسبوع", icon: Flame, href: "/trending" },
    { key: "studio", title: "الاستوديو الإبداعي", detail: "ضع المنتج في مشهد حياتي وشاركه", icon: Palette, href: "/studio" },
    { key: "merchant", title: "بوابة التاجر", detail: "بع منتجاتك عبر لُقطة", icon: Store, href: "/merchant" },
    { key: "tour", title: "جولة تعريفية", detail: "تعرّف على أدوات التطبيق", icon: Compass, href: "/?tour=1" },
    { key: "permissions", title: "الأذونات", detail: "الكاميرا والموقع والميكروفون", icon: ShieldCheck, href: "/permissions" },
  ] },
];
