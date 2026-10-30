import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Heart, Plus, Star, ShoppingBag } from "lucide-react-native";
import { router } from "expo-router";
import { Product, formatPrice, products as sampleProducts } from "../data/products";
import { useStore } from "../lib/store";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";
import { Txt } from "./ui";

const images: Record<string, ReturnType<typeof require>> = {
  headphones: require("../../assets/products/headphones.jpg"),
  speaker: require("../../assets/products/speaker.jpg"),
  keyboard: require("../../assets/products/keyboard.jpg"),
  lamp: require("../../assets/products/lamp.jpg"),
  chair: require("../../assets/products/chair.jpg"),
  mug: require("../../assets/products/mug.jpg"),
  sneakers: require("../../assets/products/sneakers.jpg"),
  bag: require("../../assets/products/bag.jpg"),
  watch: require("../../assets/products/watch.jpg"),
  serum: require("../../assets/products/serum.jpg"),
  fragrance: require("../../assets/products/fragrance.jpg"),
  diffuser: require("../../assets/products/diffuser.jpg"),
};
export function ProductImage({
  product,
  style,
}: {
  product: Product;
  style?: object;
}) {
  const { colors: t } = useTheme();
  const sourceKey = `${product.id}:${String(product.image)}`;
  const [failedSource, setFailedSource] = React.useState("");
  const failed = failedSource === sourceKey;
  const original = sampleProducts.find((item) => item.id === product.id);
  const bundled = original?.image === product.image ? images[product.id] : undefined;
  const remote = typeof product.image === "string" && /^https?:\/\//i.test(product.image)
    ? { uri: product.image }
    : undefined;
  if (failed || (!bundled && !remote))
    return (
      <View accessibilityRole="image" accessibilityLabel={`صورة غير متاحة: ${product.name}`} style={[{ width: "100%", height: "100%", backgroundColor: t.imageBackground, alignItems: "center", justifyContent: "center" }, style]}>
        <ShoppingBag color={t.muted} size={38} />
      </View>
    );
  return (
    <Image
      accessibilityLabel={product.name}
      source={bundled || remote}
      onError={() => setFailedSource(sourceKey)}
      style={[{ width: "100%", height: "100%", resizeMode: "cover" }, style]}
    />
  );
}
export function ProductCard({
  product,
  width,
}: {
  product: Product;
  width: number | `${number}%`;
}) {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { favorites, toggleFavorite, addToCart, settings } = useStore();
  const outOfStock = typeof product.stock === "number" && product.stock <= 0;
  const liked = favorites.includes(product.id);
  return (
    <View style={[s.card, { width }]}>
      <View style={s.photo}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`تفاصيل ${product.name}`}
          onPress={() => router.push(`/product/${product.id}`)}
          style={{ flex: 1 }}
        >
          <ProductImage product={product} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            liked
              ? `إزالة ${product.name} من المفضلة`
              : `حفظ ${product.name} في المفضلة`
          }
          accessibilityState={{ selected: liked }}
          onPress={() => toggleFavorite(product.id)}
          style={s.heart}
        >
          <Heart
            size={18}
            color={liked ? t.orange : t.ink}
            fill={liked ? t.orange : "transparent"}
          />
        </Pressable>
        {product.badge ? (
          <View style={s.badge}>
            <Txt weight="bold" style={{ color: t.green, fontSize: 11 }}>
              {product.badge}
            </Txt>
          </View>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/product/${product.id}`)}
        style={s.info}
      >
        <Txt style={s.brand}>{product.brand}</Txt>
        <Txt weight="bold" numberOfLines={1} style={{ fontSize: 16 }}>
          {product.name}
        </Txt>
        <Txt
          numberOfLines={1}
          style={{ color: t.muted, fontSize: 12, marginTop: 5 }}
        >
          {product.subtitle}
        </Txt>
        <View style={s.rating}>
          {product.reviews > 0 ? <>
            <Star color={t.orange} fill={t.orange} size={12} />
            <Txt weight="bold" style={{ fontSize: 12 }}>{product.rating.toFixed(1)}</Txt>
            <Txt style={{ color: t.muted, fontSize: 12 }}>({product.reviews})</Txt>
          </> : <Txt style={{ color: t.muted, fontSize: 12 }}>لا تقييمات بعد</Txt>}
        </View>
        {typeof product.stock === "number" ? <Txt style={{ color: outOfStock ? t.danger : t.green, fontSize: 12, marginTop: 7 }}>
          {outOfStock ? "نفدت الكمية" : product.stock <= 5 ? `متبقي ${product.stock}` : "متوفر في المخزون"}
        </Txt> : null}
      </Pressable>
      <View style={s.bottom}>
        <View
          style={{
            flexDirection: "row-reverse",
            alignItems: "baseline",
            gap: 4,
            flexWrap: "wrap",
            flex: 1,
          }}
        >
          <Txt weight="extra" style={{ fontSize: 17 }}>
            {formatPrice(product.price, settings.currency)}
          </Txt>
          {product.oldPrice ? (
            <Txt
              style={{
                fontSize: 11,
                color: t.muted,
                textDecorationLine: "line-through",
                marginRight: 6,
              }}
            >
              {formatPrice(product.oldPrice, settings.currency)}
            </Txt>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={product.hasVariants ? `اختر مقاس أو لون ${product.name}` : `إضافة ${product.name} للسلة`}
          onPress={() => product.hasVariants ? router.push(`/product/${product.id}`) : addToCart(product.id)}
          accessibilityState={{ disabled: outOfStock }}
          disabled={outOfStock}
          style={[s.plus, outOfStock && { opacity: 0.4 }]}
        >
          <Plus size={19} color={t.ink} />
        </Pressable>
      </View>
    </View>
  );
}
const makeStyles = (t: Palette) => StyleSheet.create({
  card: {
    backgroundColor: t.paper,
    borderRadius: 18,
    padding: 8,
    borderWidth: 1,
    borderColor: t.line,
    overflow: "hidden",
  },
  photo: {
    aspectRatio: 1.08,
    borderRadius: 12,
    backgroundColor: t.imageBackground,
    overflow: "hidden",
  },
  heart: {
    position: "absolute",
    left: 10,
    top: 10,
    width: 44,
    height: 44,
    borderRadius: 17,
    backgroundColor: t.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    right: 10,
    top: 10,
    backgroundColor: t.paper,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  info: { padding: 10, paddingBottom: 0 },
  brand: { fontSize: 10, color: t.muted, letterSpacing: 1.5, marginBottom: 7 },
  rating: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    marginTop: 9,
  },
  bottom: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    paddingTop: 8,
  },
  plus: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: t.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
});
