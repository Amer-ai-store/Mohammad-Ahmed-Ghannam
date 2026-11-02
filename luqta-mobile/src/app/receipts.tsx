// "قارئ الفواتير" (Receipt OCR) — photo → AI (server key) or paste text → on-device parser;
// saved to the account and compared with the store's prices.
import React, { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import { FileText, Trash2 } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { AccountGate } from "../components/AccountKit";
import { Card, Chip, CTA, InfoNote, LoadingBlock, SectionHeader, Segmented } from "../components/design/kit";
import { useMoney } from "../components/smart/Bits";
import { LensSurface, type LensMessage } from "../components/smart/LensSurface";
import { api } from "../lib/api";
import { parseReceiptText, type ParsedReceipt } from "../lib/receiptParser";
import { useStore } from "../lib/store";
import { useRemote } from "../lib/useRemote";
import type { ReceiptMatch } from "../lib/smart";
import { useTheme } from "../lib/theme";

type Saved = { id: string; store: string | null; total: number; items: { name: string; price: number; quantity: number }[]; createdAt: string };
export default function Receipts() {
  return <Shell title="قارئ الفواتير الذكي" subtitle="حوّل فاتورتك إلى قائمة واعرف أين توفر"><AccountGate><Body /></AccountGate></Shell>;
}
function Body() {
  const { colors: t } = useTheme();
  const money = useMoney();
  const { notify } = useStore();
  const [mode, setMode] = useState<"photo" | "text">("photo");
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [matches, setMatches] = useState<ReceiptMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, setData, reload } = useRemote<{ receipts: Saved[] }>("/receipts", { auth: true });
  async function fromPhoto(m: LensMessage) {
    if (m.type !== "photo") return;
    setBusy(true);
    try { const r = await api.post<{ result: ParsedReceipt }>("/ai/vision", { task: "receipt", image: m.dataUrl }); const items = (r.result.items || []).filter((i) => i && i.name && i.price > 0).map((i) => ({ name: String(i.name), price: Number(i.price), quantity: Number(i.quantity) || 1 })); setParsed({ store: r.result.store || null, items, total: r.result.total ?? null }); if (!items.length) notify("لم نتمكن من قراءة أصناف؛ جرّب صورة أوضح أو الصق النص"); }
    catch (e) { notify(e instanceof Error ? e.message : "تعذّر قراءة الفاتورة"); setMode("text"); } finally { setBusy(false); }
  }
  async function save() {
    if (!parsed?.items.length) return;
    setBusy(true);
    try { const r = await api.post<{ id: string; total: number; matches: ReceiptMatch[] }>("/receipts", parsed); setMatches(r.matches); notify("حُفظت الفاتورة في سجل مشترياتك"); reload(); }
    catch (e) { notify(e instanceof Error ? e.message : "تعذّر الحفظ"); } finally { setBusy(false); }
  }
  return (
    <View style={{ gap: 14 }}>
      <Segmented value={mode} onChange={setMode} options={[{ value: "photo", label: "تصوير الفاتورة" }, { value: "text", label: "لصق النص" }]} testID="receipt-mode" />
      {mode === "photo" ? <><LensSurface mode="photo" onMessage={(m) => void fromPhoto(m)} height={300} /><InfoNote text="تُقرأ الصورة بالذكاء الاصطناعي على خادم المتجر عند تفعيله؛ وإلا استخدم «لصق النص»." /></> : (
        <Card>
          <TextInput testID="receipt-text" accessibilityLabel="نص الفاتورة" multiline value={text} onChangeText={setText} placeholder={"الصق نص الفاتورة هنا، سطر لكل صنف\nمثال: حليب 1.25"} placeholderTextColor={t.mutedSoft} style={{ minHeight: 140, textAlign: "right", textAlignVertical: "top", color: t.ink, fontFamily: "Tajawal_500Medium", fontSize: 15 }} />
          <CTA title="تحليل النص" onPress={() => { const r = parseReceiptText(text); setParsed(r); setMatches(null); if (!r.items.length) notify("لم نجد أصنافًا بأسعار في النص"); }} testID="receipt-parse" />
        </Card>
      )}
      {busy ? <LoadingBlock label="جارٍ المعالجة…" /> : null}
      {parsed?.items.length ? (
        <Card testID="receipt-parsed">
          <SectionHeader title={parsed.store || "الأصناف المقروءة"} icon={FileText} />
          {parsed.items.map((i, k) => <View key={k} style={{ flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 4 }}><Txt style={{ color: t.ink }}>{i.name} × {i.quantity}</Txt><Txt weight="bold" style={{ color: t.title }}>{money(i.price * i.quantity)}</Txt></View>)}
          {parsed.total != null ? <Txt weight="bold" style={{ color: t.orange, marginTop: 6 }}>إجمالي الفاتورة {money(parsed.total)}</Txt> : null}
          <CTA title="حفظ ومقارنة بأسعار لُقطة" onPress={() => void save()} busy={busy} style={{ marginTop: 10 }} testID="receipt-save" />
        </Card>
      ) : null}
      {matches ? <Card><SectionHeader title="مقارنة مع أسعارنا" />{matches.length ? matches.map((m) => (
        <Pressable key={m.name} accessibilityRole="button" onPress={() => router.push(`/product/${m.ourProductId}`)} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingVertical: 6 }}>
          <View style={{ flex: 1, alignItems: "flex-end" }}><Txt weight="bold" style={{ color: t.title }}>{m.ourName}</Txt><Txt style={{ color: t.muted, fontSize: 12 }}>في فاتورتك «{m.name}» {money(m.theirPrice)} · عندنا {money(m.ourPrice)}</Txt></View>
          <Chip label={m.saving > 0 ? `وفّر ${money(m.saving)}` : "سعرك أفضل"} tone={m.saving > 0 ? "success" : "neutral"} />
        </Pressable>)) : <Txt style={{ color: t.muted }}>لا توجد أصناف مطابقة في المتجر.</Txt>}</Card> : null}
      {data?.receipts.length ? (
        <Card>
          <SectionHeader title="فواتيري المحفوظة" />
          {data.receipts.map((r) => (
            <View key={r.id} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingVertical: 6 }}>
              <View style={{ flex: 1, alignItems: "flex-end" }}><Txt weight="bold" style={{ color: t.title }}>{r.store || "فاتورة"} · {money(r.total)}</Txt><Txt style={{ color: t.muted, fontSize: 12 }}>{r.items.length} صنف · {new Date(r.createdAt).toLocaleDateString("ar")}</Txt></View>
              <Pressable accessibilityRole="button" accessibilityLabel="حذف الفاتورة" onPress={() => void api.delete(`/receipts/${r.id}`).then(() => setData((d) => (d ? { receipts: d.receipts.filter((x) => x.id !== r.id) } : d)))} hitSlop={8}><Trash2 size={20} color={t.orange} /></Pressable>
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );
}
