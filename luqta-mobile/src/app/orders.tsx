// "طلباتي" — current / previous / returns, with reorder, invoice and inline return request.
import React, { useCallback, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Camera, Check, ChevronDown, ChevronUp, CircleCheck, Clock, FileText, SendHorizontal, ShoppingCart, Undo2, UserRound } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { BrandHeader, Card, Chip, CTA, ErrorBlock, HeaderPill, LoadingBlock, QtyStepper, Segmented, SmallButton } from "../components/design/kit";
import { ProductImage } from "../components/ProductCard";
import { Companion } from "../components/character/Companion";
import { formatPrice, toArabicDigits } from "../data/products";
import { useStore } from "../lib/store";
import { useSession } from "../lib/session";
import { api } from "../lib/api";
import { pickImageDataUrl } from "../lib/media";
import { orderLabels, type CommerceOrder } from "../lib/commerce-types";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";

type Tab = "current" | "past" | "returns";
type ReturnItem = { id: string; orderId: string; reason: string; status: string; createdAt: string; hasPhoto?: boolean };
const REASONS = ["منتج تالف أو غير صالح", "وصلني منتج مختلف", "الكمية ناقصة", "لم يعد مطلوبًا"];
const returnLabels: Record<string, string> = { requested: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض", refunded: "تم الاسترداد" };

export default function Orders() {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { orders, demoOrders, refreshOrders, reorder, products, settings } = useStore();
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>("current");
  const [open, setOpen] = useState<string | null>(null);
  const [returnFor, setReturnFor] = useState<string | null>(null);
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!user) return; setLoading(true); setError("");
    try { await refreshOrders(); const r = await api.get<{ returns: ReturnItem[] }>("/returns"); setReturns(r.returns); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذّر تحميل الطلبات"); }
    finally { setLoading(false); }
  }, [user, refreshOrders]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const all: CommerceOrder[] = [...demoOrders, ...orders];
  const isCurrent = (o: CommerceOrder) => !["delivered", "cancelled"].includes(o.status);
  const list = tab === "current" ? all.filter(isCurrent).concat(all.filter((o) => o.status === "delivered").slice(0, 1)) : tab === "past" ? all.filter((o) => !isCurrent(o)) : [];
  return (
    <Shell header={<BrandHeader left={<HeaderPill label="حسابي" icon={UserRound} onPress={() => router.navigate("/profile")} />} />} title="طلباتي" subtitle="تابع طلباتك وإدر المرتجعات بسهولة." titleAlign="right" side={<Companion action="thumbs" base={110} enterFrom="right" />}>
      <Segmented<Tab> value={tab} onChange={setTab} testID="orders-tabs" options={[{ value: "current", label: "الحالية" }, { value: "past", label: "السابقة" }, { value: "returns", label: "المرتجعات" }]} />
      <View style={{ marginTop: 14, gap: 12 }}>
        {loading ? <LoadingBlock label="جارٍ تحميل طلباتك…" /> : null}
        {error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}
        {!user && !demoOrders.length ? (
          <Card style={{ gap: 10 }}><Txt style={{ color: t.ink }}>سجّل الدخول لعرض طلباتك المحفوظة على الخادم.</Txt><SmallButton title="تسجيل الدخول" onPress={() => router.push("/login")} style={{ alignSelf: "flex-end" }} /></Card>
        ) : null}
        {tab !== "returns" && user !== undefined && !list.length && !loading ? <Card><Txt style={{ color: t.muted, textAlign: "center" }}>{tab === "current" ? "لا توجد طلبات حالية." : "لا توجد طلبات سابقة."}</Txt></Card> : null}
        {list.map((o) => {
          const expanded = open === o.id;
          const delivered = o.status === "delivered";
          const demo = o.id.startsWith("LQ-DEMO-");
          const thumbs = o.items.slice(0, 3).map((i) => products.find((p) => p.id === i.productId)).filter(Boolean);
          return (
            <Card key={o.id} padded={false} testID={`order-${o.id}`}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`طلب رقم ${o.id}`} onPress={() => setOpen(expanded ? null : o.id)} style={s.head}>
                <View style={s.thumbs}>{thumbs.map((p, i) => <View key={i} style={[s.thumb, { right: i * 22, zIndex: 3 - i }]}><ProductImage product={p!} /></View>)}</View>
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Txt weight="bold" numberOfLines={1} style={{ fontSize: 17, color: t.title }}>طلب رقم #{toArabicDigits(o.id.replace(/^LQ-(DEMO-)?/, "").slice(-8))}</Txt>
                  <Txt style={{ color: t.muted, fontSize: 14 }}>{toArabicDigits(String(o.items.reduce((a, i) => a + i.quantity, 0)))} منتجات</Txt>
                  <Txt weight="bold" numberOfLines={1} style={{ color: t.orange, fontSize: 17 }}>{formatPrice(o.total, o.currency || settings.currency)}</Txt>
                </View>
                <View style={{ alignItems: "flex-start", gap: 10 }}>
                  <Chip label={orderLabels[o.status] || o.status} tone={delivered ? "success" : o.status === "cancelled" ? "neutral" : "info"} icon={delivered ? CircleCheck : Clock} />
                  {demo ? <Chip label="محاكاة" tone="demo" /> : null}
                </View>
                <View style={s.chev}>{expanded ? <ChevronUp size={22} color={t.ink} /> : <ChevronDown size={22} color={t.ink} />}</View>
              </Pressable>
              {expanded ? (
                <View style={{ padding: 12, paddingTop: 0 }}>
                  <View style={s.actions}>
                    <SmallButton title="إعادة الشراء" icon={ShoppingCart} onPress={() => { reorder(o); router.push("/cart"); }} style={{ flex: 1 }} />
                    <SmallButton title="طلب إرجاع" icon={Undo2} tone="purple" disabled={!delivered || demo} onPress={() => setReturnFor(returnFor === o.id ? null : o.id)} style={{ flex: 1 }} />
                    <SmallButton title="عرض الفاتورة" icon={FileText} tone="purple" onPress={() => (demo ? router.push(`/tracking/${o.id}`) : router.push(`/order/${encodeURIComponent(o.id)}`))} style={{ flex: 1 }} />
                  </View>
                  {!delivered ? <SmallButton title="تتبع الطلب" tone="outline" onPress={() => router.push(`/tracking/${encodeURIComponent(o.id)}`)} style={{ marginTop: 10 }} /> : null}
                  {returnFor === o.id ? <ReturnForm order={o} onDone={() => { setReturnFor(null); setTab("returns"); void load(); }} /> : null}
                </View>
              ) : null}
            </Card>
          );
        })}
        {tab === "returns" ? (
          returns.length ? returns.map((r) => (
            <Card key={r.id} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                <Txt weight="bold" style={{ color: t.title, fontSize: 17 }}>إرجاع للطلب #{toArabicDigits(r.orderId.replace(/^LQ-?/, ""))}</Txt>
                <Chip label={returnLabels[r.status] || r.status} tone={r.status === "approved" || r.status === "refunded" ? "success" : r.status === "rejected" ? "neutral" : "info"} />
              </View>
              <Txt style={{ color: t.muted }}>{r.reason}</Txt>
              {r.hasPhoto ? <Txt style={{ color: t.muted, fontSize: 12 }}>مرفق صورة</Txt> : null}
            </Card>
          )) : <Card><Txt style={{ color: t.muted, textAlign: "center" }}>لا توجد طلبات إرجاع.</Txt></Card>
        ) : null}
        {demoOrders.length ? <Txt style={{ color: t.muted, fontSize: 12, textAlign: "center" }}>الطلبات المعلّمة «محاكاة» بيانات تجريبية لأغراض العرض فقط.</Txt> : null}
      </View>
    </Shell>
  );
}

