// "العدسة الذكية" (Shopping Lens) — scan a barcode to open the product, scan a coupon QR,
// or search by photo (AI on the server when configured; never sent otherwise).
import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Barcode, Camera, Keyboard } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { Card, Chip, Field, InfoNote, LoadingBlock, SectionHeader, Segmented, SmallButton } from "../components/design/kit";
import { ProductRow } from "../components/smart/Bits";
import { LensSurface, type LensMessage } from "../components/smart/LensSurface";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/theme";
import type { Product } from "../data/products";

type Mode = "barcode" | "photo";
export default function LensScreen() {
  const { colors: t } = useTheme();
  const { products, notify, updateDraft } = useStore();
  const { configured, user } = useSession();
  const [mode, setMode] = useState<Mode>("barcode");
  const [manual, setManual] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Product[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  function lookup(code: string) {
    const clean = code.trim().replace(/\s+/g, "");
    if (!clean) return;
    const hit = products.find((p) => p.barcode === clean || p.sku === clean || p.id === clean);
    if (hit) { notify(`وجدنا: ${hit.name}`); router.push(`/product/${hit.id}`); return; }
    if (/^[A-Z0-9_-]{3,40}$/i.test(clean) && !/^\d{8,14}$/.test(clean)) { updateDraft({ pendingCouponCode: clean.toUpperCase() }); notify(`رمز خصم محتمل ${clean.toUpperCase()} — سيُعبأ في السلة`); router.navigate("/cart"); return; }
    setStatus(`لم نجد منتجًا بالباركود ${clean} في المتجر.`);
  }
  async function visual(dataUrl: string) {
    setFound([]); setLabels([]);
    if (!configured || !user) { setStatus("البحث بالصورة يتطلب تسجيل الدخول وربط خادم المتجر."); return; }
    setBusy(true); setStatus("");
    try { const r = await api.post<{ labels: string[]; products: Product[] }>("/ai/vision", { task: "products", image: dataUrl }); setLabels(r.labels); setFound(r.products.map((p) => products.find((x) => x.id === p.id) || p)); if (!r.products.length) setStatus("لم نجد منتجًا مطابقًا في المتجر."); }
    catch (e) { setStatus(e instanceof Error ? e.message : "تعذّر تحليل الصورة"); } finally { setBusy(false); }
  }
  function onLens(m: LensMessage) {
    if (m.type === "barcode") lookup(m.value);
    else if (m.type === "photo") { if (mode === "photo") void visual(m.dataUrl); else setStatus("لم يُقرأ باركود من الصورة — أدخل الرقم يدويًا."); }
    else if (m.type === "error") setStatus(m.code === "CAMERA_DENIED" ? "لم يُسمح بالكاميرا — فعّلها من الأذونات أو اختر صورة." : m.code === "NO_BARCODE_DETECTOR" ? "قارئ الباركود غير مدعوم على هذا الجهاز؛ أدخل الرقم يدويًا أو التقط صورة." : "");
  }
  return (
    <Shell title="العدسة الذكية" subtitle="امسح الباركود أو ابحث بالصورة">
      <Segmented testID="lens-mode" value={mode} onChange={(v) => { setMode(v); setStatus(""); setFound([]); }} options={[{ value: "barcode", label: "باركود / كوبون", icon: Barcode }, { value: "photo", label: "بحث بالصورة", icon: Camera }]} />
      <View style={{ marginTop: 12 }}><LensSurface key={mode} mode={mode} onMessage={onLens} /></View>
      {status ? <View style={{ marginTop: 10 }}><InfoNote text={status} tone="warn" /></View> : null}
      {busy ? <LoadingBlock label="نحلل الصورة…" /> : null}
      {labels.length ? <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginTop: 10 }}>{labels.map((l) => <Chip key={l} label={l} tone="info" />)}</View> : null}
      {found.length ? <Card style={{ marginTop: 12 }}><SectionHeader title="منتجات مطابقة" />{found.map((p) => <ProductRow key={p.id} product={p} />)}</Card> : null}
      <Card style={{ marginTop: 12 }}>
        <SectionHeader title="إدخال يدوي" icon={Keyboard} />
        <Field label="رقم الباركود أو رمز الخصم" placeholder="رقم الباركود أو رمز الخصم" value={manual} onChangeText={setManual} autoCapitalize="characters" testID="lens-manual" />
        <SmallButton title="بحث" onPress={() => lookup(manual)} style={{ marginTop: 8 }} testID="lens-manual-go" />
      </Card>
      <InfoNote text="تُعالج صور الباركود على جهازك. صورة البحث تُرسل لخادم المتجر فقط عند الضغط على التقاط." />
    </Shell>
  );
}
