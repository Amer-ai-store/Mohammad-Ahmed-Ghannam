// Admin › "النمو والمحتوى" — everything the G14 (Aura) features need from the owner:
// merchant approvals, campaigns, shoppable videos/stories, bundles, competitor prices,
// public coupons, promo video, professional character GLB and AI provider status.
import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Txt, Button } from "../ui";
import { AdminCard, AdminChoices, AdminField, AdminNotice, numberInput, useAdminAction } from "./AdminUI";
import { api } from "../../lib/api";
import { useTheme } from "../../lib/theme";

type Merchant = { userId: string; name: string; email: string; storeName: string; status: string; products: number };
type Campaign = { id: string; title: string; subtitle: string | null; active: boolean; endsAt: string | null };
type Media = { id: string; kind: string; title: string; active: boolean; views: number; likes: number };
type Coupon = { id: string; code: string; public?: boolean; title?: string | null; active: boolean };
type Bundle = { id: string; name: string; percent: number; minItems: number; productIds: string[]; categories: string[]; active?: boolean };

function useLoad<T>(path: string, initial: T) {
  const [data, setData] = useState<T>(initial); const [error, setError] = useState("");
  const reload = useCallback(async () => { try { setData(await api.get<T>(path)); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "تعذّر التحميل"); } }, [path]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, reload };
}

