// "التسوق الأخضر" — consolidated (eco) delivery, CO₂ estimate and freshness dates.
import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Leaf, Truck } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { Card, Chip, CTA, InfoNote, SectionHeader } from "../components/design/kit";
import { ProductRow, Stat } from "../components/smart/Bits";
import { useStore } from "../lib/store";
import { useSession } from "../lib/session";
import { useRemote } from "../lib/useRemote";
import { CO2_PER_TRIP_KG, freshness, type Insights } from "../lib/smart";
import { useTheme } from "../lib/theme";

export default function GreenHub() {
  const { colors: t } = useTheme();
  const { products, draft, updateDraft } = useStore();
  const { user } = useSession();
  const { data } = useRemote<Insights>(user ? "/me/insights" : null, { auth: true });
  const fresh = products.map((p) => ({ p, f: freshness(p.expiresAt) })).filter((x) => x.f && x.f.state !== "expired").sort((a, b) => (a.f!.days - b.f!.days)).slice(0, 6);
  const eco = !!draft.eco;
  return (
    <Shell title="التسوق الأخضر" subtitle="توصيل مجمّع، أثر كربوني أقل، ومكافأة إضافية">
      <View style={{ gap: 14 }}>
        <Card style={{ backgroundColor: t.successSoft }} testID="eco-card">
          <SectionHeader title="التوصيل المجمّع الصديق للبيئة" icon={Truck} />
          <Txt style={{ color: t.ink, lineHeight: 25 }}>نجمع طلبك مع طلبات منطقتك في رحلة واحدة بدل رحلة مخصصة؛ قد يتأخر الطلب حتى نهاية الفترة المختارة. تقدير التوفير ≈ {CO2_PER_TRIP_KG} كغ CO₂ لكل طلب، و10 نقاط مكافأة بعد التسليم.</Txt>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 10 }}>
            {eco ? <Chip label="مفعّل لطلبك القادم" tone="success" /> : null}
            <CTA title={eco ? "إلغاء التوصيل المجمّع" : "فعّل لطلبي القادم"} tone={eco ? "soft" : "primary"} onPress={() => updateDraft({ eco: !eco })} testID="eco-toggle" style={{ flex: 1 }} />
          </View>
        </Card>
        {data ? <View style={{ flexDirection: "row-reverse", gap: 8 }}><Stat label="طلبات مجمّعة" value={String(data.green.ecoOrders)} tone="good" /><Stat label="كغ CO₂ وفّرتها" value={String(data.green.co2SavedKg)} tone="good" /></View> : <InfoNote text="سجّل الدخول لترى أثرك الأخضر من طلباتك." />}
        <Card>
          <SectionHeader title="طازج — تاريخ الصلاحية الأقرب" icon={Leaf} />
          {fresh.length ? fresh.map(({ p, f }) => <ProductRow key={p.id} product={p} right={<Chip label={f!.state === "soon" ? `ينتهي خلال ${f!.days} يوم` : `صالح ${f!.days} يوم`} tone={f!.state === "soon" ? "warn" : "success"} />} />) : <Txt style={{ color: t.muted }}>تظهر تواريخ الصلاحية عندما يضيفها المتجر للمنتجات من لوحة التحكم.</Txt>}
        </Card>
        <CTA title="إلى السلة" tone="soft" onPress={() => router.navigate("/cart")} />
      </View>
    </Shell>
  );
}
