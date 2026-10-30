import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  Coffee,
  Headphones,
  Leaf,
  Shirt,
  Sparkles,
  Truck,
  ShoppingBag,
} from "lucide-react-native";
import { router } from "expo-router";
import { Shell } from "../components/Shell";
import { EmptyState, SectionTitle, Txt } from "../components/ui";
import { ProductGrid } from "../components/ProductGrid";
import { formatPrice } from "../data/products";
import { useStore } from "../lib/store";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";

const groups = [
  {
    id: "electronics",
    title: "إلكترونيات",
    detail: "تقنية تجعل يومك أسهل",
    icon: Headphones,
    bg: "#EEECE3",
    color: "#727A6B",
  },
  {
    id: "home",
    title: "المنزل والحياة",
    detail: "تفاصيل تصنع الفرق",
    icon: Coffee,
    bg: "#EEE6DA",
    color: "#AA8C60",
  },
  {
    id: "fashion",
    title: "أزياء وإكسسوارات",
    detail: "أسلوب يشبهك",
    icon: Shirt,
    bg: "#E8EAE2",
    color: "#788464",
  },
  {
    id: "care",
    title: "العناية والجمال",
    detail: "وقت صغير لنفسك",
    icon: Leaf,
    bg: "#F3E8E3",
    color: "#B18A80",
  },
];
export default function Home() {
  const { colors: t, isDark } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { products, settings } = useStore();
  const storefront = settings.storefront || {};
  const displayProducts = products.filter((p) => !p.variantOf);
  const activeCategories = [...new Set(displayProducts.map((p) => p.category))];
  const visibleGroups = activeCategories.map((id) => groups.find((group) => group.id === id) || { id, title: id, detail: "اكتشف منتجات هذا القسم", icon: ShoppingBag, bg: t.secondary, color: t.orange });
  const { width } = useWindowDimensions();
  const desktop = width >= 950;
  return (
    <Shell title="" search>
      <View style={s.welcome}>
        <View style={{ flex: 1 }}>
          <Txt weight="extra" style={{ fontSize: desktop ? 26 : 23 }}>
            أهلًا بك، لُقطتك تنتظرك <Txt style={{ fontSize: 22 }}>✦</Txt>
          </Txt>
          <Txt style={{ color: t.muted, fontSize: 13, marginTop: 7 }}>
            اختيارات جميلة. تفاصيل ذكية. كلّها في مكان واحد.
          </Txt>
        </View>
        {desktop ? (
          <View style={s.edition}>
            <View style={s.dot} />
            <Txt weight="medium" style={{ color: t.green, fontSize: 11 }}>
              {displayProducts.length} منتج في المتجر
            </Txt>
          </View>
        ) : null}
      </View>
      <View style={[s.hero, { minHeight: desktop ? 320 : 285 }]}>
        <Image
          source={require("../../assets/hero.jpg")}
          style={[s.heroImage, { width: desktop ? "49%" : "47%" }]}
        />
        <View
          style={[
            s.heroCopy,
            { width: desktop ? "56%" : "65%", padding: desktop ? 33 : 22 },
          ]}
        >
          <View style={s.heroPill}>
            <View
              style={{
                width: 4,
                height: 4,
                borderRadius: 3,
                backgroundColor: t.orange,
              }}
            />
            <Txt weight="bold" style={{ fontSize: 10, color: t.muted }}>
              أشياء قليلة، تُحدث فرقًا كبيرًا
            </Txt>
          </View>
          <Txt
            weight="extra"
            style={{
              fontSize: desktop ? 43 : 30,
              lineHeight: desktop ? 55 : 42,
              marginTop: 17,
            }}
          >
            {storefront.heroTitle || "لُقطات تستحق أن تكون لك"}
          </Txt>
          <Txt
            style={{
              color: t.muted,
              fontSize: desktop ? 14 : 12,
              lineHeight: 24,
              marginTop: 10,
              maxWidth: 320,
            }}
          >
            {storefront.heroSubtitle || "من تفاصيل منزلك إلى إيقاع يومك، اكتشف منتجات تُشبه ذوقك."}
          </Txt>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate("/explore")}
            style={s.heroButton}
          >
            <Txt weight="bold" style={{ color: t.onAccent, fontSize: 13 }}>
              اكتشف المجموعة
            </Txt>
            <ArrowLeft color={t.onAccent} size={16} />
          </Pressable>
        </View>
        {desktop ? (
          <View style={s.heroCaption}>
            <Txt
              weight="bold"
              style={{ color: "white", fontSize: 10, letterSpacing: 2 }}
            >
              THE EVERYDAY COLLECTION
            </Txt>
          </View>
        ) : null}
      </View>
      {storefront.showAssistant !== false ? <Pressable
        accessibilityRole="button"
        onPress={() => router.navigate("/assistant")}
        style={[s.aiBanner, !desktop ? { padding: 17 } : null]}
      >
        <View style={s.aiIcon}>
          <Sparkles size={23} color={t.orange} />
        </View>
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Txt weight="bold" style={{ fontSize: desktop ? 17 : 15 }}>
              ذوقك هو البداية. مساعدك يُكملها.
            </Txt>
            <View style={s.aiLabel}>
              <Txt weight="bold" style={{ color: t.orange, fontSize: 9 }}>
                AI
              </Txt>
            </View>
          </View>
          <Txt style={{ color: t.muted, fontSize: 12, marginTop: 5 }}>
            صف ما تحتاجه، واعثر على اختيار يناسبك وميزانيتك.
          </Txt>
        </View>
        {desktop ? (
          <View style={s.aiAction}>
            <Txt weight="bold" style={{ fontSize: 12 }}>
              ساعدني أختار
            </Txt>
            <ArrowLeft size={15} color={t.ink} />
          </View>
        ) : (
          <ChevronLeft size={20} color={t.orange} />
        )}
      </Pressable> : null}
      <SectionTitle
        title="على ذوقك، في كل قسم"
        action="كل الأقسام"
        onPress={() => router.navigate("/explore")}
      />
      <View style={s.categories}>
        {visibleGroups.map((group) => (
          <Pressable
            accessibilityRole="button"
            key={group.id}
            onPress={() =>
              router.navigate({
                pathname: "/explore",
                params: { category: group.id },
              })
            }
            style={[s.category, { width: width < 700 ? "48%" : "23.5%" }]}
          >
            <View style={[s.categoryIcon, { backgroundColor: isDark ? t.secondary : group.bg }]}>
              <group.icon size={26} strokeWidth={1.4} color={t.orange} />
            </View>
            <Txt weight="bold" style={{ fontSize: 14, textAlign: "center" }}>
              {group.title}
            </Txt>
            <Txt
              style={{
                fontSize: 10,
                color: t.muted,
                marginTop: 5,
                textAlign: "center",
              }}
            >
              {group.detail}
            </Txt>
          </Pressable>
        ))}
      </View>
      <SectionTitle
        title="اختيارات لُقطة"
        subtitle="تشكيلة اخترناها لتفاصيل يومك"
        action="عرض الكل"
        onPress={() => router.navigate("/explore")}
      />
      {displayProducts.length ? <ProductGrid items={displayProducts.slice(0, 4)} /> : <EmptyState title="لا توجد منتجات منشورة" detail="ستظهر الأصناف هنا بعد إضافتها أو مزامنتها من لوحة الإدارة." action="تصفح المتجر" />}
      <View style={s.promiseRow}>
        <View style={s.promise}>
          <Truck size={20} color={t.muted} />
          <View>
            <Txt weight="bold" style={{ fontSize: 12 }}>
              شحن محسوب بوضوح
            </Txt>
            <Txt style={{ color: t.muted, fontSize: 10, marginTop: 3 }}>
              {`مجاني للطلبات من ${formatPrice(settings.freeShippingThreshold, settings.currency)}`}
            </Txt>
          </View>
        </View>
        <View style={s.promise}>
          <Check size={20} color={t.muted} />
          <View>
            <Txt weight="bold" style={{ fontSize: 12 }}>
              تفاصيل قبل الاختيار
            </Txt>
            <Txt style={{ color: t.muted, fontSize: 10, marginTop: 3 }}>
              مواصفات وأسعار واضحة
            </Txt>
          </View>
        </View>
        <View style={s.promise}>
          <Sparkles size={20} color={t.muted} />
          <View>
            <Txt weight="bold" style={{ fontSize: 12 }}>
              اختيار يناسب احتياجك
            </Txt>
            <Txt style={{ color: t.muted, fontSize: 10, marginTop: 3 }}>
              مساعدك معك في كل خطوة
            </Txt>
          </View>
        </View>
      </View>
      <SectionTitle
        title="تفاصيل تُكمل يومك"
        subtitle="اكتشف لُقطات أخرى قد تعجبك"
        action="استكشف المزيد"
        onPress={() => router.navigate("/explore")}
      />
      <ProductGrid items={displayProducts.slice(4, 8)} />
    </Shell>
  );
}
const makeStyles = (t: Palette) => StyleSheet.create({
  welcome: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 10,
  },
  edition: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: t.secondary,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 5,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: t.green },
  hero: { backgroundColor: t.secondary, borderRadius: 22, overflow: "hidden" },
  heroImage: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    height: "100%",
    resizeMode: "cover",
  },
  heroCopy: {
    alignSelf: "flex-end",
    backgroundColor: t.secondary,
    borderTopLeftRadius: 90,
    borderBottomLeftRadius: 60,
  },
  heroPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 6,
  },
  heroButton: {
    flexDirection: "row-reverse",
    alignSelf: "flex-end",
    alignItems: "center",
    backgroundColor: t.orange,
    borderRadius: 11,
    paddingHorizontal: 17,
    paddingVertical: 13,
    gap: 15,
    marginTop: 22,
  },
  heroCaption: { position: "absolute", left: 23, bottom: 20 },
  aiBanner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 16,
    padding: 20,
    marginTop: 19,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 15,
    backgroundColor: t.orangeSoft,
  },
  aiIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.orangeSoft,
  },
  aiLabel: {
    backgroundColor: t.orangeSoft,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiAction: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: t.paper,
  },
  categories: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },
  category: {
    paddingVertical: 19,
    paddingHorizontal: 8,
    alignItems: "center",
    backgroundColor: t.paper,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.line,
  },
  categoryIcon: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    marginBottom: 13,
  },
  promiseRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 18,
    justifyContent: "space-between",
    marginTop: 25,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 22,
  },
  promise: { flexDirection: "row-reverse", alignItems: "center", gap: 9 },
});
