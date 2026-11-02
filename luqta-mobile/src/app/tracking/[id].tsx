// Order tracking — reference design "طلبك التجريبي" (demo) / live order tracking.
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Calendar, Check, CircleX, ClipboardList, Clock, Headset, House, Map as MapIcon, Truck } from "lucide-react-native";
import { Shell } from "../../components/Shell";
import { Txt } from "../../components/ui";
import { Card, Chip, CTA, ErrorBlock, LoadingBlock, SmallButton } from "../../components/design/kit";
import { MapArt } from "../../components/design/MapArt";
import { Companion } from "../../components/character/Companion";
import { toArabicDigits } from "../../data/products";
import { api } from "../../lib/api";
import { useSession } from "../../lib/session";
import { useStore } from "../../lib/store";
import { orderLabels, type CommerceOrder } from "../../lib/commerce-types";
import { Palette, useTheme, useThemedStyles } from "../../lib/theme";

type Tracking = { orderId: string; status: string; events: { status: string; at: string; note?: string }[]; location: unknown; updatedAt?: string };
const steps = [
  { key: "received", label: "استلام", statuses: ["pending", "confirmed", "preparing", "out_for_delivery", "delivered"], icon: ClipboardList },
  { key: "prep", label: "تجهيز", statuses: ["preparing", "out_for_delivery", "delivered"], icon: ClipboardList },
  { key: "road", label: "بالطريق", statuses: ["out_for_delivery", "delivered"], icon: Truck },
  { key: "done", label: "تسليم", statuses: ["delivered"], icon: House },
];
const stepIndex = (status: string) => steps.reduce((acc, s, i) => (s.statuses.includes(status) ? i : acc), -1);
const fmtDate = (v?: string) => (v && Number.isFinite(Date.parse(v)) ? new Date(v) : null);
const dateText = (d: Date | null) => (d ? toArabicDigits(`${d.getDate()} ${["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"][d.getMonth()]} ${d.getFullYear()}`) : "—");
const timeText = (d: Date | null) => (d ? toArabicDigits(`${String(d.getHours() % 12 || 12).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "ص" : "م"}`) : "");

