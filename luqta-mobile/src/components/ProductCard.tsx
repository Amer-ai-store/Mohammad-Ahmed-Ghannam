// Product image + cards in the reference design style.
import React from "react";
import { Image, ImageStyle, Pressable, StyleProp, StyleSheet, View } from "react-native";
import { Heart, Plus, ShoppingBag, ShoppingCart } from "lucide-react-native";
import { router } from "expo-router";
import { Product, formatPrice } from "../data/products";
import { useStore } from "../lib/store";
import { productImages } from "../lib/designAssets";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";
import { Txt } from "./ui";

export function imageSource(image: unknown): { uri: string } | number | undefined {
  if (typeof image === "string" && image.startsWith("local:")) return productImages[image.slice(6)];
  if (typeof image === "string" && /^https:\/\//i.test(image)) return { uri: image };
  if (typeof image === "number") return image;
  return undefined;
}

export function ProductImage({ product, image, style, contain = true }: { product: Product; image?: string; style?: StyleProp<ImageStyle>; contain?: boolean }) {
  const { colors: t } = useTheme();
  const src = imageSource(image ?? product.image);
  const key = `${product.id}:${String(image ?? product.image)}`;
  const [failed, setFailed] = React.useState("");
  if (!src || failed === key)
    return (
      <View accessibilityRole="image" accessibilityLabel={`صورة غير متاحة: ${product.name}`} style={[{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: t.field, borderRadius: 14 }, style as object]}>
        <ShoppingBag color={t.muted} size={34} />
      </View>
    );
  return <Image accessibilityLabel={product.name} source={src} onError={() => setFailed(key)} style={[{ width: "100%", height: "100%" }, style]} resizeMode={contain ? "contain" : "cover"} />;
}

/** Card from the home screen ("منتجات مميزة لك"). */
export function ProductCard({ product, width }: { product: Product; width: number | `${number}%` }) {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { addToCart, favorites, toggleFavorite, settings } = useStore();
  const out = typeof product.stock === "number" && product.stock <= 0;
  const liked = favorites.includes(product.id);
  return (
    <View style={[s.card, { width }]} testID={`product-card-${product.id}`}>
      <Pressable accessibilityRole="button" accessibilityLabel={`تفاصيل ${product.name}`} onPress={() => router.push(`/product/${product.id}`)} style={{ alignItems: "center" }}>
        <View style={s.photo}><ProductImage product={product} /></View>
        <Txt weight="bold" numberOfLines={1} style={s.name}>{product.name}{product.variantLabel ? ` — ${product.variantLabel}` : ""}</Txt>
        <Txt numberOfLines={1} style={s.sub}>{product.unit || product.subtitle}</Txt>
        <Txt weight="bold" style={s.price}>{formatPrice(product.price, settings.currency)}</Txt>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={liked ? `إزالة ${product.name} من المفضلة` : `حفظ ${product.name} في المفضلة`} onPress={() => toggleFavorite(product.id)} style={s.heart} hitSlop={6}>
        <Heart size={18} color={liked ? t.orange : t.muted} fill={liked ? t.orange : "transparent"} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={out ? `${product.name} غير متوفر` : `أضف ${product.name} إلى السلة`} accessibilityState={{ disabled: out }} disabled={out}
        testID={`add-${product.id}`} onPress={() => (product.hasVariants ? router.push(`/product/${product.id}`) : addToCart(product.id))} style={({ pressed }) => [s.add, { opacity: out ? 0.45 : pressed ? 0.85 : 1 }]}>
        <ShoppingCart size={21} color={t.onAccent} strokeWidth={2.2} />
        <Txt weight="medium" style={{ color: t.onAccent, fontSize: 16 }}>{out ? "غير متوفر" : product.hasVariants ? "اختر الخيار" : "أضف إلى السلة"}</Txt>
      </Pressable>
    </View>
  );
}

/** Compact card from the explore screen (image left, text right, "+" button). */
export function MiniProductCard({ product, width }: { product: Product; width: number | `${number}%` }) {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { addToCart, settings } = useStore();
  const out = typeof product.stock === "number" && product.stock <= 0;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`تفاصيل ${product.name}`} onPress={() => router.push(`/product/${product.id}`)} style={[s.mini, { width }]} testID={`mini-${product.id}`}>
      <View style={{ flex: 1, alignItems: "flex-end", justifyContent: "space-between" }}>
        <View style={{ alignItems: "flex-end" }}>
          <Txt weight="bold" numberOfLines={2} style={{ fontSize: 16, color: t.title }}>{product.name}</Txt>
          <Txt style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>{product.unit || product.subtitle}</Txt>
          <Txt weight="bold" style={{ fontSize: 16, color: t.orange, marginTop: 6 }}>{formatPrice(product.price, settings.currency)}</Txt>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`أضف ${product.name} إلى السلة`} disabled={out} testID={`mini-add-${product.id}`}
          onPress={() => (product.hasVariants ? router.push(`/product/${product.id}`) : addToCart(product.id))} style={[s.plus, out && { opacity: 0.4 }]}>
          <Plus size={26} color={t.onAccent} strokeWidth={2.6} />
        </Pressable>
      </View>
      <View style={{ width: "48%", height: 120 }}><ProductImage product={product} /></View>
    </Pressable>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  card: { backgroundColor: t.card, borderRadius: 24, borderWidth: 1, borderColor: t.line, padding: 10, shadowColor: t.shadow, shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  photo: { width: "100%", height: 92, marginTop: 2, marginBottom: 6 },
  name: { fontSize: 17, color: t.title, textAlign: "center" },
  sub: { fontSize: 13, color: t.mutedSoft, textAlign: "center", marginTop: 2 },
  price: { fontSize: 18, color: t.orange, textAlign: "center", marginTop: 2, marginBottom: 8 },
  heart: { position: "absolute", top: 10, left: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: t.field, alignItems: "center", justifyContent: "center" },
  add: { minHeight: 42, borderRadius: 999, backgroundColor: t.orange, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  mini: { flexDirection: "row-reverse", backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.line, padding: 12, gap: 6, minHeight: 140 },
  plus: { width: 46, height: 46, borderRadius: 23, backgroundColor: t.orange, alignItems: "center", justifyContent: "center", alignSelf: "center", marginTop: 8 },
});
