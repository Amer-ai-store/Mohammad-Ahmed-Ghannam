// Notification preferences (stored on the device). Push delivery needs a push provider
// that is not configured in this build; in-app notifications come from the store server.
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { BackPill, BrandHeader, Card, InfoNote, Toggle } from "../components/design/kit";
import { useTheme } from "../lib/theme";

const KEY = "luqta-notification-prefs-v1";
const items = [
  { k: "orders", l: "تحديثات الطلبات والتوصيل" },
  { k: "returns", l: "المرتجعات والاسترداد" },
  { k: "support", l: "ردود فريق الدعم" },
  { k: "offers", l: "العروض والخصومات" },
  { k: "stock", l: "توفر منتج في المفضلة" },
] as const;
type Prefs = Record<(typeof items)[number]["k"], boolean>;

export default function NotificationSettings() {
  const { colors: t } = useTheme();
  const [prefs, setPrefs] = useState<Prefs>({ orders: true, returns: true, support: true, offers: false, stock: false });
  useEffect(() => { AsyncStorage.getItem(KEY).then((v) => { if (v) { try { setPrefs((p) => ({ ...p, ...JSON.parse(v) })); } catch { /* ignore */ } } }).catch(() => {}); }, []);
  const set = (k: keyof Prefs, v: boolean) => setPrefs((p) => { const n = { ...p, [k]: v }; AsyncStorage.setItem(KEY, JSON.stringify(n)).catch(() => {}); return n; });
  return (
    <Shell header={<BrandHeader left={<BackPill />} />} title="إعدادات الإشعارات" subtitle="اختر التنبيهات التي تهمك">
      <Card>
        {items.map((i, idx) => (
          <View key={i.k} style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", minHeight: 58, borderTopWidth: idx ? 1 : 0, borderColor: t.line }}>
            <Txt style={{ color: t.title, fontSize: 16 }}>{i.l}</Txt>
            <Toggle value={prefs[i.k]} onChange={(v) => set(i.k, v)} label={i.l} />
          </View>
        ))}
      </Card>
      <View style={{ marginTop: 12 }}><InfoNote text="تصل الإشعارات داخل التطبيق من خادم المتجر. إشعارات الهاتف (Push) تحتاج ربط مزود إشعارات وهي غير مفعّلة في هذه النسخة." /></View>
    </Shell>
  );
}