export default function TrackingScreen() {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id || "");
  const demo = id.startsWith("LQ-DEMO-");
  const { demoOrders, cancelDemoOrder, refreshOrders, notify } = useStore();
  const { user } = useSession();
  const [order, setOrder] = useState<CommerceOrder | null>(null);
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const demoOrder = demo ? demoOrders.find((o) => o.id === id) || null : null;
  const load = useCallback(async () => {
    if (demo) return;
    if (!user) { setLoading(false); setError("سجّل الدخول لمتابعة طلبك."); return; }
    setLoading(true); setError("");
    try {
      const tr = await api.get<Tracking>(`/orders/${encodeURIComponent(id)}/tracking`);
      setTracking(tr);
      try { setOrder((await api.get<{ order: CommerceOrder }>(`/orders/${encodeURIComponent(id)}`)).order); } catch { /* drivers may not read the full order */ }
    } catch (e) { setError(e instanceof Error ? e.message : "تعذّر تحميل حالة الطلب"); }
    finally { setLoading(false); }
  }, [demo, id, user]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { if (demo) return; const timer = setInterval(() => void load(), 30000); return () => clearInterval(timer); }, [demo, load]);

  const current = demo ? demoOrder : order;
  const status = demo ? demoOrder?.status || "pending" : tracking?.status || order?.status || "pending";
  const events = demo ? (demoOrder?.events || []).map((e) => ({ status: e.status, at: e.createdAt || "", note: e.note })) : tracking?.events || [];
  const last = events[events.length - 1];
  const created = fmtDate(current?.createdAt || current?.date || events[0]?.at);
  const lastAt = fmtDate(last?.at);
  const idx = stepIndex(status);
  const cancelled = status === "cancelled";
  const canCancel = ["pending", "confirmed", "preparing"].includes(status) && (demo || ["pending", "confirmed"].includes(status));

  async function cancel() {
    if (demo) { cancelDemoOrder(id); notify("أُلغي الطلب التجريبي"); return; }
    setCancelling(true);
    try { await api.post(`/orders/${encodeURIComponent(id)}/cancel`); await load(); void refreshOrders(); notify("تم إلغاء الطلب"); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذّر إلغاء الطلب"); }
    finally { setCancelling(false); }
  }
  if (demo && !demoOrder) return (
    <Shell title="الطلب غير موجود" subtitle="ربما حُذفت بيانات الطلب التجريبي من هذا الجهاز."><CTA title="طلباتي" onPress={() => router.replace("/orders")} /></Shell>
  );
  return (
    <Shell title={demo ? "طلبك التجريبي" : "تتبع طلبك"} subtitle={cancelled ? "تم إلغاء الطلب." : "شكراً لك! تم استلام طلبك وجاري تجهيزه."} side={<Companion action="run" base={112} enterFrom="right" />}>
      {loading ? <LoadingBlock label="جارٍ تحميل حالة الطلب…" /> : error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}
      <Card style={s.infoRow} testID="order-info">
        <View style={[s.infoCell, { borderLeftWidth: 1, borderColor: t.line }]}>
          <View style={s.iconBox}><ClipboardList size={30} color={t.purple} /></View>
          <View style={{ alignItems: "flex-end", flex: 1 }}>
            <Txt style={{ color: t.muted, fontSize: 13 }}>رقم الطلب</Txt>
            <Txt weight="bold" style={{ color: t.title, fontSize: 17 }} numberOfLines={1}>{id}</Txt>
            {demo ? <Chip label="محاكاة" tone="demo" /> : null}
          </View>
        </View>
        <View style={s.infoCell}>
          <View style={s.iconBox}><Calendar size={28} color={t.purple} /></View>
          <View style={{ alignItems: "flex-end", flex: 1 }}>
            <Txt style={{ color: t.muted, fontSize: 13 }}>تاريخ الطلب</Txt>
            <Txt weight="bold" style={{ color: t.title, fontSize: 15 }}>{dateText(created)}</Txt>
            <Txt style={{ color: t.muted, fontSize: 13 }}>{timeText(created)}</Txt>
          </View>
        </View>
      </Card>
      <Card style={s.stepper} testID="order-steps">
        {steps.map((step, i) => {
          const done = !cancelled && i <= idx;
          return (
            <React.Fragment key={step.key}>
              {i > 0 ? <View style={[s.connector, { backgroundColor: !cancelled && i <= idx ? t.orange : t.line }]} /> : null}
              <View style={{ alignItems: "center", width: 66 }} accessibilityLabel={`${step.label}: ${done ? "مكتمل" : "لم يكتمل"}`}>
                <View style={[s.stepDot, done ? { backgroundColor: t.orange } : { backgroundColor: t.purpleSoft }]}>
                  {done ? <Check size={26} color={t.onAccent} strokeWidth={3} /> : <step.icon size={24} color={t.purple} />}
                </View>
                <Txt weight="bold" style={{ marginTop: 6, fontSize: 15, color: done ? t.orange : t.muted }}>{step.label}</Txt>
              </View>
            </React.Fragment>
          );
        })}
      </Card>
      <View style={{ marginTop: 12 }}>
        <MapArt height={190} route progress={cancelled ? 0 : idx >= 3 ? 1 : idx === 2 ? 0.55 : 0.12} />
        <View style={s.mapLabelStore}><Txt style={{ fontSize: 12, color: t.ink }}>المتجر</Txt></View>
        <View style={s.mapLabelHome}><Txt style={{ fontSize: 12, color: t.ink }}>عنوان التوصيل</Txt></View>
      </View>
      <Card style={s.update}>
        <View style={{ alignItems: "flex-end" }}>
          <Txt style={{ color: t.muted, fontSize: 13 }}>{dateText(lastAt)}</Txt>
          <Txt style={{ color: t.muted, fontSize: 13 }}>{timeText(lastAt)}</Txt>
        </View>
        <View style={{ flex: 1, alignItems: "flex-end", paddingRight: 12, borderRightWidth: 1, borderColor: t.line }}>
          <Txt weight="bold" style={{ color: t.title, fontSize: 16 }}>آخر تحديث: {demo ? "مثال" : orderLabels[status] || status}</Txt>
          <Txt style={{ color: t.muted, fontSize: 14 }}>{last?.note || orderLabels[status] || "—"}</Txt>
        </View>
        <Clock size={30} color={t.purple} />
      </Card>
      <CTA title="تفاصيل الطلب" testID="order-details" style={{ marginTop: 12 }} onPress={() => (demo ? router.push("/orders") : router.push(`/order/${encodeURIComponent(id)}`))} />
      {!demo && status === "out_for_delivery" ? <SmallButton title="الخريطة الحية لموقع السائق" icon={MapIcon} tone="outline" onPress={() => router.push(`/live/${encodeURIComponent(id)}`)} style={{ marginTop: 10 }} /> : null}
      <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="تواصل مع الدعم" onPress={() => router.push({ pathname: "/support", params: { order: id } })} style={[s.half, { borderColor: t.purpleSoft }]}>
          <Txt weight="medium" style={{ color: t.purple, fontSize: 16 }}>تواصل مع الدعم</Txt><Headset size={24} color={t.purple} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="إلغاء الطلب" disabled={!canCancel || cancelling} onPress={() => void cancel()} style={[s.half, { borderColor: t.chip, opacity: canCancel ? 1 : 0.45 }]}>
          <Txt weight="medium" style={{ color: t.orange, fontSize: 16 }}>{cancelling ? "جارٍ الإلغاء…" : cancelled ? "ملغي" : "إلغاء الطلب"}</Txt><CircleX size={24} color={t.orange} />
        </Pressable>
      </View>
    </Shell>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  infoRow: { flexDirection: "row-reverse", paddingVertical: 12, paddingHorizontal: 8 },
  infoCell: { flex: 1, flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingHorizontal: 6 },
  iconBox: { width: 50, height: 50, borderRadius: 25, backgroundColor: t.purpleSoft, alignItems: "center", justifyContent: "center" },
  stepper: { flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "center", marginTop: 12, paddingVertical: 16 },
  connector: { flex: 1, height: 3, marginTop: 25, borderRadius: 2 },
  stepDot: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  mapLabelStore: { position: "absolute", left: 28, bottom: 58, backgroundColor: t.card, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  mapLabelHome: { position: "absolute", right: 22, top: 12, backgroundColor: t.card, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  update: { flexDirection: "row-reverse", alignItems: "center", gap: 12, marginTop: 12 },
  half: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 56, borderRadius: 20, borderWidth: 1.5, backgroundColor: t.card },
});
