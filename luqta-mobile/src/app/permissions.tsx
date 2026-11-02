// Permissions onboarding — why each permission is needed, and a way to grant it.
import React, { useState } from "react";
import { Linking, Platform, View } from "react-native";
import * as Location from "expo-location";
import { Bell, Camera, MapPin, Mic } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { Card, Chip, IconCircle, InfoNote, SmallButton } from "../components/design/kit";
import { LensSurface } from "../components/smart/LensSurface";
import { useTheme } from "../lib/theme";

type Row = { key: string; title: string; detail: string; icon: typeof Camera };
const ROWS: Row[] = [
  { key: "location", title: "الموقع", detail: "لتحديد عنوان التوصيل وأقرب فرع وتتبع السائق.", icon: MapPin },
  { key: "camera", title: "الكاميرا", detail: "لمسح الباركود والفواتير والبحث بالصورة وصورة شخصيتك.", icon: Camera },
  { key: "mic", title: "الميكروفون", detail: "للبحث الصوتي فقط، وعند الضغط على زر التسجيل.", icon: Mic },
  { key: "notifications", title: "الإشعارات", detail: "تنبيهات الأسعار وحالة الطلب داخل التطبيق.", icon: Bell },
];
export default function Permissions() {
  const { colors: t } = useTheme();
  const [state, setState] = useState<Record<string, string>>({});
  const [probe, setProbe] = useState<"camera" | "mic" | null>(null);
  async function request(key: string) {
    if (key === "location") { const r = await Location.requestForegroundPermissionsAsync(); setState((s) => ({ ...s, location: r.granted ? "granted" : "denied" })); return; }
    if (key === "camera" || key === "mic") { setProbe(key === "camera" ? "camera" : "mic"); return; }
    if (Platform.OS !== "web") void Linking.openSettings();
  }
  return (
    <Shell title="الأذونات" subtitle="نطلب فقط ما تحتاجه الميزة وعند استخدامها">
      <View style={{ gap: 10 }}>
        {ROWS.map((r) => (
          <Card key={r.key} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
            <IconCircle icon={r.icon} tint={t.orange} bg={t.orangeSoft} />
            <View style={{ flex: 1, alignItems: "flex-end" }}><Txt weight="bold" style={{ color: t.title }}>{r.title}</Txt><Txt style={{ color: t.muted, fontSize: 13, lineHeight: 20 }}>{r.detail}</Txt></View>
            {state[r.key] ? <Chip label={state[r.key] === "granted" ? "مسموح" : "مرفوض"} tone={state[r.key] === "granted" ? "success" : "warn"} /> : <SmallButton title={r.key === "notifications" ? "الإعدادات" : "السماح"} onPress={() => void request(r.key)} testID={`perm-${r.key}`} />}
          </Card>
        ))}
        {probe ? <LensSurface mode={probe === "camera" ? "photo" : "voice"} height={probe === "camera" ? 220 : 130} onMessage={(m) => { if (m.type === "ready" || m.type === "recording") setState((s) => ({ ...s, [probe]: "granted" })); if (m.type === "error") setState((s) => ({ ...s, [probe]: "denied" })); }} /> : null}
        <InfoNote text="يمكنك تغيير الأذونات في أي وقت من إعدادات النظام. لا نستخدم الكاميرا أو الميكروفون في الخلفية." />
        {Platform.OS !== "web" ? <SmallButton title="فتح إعدادات التطبيق" tone="outline" onPress={() => void Linking.openSettings()} /> : null}
      </View>
    </Shell>
  );
}
