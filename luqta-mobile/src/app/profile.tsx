// "حسابي" — account hub (reference design).
import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Bell, Download, LogOut, PersonStanding, Pencil, Server, Settings, ShieldCheck, Star, Store, Trash2, Truck, UserRound, ChevronLeft, ChevronRight, LayoutDashboard, Sparkles, Trophy, Users, PiggyBank, BellRing } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { BrandHeader, Card, MenuRow } from "../components/design/kit";
import { Companion } from "../components/character/Companion";
import { toArabicDigits } from "../data/products";
import { useSession } from "../lib/session";
import { useStore } from "../lib/store";
import { api } from "../lib/api";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";

export default function Profile() {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const session = useSession();
  const { notify } = useStore();
  const user = session.user;
  const [points, setPoints] = useState<number | null>(null);
  const [unread, setUnread] = useState(false);
  const [busy, setBusy] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (!user) { setPoints(null); return; }
    api.get<{ points: number }>("/rewards").then((r) => { if (active) setPoints(r.points); }).catch(() => {});
    api.get<{ notifications: { read: boolean }[] }>("/notifications").then((r) => { if (active) setUnread(r.notifications.some((n) => !n.read)); }).catch(() => {});
    return () => { active = false; };
  }, [user]));
  async function logout() {
    setBusy(true);
    try { await session.logout(); notify("تم تسجيل الخروج"); } catch (e) { notify(e instanceof Error ? e.message : "تعذّر تسجيل الخروج"); } finally { setBusy(false); }
  }
  const bell = (
    <Pressable accessibilityRole="button" accessibilityLabel="الإشعارات" onPress={() => router.push({ pathname: "/support", params: { tab: "notifications" } })} style={s.bell}>
      <Bell size={26} color={t.ink} />{unread || !user ? <View style={s.bellDot} /> : null}
    </Pressable>
  );
  return (
    <Shell header={<BrandHeader left={bell} />} title="حسابي" subtitle="إدارة حسابك وتخصيص تجربتك">
      <Card style={s.profile} testID="profile-card">
        <View style={s.avatar}><UserRound size={44} color={t.purple} fill={t.purple} /></View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Txt weight="extra" style={{ fontSize: 26, color: t.title }}>{user ? user.name : "زائر"}</Txt>
          <Txt numberOfLines={2} style={{ color: t.muted, fontSize: 14 }}>{user ? "عضو في Amer AI Store" : "حساب زائر"}</Txt>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={user ? "تعديل الملف" : "تسجيل الدخول"} testID="edit-profile" onPress={() => router.push(user ? "/account-details" : "/login")} style={s.edit}>
          <Txt weight="medium" style={{ fontSize: 15, color: t.ink }}>{user ? "تعديل الملف" : "تسجيل الدخول"}</Txt>
          {user ? <Pencil size={18} color={t.ink} /> : <ChevronLeft size={18} color={t.ink} />}
        </Pressable>
      </Card>
      <View style={s.points} testID="points-card">
        <View style={s.star}><Star size={30} color={t.orange} fill={t.orange} /></View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Txt weight="bold" style={{ fontSize: 18, color: t.title }}>{user ? "نقاطي: " : "نقاط تجريبية: "}<Txt weight="extra" style={{ color: t.orange, fontSize: 20 }}>{toArabicDigits(String(user ? points ?? 0 : 120))}</Txt></Txt>
          <Txt style={{ color: t.muted, fontSize: 13 }}>يمكنك استبدال النقاط بمكافآت وتجارب حصرية</Txt>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="استبدال النقاط" testID="redeem" onPress={() => (user ? router.push("/wallet") : notify("سجّل الدخول لاستبدال النقاط الحقيقية"))} style={s.redeem}>
          <Txt weight="bold" style={{ color: t.onAccent, fontSize: 17 }}>استبدال</Txt>
        </Pressable>
      </View>
      <View style={{ marginTop: 12 }}>
        <MenuRow testID="menu-details" title="بياناتي وعناويني" subtitle="إدارة بياناتك الشخصية وعناوين التوصيل" icon={UserRound} onPress={() => router.push(user ? "/account-details" : "/addresses")} />
        <MenuRow testID="menu-smart" title="أدوات لُقطة الذكية" subtitle="نبض السوق، رادار الأسعار، العدسة، الفواتير والمزيد" icon={Sparkles} onPress={() => router.push("/smart-tools")} />
        <MenuRow testID="menu-rewards" title="المستويات والشارات" subtitle="التسجيل اليومي، الشارات، العب واربح" icon={Trophy} onPress={() => router.push("/rewards")} />
        <MenuRow testID="menu-lists" title="القوائم ووضع العائلة" subtitle="قوائم مشتركة بميزانية ورمز دعوة" icon={Users} onPress={() => router.push("/lists")} />
        <MenuRow title="تنبيهات الأسعار" subtitle="المنتجات التي تتابع أسعارها" icon={BellRing} onPress={() => router.push("/watchlist")} />
        <MenuRow title="رؤى الإنفاق" subtitle="إنفاقك الشهري ونصائح التوفير" icon={PiggyBank} onPress={() => router.push("/insights")} />
        <MenuRow testID="menu-character" title="شخصيتي وحركتها" subtitle="تخصيص شخصية لُقطة وحركاتها" icon={PersonStanding} onPress={() => router.push("/character")} />
        <MenuRow title="اللغة والمظهر" subtitle="اختر اللغة والمظهر المفضل" icon={Settings} onPress={() => router.push("/appearance")} />
        <MenuRow title="الإشعارات" subtitle="إدارة التنبيهات والرسائل" icon={Bell} onPress={() => router.push("/notification-settings")} />
        <MenuRow title="الخصوصية والأجهزة" subtitle="إدارة الخصوصية والأجهزة المرتبطة" icon={ShieldCheck} onPress={() => router.push("/privacy")} />
        <MenuRow testID="menu-export" title="تصدير بياناتي" subtitle="تحميل نسخة من بياناتك" icon={Download} onPress={() => router.push("/export")} />
        <MenuRow title="طلباتي والدعم" subtitle="الطلبات والمرتجعات والمحادثات" icon={Store} onPress={() => router.push("/orders")} />
        <MenuRow testID="menu-merchant" title="بوابة التاجر" subtitle="بِع منتجاتك عبر لُقطة" icon={Store} onPress={() => router.push("/merchant")} />
        <MenuRow title="اتصال الخادم" subtitle={session.configured ? (session.connected ? "متصل بخادم المتجر" : "عنوان محفوظ · غير مؤكد") : "وضع تجريبي · اربط خادم المتجر"} icon={Server} onPress={() => router.push("/connection")} />
        {user?.role === "admin" ? <MenuRow title="لوحة الإدارة والقيادة" subtitle="المخزون والفروع والمزامنة والطلبات" icon={LayoutDashboard} onPress={() => router.push("/admin")} /> : null}
        {user?.role === "driver" ? <MenuRow title="لوحة السائق" subtitle="الطلبات المسندة ومشاركة الموقع" icon={Truck} onPress={() => router.push("/driver")} /> : null}
      </View>
      {user ? (
        <Pressable accessibilityRole="button" accessibilityLabel="تسجيل الخروج" testID="logout" disabled={busy} onPress={() => void logout()} style={[s.logout, busy && { opacity: 0.6 }]}>
          <ChevronRight size={24} color={t.onAccent} />
          <Txt weight="bold" style={{ color: t.onAccent, fontSize: 19, flex: 1, textAlign: "center" }}>تسجيل الخروج</Txt>
          <LogOut size={26} color={t.onAccent} style={{ transform: [{ scaleX: -1 }] }} />
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="تسجيل الدخول" onPress={() => router.push("/login")} style={s.logout}>
          <ChevronRight size={24} color={t.onAccent} /><Txt weight="bold" style={{ color: t.onAccent, fontSize: 19, flex: 1, textAlign: "center" }}>تسجيل الدخول</Txt><UserRound size={24} color={t.onAccent} />
        </Pressable>
      )}
      {user ? (
        <Pressable accessibilityRole="button" accessibilityLabel="حذف الحساب" onPress={() => router.push("/delete-account")} style={s.delete}>
          <ChevronRight size={22} color={t.orange} />
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Txt weight="bold" style={{ color: t.orange, fontSize: 18 }}>حذف الحساب</Txt>
            <Txt style={{ color: t.muted, fontSize: 13 }}>سيتم حذف جميع بياناتك بشكل نهائي</Txt>
          </View>
          <Trash2 size={26} color={t.orange} />
        </Pressable>
      ) : null}
      <View style={{ alignItems: "flex-end", marginTop: -6 }}><Companion action="sleep" base={86} aspect={2.5} enterFrom="none" /></View>
    </Shell>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  bell: { width: 54, height: 54, borderRadius: 27, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, alignItems: "center", justifyContent: "center" },
  bellDot: { position: "absolute", top: 12, right: 14, width: 11, height: 11, borderRadius: 6, backgroundColor: t.orange, borderWidth: 2, borderColor: t.card },
  profile: { flexDirection: "row-reverse", alignItems: "center", gap: 14 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: t.purpleSoft, alignItems: "center", justifyContent: "center" },
  edit: { flexDirection: "row-reverse", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.card },
  points: { flexDirection: "row-reverse", alignItems: "center", gap: 12, marginTop: 12, padding: 14, borderRadius: 22, backgroundColor: t.orangeSoft, borderWidth: 1, borderColor: t.chip },
  star: { width: 56, height: 56, borderRadius: 28, backgroundColor: t.chip, alignItems: "center", justifyContent: "center" },
  redeem: { minHeight: 48, paddingHorizontal: 22, borderRadius: 999, backgroundColor: t.orange, alignItems: "center", justifyContent: "center" },
  logout: { flexDirection: "row", alignItems: "center", minHeight: 56, borderRadius: 20, backgroundColor: t.orange, paddingHorizontal: 18, marginTop: 6 },
  delete: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, borderRadius: 18, backgroundColor: t.orangeSoft, paddingHorizontal: 16, marginTop: 10 },
});