export function GrowthPanel() {
  const { colors: c } = useTheme();
  const merchants = useLoad<{ merchants: Merchant[] }>("/admin/merchants", { merchants: [] });
  const campaigns = useLoad<{ campaigns: Campaign[] }>("/campaigns/manage", { campaigns: [] });
  const media = useLoad<{ posts: Media[] }>("/admin/media", { posts: [] });
  const coupons = useLoad<{ coupons: Coupon[] }>("/admin/coupons", { coupons: [] });
  const settings = useLoad<{ settings: { bundles?: Bundle[]; character?: { modelUrl?: string | null }; storefront?: { promoVideoUrl?: string | null } } }>("/admin/settings", { settings: {} });
  const ai = useLoad<{ configured: boolean; model: string | null }>("/ai/status", { configured: false, model: null });
  const action = useAdminAction();
  const [post, setPost] = useState({ kind: "video" as "video" | "story", title: "", mediaUrl: "", posterUrl: "", productId: "" });
  const [camp, setCamp] = useState({ title: "", subtitle: "", image: "", productId: "", endsAt: "" });
  const [bundle, setBundle] = useState({ name: "", percent: "10", minItems: "2", categories: "", productIds: "" });
  const [rates, setRates] = useState("");
  const [modelUrl, setModelUrl] = useState(""); const [promo, setPromo] = useState("");
  useEffect(() => { setModelUrl(settings.data.settings.character?.modelUrl || ""); setPromo(settings.data.settings.storefront?.promoVideoUrl || ""); }, [settings.data]);
  const bundles = settings.data.settings.bundles || [];
  const line = { flexDirection: "row-reverse" as const, alignItems: "center" as const, gap: 8, paddingVertical: 6, borderTopWidth: 1, borderColor: c.line, flexWrap: "wrap" as const };
  return (
    <>
      <AdminNotice error={action.error || merchants.error || campaigns.error || media.error} message={action.message} />
      <AdminCard title="مزود الذكاء الاصطناعي">
        <Txt style={{ color: ai.data.configured ? c.green : c.muted, lineHeight: 24 }}>{ai.data.configured ? `مفعّل (${ai.data.model}) — البحث بالصورة وقراءة الفواتير وتقدير السعرات والبحث الصوتي تعمل.` : "غير مفعّل. اضبط GEMINI_API_KEY في بيئة الخادم (لا يوضع في التطبيق) لتفعيل البحث بالصورة والفواتير والسعرات والصوت."}</Txt>
      </AdminCard>
      <AdminCard title="طلبات التجار">
        {merchants.data.merchants.length ? merchants.data.merchants.map((m) => (
          <View key={m.userId} style={line}>
            <Txt weight="bold" style={{ flex: 1, color: c.ink }}>{m.storeName} · {m.name} ({m.products} منتج) — {m.status === "approved" ? "مفعّل" : m.status === "pending" ? "قيد المراجعة" : "موقوف"}</Txt>
            {m.status !== "approved" ? <Button title="موافقة" onPress={() => void action.run(() => api.patch(`/admin/merchants/${m.userId}`, { status: "approved" }), "تمت الموافقة", merchants.reload)} /> : <Button title="إيقاف" secondary onPress={() => void action.run(() => api.patch(`/admin/merchants/${m.userId}`, { status: "suspended" }), "أُوقف التاجر ومنتجاته", merchants.reload)} />}
          </View>
        )) : <Txt style={{ color: c.muted }}>لا توجد طلبات تجار. منتجات التجار الجديدة تظهر غير منشورة في «الأصناف» للمراجعة.</Txt>}
      </AdminCard>
      <AdminCard title="الحملات والبانرات">
        {campaigns.data.campaigns.map((x) => (
          <View key={x.id} style={line}>
            <Txt style={{ flex: 1, color: c.ink }}>{x.title}{x.subtitle ? ` — ${x.subtitle}` : ""} {x.active ? "(نشطة)" : "(بانتظار التفعيل)"}</Txt>
            <Button title={x.active ? "إيقاف" : "تفعيل"} secondary={x.active} onPress={() => void action.run(() => api.patch(`/campaigns/manage/${x.id}`, { active: !x.active }), "حُدّثت الحملة", campaigns.reload)} />
            <Button title="حذف" secondary onPress={() => void action.run(() => api.delete(`/campaigns/manage/${x.id}`), "حُذفت الحملة", campaigns.reload)} />
          </View>
        ))}
        <AdminField label="عنوان الحملة" value={camp.title} onChangeText={(v) => setCamp({ ...camp, title: v })} />
        <AdminField label="وصف" value={camp.subtitle} onChangeText={(v) => setCamp({ ...camp, subtitle: v })} />
        <AdminField label="صورة HTTPS" value={camp.image} onChangeText={(v) => setCamp({ ...camp, image: v })} placeholder="https://" />
        <AdminField label="معرّف المنتج (اختياري)" value={camp.productId} onChangeText={(v) => setCamp({ ...camp, productId: v })} />
        <AdminField label="تنتهي في (ISO، اختياري)" value={camp.endsAt} onChangeText={(v) => setCamp({ ...camp, endsAt: v })} placeholder="2026-12-31T21:00:00Z" />
        <Button title="نشر الحملة" busy={action.busy} onPress={() => void action.run(() => api.post("/campaigns/manage", { title: camp.title, subtitle: camp.subtitle || undefined, image: camp.image || undefined, productId: camp.productId || undefined, endsAt: camp.endsAt || undefined }), "نُشرت الحملة", campaigns.reload)} />
      </AdminCard>
      <AdminCard title="فيديوهات التسوق والقصص">
        {media.data.posts.map((m) => (
          <View key={m.id} style={line}>
            <Txt style={{ flex: 1, color: c.ink }}>{m.kind === "video" ? "🎬" : "📸"} {m.title} · {m.views} مشاهدة · {m.likes} إعجاب</Txt>
            <Button title={m.active ? "إخفاء" : "إظهار"} secondary onPress={() => void action.run(() => api.patch(`/admin/media/${m.id}`, { active: !m.active }), "حُدّث المنشور", media.reload)} />
            <Button title="حذف" secondary onPress={() => void action.run(() => api.delete(`/admin/media/${m.id}`), "حُذف المنشور", media.reload)} />
          </View>
        ))}
        <AdminChoices label="النوع" value={post.kind} choices={[{ value: "video", label: "فيديو (mp4/webm/m3u8)" }, { value: "story", label: "قصة (صورة، 24 ساعة)" }] as const} onChange={(v) => setPost({ ...post, kind: v })} />
        <AdminField label="العنوان" value={post.title} onChangeText={(v) => setPost({ ...post, title: v })} />
        <AdminField label="رابط الملف HTTPS" value={post.mediaUrl} onChangeText={(v) => setPost({ ...post, mediaUrl: v })} placeholder="https://cdn…/clip.mp4" />
        <AdminField label="صورة الغلاف (اختياري)" value={post.posterUrl} onChangeText={(v) => setPost({ ...post, posterUrl: v })} />
        <AdminField label="معرّف المنتج المرتبط" value={post.productId} onChangeText={(v) => setPost({ ...post, productId: v })} />
        <Button title="نشر" busy={action.busy} onPress={() => void action.run(() => api.post("/admin/media", { ...post, posterUrl: post.posterUrl || undefined, productId: post.productId || undefined }), "نُشر المحتوى", media.reload)} />
      </AdminCard>
      <AdminCard title="حزم التوفير (تُطبّق عند الدفع)">
        {bundles.map((b) => (
          <View key={b.id} style={line}>
            <Txt style={{ flex: 1, color: c.ink }}>{b.name}: خصم {b.percent}% عند {b.minItems}+ أصناف من {b.categories.length ? `الأقسام ${b.categories.join("، ")}` : `${b.productIds.length} منتجات`}</Txt>
            <Button title="حذف" secondary onPress={() => void action.run(() => api.patch("/admin/settings", { bundles: bundles.filter((x) => x.id !== b.id) }), "حُذفت الحزمة", settings.reload)} />
          </View>
        ))}
        <AdminField label="اسم الحزمة" value={bundle.name} onChangeText={(v) => setBundle({ ...bundle, name: v })} />
        <AdminField label="نسبة الخصم %" numeric value={bundle.percent} onChangeText={(v) => setBundle({ ...bundle, percent: v })} />
        <AdminField label="أقل عدد أصناف" numeric value={bundle.minItems} onChangeText={(v) => setBundle({ ...bundle, minItems: v })} />
        <AdminField label="الأقسام (مفصولة بفاصلة)" value={bundle.categories} onChangeText={(v) => setBundle({ ...bundle, categories: v })} placeholder="care, grocery" />
        <AdminField label="أو معرّفات منتجات (مفصولة بفاصلة)" value={bundle.productIds} onChangeText={(v) => setBundle({ ...bundle, productIds: v })} />
        <Button title="إضافة الحزمة" busy={action.busy} onPress={() => void action.run(() => api.patch("/admin/settings", { bundles: [...bundles, { id: `bundle-${Date.now().toString(36)}`, name: bundle.name, percent: numberInput(bundle.percent, "النسبة"), minItems: numberInput(bundle.minItems, "العدد"), categories: bundle.categories.split(/[,،]/).map((s) => s.trim()).filter(Boolean), productIds: bundle.productIds.split(/[,،]/).map((s) => s.trim()).filter(Boolean) }] }), "أضيفت الحزمة", settings.reload)} />
      </AdminCard>
      <AdminCard title="أسعار المنافسين (رادار الأسعار)">
        <Txt style={{ color: c.muted, lineHeight: 22 }}>سطر لكل سعر: معرّف المنتج, اسم المتجر, السعر, الشحن, الرابط(اختياري)</Txt>
        <AdminField label="الأسعار" multiline value={rates} onChangeText={setRates} placeholder={"watch, متجر أ, 270, 0, https://…"} />
        <Button title="استيراد" busy={action.busy} onPress={() => void action.run(() => api.put("/admin/competitor-prices", { rows: rates.split(/\n/).map((l) => l.split(/[,،]/).map((s) => s.trim())).filter((r) => r.length >= 3).map(([productId, source, price, shipping, url]) => ({ productId, source, price: numberInput(price, "السعر"), shipping: shipping ? numberInput(shipping, "الشحن") : 0, url: url || undefined })) }), "استُوردت الأسعار")} />
      </AdminCard>
      <AdminCard title="كوبونات محفظة العملاء">
        {coupons.data.coupons.filter((x) => x.active).map((x) => (
          <View key={x.id} style={line}>
            <Txt style={{ flex: 1, color: c.ink }}>{x.code}{x.public ? " — ظاهر في المحفظة" : ""}</Txt>
            <Button title={x.public ? "إخفاء" : "إظهار في المحفظة"} secondary={x.public} onPress={() => void action.run(() => api.patch(`/admin/coupon-visibility/${x.id}`, { public: !x.public }), "حُدّث الكوبون", coupons.reload)} />
          </View>
        ))}
      </AdminCard>
      <AdminCard title="فيديو العرض والشخصية الاحترافية">
        <AdminField label="رابط فيديو YouTube للصفحة الرئيسية" value={promo} onChangeText={setPromo} placeholder="https://youtu.be/…" />
        <Button title="حفظ الفيديو" secondary onPress={() => void action.run(() => api.patch("/admin/settings", { storefront: { promoVideoUrl: promo || null } }), "حُفظ فيديو العرض", settings.reload)} />
        <AdminField label="رابط نموذج الشخصية GLB (https)" value={modelUrl} onChangeText={setModelUrl} placeholder="https://cdn…/luqta-avatar.glb" />
        <Txt style={{ color: c.muted, lineHeight: 22, fontSize: 13 }}>نموذج بشري بهيكل Mixamo (Hips/Spine/LeftArm…) مع مقاطع idle/walk/run (اختياري: jump/wave/sit/sleep) ومادة باسم Face للصورة. يُستخدم النموذج المدمج إن تُرك فارغًا.</Txt>
        <Button title="حفظ النموذج" secondary onPress={() => void action.run(() => api.patch("/admin/settings", { character: { modelUrl: modelUrl || null } }), "حُفظ نموذج الشخصية", settings.reload)} />
      </AdminCard>
    </>
  );
}
