// "ماسح السعرات" (Calorie & nutrition scan) — product facts by barcode, cart totals,
// and an AI photo estimate when the server has a provider key.
import React, { useState } from "react";
import { View } from "react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { Card, InfoNote, LoadingBlock, SectionHeader, Segmented } from "../components/design/kit";
import { ProductRow } from "../components/smart/Bits";
import { LensSurface, type LensMessage } from "../components/smart/LensSurface";
import { NutritionCard } from "../components/smart/NutritionCard";
import { api } from "../lib/api";
import { cartNutrition } from "../lib/smart";
import { useSession } from "../lib/session";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/theme";
import type { Product } from "../data/products";

type Estimate = { food?: string; serving?: string; calories?: number; protein?: number; carbs?: number; fat?: number; sugar?: number; confidence?: number };
export default function NutritionScreen() {
  const { colors: t } = useTheme();
  const { products, cart } = useStore();
  const { configured, user } = useSession();
  const [mode, setMode] = useState<"barcode" | "photo">("barcode");
  const [product, setProduct] = useState<Product | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const totals = cartNutrition(products, cart);
  async function onLens(m: LensMessage) {
    setMsg("");
    if (m.type === "barcode") { const p = products.find((x) => x.barcode === m.value || x.sku === m.value); setProduct(p || null); if (!p) setMsg(`لا يوجد منتج بالباركود ${m.value}`); else if (!p.nutrition) setMsg("لم يضف المتجر القيم الغذائية لهذا المنتج بعد."); }
    else if (m.type === "photo" && mode === "photo") {
      if (!configured || !user) { setMsg("تقدير السعرات من الصورة يتطلب تسجيل الدخول وربط الخادم."); return; }
      setBusy(true);
      try { const r = await api.post<{ result: Estimate }>("/ai/vision", { task: "nutrition", image: m.dataUrl }); setEstimate(r.result); }
      catch (e) { setMsg(e instanceof Error ? e.message : "تعذّر التقدير"); } finally { setBusy(false); }
    }
  }
  return (
    <Shell title="ماسح السعرات" subtitle="اعرف القيم الغذائية قبل أن تضيف للسلة">
      <Segmented value={mode} onChange={(v) => { setMode(v); setMsg(""); }} options={[{ value: "barcode", label: "باركود المنتج" }, { value: "photo", label: "تقدير من صورة" }]} testID="nutrition-mode" />
      <View style={{ marginTop: 12 }}><LensSurface key={mode} mode={mode} onMessage={(m) => void onLens(m)} height={280} /></View>
      {msg ? <View style={{ marginTop: 10 }}><InfoNote text={msg} tone="warn" /></View> : null}
      {busy ? <LoadingBlock label="نقدّر القيم الغذائية…" /> : null}
      {product ? <Card style={{ marginTop: 12 }}><ProductRow product={product} /></Card> : null}
      {product?.nutrition ? <NutritionCard nutrition={product.nutrition} /> : null}
      {estimate ? <><NutritionCard title={`تقدير: ${estimate.food || "الطعام"}`} nutrition={{ calories: estimate.calories, protein: estimate.protein, carbs: estimate.carbs, fat: estimate.fat, sugar: estimate.sugar, per: estimate.serving }} /><InfoNote text={`تقدير تقريبي بالذكاء الاصطناعي (ثقة ${Math.round((estimate.confidence || 0) * 100)}%) وليس بديلًا عن الملصق الغذائي.`} /></> : null}
      <Card style={{ marginTop: 14 }} testID="cart-nutrition">
        <SectionHeader title="القيم الغذائية لسلتك" />
        {totals.covered ? <Txt style={{ color: t.ink, lineHeight: 26 }}>{totals.total.calories} سعرة · بروتين {totals.total.protein}غ · كربوهيدرات {totals.total.carbs}غ · دهون {totals.total.fat}غ · سكر {totals.total.sugar}غ</Txt> : null}
        <Txt style={{ color: t.muted, fontSize: 13 }}>{totals.items ? `محسوبة لـ ${totals.covered} من ${totals.items} صنف تتوفر لها قيم غذائية.` : "سلتك فارغة."}</Txt>
      </Card>
    </Shell>
  );
}
