// Product detail — reference design (gallery, 3D, colours, quantity, specs, compare).
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Share, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Battery, Bluetooth, Box, ChevronLeft, Clock, Headphones, Heart, Info, Leaf, Play, Ruler, Scale, Share2, ShoppingCart, Weight } from "lucide-react-native";
import { Shell } from "../../components/Shell";
import { ProductImage } from "../../components/ProductCard";
import { ProductReviews } from "../../components/ProductReviews";
import { Txt } from "../../components/ui";
import { BackSquare, BrandHeader, Card, Chip, CTA, QtyStepper, SmallButton } from "../../components/design/kit";
import { Companion } from "../../components/character/Companion";
import { formatPrice, type ProductSpec } from "../../data/products";
import { useStore } from "../../lib/store";
import { track } from "../../lib/analytics";
import { PriceInsight } from "../../components/smart/PriceInsight";
import { PricePassport } from "../../components/smart/PricePassport";
import { NutritionCard } from "../../components/smart/NutritionCard";
import { FlashBadges, TogetherSection, useProductEvents } from "../../components/smart/ProductExtras";
import { Palette, useTheme, useThemedStyles } from "../../lib/theme";

const specIcons: Record<ProductSpec["icon"], typeof Box> = { headphones: Headphones, bluetooth: Bluetooth, battery: Battery, ruler: Ruler, weight: Weight, box: Box, leaf: Leaf, clock: Clock };

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProductContent key={id || "none"} id={id || ""} />;
}

