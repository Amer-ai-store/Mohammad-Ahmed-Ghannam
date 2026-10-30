import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Check, MapPin, Package, RotateCcw } from "lucide-react-native";
import { Shell } from "../../components/Shell";
import { Button, Txt } from "../../components/ui";
import { formatPrice } from "../../data/products";
import { api } from "../../lib/api";
import { CommerceOrder, orderLabels } from "../../lib/commerce-types";
import { useSession } from "../../lib/session";
import { useStore } from "../../lib/store";
import { Palette, useTheme, useThemedStyles } from "../../lib/theme";

const paymentLabels: Record<string, string> = {
  unpaid: "بانتظار التحصيل", pending: "بانتظار التحصيل", due: "بانتظار التحصيل",
  paid: "مدفوع من الرصيد", collected: "تم التحصيل", refunded: "أُعيد إلى رصيد المتجر", cancelled: "أُلغي التحصيل",
};

export default function OrderScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user, configured, hydrated, baseUrl } = useSession();
  const { refreshOrders, refreshCatalog, reorder, settings } = useStore();
  const { colors: t } = useTheme();
  const s = useThemedStyles(styles);
  const [order, setOrder] = useState<CommerceOrder | null>(null);
  const [loadedFor, setLoadedFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"cancel" | "return" | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [returnForm, setReturnForm] = useState(false);
  const [reason, setReason] = useState("");
  const [returnSubmitted, setReturnSubmitted] = useState(false);
  const version = useRef(0);
  const identity = `${baseUrl}:${user?.id || ""}:${id || ""}`;
  const identityRef = useRef(identity);
  useEffect(() => { identityRef.current = identity; }, [identity]);

  const load = useCallback(async () => {
    const current = ++version.current;
    if (!id || !user || !configured) return;
    setLoading(true); setError("");
    try {
      const result = await api.get<{ order: CommerceOrder }>(`/orders/${encodeURIComponent(id)}`);
      if (current === version.current) { setOrder(result.order); setLoadedFor(`${baseUrl}:${user.id}:${id}`); }
    } catch (failure) {
      if (current === version.current) setError(failure instanceof Error ? failure.message : "تعذّر تحميل تفاصيل الطلب");
    } finally { if (current === version.current) setLoading(false); }
  }, [id, user, configured, baseUrl]);
  useFocusEffect(useCallback(() => {
    setNotice(""); setConfirmCancel(false); setReturnForm(false); setReturnSubmitted(false); setReason("");
    void load();
    return () => { version.current++; };
  }, [load]));

  const cancel = async () => {
    if (!id || busy) return;
    const actionIdentity = identity;
    setBusy("cancel"); setError(""); setNotice("");
    try {
      const result = await api.post<{ order?: CommerceOrder }>(`/orders/${encodeURIComponent(id)}/cancel`);
      if (identityRef.current !== actionIdentity) return;
      if (result.order) setOrder(result.order);
      setConfirmCancel(false);
      setNotice("أُلغي الطلب على الخادم. أُعيد المخزون وأي مبلغ مستحق من المحفظة الداخلية حسب حالة الدفع.");
      await load();
      await Promise.allSettled([refreshOrders(), refreshCatalog()]);
    } catch (failure) {
      if (identityRef.current === actionIdentity) setError(failure instanceof Error ? failure.message : "تعذّر إلغاء الطلب");
    } finally { if (identityRef.current === actionIdentity) setBusy(""); }
  };
  const requestReturn = async () => {
    if (!id || busy) return;
    if (reason.trim().length < 5) { setError("اكتب سبب الإرجاع في خمس حروف على الأقل."); return; }
    const actionIdentity = identity;
    setBusy("return"); setError(""); setNotice("");
    try {
      await api.post(`/orders/${encodeURIComponent(id)}/returns`, { reason: reason.trim() });
      if (identityRef.current !== actionIdentity) return;
      setReturnSubmitted(true); setReturnForm(false); setReason("");
      setNotice("تم حفظ طلب الإرجاع على الخادم وهو بانتظار مراجعة المتجر. لم يُنفذ استرداد بمجرد إرسال الطلب.");
    } catch (failure) {
      if (identityRef.current === actionIdentity) setError(failure instanceof Error ? failure.message : "تعذّر إرسال طلب الإرجاع");
    } finally { if (identityRef.current === actionIdentity) setBusy(""); }
  };
  const ready = order && loadedFor === identity;

  return (
    <Shell title="تفاصيل الطلب" subtitle="تفاصيل الطلب المسجلة وقت الشراء وتحديثات المتجر.">
      <View style={s.page}>
        {!hydrated ? <ActivityIndicator color={t.orange} /> : !configured ? (
          <View style={s.card}><Txt>اربط خادم المتجر لعرض تفاصيل الطلب.</Txt><Button title="إعداد اتصال الخادم" onPress={() => router.push("/connection")} /></View>
        ) : !user ? (
          <View style={s.card}><Txt>تحتاج إلى تسجيل الدخول بحساب صاحب الطلب.</Txt><Button title="تسجيل الدخول" onPress={() => router.push("/login")} /></View>
        ) : <>
          <View style={s.actions}>
            <Button title="كل الطلبات" secondary onPress={() => router.push("/orders")} />
            <Button title="تحديث التفاصيل" secondary busy={loading} disabled={Boolean(busy)} onPress={() => { void load(); }} />
          </View>
          {error ? <View style={s.error}><Txt accessibilityRole="alert" style={{ color: t.danger }}>{error}</Txt></View> : null}
          {notice ? <View style={s.notice}><Txt accessibilityRole="alert" style={{ color: t.green, lineHeight: 26 }}>{notice}</Txt></View> : null}
          {!ready ? loading ? <ActivityIndicator color={t.orange} style={{ padding: 35 }} /> : null : <>
            <View style={s.card}>
              <View style={s.row}>
                <Package color={t.orange} size={26} />
                <View style={{ flex: 1, gap: 7 }}><Txt weight="extra" selectable style={s.title}>{order.id}</Txt><Txt style={s.muted}>{new Date(order.date).toLocaleString("ar")}</Txt></View>
                <View style={s.badge}><Txt weight="bold" style={{ color: order.status === "cancelled" ? t.danger : t.green }}>{orderLabels[order.status] || order.status}</Txt></View>
              </View>
              <Txt style={s.muted}>{order.paymentMethod === "cod" ? "الدفع عند الاستلام" : "الدفع من محفظة المتجر"} · {paymentLabels[order.paymentStatus] || order.paymentStatus}</Txt>
              {order.items.map((item, index) => (
                <Pressable key={`${item.productId}-${index}`} accessibilityRole="button" accessibilityLabel={`المنتج ${item.name}`} style={s.item} onPress={() => router.push(`/product/${encodeURIComponent(item.productId)}`)}>
                  <View style={{ flex: 1, gap: 5 }}><Txt weight="bold">{item.name}</Txt><Txt style={s.muted}>{formatPrice(item.price, order.currency)} × {item.quantity}</Txt></View>
                  <Txt weight="bold">{formatPrice(item.price * item.quantity, order.currency)}</Txt>
                </Pressable>
              ))}
              <View style={s.totals}>
                <View style={s.between}><Txt style={s.muted}>المنتجات</Txt><Txt>{formatPrice(order.subtotal, order.currency)}</Txt></View>
                <View style={s.between}><Txt style={s.muted}>الخصم</Txt><Txt style={{ color: t.green }}>− {formatPrice(order.discount || 0, order.currency)}</Txt></View>
                <View style={s.between}><Txt style={s.muted}>التوصيل</Txt><Txt>{formatPrice(order.shipping, order.currency)}</Txt></View>
                <View style={s.between}><Txt weight="bold">الإجمالي المسجل</Txt><Txt weight="extra" style={{ color: t.orange, fontSize: 24 }}>{formatPrice(order.total, order.currency)}</Txt></View>
              </View>
              <Button title="إعادة شراء المنتجات المتوفرة" secondary onPress={() => { reorder(order); router.push("/cart"); }} />
              <Txt style={s.small}>إعادة الشراء تستخدم الأسعار والكميات المتوفرة حاليًا، وقد تختلف عن هذا الطلب.</Txt>
            </View>
            <View style={s.card}>
              <View style={s.row}><MapPin color={t.orange} size={23} /><Txt weight="bold" style={s.title}>عنوان التسليم</Txt></View>
              <Txt>{order.address.name} · {order.address.phone}</Txt>
              <Txt style={s.muted}>{order.address.city}، {order.address.street}</Txt>
              {order.status !== "cancelled" ? <Button title="خريطة وتتبع التوصيل" onPress={() => router.push(`/tracking/${encodeURIComponent(order.id)}`)} /> : null}
            </View>
            <View style={s.card}>
              <Txt weight="bold" style={s.title}>سجل حالة الطلب</Txt>
              {order.events?.length ? order.events.map((event, index) => {
                const time = (event as typeof event & { at?: string }).at || event.createdAt || event.date;
                return <View key={`${event.status}-${index}`} style={s.event}>
                  <View style={s.dot}><Check size={13} color={t.green} /></View>
                  <View style={{ flex: 1, gap: 6 }}><Txt weight="bold">{orderLabels[event.status] || event.status}</Txt>{event.note ? <Txt style={s.muted}>{event.note}</Txt> : null}{time ? <Txt style={s.small}>{new Date(time).toLocaleString("ar")}</Txt> : null}</View>
                </View>;
              }) : <Txt style={s.muted}>الحالة الحالية: {orderLabels[order.status] || order.status}</Txt>}
            </View>
            {order.status === "pending" || order.status === "confirmed" ? <View style={s.card}>
              <Txt weight="bold">إلغاء الطلب</Txt>
              <Txt style={s.muted}>يمكن الإلغاء قبل بدء التجهيز. يتحقق الخادم من الحالة ويعالج المخزون والرصيد مرة واحدة.</Txt>
              {!confirmCancel ? <Button title="طلب إلغاء الطلب" secondary disabled={Boolean(busy)} onPress={() => setConfirmCancel(true)} /> : <>
                <Txt style={{ color: t.danger }}>هل تريد إلغاء هذا الطلب كاملًا؟</Txt>
                <View style={s.actions}><Button title="تأكيد الإلغاء" busy={busy === "cancel"} onPress={() => { void cancel(); }} style={{ backgroundColor: t.danger }} /><Button title="الاحتفاظ بالطلب" secondary disabled={Boolean(busy)} onPress={() => setConfirmCancel(false)} /></View>
              </>}
            </View> : null}
            {order.status === "delivered" ? <View style={s.card}>
              <View style={s.row}><RotateCcw color={t.orange} size={23} /><Txt weight="bold" style={s.title}>الإرجاع</Txt></View>
              <Txt style={s.muted}>مهلة الإرجاع {settings.returnsDays} يومًا من التسليم. يشمل طلب الإرجاع هنا جميع عناصر الطلب، ويخضع للمراجعة.</Txt>
              {returnForm ? <>
                <Txt weight="bold">سبب الإرجاع</Txt>
                <TextInput accessibilityLabel="سبب إرجاع الطلب" placeholder="اشرح سبب طلب الإرجاع" placeholderTextColor={t.muted} value={reason} onChangeText={setReason} maxLength={1000} multiline textAlignVertical="top" style={s.input} />
                <Button title="إرسال طلب الإرجاع" busy={busy === "return"} onPress={() => { void requestReturn(); }} />
                <Button title="إغلاق نموذج الإرجاع" secondary disabled={Boolean(busy)} onPress={() => setReturnForm(false)} />
              </> : !returnSubmitted ? <Button title="إنشاء طلب إرجاع" secondary disabled={Boolean(busy)} onPress={() => setReturnForm(true)} /> : null}
              <Button title="متابعة طلبات الإرجاع" secondary onPress={() => router.push("/returns")} />
              <Txt style={s.small}>عند قبول الإرجاع يُسجل المبلغ المستحق في محفظة المتجر الداخلية. لا توجد بوابة بطاقات أو تحويل بنكي مفعّلة في هذه النسخة.</Txt>
            </View> : null}
          </>}
        </>}
      </View>
    </Shell>
  );
}

