import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { RotateCcw } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Button, Txt } from "../components/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";

type ReturnRequest = { id: string; orderId: string; status: string; reason: string; createdAt?: string; date?: string; note?: string };
const labels: Record<string, string> = { pending: "قيد المراجعة", requested: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" };

export default function ReturnsScreen() {
  const { user, configured, hydrated, baseUrl } = useSession();
  const { colors: t } = useTheme();
  const s = useThemedStyles(styles);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedFor, setLoadedFor] = useState("");
  const version = useRef(0);
  const identity = `${baseUrl}:${user?.id || ""}`;
  const load = useCallback(async () => {
    const current = ++version.current;
    if (!user || !configured) return;
    setLoading(true); setError("");
    try {
      const data = await api.get<{ returns: ReturnRequest[] }>("/returns");
      if (current === version.current) { setReturns(data.returns); setLoadedFor(`${baseUrl}:${user.id}`); }
    } catch (failure) {
      if (current === version.current) setError(failure instanceof Error ? failure.message : "تعذّر تحميل طلبات الإرجاع");
    } finally { if (current === version.current) setLoading(false); }
  }, [user, configured, baseUrl]);
  useFocusEffect(useCallback(() => { void load(); return () => { version.current++; }; }, [load]));

  return (
    <Shell title="طلبات الإرجاع" subtitle="متابعة طلبات الإرجاع التي أرسلتها وحالة مراجعتها.">
      <View style={s.page}>
        {!hydrated ? <ActivityIndicator color={t.orange} /> : !configured ? (
          <View style={s.card}><Txt>يلزم ربط خادم المتجر للوصول لطلبات الإرجاع.</Txt><Button title="إعداد الاتصال" onPress={() => router.push("/connection")} /></View>
        ) : !user ? (
          <View style={s.card}><Txt>سجّل الدخول لعرض طلبات الإرجاع الخاصة بحسابك.</Txt><Button title="تسجيل الدخول" onPress={() => router.push("/login")} /></View>
        ) : <>
          <Button title="تحديث طلبات الإرجاع" onPress={() => { void load(); }} busy={loading} secondary />
          {error ? <Txt accessibilityRole="alert" style={{ color: t.danger }}>{error}</Txt> : null}
          {loadedFor !== identity ? loading ? <ActivityIndicator color={t.orange} /> : null : returns.length === 0 ? (
            <View style={s.empty}>
              <RotateCcw size={35} color={t.muted} />
              <Txt weight="bold" style={{ fontSize: 21 }}>لا توجد طلبات إرجاع</Txt>
              <Txt style={s.muted}>يمكنك طلب إرجاع طلب تم تسليمه من صفحة تفاصيله، ضمن مدة الإرجاع المسموحة.</Txt>
              <Button title="عرض طلباتي" onPress={() => router.push("/orders")} />
            </View>
          ) : returns.map((item) => (
            <View key={item.id} style={s.card}>
              <View style={s.row}><Txt weight="bold" style={{ flex: 1 }}>{item.id}</Txt><Txt weight="bold" style={{ color: item.status === "rejected" ? t.danger : t.green }}>{labels[item.status] || item.status}</Txt></View>
              <Txt style={s.muted}>الطلب: {item.orderId}</Txt>
              <Txt>سبب الإرجاع: {item.reason}</Txt>
              {item.createdAt || item.date ? <Txt style={s.muted}>{new Date(item.createdAt || item.date || "").toLocaleString("ar")}</Txt> : null}
              {item.note ? <Txt style={s.muted}>رد المتجر: {item.note}</Txt> : null}
              <Button title="تفاصيل الطلب المرتبط" secondary onPress={() => router.push(`/order/${encodeURIComponent(item.orderId)}`)} />
            </View>
          ))}
          <Txt style={s.muted}>إرسال طلب إرجاع لا يعني قبوله أو إجراء استرداد مالي. ستظهر نتيجة المراجعة هنا بعد إجراء المتجر.</Txt>
        </>}
      </View>
    </Shell>
  );
}

const styles = (t: Palette) => StyleSheet.create({
  page: { maxWidth: 850, width: "100%", alignSelf: "center", gap: 18 },
  card: { borderRadius: 20, borderWidth: 1, borderColor: t.line, padding: 22, backgroundColor: t.paper, gap: 15 },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 10, flexWrap: "wrap" },
  muted: { color: t.muted, lineHeight: 25 },
  empty: { alignItems: "center", gap: 20, padding: 30 },
});
