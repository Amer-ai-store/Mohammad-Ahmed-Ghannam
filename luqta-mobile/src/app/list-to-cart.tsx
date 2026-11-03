// "قائمة إلى سلة" (WP-13 Shopping Intent Compiler / NX-05): paste or dictate a list in
// Arabic or Jordanian dialect, get real catalog products with confidence; unknown or
// unavailable items are flagged, never invented; nothing enters the cart until reviewed.
import React, { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Check, ListChecks } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { Card, CTA, InfoNote, SmallButton } from "../components/design/kit";
import { useMoney } from "../components/smart/Bits";
import { api } from "../lib/api";
import { compileIntent, type Intent, type IntentItem } from "../lib/intent";
import { useSession } from "../lib/session";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/theme";

const STATUS: Record<IntentItem["status"], string> = { matched: "مطابق", ambiguous: "تأكد من الصنف", out_of_stock: "غير متوفر", not_found: "غير موجود في المتجر" };
export default function ListToCart() {
  const { colors: t } = useTheme();
  const money = useMoney();
  const { configured } = useSession();
  const { products, setQuantity, cart, notify, catalogStatus } = useStore();
  const [text, setText] = useState("");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function compile() {
    setError(""); setBusy(true);
    try {
      const r = configured && catalogStatus === "connected" ? await api.post<Intent>("/intent/parse", { text }) : compileIntent(text, products);
      setIntent(r); setPicked(Object.fromEntries(r.items.map((i, n) => [n, i.status === "matched"])));
    } catch (e) { setError(e instanceof Error ? e.message : "تعذّر تحليل القائمة"); }
    finally { setBusy(false); }
  }
  const chosen = intent ? intent.items.filter((i, n) => picked[n] && i.productId && i.status !== "out_of_stock") : [];
  const accent = (s: IntentItem["status"]) => (s === "matched" ? t.green : s === "ambiguous" ? t.orange : t.danger);
  return (
    <Shell title="قائمة إلى سلة" subtitle="اكتب قائمتك كما تقولها، ونطابقها مع منتجات حقيقية">
      <Card style={{ gap: 8 }}>
        <TextInput testID="intent-text" accessibilityLabel="قائمة المشتريات" multiline value={text} onChangeText={setText} placeholder={"مثال:\n٢ حليب\nكيلو رز\nموز، وسكر\nتحت ٢٠ دينار"} placeholderTextColor={t.mutedSoft}
          style={{ minHeight: 130, textAlign: "right", writingDirection: "rtl", textAlignVertical: "top", color: t.ink, fontFamily: "IBMPlexSansArabic_400Regular", fontSize: 16, borderWidth: 1, borderColor: t.line, borderRadius: 14, padding: 12 }} />
        <CTA title="طابق القائمة" icon={ListChecks} testID="intent-go" busy={busy} disabled={text.trim().length < 2} onPress={() => void compile()} />
        {error ? <Txt style={{ color: t.danger }}>{error}</Txt> : null}
      </Card>
      {intent ? <Card style={{ marginTop: 12, gap: 6 }} testID="intent-result">
        {intent.items.map((i, n) => (
          <Pressable key={`${i.raw}${n}`} accessibilityRole="checkbox" accessibilityState={{ checked: !!picked[n], disabled: !i.productId || i.status === "out_of_stock" }} disabled={!i.productId || i.status === "out_of_stock"} onPress={() => setPicked({ ...picked, [n]: !picked[n] })}
            style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: n ? 1 : 0, borderColor: t.line }}>
            <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: picked[n] ? t.orange : t.line, backgroundColor: picked[n] ? t.orange : "transparent", alignItems: "center", justifyContent: "center" }}>{picked[n] ? <Check size={16} color={t.onAccent} /> : null}</View>
            <View style={{ flex: 1 }}>
              <Txt weight="bold" style={{ color: t.ink }}>{i.name || i.raw}{i.quantity ? ` × ${i.quantity}` : ""}</Txt>
              <Txt style={{ color: t.muted, fontSize: 13 }}>«{i.raw}»{i.price != null ? ` · ${money(i.price)}` : ""}{i.status === "ambiguous" && i.alternatives[0] ? ` · أو ${i.alternatives[0].name}` : ""}</Txt>
            </View>
            <Txt style={{ color: accent(i.status), fontSize: 13 }}>{STATUS[i.status]}</Txt>
          </Pressable>
        ))}
        {intent.budget != null ? <Txt weight="bold" style={{ color: intent.withinBudget ? t.green : t.danger }}>المطابق {money(intent.total)} من ميزانية {money(intent.budget)}</Txt> : null}
        <SmallButton title={`أضف ${chosen.length} للسلة`} disabled={!chosen.length} testID="intent-add" onPress={() => { for (const i of chosen) setQuantity(i.productId!, Math.max(cart[i.productId!] || 0, i.quantity || 1)); notify(`أُضيف ${chosen.length} صنف — راجع السلة قبل الطلب`); router.push("/cart"); }} />
      </Card> : null}
      <View style={{ marginTop: 12 }}><InfoNote text="المطابقة تتم مع كتالوج المتجر فقط. الأسعار والتوفر من الخادم عند الربط، ولا يُضاف أي صنف قبل موافقتك." /></View>
    </Shell>
  );
}
