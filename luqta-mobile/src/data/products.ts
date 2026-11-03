// SAMPLE catalogue shown only while no commerce server is connected ("وضع تجريبي").
// Prices are demonstration values in JOD, never real selling prices. When the app is
// connected, every product, image, price, quantity and branch comes from the server
// (fed by the control dashboard through POST /api/admin/dashboard-sync).
export type ProductCategory = string;

export type ProductSpec = { label: string; value: string; icon: "headphones" | "bluetooth" | "battery" | "ruler" | "weight" | "box" | "leaf" | "clock" };
export type Swatch = { name: string; hex: string };

export type Product = {
  id: string;
  name: string;
  subtitle: string;
  brand: string;
  category: ProductCategory;
  price: number;
  oldPrice?: number;
  rating: number;
  reviews: number;
  /** "local:<key>" for bundled demo images, or an https URL from the server */
  image: any;
  images?: string[];
  tags: string[];
  description: string;
  features: string[];
  colors: string[];
  swatches?: Swatch[];
  specs?: ProductSpec[];
  unit?: string;
  model3d?: "chair" | "headphones" | "box";
  dimensions?: { w: number; d: number; h: number };
  badge?: string;
  sku?: string;
  barcode?: string;
  stock?: number;
  branchStock?: Record<string, number>;
  active?: boolean;
  variantOf?: string;
  variantLabel?: string;
  hasVariants?: boolean;
  /** G14: nutrition facts (dashboard import), flash-sale end, freshness date, marketplace merchant */
  nutrition?: { calories?: number; protein?: number; carbs?: number; fat?: number; sugar?: number; fiber?: number; sodium?: number; per?: string };
  offerEndsAt?: string;
  expiresAt?: string;
  /** G18: measured pack (kg/g/l/ml/piece) and server-computed price per base unit */
  measureUnit?: "kg" | "g" | "l" | "ml" | "piece";
  measureSize?: number;
  unitPrice?: { value: number; per: "kg" | "l" | "piece" } | null;
  merchantId?: string;
  basePrice?: number;
  baseStock?: number;
  demo?: boolean;
};

export const categories: { id: ProductCategory; label: string; short: string; icon: string }[] = [
  { id: "grocery", label: "بقالة ومأكولات", short: "غذاء", icon: "food" },
  { id: "electronics", label: "إلكترونيات", short: "إلكترونيات", icon: "electronics" },
  { id: "fashion", label: "أزياء وموضة", short: "أزياء", icon: "fashion" },
  { id: "home", label: "المنزل والمطبخ", short: "منزل", icon: "home" },
  { id: "beauty", label: "العناية والجمال", short: "العناية", icon: "beauty" },
  { id: "sports", label: "الرياضة واللياقة", short: "رياضة", icon: "sports" },
];
/** legacy category ids from 1.x servers */
export const categoryAliases: Record<string, string> = { care: "beauty", food: "grocery" };
export const categoryLabel = (id: string) => categories.find((c) => c.id === (categoryAliases[id] || id))?.label || id;

const p = (x: Omit<Product, "rating" | "reviews" | "tags" | "features" | "colors" | "brand" | "description"> & Partial<Product>): Product => ({
  rating: 0, reviews: 0, tags: [], features: [], colors: [], brand: "لُقطة", description: "", demo: true, active: true, ...x,
});

