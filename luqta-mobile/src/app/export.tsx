// "تصدير بياناتي" — builds a JSON copy of local + server account data and shares it.
import React, { useState } from "react";
import { Share, View } from "react-native";
import { Download } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { BackPill, BrandHeader, Card, CTA, ErrorBlock, InfoNote } from "../components/design/kit";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { useStore } from "../lib/store";
import { useCharacter } from "../lib/character";
import { useTheme } from "../lib/theme";

export default function ExportData() {
  const { colors: t } = useTheme();
  const { user } = useSession();
  const store = useStore();
  const { profile } = useCharacter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  async function run() {
    setBusy(true); setError("");
    try {
      const server: Record<string, unknown> = {};
      if (user) {
        const paths = ["/auth/me", "/orders", "/addresses", "/wallet", "/rewards", "/returns", "/tickets", "/notifications", "/wishlist"];
        for (const p of paths) { try { server[p] = await api.get(p); } catch (e) { server[p] = { error: e instanceof Error ? e.message : "unavailable" }; } }
      }
      const data = {
        exportedAt: new Date().toISOString(), app: "Amer AI Store | لُقطة 2.0.0",
        device: { cart: store.cart, favorites: store.favorites, branchId: store.branchId, demoOrders: store.demoOrders, character: { ...profile, faceDataUrl: profile.faceDataUrl ? "[صورة محفوظة على الجهاز — غير مضمّنة]" : undefined } },
        server: user ? server : "غير مسجّل الدخول",
      };
      const json = JSON.stringify(data, null, 2);
      setSummary(`${(json.length / 1024).toFixed(1)} KB · ${Object.keys(server).length} أقسام من الخادم`);
      await Share.share({ title: "بياناتي من لُقطة", message: json });
    } catch (e) { setError(e instanceof Error ? e.message : "تعذّر التصدير"); }
    finally { setBusy(false); }
  }
  return (
    <Shell header={<BrandHeader left={<BackPill />} />} title="تصدير بياناتي" subtitle="تحميل نسخة من بياناتك">
      <Card style={{ gap: 8 }}>
        <Txt style={{ color: t.ink, lineHeight: 25 }}>يشمل التصدير: السلة والمفضلة والطلبات التجريبية وإعدادات الشخصية على هذا الجهاز، وإن كنت مسجّلًا: الملف والطلبات والعناوين والمحفظة والنقاط والمرتجعات وتذاكر الدعم والإشعارات من الخادم.</Txt>
        {summary ? <Txt style={{ color: t.green }}>تم تجهيز الملف: {summary}</Txt> : null}
      </Card>
      {error ? <View style={{ marginTop: 10 }}><ErrorBlock message={error} onRetry={() => void run()} /></View> : null}
      <CTA title="تصدير ومشاركة" icon={Download} busy={busy} onPress={() => void run()} style={{ marginTop: 14 }} />
      <View style={{ marginTop: 10 }}><InfoNote text="صورة الوجه لا تُضمّن في التصدير حفاظًا على خصوصيتك." /></View>
    </Shell>
  );
}
