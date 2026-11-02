// "بوابة التاجر" (Merchant portal) — apply, then list products (reviewed by admin before
// publishing), update price/stock/offers, see sales, and request promo campaigns.
import React, { useState } from "react";
import { View } from "react-native";
import { Megaphone, Package, Store } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { AccountGate } from "../components/AccountKit";
import { Card, Chip, CTA, ErrorBlock, Field, InfoNote, LoadingBlock, SectionHeader, SmallButton } from "../components/design/kit";
import { Stat, useMoney } from "../components/smart/Bits";
import { api } from "../lib/api";
import { useStore } from "../lib/store";
import { useRemote } from "../lib/useRemote";
import type { Product } from "../data/products";
import { useTheme } from "../lib/theme";

type Me = { merchant: { storeName: string; status: "pending" | "approved" | "suspended"; createdAt: string } | null; products?: (Product & { active?: boolean })[]; sales?: { revenue: number; units: number } };
const STATUS: Record<string, [string, "success" | "warn" | "info"]> = { approved: ["مفعّل", "success"], pending: ["قيد المراجعة", "info"], suspended: ["موقوف", "warn"] };

export default function MerchantPortal() {
  return <Shell title="بوابة التاجر" subtitle="بِع منتجاتك عبر لُقطة"><AccountGate><Body /></AccountGate></Shell>;
}
function Body() {
  const { colors: t } = useTheme();
  const money = useMoney();
  const { notify } = useStore();
  const { data, loading, error, reload } = useRemote<Me>("/merchant/me", { auth: true });
  const [storeName, setStoreName] = useState(""); const [phone, setPhone] = useState("");
  const [form, setForm] = useState({ name: "", price: "", stock: "", category: "grocery", image: "", oldPrice: "", offerEndsAt: "" });
  const [camp, setCamp] = useState({ title: "", subtitle: "", productId: "" });
  const [busy, setBusy] = useState("");
  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => { setBusy(key); try { await fn(); notify(ok); reload(); } catch (e) { notify(e instanceof Error ? e.message : "تعذّر التنفيذ"); } finally { setBusy(""); } };
  if (loading && !data) return <LoadingBlock />;
  if (!data) return <ErrorBlock message={error || "تعذّر التحميل"} onRetry={reload} />;
  if (!data.merchant) return (
    <Card>
      <SectionHeader title="انضم كتاجر" icon={Store} />
      <Txt style={{ color: t.muted, lineHeight: 25, marginBottom: 8 }}>اعرض منتجاتك لعملاء لُقطة. تراجع الإدارة الطلب ثم كل منتج قبل نشره.</Txt>
      <Field label="اسم المتجر" placeholder="اسم المتجر" value={storeName} onChangeText={setStoreName} testID="merchant-store" />
      <Field label="هاتف التواصل" placeholder="هاتف التواصل (اختياري)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={{ marginTop: 8 }} />
      <CTA title="إرسال الطلب" busy={busy === "apply"} onPress={() => void act("apply", () => api.post("/merchant/apply", { storeName, phone: phone || undefined }), "أُرسل طلبك للمراجعة")} style={{ marginTop: 10 }} testID="merchant-apply" />
    </Card>
  );
  const [label, tone] = STATUS[data.merchant.status];
  return (
    <View style={{ gap: 14 }} testID="merchant-portal">
      <Card style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
        <Store size={34} color={t.orange} />
        <View style={{ flex: 1, alignItems: "flex-end" }}><Txt weight="extra" style={{ fontSize: 20, color: t.title }}>{data.merchant.storeName}</Txt><Txt style={{ color: t.muted, fontSize: 12 }}>منذ {new Date(data.merchant.createdAt).toLocaleDateString("ar")}</Txt></View>
        <Chip label={label} tone={tone} />
      </Card>
      {data.merchant.status !== "approved" ? <InfoNote text={data.merchant.status === "pending" ? "طلبك قيد المراجعة؛ سنرسل لك إشعارًا عند التفعيل." : "الحساب موقوف؛ تواصل مع الدعم."} tone="warn" /> : (
        <>
          <View style={{ flexDirection: "row-reverse", gap: 8 }}><Stat label="المبيعات المسلّمة" value={money(data.sales?.revenue || 0)} tone="good" /><Stat label="قطع مباعة" value={String(data.sales?.units || 0)} /><Stat label="منتجاتي" value={String(data.products?.length || 0)} /></View>
          <Card>
            <SectionHeader title="منتجاتي" icon={Package} />
            {data.products?.length ? data.products.map((p) => (
              <View key={p.id} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingVertical: 8, borderTopWidth: 1, borderColor: t.line }}>
                <View style={{ flex: 1, alignItems: "flex-end" }}><Txt weight="bold" style={{ color: t.title }}>{p.name}</Txt><Txt style={{ color: t.muted, fontSize: 12 }}>{money(p.price)} · مخزون {p.stock ?? 0}</Txt></View>
                <Chip label={p.active ? "منشور" : "بانتظار المراجعة"} tone={p.active ? "success" : "info"} />
                <SmallButton title="+10" tone="outline" onPress={() => void act(`stock-${p.id}`, () => api.patch(`/merchant/products/${p.id}`, { stock: (p.stock ?? 0) + 10 }), "حُدّث المخزون")} />
              </View>
            )) : <Txt style={{ color: t.muted }}>لم تضف منتجات بعد.</Txt>}
          </Card>
          <Card>
            <SectionHeader title="إضافة منتج" />
            <Field label="اسم المنتج" placeholder="اسم المنتج" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} testID="merchant-pname" />
            <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 8 }}>
              <Field label="السعر" placeholder="السعر" value={form.price} onChangeText={(v) => setForm({ ...form, price: v })} keyboardType="decimal-pad" style={{ flex: 1 }} />
              <Field label="السعر قبل الخصم" placeholder="قبل الخصم" value={form.oldPrice} onChangeText={(v) => setForm({ ...form, oldPrice: v })} keyboardType="decimal-pad" style={{ flex: 1 }} />
              <Field label="المخزون" placeholder="المخزون" value={form.stock} onChangeText={(v) => setForm({ ...form, stock: v })} keyboardType="number-pad" style={{ flex: 1 }} />
            </View>
            <Field label="القسم" placeholder="القسم (مثل grocery)" value={form.category} onChangeText={(v) => setForm({ ...form, category: v })} style={{ marginTop: 8 }} />
            <Field label="رابط صورة HTTPS" placeholder="رابط صورة https://" value={form.image} onChangeText={(v) => setForm({ ...form, image: v })} autoCapitalize="none" style={{ marginTop: 8 }} />
            <Field label="نهاية العرض" placeholder="نهاية العرض (2026-12-31T20:00)" value={form.offerEndsAt} onChangeText={(v) => setForm({ ...form, offerEndsAt: v })} autoCapitalize="none" style={{ marginTop: 8 }} />
            <CTA title="إرسال للمراجعة" busy={busy === "product"} onPress={() => void act("product", () => api.post("/merchant/products", { name: form.name, price: Number(form.price), stock: Number(form.stock || 0), category: form.category, image: form.image || undefined, oldPrice: form.oldPrice ? Number(form.oldPrice) : undefined, offerEndsAt: form.offerEndsAt || undefined }), "أُرسل المنتج لمراجعة الإدارة")} style={{ marginTop: 10 }} testID="merchant-add" />
          </Card>
          <Card>
            <SectionHeader title="طلب حملة ترويجية" icon={Megaphone} />
            <Field label="عنوان الحملة" placeholder="عنوان الحملة" value={camp.title} onChangeText={(v) => setCamp({ ...camp, title: v })} />
            <Field label="وصف قصير" placeholder="وصف قصير" value={camp.subtitle} onChangeText={(v) => setCamp({ ...camp, subtitle: v })} style={{ marginTop: 8 }} />
            <Field label="معرّف المنتج" placeholder="معرّف المنتج (اختياري)" value={camp.productId} onChangeText={(v) => setCamp({ ...camp, productId: v })} autoCapitalize="none" style={{ marginTop: 8 }} />
            <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 10 }}>
              <SmallButton title="اقترح نصًا بالذكاء الاصطناعي" tone="purple" onPress={() => void api.post<{ title: string; subtitle: string }>("/ai/campaign-copy", { brief: camp.title || data.merchant!.storeName }).then((r) => setCamp({ ...camp, title: r.title || camp.title, subtitle: r.subtitle || camp.subtitle })).catch((e: unknown) => notify(e instanceof Error ? e.message : "تعذّر"))} />
              <SmallButton title="إرسال للموافقة" onPress={() => void act("camp", () => api.post("/campaigns/manage", { title: camp.title, subtitle: camp.subtitle || undefined, productId: camp.productId || undefined }), "أُرسلت الحملة لموافقة الإدارة")} />
            </View>
          </Card>
        </>
      )}
    </View>
  );
}
