import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Package, RefreshCw } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Button, Txt } from "../components/ui";
import { formatPrice } from "../data/products";
import { orderLabels } from "../lib/commerce-types";
import { useSession } from "../lib/session";
import { useStore } from "../lib/store";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";

export default function OrdersScreen() {
  const { user, configured, hydrated, baseUrl } = useSession();
  const { orders, refreshOrders, reorder } = useStore();
  const { colors: t } = useTheme();
  const s = useThemedStyles(styles);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedFor, setLoadedFor] = useState("");
  const version = useRef(0);
  const identity = `${baseUrl}:${user?.id || ""}`;
  const load = useCallback(async () => {
    const current = ++version.current;
    if (!configured || !user) return;
    setLoading(true);
    setError("");
    try {
      await refreshOrders();
      if (current === version.current) setLoadedFor(`${baseUrl}:${user.id}`);
    } catch (failure) {
      if (current === version.current)
        setError(failure instanceof Error ? failure.message : "تعذّر تحميل الطلبات");
    } finally {
      if (current === version.current) setLoading(false);
    }
  }, [configured, user, baseUrl, refreshOrders]);
  useFocusEffect(useCallback(() => {
    void load();
    return () => { version.current++; };
  }, [load]));

  return (
    <Shell title="طلباتي" subtitle="طلبات حسابك المحفوظة على خادم المتجر وحالتها الحالية.">
      <View style={s.page}>
        {!hydrated ? <ActivityIndicator color={t.orange} /> : !configured ? (
          <View style={s.card}>
            <Txt weight="bold" style={s.title}>اربط خادم المتجر أولًا</Txt>
            <Txt style={s.muted}>سجل الطلبات مرتبط بالحساب وقاعدة البيانات. لا تُنشأ طلبات محلية على هذه الصفحة.</Txt>
            <Button title="إعداد اتصال الخادم" onPress={() => router.push("/connection")} />
          </View>
        ) : !user ? (
          <View style={s.card}>
            <Txt weight="bold" style={s.title}>سجّل الدخول لعرض طلباتك</Txt>
            <Button title="تسجيل الدخول" onPress={() => router.push("/login")} />
          </View>
        ) : (
          <>
            <View style={s.actions}>
              <Button title="تحديث الطلبات" onPress={() => { void load(); }} secondary busy={loading} />
              <Button title="طلبات الإرجاع" onPress={() => router.push("/returns")} secondary />
            </View>
            {error ? <View style={s.error}><Txt accessibilityRole="alert" style={{ color: t.danger }}>{error}</Txt></View> : null}
            {loadedFor !== identity ? (
              loading ? <ActivityIndicator accessibilityLabel="جارٍ تحميل الطلبات" color={t.orange} style={{ padding: 30 }} /> : null
            ) : orders.length === 0 ? (
              <View style={s.empty}>
                <Package color={t.muted} size={38} />
                <Txt weight="bold" style={s.title}>لا توجد طلبات في حسابك بعد</Txt>
                <Txt style={s.muted}>عند تأكيد طلب من السلة سيظهر هنا برقم محفوظ على الخادم.</Txt>
                <Button title="تصفح المنتجات" onPress={() => router.push("/explore")} />
              </View>
            ) : orders.map((order) => (
              <View key={order.id} style={s.card}>
                <Pressable accessibilityRole="button" accessibilityLabel={`تفاصيل الطلب ${order.id}`} onPress={() => router.push(`/order/${encodeURIComponent(order.id)}`)} style={s.heading}>
                  <View style={s.icon}><Package color={t.orange} size={23} /></View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Txt weight="bold" selectable>{order.id}</Txt>
                    <Txt style={s.small}>{new Date(order.date).toLocaleString("ar")}</Txt>
                  </View>
                  <View style={s.badge}><Txt weight="bold" style={{ color: t.green, fontSize: 12 }}>{orderLabels[order.status] || order.status}</Txt></View>
                </Pressable>
                {order.items.map((item, index) => (
                  <View key={`${item.productId}-${index}`} style={s.row}>
                    <Txt style={{ flex: 1 }}>{item.name}</Txt>
                    <Txt style={s.small}>× {item.quantity}</Txt>
                  </View>
                ))}
                <View style={s.total}>
                  <Txt style={s.muted}>إجمالي الطلب</Txt>
                  <Txt weight="extra" style={{ color: t.orange, fontSize: 22 }}>{formatPrice(order.total, order.currency)}</Txt>
                </View>
                <View style={s.actions}>
                  <Button title="تفاصيل الطلب" onPress={() => router.push(`/order/${encodeURIComponent(order.id)}`)} style={{ flex: 1 }} />
                  <Pressable accessibilityRole="button" accessibilityLabel={`إعادة شراء الطلب ${order.id}`} style={s.reorder} onPress={() => { reorder(order); router.push("/cart"); }}>
                    <RefreshCw color={t.ink} size={17} />
                    <Txt weight="bold">إعادة الشراء</Txt>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}
      </View>
    </Shell>
  );
}

const styles = (t: Palette) => StyleSheet.create({
  page: { width: "100%", maxWidth: 850, alignSelf: "center", gap: 18 },
  card: { padding: 22, borderRadius: 20, backgroundColor: t.paper, borderWidth: 1, borderColor: t.line, gap: 17 },
  title: { fontSize: 21 },
  muted: { color: t.muted, lineHeight: 25 },
  small: { color: t.muted, fontSize: 12, lineHeight: 20 },
  heading: { flexDirection: "row-reverse", alignItems: "center", gap: 12, flexWrap: "wrap", minHeight: 50 },
  icon: { backgroundColor: t.orangeSoft, padding: 12, borderRadius: 13 },
  badge: { backgroundColor: t.secondary, borderRadius: 10, padding: 9 },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  total: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderColor: t.line, paddingTop: 15 },
  actions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 12 },
  reorder: { backgroundColor: t.secondary, borderRadius: 14, paddingHorizontal: 15, minHeight: 51, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7 },
  empty: { padding: 30, alignItems: "center", gap: 19 },
  error: { borderWidth: 1, borderColor: t.danger, backgroundColor: t.paper, padding: 15, borderRadius: 12 },
});
