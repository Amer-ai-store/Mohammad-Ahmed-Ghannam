// "مراجعة الطلب" — server re-checks price & stock (branch aware) before the customer
// can confirm. Nothing is ordered without the explicit confirm button + terms checkbox.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ChevronLeft, Clock, CreditCard, MapPin, RefreshCw, ShoppingCart } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { BackSquare, BrandHeader, Card, Checkbox, CTA, ErrorBlock, IconCircle, LoadingBlock, SmallButton } from "../components/design/kit";
import { ProductImage } from "../components/ProductCard";
import { Companion } from "../components/character/Companion";
import { formatPrice, toArabicDigits } from "../data/products";
import { useStore } from "../lib/store";
import { useSession } from "../lib/session";
import { ApiError } from "../lib/api";
import { canConfirmOrder, cartSignatureOf, computeTotals, newIdempotencyKey } from "../lib/checkout";
import { deliverySlots, type CartCheck } from "../lib/commerce-types";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";

function SummaryCard({ icon, title, lines, action, onPress, testID }: { icon: typeof MapPin; title: string; lines: string[]; action: string; onPress: () => void; testID?: string }) {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  return (
    <Card style={s.summary} testID={testID}>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <Txt weight="bold" style={{ fontSize: 19, color: t.title }}>{title}</Txt>
        {lines.map((l, i) => <Txt key={i} style={{ fontSize: 15, color: t.muted, marginTop: 3 }}>{l}</Txt>)}
      </View>
      <View style={{ alignItems: "center", gap: 10 }}>
        <IconCircle icon={icon} tint={t.title} size={52} />
        <Pressable accessibilityRole="button" accessibilityLabel={`${action} ${title}`} onPress={onPress} style={s.action}>
          <Txt weight="medium" style={{ color: t.orange, fontSize: 15 }}>{action}</Txt><ChevronLeft size={18} color={t.orange} />
        </Pressable>
      </View>
    </Card>
  );
}