export const products: Product[] = [
  p({ id: "rice", name: "أرز بسمتي", subtitle: "1 كجم", unit: "1 كجم", category: "grocery", price: 3.25, stock: 40, image: "local:rice", badge: "أساسيات",
    tags: ["أرز", "رز", "بسمتي", "طبخ", "أساسيات", "سلة", "rice"], description: "أرز بسمتي طويل الحبة، مناسب للأطباق اليومية والمناسبات.", features: ["حبة طويلة", "عبوة 1 كجم"],
    specs: [{ label: "الوزن", value: "1 كجم", icon: "weight" }, { label: "النوع", value: "بسمتي", icon: "leaf" }, { label: "التخزين", value: "مكان جاف", icon: "box" }] }),
  p({ id: "milk", name: "حليب طويل الأمد", subtitle: "1 لتر", unit: "1 لتر", category: "grocery", price: 2.2, stock: 60, image: "local:milk",
    tags: ["حليب", "ألبان", "فطور", "أساسيات", "سلة", "milk"], description: "حليب كامل الدسم طويل الأمد، عبوة 1 لتر.", features: ["كامل الدسم", "1 لتر"],
    specs: [{ label: "الحجم", value: "1 لتر", icon: "box" }, { label: "الصلاحية", value: "طويل الأمد", icon: "clock" }, { label: "النوع", value: "كامل الدسم", icon: "leaf" }] }),
  p({ id: "banana", name: "موز", subtitle: "1 كجم", unit: "1 كجم", category: "grocery", price: 1.75, stock: 25, image: "local:banana",
    tags: ["موز", "فواكه", "فاكهة", "صحي", "سلة", "banana"], description: "موز طازج بالكيلو.", features: ["طازج", "بالكيلو"],
    specs: [{ label: "الوزن", value: "1 كجم", icon: "weight" }, { label: "المصدر", value: "طازج", icon: "leaf" }, { label: "التخزين", value: "حرارة الغرفة", icon: "box" }] }),
  p({ id: "headphones", name: "سماعات لاسلكية", subtitle: "بلوتوث", unit: "بلوتوث", category: "electronics", price: 12.5, stock: 8, image: "local:headphones", model3d: "headphones",
    images: ["local:headphones", "local:headphones-2", "local:headphones-3", "local:headphones-4"], badge: "الأكثر طلبًا",
    tags: ["سماعات", "سماعة", "لاسلكية", "بلوتوث", "موسيقى", "headphones", "audio"], description: "صوت نقي وتجربة استماع مريحة طوال اليوم.",
    features: ["بلوتوث 5.3", "بطارية حتى 20 ساعة", "وسائد مريحة"], colors: ["أسود", "أبيض", "أزرق", "وردي"],
    swatches: [{ name: "أسود", hex: "#1D1D1F" }, { name: "أبيض", hex: "#E8E4DC" }, { name: "أزرق", hex: "#4D7CC4" }, { name: "وردي", hex: "#F2A9C1" }],
    specs: [{ label: "نوع السماعة", value: "سماعة رأس لاسلكية", icon: "headphones" }, { label: "الاتصال", value: "بلوتوث 5.3", icon: "bluetooth" }, { label: "عمر البطارية", value: "حتى ٢٠ ساعة", icon: "battery" }] }),
  p({ id: "armchair", name: "كرسي مريح", subtitle: "قماش بيج", unit: "78×80×82 سم", category: "home", price: 89, stock: 3, image: "local:armchair", model3d: "chair", dimensions: { w: 0.78, d: 0.8, h: 0.82 },
    tags: ["كرسي", "أثاث", "صالة", "منزل", "chair"], description: "كرسي بذراعين بقماش ناعم وأرجل خشبية.", features: ["قماش ناعم", "أرجل خشب"],
    swatches: [{ name: "بيج", hex: "#D8BF98" }, { name: "رمادي", hex: "#A9A6A3" }, { name: "أخضر", hex: "#8FA58A" }],
    specs: [{ label: "المقاسات", value: "78×80×82 سم", icon: "ruler" }, { label: "الخامة", value: "قماش وخشب", icon: "box" }, { label: "الوزن", value: "14 كجم", icon: "weight" }] }),
  p({ id: "speaker", name: "مكبر صوت ميني", subtitle: "محمول", category: "electronics", price: 18, stock: 12, image: "local:speaker", model3d: "box", tags: ["مكبر صوت", "سماعة", "موسيقى", "speaker"], description: "مكبر صوت محمول بصوت غني." }),
  p({ id: "watch", name: "ساعة ذكية", subtitle: "مقاومة للماء", category: "electronics", price: 35, stock: 6, image: "local:watch", tags: ["ساعة", "ذكية", "رياضة", "watch"], description: "ساعة ذكية لمتابعة نشاطك اليومي." }),
  p({ id: "keyboard", name: "لوحة مفاتيح لاسلكية", subtitle: "تصميم مضغوط", category: "electronics", price: 22, stock: 9, image: "local:keyboard", tags: ["لوحة مفاتيح", "كيبورد", "مكتب", "keyboard"], description: "لوحة مفاتيح لاسلكية هادئة." }),
  p({ id: "bag", name: "حقيبة يد", subtitle: "جلد صناعي", category: "fashion", price: 27, stock: 7, image: "local:bag", tags: ["حقيبة", "شنطة", "أزياء", "bag"], description: "حقيبة يومية أنيقة." }),
  p({ id: "sneakers", name: "حذاء رياضي", subtitle: "مريح للمشي", category: "sports", price: 39, stock: 10, image: "local:sneakers", tags: ["حذاء", "رياضة", "مشي", "sneakers"], description: "حذاء خفيف للمشي والتمرين." }),
  p({ id: "lamp", name: "مصباح طاولة", subtitle: "ضوء دافئ", category: "home", price: 16, stock: 11, image: "local:lamp", model3d: "box", tags: ["مصباح", "إضاءة", "منزل", "lamp"], description: "مصباح بضوء دافئ للقراءة." }),
  p({ id: "mug", name: "كوب سيراميك", subtitle: "350 مل", category: "home", price: 4.5, stock: 30, image: "local:mug", tags: ["كوب", "مطبخ", "قهوة", "mug"], description: "كوب سيراميك للقهوة والشاي." }),
  p({ id: "diffuser", name: "معطر جو", subtitle: "زيوت عطرية", category: "home", price: 12, stock: 14, image: "local:diffuser", tags: ["معطر", "منزل", "عطر", "diffuser"], description: "معطر جو بزيوت طبيعية." }),
  p({ id: "serum", name: "سيروم للبشرة", subtitle: "30 مل", category: "beauty", price: 14, stock: 15, image: "local:serum", tags: ["سيروم", "بشرة", "عناية", "serum"], description: "سيروم مرطب للاستخدام اليومي." }),
  p({ id: "fragrance", name: "عطر", subtitle: "50 مل", category: "beauty", price: 29, stock: 5, image: "local:fragrance", tags: ["عطر", "عناية", "هدية", "fragrance"], description: "عطر بنفحات منعشة." }),
];

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const toArabicDigits = (s: string) => s.replace(/\d/g, (d) => AR_DIGITS[Number(d)]);

/** JOD shows 3 decimals ("٣٫٢٥٠ د.أ") as in the designs; other currencies fall back to Intl. */
export function formatPrice(price: number, currency = "JOD"): string {
  const value = Number.isFinite(price) ? price : 0;
  if (currency === "JOD") {
    const [whole, frac] = Math.abs(value).toFixed(3).split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
    return `${value < 0 ? "-" : ""}${toArabicDigits(grouped)}٫${toArabicDigits(frac)} د.أ`;
  }
  try {
    return new Intl.NumberFormat("ar", { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}
