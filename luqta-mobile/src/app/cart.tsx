import React from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Minus, Plus, ShoppingBag, Trash2, Truck } from "lucide-react-native";
import { router } from "expo-router";
import { Shell } from "../components/Shell";
import { ProductImage } from "../components/ProductCard";
import { Button, EmptyState, Txt } from "../components/ui";
import { formatPrice } from "../data/products";
import { useStore } from "../lib/store";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";

export default function CartScreen() {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const wide = width >= 1080;
  const { cart, cartCount, subtotal, shipping, setQuantity, hydrated, products, settings, catalogStatus } =
    useStore();
  const items = products.filter((product) => cart[product.id]);
  const unavailableIds = Object.keys(cart).filter((id) => !products.some((p) => p.id === id));
  const stockIssue = items.some((p) => p.stock !== undefined && cart[p.id] > p.stock);
  const checkoutReady = catalogStatus === "connected";
  return (
    <Shell
      title="سلة المشتريات"
      subtitle="لُقطاتك الجميلة تنتظر الخطوة التالية."
    >
      {!hydrated ? (
        <Txt style={{ color: t.muted, padding: 30 }}>جارٍ استعادة سلتك…</Txt>
      ) : !items.length ? (
        <View>
          <EmptyState
            title="سلتك تنتظر لُقطتك الأولى"
            detail="استكشف المنتجات وأضف ما يناسبك. ستبقى اختياراتك محفوظة على هذا الجهاز."
          />
          {unavailableIds.length ? <Button title="إزالة الأصناف التي لم تعد متاحة" secondary onPress={() => unavailableIds.forEach((id) => setQuantity(id, 0))} /> : null}
        </View>
      ) : (
        <View
          style={[s.layout, { flexDirection: wide ? "row-reverse" : "column" }]}
        >
          <View style={{ flex: 1, gap: 14 }}>
            <View style={s.delivery}>
              <Truck size={21} color={t.green} />
              <View style={{ flex: 1 }}>
                <Txt weight="bold" style={{ color: t.green, fontSize: 14 }}>
                  {subtotal >= settings.freeShippingThreshold
                    ? "وصلت إلى حد الشحن المجاني"
                    : `أضف ${formatPrice(settings.freeShippingThreshold - subtotal, settings.currency)} للشحن المجاني`}
                </Txt>
                <Txt style={{ color: t.muted, fontSize: 12, marginTop: 5 }}>
                  {checkoutReady ? "يُعاد التحقق من السعر والمخزون عند تأكيد الطلب" : "اربط الخادم للتحقق من إعدادات الشحن الفعلية"}
                </Txt>
              </View>
            </View>
            {unavailableIds.length ? <View style={s.delivery}>
              <Txt style={{ color: t.danger, flex: 1, lineHeight: 24 }}>بعض منتجات السلة لم تعد منشورة في المتجر.</Txt>
              <Pressable accessibilityRole="button" style={s.remove} onPress={() => unavailableIds.forEach((id) => setQuantity(id, 0))}><Txt style={{ color: t.orange }}>إزالتها</Txt></Pressable>
            </View> : null}
            {items.map((product) => (
              <View key={product.id} style={s.item}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`تفاصيل ${product.name}`}
                  onPress={() => router.push(`/product/${product.id}`)}
                  style={[
                    s.image,
                    width < 390 ? { width: 78, height: 88 } : null,
                  ]}
                >
                  <ProductImage product={product} />
                </Pressable>
                <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
                  <Txt style={s.brand}>{product.brand}</Txt>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push(`/product/${product.id}`)}
                  >
                    <Txt weight="bold" style={{ fontSize: 16 }}>
                      {product.name}{product.variantLabel ? ` — ${product.variantLabel}` : ""}
                    </Txt>
                  </Pressable>
                  <Txt weight="bold" style={{ color: t.orange }}>
                    {formatPrice(product.price, settings.currency)}
                  </Txt>
                  {product.stock !== undefined ? <Txt style={{ color: cart[product.id] > product.stock ? t.danger : t.muted, fontSize: 12 }}>
                    {product.stock === 0 ? "نفدت الكمية. أزل المنتج للمتابعة." : `المتاح: ${product.stock} قطعة`}
                  </Txt> : null}
                  <View style={s.itemBottom}>
                    <View style={s.quantity}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`زيادة كمية ${product.name}`}
                        disabled={cart[product.id] >= Math.min(99, product.stock ?? 10)}
                        accessibilityState={{ disabled: cart[product.id] >= Math.min(99, product.stock ?? 10) }}
                        onPress={() =>
                          setQuantity(product.id, cart[product.id] + 1)
                        }
                        style={[
                          s.qtyButton,
                          cart[product.id] >= Math.min(99, product.stock ?? 10) ? { opacity: 0.3 } : null,
                        ]}
                      >
                        <Plus size={15} color={t.ink} />
                      </Pressable>
                      <Txt
                        weight="bold"
                        style={{ textAlign: "center", minWidth: 26 }}
                      >
                        {cart[product.id]}
                      </Txt>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`تقليل كمية ${product.name}`}
                        onPress={() =>
                          setQuantity(product.id, cart[product.id] - 1)
                        }
                        style={s.qtyButton}
                      >
                        <Minus size={15} color={t.ink} />
                      </Pressable>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`إزالة ${product.name} من السلة`}
                      onPress={() => setQuantity(product.id, 0)}
                      style={s.remove}
                    >
                      <Trash2 size={16} color={t.muted} />
                      <Txt style={{ fontSize: 12, color: t.muted }}>حذف</Txt>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate("/explore")}
              style={{ alignSelf: "flex-end", paddingVertical: 12 }}
            >
              <Txt weight="bold" style={{ color: t.orange }}>
                + تابع اكتشاف المنتجات
              </Txt>
            </Pressable>
          </View>
          <View style={[s.summary, wide ? { width: 305 } : { width: "100%" }]}>
            <View style={s.summaryTitle}>
              <ShoppingBag size={20} color={t.orange} />
              <Txt weight="bold" style={{ fontSize: 20 }}>
                ملخص السلة
              </Txt>
            </View>
            <TotalRow
              label={`المنتجات (${cartCount})`}
              value={formatPrice(subtotal, settings.currency)}
            />
            <TotalRow
              label="الشحن"
              value={shipping ? formatPrice(shipping, settings.currency) : "مجاني"}
            />
            <View style={s.divider} />
            <TotalRow
              label="المجموع"
              value={formatPrice(subtotal + shipping, settings.currency)}
              bold
            />
            <Button
              title={checkoutReady ? "متابعة إتمام الطلب" : "ربط الخادم لإتمام الطلب"}
              disabled={catalogStatus === "loading" || stockIssue || unavailableIds.length > 0}
              onPress={() => router.navigate(checkoutReady ? "/checkout" : "/connection")}
              style={{ marginTop: 14 }}
            />
            <Txt style={s.note}>
              {stockIssue ? "عدّل الكميات لتناسب المخزون المتاح قبل المتابعة." : "تُحدّد طريقة الدفع والعنوان والخصومات في الخطوة التالية."}
            </Txt>
          </View>
        </View>
      )}
    </Shell>
  );
}
function TotalRow({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.totalRow}>
      <Txt
        weight={bold ? "bold" : "regular"}
        style={{ color: bold ? t.ink : t.muted, fontSize: bold ? 18 : 14 }}
      >
        {label}
      </Txt>
      <Txt
        weight="bold"
        style={{ fontSize: bold ? 20 : 15, color: bold ? t.orange : t.ink }}
      >
        {value}
      </Txt>
    </View>
  );
}
const makeStyles = (t: Palette) => StyleSheet.create({
  layout: { alignItems: "stretch", gap: 25 },
  delivery: {
    backgroundColor: t.secondary,
    padding: 18,
    borderRadius: 16,
    flexDirection: "row-reverse",
    gap: 12,
    alignItems: "center",
  },
  item: {
    flexDirection: "row-reverse",
    gap: 16,
    padding: 17,
    backgroundColor: t.paper,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 18,
    alignItems: "center",
  },
  image: {
    width: 100,
    height: 110,
    borderRadius: 12,
    backgroundColor: t.imageBackground,
    overflow: "hidden",
  },
  brand: { color: t.muted, fontSize: 10, letterSpacing: 1.4 },
  itemBottom: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 5,
  },
  quantity: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 10,
  },
  qtyButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  remove: {
    flexDirection: "row-reverse",
    gap: 6,
    padding: 8,
    minHeight: 44,
    alignItems: "center",
  },
  summary: {
    backgroundColor: t.paper,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.line,
    alignSelf: "flex-start",
    gap: 18,
  },
  summaryTitle: {
    flexDirection: "row-reverse",
    gap: 10,
    alignItems: "center",
    marginBottom: 7,
  },
  totalRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
  },
  divider: { height: 1, backgroundColor: t.line },
  note: { fontSize: 12, color: t.muted, lineHeight: 22, textAlign: "center" },
});
