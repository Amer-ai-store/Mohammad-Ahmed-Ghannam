import React, { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Shell } from "../components/Shell";
import { Button, Txt } from "../components/ui";
import { AccountCard, AccountGate, errorMessage, FormMessage } from "../components/AccountKit";
import { api } from "../lib/api";
import { useAccountResource } from "../lib/accountResource";
import { useTheme } from "../lib/theme";

type Notification = { id: string; title: string; body: string; read: boolean; createdAt: string; orderId?: string };
function NotificationContent() {
  const { colors: t } = useTheme();
  const resource = useAccountResource<{ notifications: Notification[] }>("/notifications");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const mark = async (id?: string) => {
    setBusy(id || "all"); setError("");
    try { if (id) await api.patch(`/notifications/${encodeURIComponent(id)}`, { read: true }); else await api.post("/notifications/read-all"); resource.reload(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(""); }
  };
  return <View style={{ gap: 16 }}><Button title="تحديث الإشعارات" secondary disabled={resource.loading || Boolean(busy)} onPress={resource.reload} />{resource.data?.notifications.some((item) => !item.read) ? <Button title="تعيين الكل كمقروء" secondary busy={busy === "all"} disabled={Boolean(busy)} onPress={() => void mark()} /> : null}{resource.loading ? <ActivityIndicator color={t.orange} /> : null}<FormMessage text={error || resource.error} />{resource.data?.notifications.length === 0 ? <AccountCard><Txt style={{ color: t.muted }}>لا توجد إشعارات من الخادم بعد.</Txt></AccountCard> : null}{resource.data?.notifications.map((item) => <AccountCard key={item.id}><View style={{ flexDirection: "row-reverse", gap: 10, alignItems: "center" }}>{!item.read ? <View style={{ height: 9, width: 9, borderRadius: 5, backgroundColor: t.orange }} /> : null}<Txt weight="bold" style={{ fontSize: 18, flex: 1 }}>{item.title}</Txt></View><Txt style={{ lineHeight: 26, color: t.muted }}>{item.body}</Txt><Txt style={{ color: t.muted, fontSize: 12 }}>{new Date(item.createdAt).toLocaleString("ar")}</Txt>{!item.read ? <Button title="تعيين كمقروء" secondary busy={busy === item.id} disabled={Boolean(busy)} onPress={() => void mark(item.id)} /> : null}{item.orderId ? <Pressable accessibilityRole="button" onPress={() => router.push(`/tracking/${item.orderId}`)}><Txt weight="bold" style={{ color: t.orange }}>عرض الطلب والتتبع</Txt></Pressable> : null}</AccountCard>)}</View>;
}
export default function NotificationsScreen() { return <Shell title="الإشعارات" subtitle="تحديثات فعلية من قاعدة بيانات المتجر، مع حفظ حالة القراءة."><AccountGate><NotificationContent /></AccountGate></Shell>; }
