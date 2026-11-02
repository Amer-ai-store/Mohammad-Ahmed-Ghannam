// "طريقة الدفع" — card (demo only, never stored or sent), cash on delivery, store balance.
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Calendar, CreditCard, Info, Lock, Package, Plus, Wallet } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { BackPill, BrandHeader, Card, CTA, RadioDot } from "../components/design/kit";
import { Companion } from "../components/character/Companion";
import { formatPrice, toArabicDigits } from "../data/products";
import { useStore } from "../lib/store";
import { useSession } from "../lib/session";
import { api } from "../lib/api";
import { cartSignatureOf, computeTotals, expiryValid, formatCardNumber, luhnValid } from "../lib/checkout";
import type { PaymentChoice } from "../lib/commerce-types";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";

export default function Payment() {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { draft, updateDraft, subtotal, settings, catalogStatus, cart } = useStore();
  const { user } = useSession();
  const demo = catalogStatus !== "connected";
  const [method, setMethod] = useState<PaymentChoice>(draft.payment);
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardAdded, setCardAdded] = useState(Boolean(draft.cardLast4));
  const [error, setError] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => { if (user && !demo) api.get<{ balance: number }>("/wallet").then((r) => setBalance(r.balance)).catch(() => setBalance(null)); }, [user, demo]);
  const coupon = draft.coupon && draft.coupon.cartSignature === cartSignatureOf(cart) ? draft.coupon : undefined;
  const totals = computeTotals(subtotal, coupon?.discount || 0, settings.shippingFee, settings.freeShippingThreshold);
  const cardAllowed = demo; // no payment gateway is connected: card payments are demo-only
  const options: { id: PaymentChoice; label: string; icon: typeof CreditCard }[] = [
    { id: "card", label: "بطاقة بنكية", icon: CreditCard },
    { id: "cod", label: "الدفع عند الاستلام", icon: Package },
    { id: "wallet", label: "رصيد المتجر", icon: Wallet },
  ];
  function addCard() {
    setError("");
    if (!luhnValid(number)) return setError("رقم البطاقة غير صحيح");
    if (!expiryValid(expiry)) return setError("تاريخ الانتهاء غير صالح");
    if (!/^\d{3,4}$/.test(cvv)) return setError("رمز الأمان غير صالح");
    // Only the last 4 digits are kept in memory for the review screen. Nothing is saved or sent.
    updateDraft({ cardLast4: number.replace(/\D/g, "").slice(-4) });
    setCardAdded(true); setNumber(""); setCvv(""); setExpiry("");
  }
  function next() {
    setError("");
    if (method === "card" && !cardAllowed) return setError("الدفع بالبطاقة يحتاج ربط بوابة دفع مرخّصة، وهو غير مفعّل بعد. اختر الدفع عند الاستلام أو رصيد المتجر.");
    if (method === "card" && !cardAdded) return setError("أضف بيانات البطاقة التجريبية أولًا");
    if (method === "wallet" && !demo && (!user || balance === null || balance < totals.total)) return setError(!user ? "سجّل الدخول لاستخدام رصيد المتجر" : "رصيد المتجر غير كافٍ لهذا الطلب");
    updateDraft({ payment: method });
    router.push("/checkout");
  }
  return (
    <Shell header={<BrandHeader left={<BackPill />} />} title="طريقة الدفع" subtitle="اختر طريقة الدفع المناسبة لك." side={<Companion action="thumbs" base={96} enterFrom="right" />}>
      <View style={s.options}>
        {options.map((o) => {
          const active = o.id === method;
          return (
            <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ checked: active }} accessibilityLabel={o.label} testID={`pay-${o.id}`} onPress={() => { setMethod(o.id); setError(""); }} style={[s.option, active && s.optionActive]}>
              <o.icon size={34} color={o.id === "cod" ? t.purple : t.title} />
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 8 }}>
                <RadioDot selected={active} />
                <Txt weight="bold" style={{ fontSize: 14, color: t.title, flexShrink: 1, textAlign: "center" }}>{o.label}</Txt>
              </View>
            </Pressable>
          );
        })}
      </View>

      {method === "card" ? (
        <Card style={{ marginTop: 14 }}>
          <Txt weight="bold" style={{ fontSize: 19, color: t.title }}>تفاصيل البطاقة</Txt>
          <LinearGradient colors={["#8E7BC9", "#6E5BB0"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cardVisual}>
            <View style={s.chip} />
            <Txt weight="bold" style={{ color: "#fff", fontSize: 20, letterSpacing: 3, textAlign: "left", writingDirection: "ltr" }}>{cardAdded && draft.cardLast4 ? `•••• •••• •••• ${draft.cardLast4}` : "•••• •••• •••• ••••"}</Txt>
            <Txt style={{ color: "#fff", fontSize: 14, textAlign: "left", writingDirection: "ltr" }}>MM/YY</Txt>
          </LinearGradient>
          {!cardAllowed ? <View style={s.warn}><Info size={18} color={t.warn} /><Txt style={{ color: t.warn, fontSize: 13, flex: 1 }}>بوابة الدفع غير مربوطة بعد؛ لا يمكن قبول البطاقات في الطلبات الحقيقية.</Txt></View> : null}
          <View style={s.input}><CreditCard size={24} color={t.title} /><Txt style={s.inputLabel}>رقم البطاقة</Txt>
            <TextInput testID="card-number" accessibilityLabel="رقم البطاقة" editable={cardAllowed} value={number} onChangeText={(v) => setNumber(formatCardNumber(v))} keyboardType="number-pad" placeholder="•••• •••• •••• ••••" placeholderTextColor={t.mutedSoft} style={s.inputField} autoComplete="off" importantForAutofill="no" secureTextEntry={false} maxLength={23} />
          </View>
          <View style={{ flexDirection: "row-reverse", gap: 10 }}>
            <View style={[s.input, { flex: 1 }]}><Lock size={22} color={t.title} /><Txt style={s.inputLabel}>(CVV)</Txt>
              <TextInput accessibilityLabel="رمز الأمان CVV" editable={cardAllowed} value={cvv} onChangeText={(v) => setCvv(v.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" placeholder="•••" placeholderTextColor={t.mutedSoft} secureTextEntry style={s.inputField} autoComplete="off" importantForAutofill="no" />
            </View>
            <View style={[s.input, { flex: 1 }]}><Calendar size={22} color={t.title} />
              <TextInput accessibilityLabel="تاريخ الانتهاء" editable={cardAllowed} value={expiry} onChangeText={(v) => { const d = v.replace(/\D/g, "").slice(0, 4); setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d); }} keyboardType="number-pad" placeholder="MM / YY" placeholderTextColor={t.mutedSoft} style={s.inputField} />
            </View>
          </View>
          {cardAllowed ? <Pressable accessibilityRole="button" accessibilityLabel="تعبئة بطاقة اختبار" testID="card-sandbox" onPress={() => { setNumber(formatCardNumber("4242424242424242")); setExpiry("12/30"); setCvv("123"); }} style={{ alignSelf: "flex-start", paddingVertical: 8 }}>
            <Txt style={{ color: t.purple, fontSize: 14 }}>تعبئة بطاقة اختبار (4242…) — للوضع التجريبي فقط</Txt>
          </Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="إضافة بطاقة" testID="card-add" disabled={!cardAllowed} onPress={addCard} style={[s.addCard, !cardAllowed && { opacity: 0.45 }]}>
            <Txt weight="medium" style={{ color: t.orange, fontSize: 16 }}>{cardAdded ? "تم إضافة البطاقة — استبدال" : "إضافة بطاقة"}</Txt><Plus size={22} color={t.orange} />
          </Pressable>
        </Card>
      ) : method === "wallet" ? (
        <Card style={{ marginTop: 14 }}>
          <Txt weight="bold" style={{ fontSize: 18, color: t.title }}>رصيد المتجر</Txt>
          <Txt style={{ color: t.muted, marginTop: 6 }}>{demo ? "في الوضع التجريبي لا يُخصم أي رصيد." : balance === null ? (user ? "جارٍ تحميل الرصيد…" : "سجّل الدخول لعرض رصيدك.") : `رصيدك الحالي: ${formatPrice(balance, settings.currency)}`}</Txt>
        </Card>
      ) : (
        <Card style={{ marginTop: 14 }}>
          <Txt weight="bold" style={{ fontSize: 18, color: t.title }}>الدفع عند الاستلام</Txt>
          <Txt style={{ color: t.muted, marginTop: 6 }}>تدفع نقدًا عند استلام الطلب. لا يُحصّل أي مبلغ إلكترونيًا.</Txt>
        </Card>
      )}

      <Card style={{ marginTop: 14 }}>
        <Txt weight="bold" style={{ fontSize: 19, color: t.title, marginBottom: 6 }}>ملخص الطلب</Txt>
        <View style={s.sumRow}><Txt style={s.sumLabel}>المجموع الفرعي</Txt><Txt style={s.sumValue}>{formatPrice(totals.subtotal, settings.currency)}</Txt></View>
        <View style={s.sumRow}><Txt style={s.sumLabel}>كود الخصم</Txt><Txt style={[s.sumValue, { color: t.discount }]}>{totals.discount ? `- ${formatPrice(totals.discount, settings.currency)}` : formatPrice(0, settings.currency)}</Txt></View>
        <View style={s.sumRow}><Txt style={s.sumLabel}>رسوم التوصيل</Txt><Txt style={s.sumValue}>{formatPrice(totals.shipping, settings.currency)}</Txt></View>
        <View style={s.totalBox}>
          <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
            <Txt weight="bold" style={{ fontSize: 18, color: t.title }}>المجموع الكلي</Txt>
            <Txt weight="extra" style={{ fontSize: 28, color: t.orange }}>{formatPrice(totals.total, settings.currency)}</Txt>
          </View>
          {demo ? <View style={s.demoChip}><Info size={16} color={t.warn} /><Txt style={{ color: t.warn, fontSize: 13 }}>وضع تجريبي — لا خصم فعلي</Txt></View> : null}
        </View>
      </Card>
      {error ? <Txt accessibilityRole="alert" style={{ color: t.danger, marginTop: 10 }}>{error}</Txt> : null}
      <CTA title={demo ? "متابعة الدفع التجريبي" : "متابعة"} testID="payment-next" onPress={next} style={{ marginTop: 14 }} />
      <Txt style={{ color: t.mutedSoft, fontSize: 11, textAlign: "center", marginTop: 8 }}>{toArabicDigits("لا تُحفظ بيانات البطاقة ولا تُرسل إلى أي خادم في هذه النسخة.")}</Txt>
    </Shell>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  options: { flexDirection: "row-reverse", gap: 10 },
  option: { flex: 1, minHeight: 116, borderRadius: 22, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, alignItems: "center", justifyContent: "center", padding: 8 },
  optionActive: { borderColor: t.orange, backgroundColor: t.orangeSoft },
  cardVisual: { height: 168, borderRadius: 22, padding: 20, justifyContent: "space-between", marginVertical: 14, marginHorizontal: 24 },
  chip: { width: 44, height: 34, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.55)" },
  warn: { flexDirection: "row-reverse", alignItems: "center", gap: 6, backgroundColor: t.warnSoft, borderRadius: 12, padding: 10, marginBottom: 10 },
  input: { flexDirection: "row-reverse", alignItems: "center", gap: 10, minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, paddingHorizontal: 14, marginBottom: 10 },
  inputLabel: { color: t.muted, fontSize: 15 },
  inputField: { flex: 1, fontFamily: "IBMPlexSansArabic_500Medium", fontSize: 16, color: t.ink, textAlign: "left", writingDirection: "ltr", minHeight: 48 },
  addCard: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 54, borderRadius: 18, borderWidth: 1.5, borderColor: t.orange, backgroundColor: t.orangeSoft },
  sumRow: { flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 10, borderTopWidth: 1, borderColor: t.line },
  sumLabel: { color: t.muted, fontSize: 16 },
  sumValue: { color: t.title, fontSize: 16 },
  totalBox: { backgroundColor: t.orangeSoft, borderRadius: 16, padding: 14, marginTop: 6, gap: 8 },
  demoChip: { flexDirection: "row-reverse", alignItems: "center", gap: 6, alignSelf: "flex-end", backgroundColor: t.warnSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
});
