// Cart — reference design "سلة المشتريات"
import React, { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { ArrowLeft, ShoppingBasket, Ticket, Trash2 } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { Card, Chip, CTA, InfoNote, QtyStepper } from "../components/design/kit";
import { ProductImage } from "../components/ProductCard";
import { Companion } from "../components/character/Companion";
import { formatPrice } from "../data/products";
import { useStore } from "../lib/store";
import { useSession } from "../lib/session";
import { api } from "../lib/api";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";
import { DEMO_COUPON, cartSignatureOf } from "../lib/checkout";


export default function CartScreen() {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { cart, products, subtotal, setQuantity, settings, catalogStatus, hydrated, draft, updateDraft, notify } = useStore();
  const { user } = useSession();
  const [code, setCode] = useState(draft.coupon?.code || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const items = products.filter((p) => cart[p.id]);
  const missing = Object.keys(cart).filter((id) => !products.some((p) => p.id === id));
  const signature = cartSignatureOf(cart);
  const coupon = draft.coupon && draft.coupon.cartSignature === signature ? draft.coupon : undefined;
  const demo = catalogStatus !== "connected";

  async function applyCoupon() {
    setError(""); const value = code.trim().toUpperCase();
    if (!value) { setError("أدخل رمز الخصم"); return; }
    if (demo) {
      if (value === DEMO_COUPON.code) { updateDraft({ coupon: { code: value, discount: Math.min(DEMO_COUPON.discount, subtotal), cartSignature: signature } }); notify("طُبّق خصم تجريبي"); }
      else setError(`في الوضع التجريبي استخدم الرمز ${DEMO_COUPON.code}. الرموز الحقيقية تُتحقق من الخادم.`);
      return;
    }
    if (!user) { setError("سجّل الدخول للتحقق من رمز الخصم"); return; }
    setBusy(true);
    try {
      const r = await api.post<{ code: string; discount: number }>("/coupons/validate", { code: value, items: Object.entries(cart).map(([productId, quantity]) => ({ productId, quantity })) });
      updateDraft({ coupon: { code: r.code, discount: r.discount, cartSignature: signature } }); notify("طُبّق رمز الخصم");
    } catch (e) { updateDraft({ coupon: undefined }); setError(e instanceof Error ? e.message : "تعذّر تطبيق الرمز"); }
    finally { setBusy(false); }
  }

  return (
    <Shell title="سلة المشتريات" subtitle="مراجعة منتجاتك قبل إتمام الطلب">
      {!hydrated ? <Txt style={{ color: t.muted, textAlign: "center" }}>جارٍ استعادة سلتك…</Txt> : !items.length ? (
        <Card style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}>
          <ShoppingBasket size={46} color={t.orange} />
          <Txt weight="extra" style={{ fontSize: 22, color: t.title }}>سلتك فارغة</Txt>
          <Txt style={{ color: t.muted, textAlign: "center" }}>أضف منتجات من المتجر أو اطلب من المساعد تجهيز سلة لك.</Txt>
          {missing.length ? <Pressable accessibilityRole="button" onPress={() => missing.forEach((id) => setQuantity(id, 0))}><Txt style={{ color: t.orange }}>إزالة الأصناف غير المتاحة ({missing.length})</Txt></Pressable> : null}
          <CTA title="ابدأ التسوق" onPress={() => router.navigate("/explore")} style={{ alignSelf: "stretch" }} />
        </Card>
      ) : (
        <>
          <Card padded={false} testID="cart-items">
            {items.map((p, i) => {
              const max = Math.max(1, Math.min(99, p.stock ?? 99));
              const over = p.stock !== undefined && cart[p.id] > p.stock;
              return (
                <View key={p.id} style={[s.row, i > 0 && { borderTopWidth: 1, borderColor: t.line }]} testID={`cart-row-${p.id}`}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`تفاصيل ${p.name}`} onPress={() => router.push(`/product/${p.id}`)} style={s.image}><ProductImage product={p} /></Pressable>
                  <View style={{ flex: 1, alignItems: "flex-end", gap: 2 }}>
                    <Txt weight="bold" numberOfLines={2} style={{ fontSize: 17, color: t.title }}>{p.name}{p.variantLabel ? ` — ${p.variantLabel}` : ""}</Txt>
                    <Txt style={{ fontSize: 15, color: t.mutedSoft }}>{p.unit || p.subtitle}</Txt>
                    <Txt weight="bold" numberOfLines={1} style={{ fontSize: 17, color: t.orange }}>{formatPrice(p.price, settings.currency)}</Txt>
                    {over ? <Txt style={{ color: t.danger, fontSize: 12 }}>{p.stock === 0 ? "نفدت الكمية" : `المتاح ${p.stock} فقط`}</Txt> : null}
                  </View>
                  <QtyStepper size="sm" label={p.name} value={cart[p.id]} min={1} max={max} onChange={(v) => setQuantity(p.id, v)} />
                  <Pressable accessibilityRole="button" accessibilityLabel={`حذف ${p.name} من السلة`} testID={`cart-remove-${p.id}`} onPress={() => setQuantity(p.id, 0)} style={s.trash} hitSlop={8}>
                    <Trash2 size={26} color={t.orange} />
                  </Pressable>
                </View>
              );
            })}
          </Card>

          <Card style={{ marginTop: 14 }}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Ticket size={26} color={t.title} />
              <Txt weight="bold" style={{ fontSize: 19, color: t.title }}>رمز الخصم</Txt>
            </View>
            <View style={{ flexDirection: "row-reverse", gap: 10 }}>
              <TextInput testID="coupon-input" accessibilityLabel="رمز الخصم" value={code} onChangeText={(v) => { setCode(v); setError(""); }} autoCapitalize="characters" placeholder="أدخل رمز الخصم" placeholderTextColor={t.mutedSoft} style={s.couponInput} />
              <Pressable accessibilityRole="button" accessibilityLabel="تطبيق رمز الخصم" testID="coupon-apply" disabled={busy} onPress={() => void applyCoupon()} style={[s.apply, busy && { opacity: 0.6 }]}>
                <Txt weight="bold" style={{ color: t.onAccent, fontSize: 18 }}>{busy ? "…" : "تطبيق"}</Txt>
              </Pressable>
            </View>
            {error ? <Txt accessibilityRole="alert" style={{ color: t.danger, fontSize: 13, marginTop: 8 }}>{error}</Txt> : null}
            {coupon ? <Txt style={{ color: t.discount, fontSize: 14, marginTop: 8 }}>طُبّق {coupon.code}: خصم {formatPrice(coupon.discount, settings.currency)}</Txt> : null}
          </Card>

          <Card style={{ marginTop: 14 }}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
              <Txt weight="bold" style={{ fontSize: 19, color: t.title }}>المجموع الفرعي</Txt>
              {demo ? <Chip label="بيانات تجريبي" tone="demo" /> : null}
            </View>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
              <Txt weight="extra" style={{ fontSize: 30, color: t.orange }}>{formatPrice(Math.max(0, subtotal - (coupon?.discount || 0)), settings.currency)}</Txt>
              <InfoNote text="يُعاد التحقق عند التأكيد" />
            </View>
          </Card>

          <View style={s.ctaRow}>
            <Companion action="thumbs" base={108} enterFrom="right" />
            <View style={{ flex: 1 }}><CTA title="متابعة الشراء" testID="cart-continue" onPress={() => router.push("/delivery")} /></View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="مواصلة التسوق" onPress={() => router.navigate("/explore")} style={s.continue}>
            <Txt weight="medium" style={{ color: t.muted, fontSize: 18 }}>مواصلة التسوق</Txt>
            <ArrowLeft size={24} color={t.purple} />
          </Pressable>
        </>
      )}
    </Shell>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 10 },
  image: { width: 70, height: 84 },
  trash: { width: 36, height: 44, alignItems: "center", justifyContent: "center" },
  couponInput: { flex: 1, minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, paddingHorizontal: 14, fontFamily: "Tajawal_500Medium", fontSize: 16, color: t.ink, textAlign: "right" },
  apply: { width: "34%", minHeight: 54, borderRadius: 14, backgroundColor: t.orange, alignItems: "center", justifyContent: "center" },
  ctaRow: { flexDirection: "row-reverse", alignItems: "flex-end", gap: 2, marginTop: 12 },
  continue: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 48 },
});