export default function Checkout() {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const store = useStore();
  const { cart, products, settings, catalogStatus, draft, checkCart, submitOrder, createDemoOrder, setQuantity, branches, branchId } = store;
  const { user, configured } = useSession();
  const demo = catalogStatus !== "connected";
  const [check, setCheck] = useState<CartCheck | null>(null);
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState("");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const idempotency = useRef("");
  const items = products.filter((p) => cart[p.id]);
  const signature = cartSignatureOf(cart);
  const coupon = draft.coupon && draft.coupon.cartSignature === signature ? draft.coupon : undefined;
  const runCheck = useCallback(async () => {
    setChecking(true); setCheckError("");
    try { setCheck(await checkCart()); } catch (e) { setCheck(null); setCheckError(e instanceof Error ? e.message : "تعذّر التحقق من السلة"); }
    finally { setChecking(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, branchId, catalogStatus]);
  useEffect(() => { const timer = setTimeout(() => { void runCheck(); }, 0); return () => clearTimeout(timer); }, [runCheck]);
  useEffect(() => { idempotency.current = newIdempotencyKey(); }, [signature, draft.address, draft.payment]);

  const base = check ? check.subtotal : store.subtotal;
  const totals = computeTotals(base, coupon?.discount || 0, settings.shippingFee, settings.freeShippingThreshold);
  const slot = deliverySlots.find((d) => d.id === draft.slot) || deliverySlots[1];
  const paymentLabel = draft.payment === "card" ? "بطاقة ائتمان / خصم" : draft.payment === "wallet" ? "رصيد المتجر" : "الدفع عند الاستلام";
  const paymentSupported = draft.payment !== "card" || demo;
  const gate = canConfirmOrder({ termsAccepted: terms, hasAddress: !!draft.address, cartChecked: !!check && !checking, cartOk: !!check?.ok, paymentSupported, busy });
  const needsAccount = !demo && (!configured || !user);

  async function confirm() {
    setError("");
    if (!gate.ok || !draft.address) { setError(gate.reason || "أكمل البيانات"); return; }
    if (!idempotency.current) idempotency.current = newIdempotencyKey();
    if (demo) {
      const order = createDemoOrder({ address: draft.address, payment: draft.payment, slot: draft.slot, discount: totals.discount });
      router.replace(`/tracking/${order.id}`);
      return;
    }
    setBusy(true);
    try {
      const order = await submitOrder({ address: draft.address, paymentMethod: draft.payment === "wallet" ? "wallet" : "cod", couponCode: coupon?.code, idempotencyKey: idempotency.current, expectedSubtotal: check?.subtotal, deliverySlot: draft.slot });
      router.replace(`/tracking/${order.id}`);
    } catch (e) {
      if (e instanceof ApiError && (e.code === "price_changed" || e.code === "out_of_stock" || e.code === "product_unavailable")) { setTerms(false); void runCheck(); }
      setError(e instanceof Error ? e.message : "تعذّر تأكيد الطلب. لم يُنشأ أي طلب.");
    } finally { setBusy(false); }
  }
  function applyAvailability() {
    if (!check) return;
    for (const l of check.lines) if (l.available < l.quantity) setQuantity(l.productId, l.available);
    void runCheck();
  }
  if (!items.length) return (
    <Shell header={<BrandHeader left={<BackSquare />} />} title="مراجعة الطلب" subtitle="سلتك فارغة.">
      <CTA title="العودة إلى المتجر" onPress={() => router.navigate("/explore")} />
    </Shell>
  );
  return (
    <Shell header={<BrandHeader left={<BackSquare />} />} title="مراجعة الطلب" subtitle="تأكد من تفاصيل طلبك قبل المتابعة." side={<Companion action="think" base={110} enterFrom="right" />}>
      <SummaryCard icon={MapPin} title="عنوان التوصيل" testID="review-address" action={draft.address ? "تعديل" : "إضافة"} onPress={() => router.push("/delivery")}
        lines={draft.address ? [draft.address.street, `${draft.address.city}، الأردن`] : ["لم يُحدد عنوان بعد"]} />
      <SummaryCard icon={Clock} title="وقت التوصيل" action="اختيار" onPress={() => router.push("/delivery")} lines={[`اليوم، ${slot.label} ${toArabicDigits(slot.time)}`]} />
      <SummaryCard icon={CreditCard} title="طريقة الدفع" action="تغيير" onPress={() => router.push("/payment")} lines={[paymentLabel, ...(draft.payment === "card" && draft.cardLast4 ? [`**** ${draft.cardLast4}`] : [])]} />

      <Card style={{ marginTop: 12 }}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingBottom: 10, borderBottomWidth: 1, borderColor: t.line }}>
          <ShoppingCart size={24} color={t.orange} /><Txt weight="bold" style={{ fontSize: 19, color: t.title }}>ملخص الطلب</Txt>
          <View style={{ flex: 1 }} />
          <Pressable accessibilityRole="button" accessibilityLabel="إعادة التحقق من الأسعار والمخزون" onPress={() => void runCheck()} hitSlop={8}><RefreshCw size={20} color={t.muted} /></Pressable>
        </View>
        {items.map((p) => {
          const line = check?.lines.find((l) => l.productId === p.id);
          return (
            <View key={p.id} style={s.item}>
              <View style={{ width: 64, height: 70 }}><ProductImage product={p} /></View>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Txt weight="bold" style={{ fontSize: 17, color: t.title }}>{p.name}</Txt>
                <Txt style={{ color: t.muted, fontSize: 14 }}>{p.unit || p.subtitle} × {toArabicDigits(String(cart[p.id]))}</Txt>
                {line && !line.ok ? <Txt style={{ color: t.danger, fontSize: 12 }}>المتاح {toArabicDigits(String(line.available))} فقط</Txt> : null}
              </View>
              <Txt weight="bold" style={{ color: t.orange, fontSize: 17 }}>{formatPrice((line?.price ?? p.price) * cart[p.id], settings.currency)}</Txt>
            </View>
          );
        })}
        {checking ? <LoadingBlock label={demo ? "التحقق من السلة التجريبية…" : "يتحقق الخادم من الأسعار والمخزون…"} /> : checkError ? <ErrorBlock message={checkError} onRetry={() => void runCheck()} /> : check && !check.ok ? (
          <View style={s.issues} accessibilityRole="alert">
            <Txt weight="bold" style={{ color: t.danger }}>تغيّرت بيانات بعض المنتجات منذ إضافتها:</Txt>
            {check.issues.map((i, k) => <Txt key={k} style={{ color: t.ink, fontSize: 13 }}>• {products.find((p) => p.id === i.productId)?.name || i.productId}: {i.code === "price_changed" ? `السعر أصبح ${formatPrice(i.to || 0, settings.currency)}` : i.code === "insufficient_stock" ? `المتاح ${i.available ?? 0} فقط${branches.find((b) => b.id === branchId) ? ` في ${branches.find((b) => b.id === branchId)?.name}` : ""}` : "لم يعد متاحًا"}</Txt>)}
            <SmallButton title="تحديث السلة بالمتاح" tone="soft" onPress={applyAvailability} style={{ alignSelf: "flex-end" }} />
          </View>
        ) : null}
        <View style={s.line}><Txt style={s.label}>مجموع المنتجات</Txt><Txt style={s.value}>{formatPrice(totals.subtotal, settings.currency)}</Txt></View>
        {totals.discount ? <View style={s.line}><Txt style={s.label}>الخصم ({coupon?.code})</Txt><Txt style={[s.value, { color: t.discount }]}>- {formatPrice(totals.discount, settings.currency)}</Txt></View> : null}
        <View style={s.line}><Txt style={s.label}>رسوم التوصيل</Txt><Txt style={s.value}>{formatPrice(totals.shipping, settings.currency)}</Txt></View>
        <View style={s.total}><Txt weight="bold" style={{ fontSize: 19, color: t.title }}>المجموع</Txt><Txt weight="extra" style={{ fontSize: 26, color: t.orange }}>{formatPrice(totals.total, settings.currency)}</Txt></View>
        <Txt style={{ color: t.muted, fontSize: 13, marginTop: 6, textAlign: "left" }}>{demo ? "مثال شامل الرسوم" : check?.source === "server" ? "تحقق الخادم من السعر والمخزون" : ""}</Txt>
      </Card>

      {needsAccount ? (
        <Card style={{ marginTop: 12, gap: 10 }}>
          <Txt style={{ color: t.ink }}>سجّل الدخول لإنشاء طلب حقيقي محفوظ على الخادم.</Txt>
          <View style={{ flexDirection: "row-reverse", gap: 10 }}><SmallButton title="تسجيل الدخول" onPress={() => router.push("/login")} /><SmallButton title="إنشاء حساب" tone="outline" onPress={() => router.push("/register")} /></View>
        </Card>
      ) : null}
      <Card style={{ marginTop: 12, paddingVertical: 8 }}>
        <Checkbox checked={terms} onChange={setTerms} testID="terms" label={<Txt style={{ fontSize: 15, color: t.ink }}>أوافق على <Txt style={{ color: t.orange, fontSize: 15 }} onPress={() => router.push("/terms")}>الشروط والأحكام</Txt> الخاصة بـ Amer AI Store.</Txt>} />
      </Card>
      {error ? <Txt accessibilityRole="alert" style={{ color: t.danger, marginTop: 10 }}>{error}</Txt> : null}
      {!gate.ok && !busy && !checking ? <Txt style={{ color: t.muted, fontSize: 13, marginTop: 8, textAlign: "center" }}>{gate.reason}</Txt> : null}
      <CTA title={demo ? "تأكيد الطلب التجريبي" : "تأكيد الطلب"} testID="confirm-order" busy={busy} disabled={!gate.ok || needsAccount} onPress={() => void confirm()} style={{ marginTop: 12 }} />
    </Shell>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  summary: { flexDirection: "row-reverse", alignItems: "center", marginTop: 10, gap: 12 },
  action: { flexDirection: "row-reverse", alignItems: "center", gap: 4, minHeight: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: t.orangeSoft },
  item: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: t.line },
  issues: { backgroundColor: t.orangeSoft, borderRadius: 14, padding: 12, gap: 6, marginTop: 10 },
  line: { flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 8 },
  label: { color: t.muted, fontSize: 16 },
  value: { color: t.title, fontSize: 16 },
  total: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", backgroundColor: t.orangeSoft, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginTop: 4 },
});