function ReturnForm({ order, onDone }: { order: CommerceOrder; onDone: () => void }) {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { products, notify } = useStore();
  const [selected, setSelected] = useState<Record<string, number>>({ [order.items[0]?.productId || ""]: 1 });
  const [reason, setReason] = useState(REASONS[0]);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [photo, setPhoto] = useState<{ uri: string; data: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function attach() {
    setError("");
    try { const r = await pickImageDataUrl(); if (r) setPhoto({ uri: r.uri, data: r.dataUrl }); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذّر إرفاق الصورة"); }
  }
  async function submit() {
    const chosen = Object.entries(selected).filter(([, q]) => q > 0);
    if (!chosen.length) { setError("اختر منتجًا واحدًا على الأقل"); return; }
    setBusy(true); setError("");
    try {
      const lines = chosen.map(([id, q]) => `${order.items.find((i) => i.productId === id)?.name || id} × ${q}`).join("، ");
      await api.post(`/orders/${encodeURIComponent(order.id)}/returns`, { reason: `${reason}: ${lines}`, ...(photo ? { photo: photo.data } : {}) });
      notify("أُرسل طلب الإرجاع للمراجعة"); onDone();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذّر إرسال طلب الإرجاع"); }
    finally { setBusy(false); }
  }
  return (
    <View style={s.returnBox} testID="return-form">
      <Txt weight="extra" style={{ fontSize: 19, color: t.title }}>تقديم طلب إرجاع</Txt>
      <Txt style={{ color: t.muted, fontSize: 14 }}>اختر المنتجات وحدد سبب الإرجاع.</Txt>
      <Card style={{ marginTop: 10, gap: 10 }}>
        {order.items.map((i) => {
          const p = products.find((x) => x.id === i.productId);
          const on = (selected[i.productId] || 0) > 0;
          return (
            <View key={i.productId} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={i.name} onPress={() => setSelected((x) => ({ ...x, [i.productId]: on ? 0 : 1 }))} style={[s.check, on && { backgroundColor: t.purple, borderColor: t.purple }]}>{on ? <Check size={18} color="#fff" strokeWidth={3} /> : null}</Pressable>
              <View style={{ width: 52, height: 60 }}>{p ? <ProductImage product={p} /> : null}</View>
              <Txt weight="bold" style={{ flex: 1, color: t.title }}>{i.name}</Txt>
              {on ? <QtyStepper size="sm" label={i.name} value={selected[i.productId]} max={i.quantity} onChange={(v) => setSelected((x) => ({ ...x, [i.productId]: v }))} /> : null}
            </View>
          );
        })}
        <Txt style={{ color: t.title }}>سبب الإرجاع</Txt>
        <Pressable accessibilityRole="button" accessibilityLabel={`سبب الإرجاع: ${reason}`} onPress={() => setReasonOpen(!reasonOpen)} style={s.select}><Txt style={{ flex: 1, color: t.ink }}>{reason}</Txt><ChevronDown size={20} color={t.ink} /></Pressable>
        {reasonOpen ? REASONS.map((r) => <Pressable key={r} accessibilityRole="radio" accessibilityState={{ checked: r === reason }} onPress={() => { setReason(r); setReasonOpen(false); }} style={{ minHeight: 42, justifyContent: "center" }}><Txt style={{ color: r === reason ? t.orange : t.ink }}>{r}</Txt></Pressable>) : null}
        <Txt style={{ color: t.title }}>إرفاق صورة (اختياري)</Txt>
        <Pressable accessibilityRole="button" accessibilityLabel="إرفاق صورة" onPress={() => void attach()} style={s.attach}>
          {photo ? <Image source={{ uri: photo.uri }} style={{ width: 44, height: 44, borderRadius: 8 }} /> : <Camera size={24} color={t.ink} />}
          <Txt style={{ color: t.ink }}>{photo ? "تغيير الصورة" : "إرفاق صورة"}</Txt>
        </Pressable>
        {error ? <Txt accessibilityRole="alert" style={{ color: t.danger }}>{error}</Txt> : null}
        <CTA title="إرسال طلب الإرجاع" icon={SendHorizontal} busy={busy} onPress={() => void submit()} />
      </Card>
    </View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  head: { flexDirection: "row-reverse", alignItems: "center", gap: 10, padding: 12 },
  thumbs: { width: 96, height: 76 },
  thumb: { position: "absolute", top: 0, width: 58, height: 72, borderRadius: 12, backgroundColor: t.card },
  chev: { width: 38, height: 38, borderRadius: 19, backgroundColor: t.field, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row-reverse", gap: 8, paddingTop: 10, borderTopWidth: 1, borderColor: t.line },
  returnBox: { backgroundColor: t.field, borderRadius: 20, padding: 12, marginTop: 12 },
  check: { width: 30, height: 30, borderRadius: 8, borderWidth: 2, borderColor: t.mutedSoft, alignItems: "center", justifyContent: "center" },
  select: { flexDirection: "row-reverse", alignItems: "center", minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, paddingHorizontal: 14 },
  attach: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 60, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.mutedSoft },
});