function ProductContent({ id }: { id: string }) {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { products, cart, favorites, compareIds, settings, catalogStatus, branchId, branches, rememberProduct, setQuantity, toggleFavorite, toggleCompare, notify } = useStore();
  const requested = products.find((p) => p.id === id);
  const product = requested?.variantOf ? products.find((p) => p.id === requested.variantOf) || requested : requested;
  const variants = useMemo(() => (product ? products.filter((p) => p.variantOf === product.id && p.active !== false) : []), [products, product]);
  const [variantId, setVariantId] = useState(requested?.variantOf ? requested.id : "");
  const [imageIndex, setImageIndex] = useState(0);
  const [swatch, setSwatch] = useState(0);
  const [qty, setQty] = useState(1);
  const [showSpecs, setShowSpecs] = useState(false);
  useEffect(() => { if (product?.id) rememberProduct(product.id); }, [product?.id, rememberProduct]);
  const track = useProductEvents(product?.id);
  if (!product) return (
    <Shell header={<BrandHeader left={<BackSquare />} />} title="المنتج غير متاح" subtitle={catalogStatus === "loading" ? "جارٍ تحميل الكتالوج…" : "قد يكون المنتج مؤرشفًا أو الرابط غير صحيح."}>
      <CTA title="العودة إلى المتجر" onPress={() => router.navigate("/explore")} />
    </Shell>
  );
  const selected = variants.length ? variants.find((v) => v.id === variantId) : product;
  const gallery = product.images?.length ? product.images : [product.image];
  const stockRaw = selected?.stock ?? (variants.length ? 0 : 10);
  const branchStock = selected?.branchStock && branchId ? Math.min(stockRaw, selected.branchStock[branchId] ?? 0) : stockRaw;
  const remaining = Math.max(0, Math.min(99, branchStock - (selected ? cart[selected.id] || 0 : 0)));
  const liked = favorites.includes(product.id);
  const compared = compareIds.includes(product.id);
  const branchName = branches.find((b) => b.id === branchId)?.name;
  const add = () => {
    if (!selected) { notify("اختر المقاس أو اللون أولًا"); return; }
    if (remaining < 1) { notify(branchStock < 1 ? "غير متوفر في الفرع المختار" : "الكمية المتاحة موجودة في سلتك"); return; }
    const chosen = Math.min(qty, remaining);
    setQuantity(selected.id, (cart[selected.id] || 0) + chosen);
    track("add_to_cart");
    notify(chosen === qty ? "أُضيف المنتج إلى سلتك" : `أُضيفت ${chosen} قطع حسب الكمية المتاحة`);
  };
  const share = async () => {
    const link = `luqta://product/${encodeURIComponent(product.id)}`;
    track("share");
    try { await Share.share({ title: product.name, message: `${product.name} — ${formatPrice(selected?.price ?? product.price, settings.currency)}\n${link}`, url: link }); }
    catch (e) { notify(e instanceof Error ? e.message : "تعذّرت مشاركة المنتج"); }
  };
  const specs = product.specs?.length ? product.specs : product.features.slice(0, 3).map((f) => ({ label: f, value: "", icon: "box" as const }));
  const demo = catalogStatus !== "connected";
  return (
    <Shell header={<BrandHeader left={<BackSquare />} />}>
      <Card padded={false} style={s.gallery} testID="product-gallery">
        <View style={s.thumbs}>
          {gallery.slice(0, 3).map((img, i) => (
            <Pressable key={`${img}-${i}`} accessibilityRole="button" accessibilityLabel={`صورة ${i + 1}`} accessibilityState={{ selected: i === imageIndex }} onPress={() => setImageIndex(i)} style={[s.thumb, i === imageIndex && s.thumbActive]}>
              <ProductImage product={product} image={img} />
            </Pressable>
          ))}
          {product.model3d ? (
            <Pressable accessibilityRole="button" accessibilityLabel="فيديو وعرض 360°" onPress={() => router.push(`/view3d/${product.id}`)} style={[s.thumb, { backgroundColor: t.purpleSoft }]}>
              <ProductImage product={product} image={gallery[gallery.length - 1]} style={{ opacity: 0.55 }} />
              <View style={s.play}><Play size={22} color={t.onAccent} fill={t.onAccent} /></View>
            </Pressable>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.galleryTop}>
            <Pressable accessibilityRole="button" accessibilityLabel="مشاركة" onPress={() => void share()} style={s.roundBtn}><Share2 size={22} color={t.ink} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={liked ? "إزالة من المفضلة" : "حفظ في المفضلة"} accessibilityState={{ selected: liked }} onPress={() => toggleFavorite(product.id)} style={s.roundBtn}><Heart size={22} color={liked ? t.orange : t.ink} fill={liked ? t.orange : "transparent"} /></Pressable>
          </View>
          <View style={s.mainImage}><ProductImage product={product} image={gallery[imageIndex] || product.image} /></View>
          <View style={s.galleryBottom}>
            <View style={{ position: "absolute", right: -8, bottom: 40 }} pointerEvents="none"><Companion action="thumbs" base={120} enterFrom="none" /></View>
            <View style={{ flex: 1 }} />
            {product.model3d ? (
              <Pressable accessibilityRole="button" accessibilityLabel="عرض ثلاثي الأبعاد" testID="open-3d" onPress={() => router.push(`/view3d/${product.id}`)} style={s.pill3d}>
                <Txt weight="medium" style={{ fontSize: 15, color: t.ink }}>عرض ثلاثي الأبعاد</Txt><Box size={22} color={t.ink} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </Card>

      <View style={s.titleRow}>
        <Txt accessibilityRole="header" weight="extra" style={{ fontSize: 28, color: t.title, flex: 1 }}>{product.name}</Txt>
        <Chip label={demo ? "توفر تجريبي" : branchStock > 0 ? (branchStock <= 5 ? `متبقي ${branchStock}` : "متوفر") : "غير متوفر"} tone={demo ? "demo" : branchStock > 0 ? "success" : "demo"} dot={branchStock > 0 ? "#1ED055" : "#E5363D"} />
      </View>
      <Txt style={{ color: t.muted, fontSize: 16, marginTop: 2 }}>{product.description || product.subtitle}</Txt>
      <View style={{ flexDirection: "row-reverse", alignItems: "baseline", gap: 10, marginTop: 6 }}>
        <Txt weight="extra" style={{ fontSize: 30, color: t.orange }}>{formatPrice(selected?.price ?? product.price, settings.currency)}</Txt>
        {product.oldPrice && product.oldPrice > product.price ? <Txt style={{ color: t.muted, textDecorationLine: "line-through" }}>{formatPrice(product.oldPrice, settings.currency)}</Txt> : null}
      </View>
      {branchName && !demo ? <Txt style={{ color: t.muted, fontSize: 12 }}>المتوفر في {branchName}: {branchStock}</Txt> : null}
      <FlashBadges product={product} />

      {variants.length ? (
        <Card style={s.row}>
          <Txt weight="bold" style={s.rowLabel}>الخيار</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, flex: 1 }}>
            {variants.map((v) => <SmallButton key={v.id} title={`${v.variantLabel || v.id}`} tone={v.id === variantId ? "primary" : "outline"} onPress={() => { setVariantId(v.id); setQty(1); }} />)}
          </View>
        </Card>
      ) : product.swatches?.length ? (
        <Card style={s.row}>
          <Txt weight="bold" style={s.rowLabel}>اللون</Txt>
          <View style={{ flexDirection: "row", gap: 14, flex: 1 }}>
            {product.swatches.map((c, i) => (
              <Pressable key={c.hex} accessibilityRole="radio" accessibilityLabel={`اللون ${c.name}`} accessibilityState={{ checked: i === swatch }} onPress={() => setSwatch(i)} style={[s.swatchRing, i === swatch && { borderColor: t.purple }]}>
                <View style={[s.swatch, { backgroundColor: c.hex }]} />
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}

      <Card style={s.row}>
        <Txt weight="bold" style={s.rowLabel}>الكمية</Txt>
        <View style={{ flex: 1, alignItems: "flex-start" }}><QtyStepper label={product.name} value={Math.min(qty, Math.max(1, remaining))} max={Math.max(1, remaining)} onChange={setQty} /></View>
      </Card>

      <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="المواصفات" accessibilityState={{ expanded: showSpecs }} onPress={() => setShowSpecs(!showSpecs)} style={[s.halfBtn]}>
          <Info size={24} color={t.ink} /><Txt style={{ fontSize: 16, color: t.ink, flex: 1 }}>المواصفات</Txt><ChevronLeft size={24} color={t.ink} style={{ transform: [{ rotate: showSpecs ? "-90deg" : "0deg" }] }} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={compared ? "عرض المقارنة" : "قارن"} accessibilityState={{ selected: compared }} onPress={() => { if (!compared) toggleCompare(product.id); router.push("/compare"); }} style={[s.halfBtn, compared && { borderColor: t.orange }]}>
          <Scale size={24} color={t.ink} /><Txt style={{ fontSize: 16, color: t.ink }}>{compared ? "في المقارنة" : "قارن"}</Txt>
        </Pressable>
      </View>

      {specs.length ? (
        <Card style={s.specs}>
          {specs.slice(0, 3).map((sp, i) => {
            const Icon = specIcons[sp.icon] || Box;
            return (
              <View key={`${sp.label}-${i}`} style={[s.spec, i > 0 && { borderRightWidth: 1, borderColor: t.line }]}>
                <Icon size={26} color={t.title} />
                <Txt weight="bold" style={{ fontSize: 15, color: t.title, textAlign: "center", marginTop: 4 }}>{sp.label}</Txt>
                {sp.value ? <Txt style={{ fontSize: 13, color: t.muted, textAlign: "center" }}>{sp.value}</Txt> : null}
              </View>
            );
          })}
        </Card>
      ) : null}
      {showSpecs ? (
        <Card style={{ marginTop: 10, gap: 6 }}>
          {product.features.map((f, i) => <Txt key={i} style={{ color: t.ink }}>• {f}</Txt>)}
          {product.dimensions ? <Txt style={{ color: t.muted }}>المقاسات: {Math.round(product.dimensions.w * 100)}×{Math.round(product.dimensions.d * 100)}×{Math.round(product.dimensions.h * 100)} سم</Txt> : null}
          {product.sku ? <Txt style={{ color: t.muted }}>رمز الصنف: {product.sku}</Txt> : null}
        </Card>
      ) : null}

      <CTA title={variants.length && !selected ? "اختر الخيار" : remaining < 1 ? "غير متوفر" : "أضف إلى السلة"} icon={ShoppingCart} testID="product-add" disabled={remaining < 1 || (variants.length > 0 && !selected)} onPress={add} style={{ marginTop: 16 }} />
      <PriceInsight product={product} />
      <PricePassport product={product} />
      <NutritionCard nutrition={product.nutrition} />
      <TogetherSection product={product} />
      <View style={{ marginTop: 16 }}><ProductReviews productId={product.id} /></View>
    </Shell>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  gallery: { flexDirection: "row", padding: 12, gap: 10, minHeight: 330, marginTop: 4 },
  thumbs: { width: 64, gap: 8 },
  thumb: { width: 64, height: 64, borderRadius: 14, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, padding: 4, overflow: "hidden" },
  thumbActive: { borderColor: t.purple, borderWidth: 2 },
  play: { position: "absolute", top: 18, left: 18, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(19,0,80,0.55)", alignItems: "center", justifyContent: "center" },
  galleryTop: { flexDirection: "row-reverse", gap: 10, justifyContent: "flex-start" },
  roundBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, alignItems: "center", justifyContent: "center" },
  mainImage: { flex: 1, minHeight: 190, paddingHorizontal: 6 },
  galleryBottom: { flexDirection: "row", alignItems: "flex-end", minHeight: 52 },
  pill3d: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingHorizontal: 16, minHeight: 44, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.card },
  titleRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginTop: 16 },
  row: { flexDirection: "row-reverse", alignItems: "center", marginTop: 12, paddingVertical: 12 },
  rowLabel: { fontSize: 17, color: t.title, width: 80 },
  swatchRing: { width: 46, height: 46, borderRadius: 23, borderWidth: 2.5, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  swatch: { width: 36, height: 36, borderRadius: 18 },
  halfBtn: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 54, borderRadius: 18, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, paddingHorizontal: 14 },
  specs: { flexDirection: "row-reverse", marginTop: 12, paddingVertical: 14, paddingHorizontal: 4 },
  spec: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
});
