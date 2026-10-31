export type ProductCategory = string;

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
  image: any;
  tags: string[];
  description: string;
  features: string[];
  colors: string[];
  badge?: string;
  sku?: string;
  stock?: number;
  active?: boolean;
  variantOf?: string;
  variantLabel?: string;
  hasVariants?: boolean;
  basePrice?: number;
  baseStock?: number;
};

export const categories: {
  id: ProductCategory;
  label: string;
  icon: string;
}[] = [
  { id: "electronics", label: "إلكترونيات", icon: "headphones" },
  { id: "home", label: "المنزل", icon: "home" },
  { id: "fashion", label: "الأزياء", icon: "shopping-bag" },
  { id: "care", label: "العناية", icon: "droplet" },
];

export const products: Product[] = [
  {
    id: "headphones",
    name: "سماعات هدوء لاسلكية",
    subtitle: "صوت أقرب. عالم أهدأ.",
    brand: "SONORA",
    category: "electronics",
    price: 249,
    oldPrice: 349,
    rating: 4.8,
    reviews: 128,
    image:
      "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=900&auto=format&fit=crop&q=85",
    tags: [
      "سماعات",
      "سماعة",
      "لاسلكية",
      "عزل الضوضاء",
      "موسيقى",
      "عمل",
      "مكتب",
      "هدية",
      "headphones",
      "audio",
    ],
    description:
      "سماعات مريحة للأيام الطويلة، مع عزل للضوضاء وصوت واضح للموسيقى والمكالمات. تصميم خفيف يرافقك في المكتب وأثناء التنقل.",
    features: [
      "عزل نشط للضوضاء",
      "بطارية حتى ٣٠ ساعة",
      "اتصال Bluetooth",
      "وسائد مريحة وقابلة للتعديل",
    ],
    colors: ["#2A2A2A", "#E1DACE", "#66756E"],
    badge: "الأكثر طلبًا",
  },
  {
    id: "speaker",
    name: "مكبر صوت ميني",
    subtitle: "موسيقاك، أينما كنت",
    brand: "SONORA",
    category: "electronics",
    price: 179,
    oldPrice: 219,
    rating: 4.7,
    reviews: 94,
    image:
      "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=900&auto=format&fit=crop&q=85",
    tags: [
      "مكبر صوت",
      "صوت",
      "موسيقى",
      "لاسلكي",
      "رحلات",
      "هدية",
      "speaker",
      "audio",
    ],
    description:
      "مكبر صوت محمول بحجم صغير وصوت غني. مناسب لجلسات المنزل ورحلات نهاية الأسبوع، مع تصميم بسيط يسهل حمله.",
    features: [
      "بطارية حتى ١٢ ساعة",
      "مقاوم للرذاذ",
      "اتصال Bluetooth",
      "وزن خفيف وسهل الحمل",
    ],
    colors: ["#202523", "#B6C1B4", "#DDD3C6"],
    badge: "اختيار لقطة",
  },
  {
    id: "keyboard",
    name: "لوحة مفاتيح كلاود",
    subtitle: "مساحة عمل تلهمك",
    brand: "FORM",
    category: "electronics",
    price: 199,
    rating: 4.6,
    reviews: 62,
    image:
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=900&auto=format&fit=crop&q=85",
    tags: [
      "لوحة مفاتيح",
      "كيبورد",
      "حاسوب",
      "كمبيوتر",
      "مكتب",
      "عمل",
      "دراسة",
      "keyboard",
      "office",
    ],
    description:
      "لوحة مفاتيح لاسلكية بتصميم مضغوط ومفاتيح مريحة. لمسة أنيقة لمكتبك مع سهولة الانتقال بين أجهزتك.",
    features: [
      "اتصال لاسلكي",
      "تصميم مضغوط",
      "مفاتيح هادئة",
      "متوافقة مع الكمبيوتر والأجهزة اللوحية",
    ],
    colors: ["#F2EFE9", "#303433"],
  },
  {
    id: "lamp",
    name: "مصباح هالة",
    subtitle: "ضوء دافئ لتفاصيلك",
    brand: "NEST",
    category: "home",
    price: 129,
    oldPrice: 169,
    rating: 4.8,
    reviews: 87,
    image:
      "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=900&auto=format&fit=crop&q=85",
    tags: [
      "مصباح",
      "إضاءة",
      "لمبة",
      "مكتب",
      "عمل",
      "غرفة",
      "نوم",
      "منزل",
      "ديكور",
      "هدية",
      "lamp",
      "office",
      "bedroom",
    ],
    description:
      "مصباح طاولة بإضاءة دافئة وتصميم هادئ. يضيف أجواء مريحة لركن القراءة أو الطاولة بجوار سريرك.",
    features: [
      "إضاءة LED دافئة",
      "٣ مستويات سطوع",
      "تحكم باللمس",
      "قاعدة ثابتة",
    ],
    colors: ["#E8DDCB", "#727F71"],
    badge: "وصل حديثًا",
  },
  {
    id: "chair",
    name: "كرسي ركن",
    subtitle: "مكانك المفضل للاسترخاء",
    brand: "NEST",
    category: "home",
    price: 449,
    oldPrice: 549,
    rating: 4.9,
    reviews: 43,
    image:
      "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=900&auto=format&fit=crop&q=85",
    tags: [
      "كرسي",
      "أثاث",
      "منزل",
      "غرفة",
      "ديكور",
      "قراءة",
      "راحة",
      "chair",
      "home",
    ],
    description:
      "كرسي بذراعين وخطوط بسيطة، مع مقعد مبطن وأرجل خشبية. قطعة تضيف الدفء والراحة إلى غرفة المعيشة.",
    features: [
      "مقعد مبطن",
      "أرجل خشبية",
      "قماش ناعم",
      "تصميم مناسب للمساحات الصغيرة",
    ],
    colors: ["#DDCEB7", "#8F9B8A", "#C49B7E"],
  },
  {
    id: "mug",
    name: "كوب صباح سيراميك",
    subtitle: "بداية صغيرة، جميلة",
    brand: "NEST",
    category: "home",
    price: 59,
    rating: 4.7,
    reviews: 156,
    image:
      "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=900&auto=format&fit=crop&q=85",
    tags: [
      "كوب",
      "سيراميك",
      "قهوة",
      "شاي",
      "منزل",
      "مكتب",
      "عمل",
      "هدية",
      "mug",
      "coffee",
      "office",
    ],
    description:
      "كوب سيراميك بملمس لطيف ومقبض مريح. للقهوة الصباحية والشاي في استراحة يومك، أو هدية بسيطة لمن تحب.",
    features: ["سعة ٣٥٠ مل", "سيراميك متين", "آمن لغسالة الصحون", "مقبض مريح"],
    colors: ["#D7C3A6", "#6B7E71", "#F0E9DC"],
  },
  {
    id: "sneakers",
    name: "حذاء ستريت اليومي",
    subtitle: "خفّة ترافق كل خطوة",
    brand: "PACE",
    category: "fashion",
    price: 219,
    oldPrice: 289,
    rating: 4.8,
    reviews: 112,
    image:
      "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=900&auto=format&fit=crop&q=85",
    tags: [
      "حذاء",
      "أحذية",
      "جزمة",
      "سنيكرز",
      "أزياء",
      "موضة",
      "مشي",
      "رياضي",
      "sneakers",
      "shoes",
    ],
    description:
      "حذاء يومي بوسادة قدم مريحة ونعل مرن. تصميم سهل التنسيق يناسب المشي والتنقل وإطلالاتك البسيطة.",
    features: ["نعل مرن", "بطانة مريحة", "خامة تسمح بالتهوية", "تصميم يومي"],
    colors: ["#F1ECE2", "#1E2221", "#C4AF8E"],
    badge: "اختيار لقطة",
  },
  {
    id: "bag",
    name: "حقيبة كل يوم",
    subtitle: "كل ما تحتاجه، بخفّة",
    brand: "ROAM",
    category: "fashion",
    price: 149,
    rating: 4.6,
    reviews: 73,
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=900&auto=format&fit=crop&q=85",
    tags: [
      "حقيبة",
      "شنطة",
      "ظهر",
      "أزياء",
      "عمل",
      "مكتب",
      "دراسة",
      "سفر",
      "هدية",
      "bag",
      "backpack",
      "office",
    ],
    description:
      "حقيبة قماشية واسعة بتصميم بسيط ومقابض مريحة. رفيقة للمشاوير والعمل والتسوق، مع مساحة لترتيب أغراضك اليومية.",
    features: ["خامة قماشية", "مساحة داخلية واسعة", "مقابض مريحة", "وزن خفيف"],
    colors: ["#3C4A40", "#BBA484", "#272C2A"],
    badge: "وصل حديثًا",
  },
  {
    id: "watch",
    name: "ساعة مومنت",
    subtitle: "تفصيل لا يمرّ",
    brand: "MOMENT",
    category: "fashion",
    price: 279,
    oldPrice: 329,
    rating: 4.7,
    reviews: 58,
    image:
      "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=900&auto=format&fit=crop&q=85",
    tags: [
      "ساعة",
      "إكسسوارات",
      "أزياء",
      "موضة",
      "هدية",
      "watch",
      "accessories",
    ],
    description:
      "ساعة ذكية بواجهة بسيطة وسوار مريح. تجمع بين لمسة أنيقة ومتابعة نشاطك اليومي وإشعارات الهاتف.",
    features: [
      "شاشة ملونة",
      "سوار قابل للتعديل",
      "متابعة النشاط اليومي",
      "إشعارات الهاتف",
    ],
    colors: ["#B6A16B", "#AEB5B3", "#363A38"],
  },
  {
    id: "serum",
    name: "سيروم الترطيب اليومي",
    subtitle: "عناية تبدأ بلحظة",
    brand: "BOTANICA",
    category: "care",
    price: 89,
    oldPrice: 119,
    rating: 4.8,
    reviews: 104,
    image:
      "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=900&auto=format&fit=crop&q=85",
    tags: [
      "سيروم",
      "بشرة",
      "عناية",
      "ترطيب",
      "وجه",
      "جمال",
      "serum",
      "skincare",
      "care",
    ],
    description:
      "سيروم خفيف للترطيب اليومي بقوام سريع الامتصاص. أضفه إلى روتين العناية بالبشرة، مع اختبار المنتج على مساحة صغيرة أولًا.",
    features: ["حجم ٣٠ مل", "قوام خفيف", "سريع الامتصاص", "للاستخدام اليومي"],
    colors: ["#DDC9A9"],
  },
  {
    id: "fragrance",
    name: "عطر وود آند مسك",
    subtitle: "أثر هادئ، لا يُنسى",
    brand: "ATELIER",
    category: "care",
    price: 199,
    rating: 4.9,
    reviews: 91,
    image:
      "https://images.unsplash.com/photo-1541643600914-78b084683601?w=900&auto=format&fit=crop&q=85",
    tags: [
      "عطر",
      "عطور",
      "مسك",
      "خشب",
      "عناية",
      "هدية",
      "perfume",
      "fragrance",
      "care",
    ],
    description:
      "عطر يجمع نغمات الخشب والمسك مع لمسة دافئة. عبوة أنيقة تصلح للاستخدام اليومي ولإهداء شخص عزيز.",
    features: [
      "حجم ٥٠ مل",
      "نغمات خشبية",
      "لمسات من المسك",
      "عبوة قابلة لإعادة الاستخدام",
    ],
    colors: ["#B39157"],
    badge: "الأكثر طلبًا",
  },
  {
    id: "diffuser",
    name: "فواحة سكون",
    subtitle: "مساحة تتنفّس هدوءًا",
    brand: "BOTANICA",
    category: "care",
    price: 119,
    rating: 4.7,
    reviews: 66,
    image:
      "https://images.unsplash.com/photo-1602928321679-560bb453f190?w=900&auto=format&fit=crop&q=85",
    tags: [
      "فواحة",
      "رائحة",
      "عناية",
      "استرخاء",
      "منزل",
      "غرفة",
      "نوم",
      "هدية",
      "diffuser",
      "care",
      "bedroom",
    ],
    description:
      "فواحة منزلية بعيدان خشبية ورائحة لطيفة. تمنح ركنك المفضل أجواء هادئة دون الحاجة إلى الكهرباء.",
    features: [
      "حجم ١٠٠ مل",
      "عيدان خشبية",
      "لا تحتاج كهرباء",
      "رائحة لطيفة للمنزل",
    ],
    colors: ["#D6C5A8", "#ADBAA7"],
  },
];

export function formatPrice(price: number, currency = "JOD"): string {
  try {
    return new Intl.NumberFormat("ar", { style: "currency", currency }).format(price);
  } catch {
    return `${Number(price).toFixed(2)} ${currency}`;
  }
}