const styles = (t: Palette) => StyleSheet.create({
  page: { maxWidth: 850, width: "100%", alignSelf: "center", gap: 18 },
  card: { padding: 22, gap: 18, borderRadius: 20, borderWidth: 1, borderColor: t.line, backgroundColor: t.paper },
  title: { fontSize: 21 },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 12, flexWrap: "wrap" },
  muted: { color: t.muted, lineHeight: 25 },
  small: { color: t.muted, fontSize: 12, lineHeight: 22 },
  badge: { padding: 10, borderRadius: 10, backgroundColor: t.secondary },
  item: { flexDirection: "row-reverse", alignItems: "center", gap: 12, borderTopWidth: 1, borderColor: t.line, paddingTop: 15, minHeight: 60 },
  totals: { gap: 15, borderTopWidth: 1, borderColor: t.line, paddingTop: 20 },
  between: { flexDirection: "row-reverse", justifyContent: "space-between", gap: 15 },
  actions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 12 },
  error: { borderWidth: 1, borderColor: t.danger, padding: 15, borderRadius: 12, backgroundColor: t.paper },
  notice: { borderWidth: 1, borderColor: t.green, padding: 15, borderRadius: 12, backgroundColor: t.paper },
  event: { flexDirection: "row-reverse", gap: 12, paddingVertical: 10 },
  dot: { width: 26, height: 26, alignItems: "center", justifyContent: "center", backgroundColor: t.secondary, borderRadius: 13 },
  input: { minHeight: 125, borderWidth: 1, borderColor: t.line, borderRadius: 13, padding: 15, color: t.ink, backgroundColor: t.background, fontFamily: "Tajawal_400Regular", textAlign: "right", fontSize: 15 },
});
