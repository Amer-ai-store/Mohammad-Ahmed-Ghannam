// "الخصوصية والأجهزة" — photo/character data, sessions, local data, server link.
import React, { useEffect, useState } from "react";
import { isAnalyticsOptedOut, setAnalyticsOptOut } from "../lib/analytics";
import { View } from "react-native";
import { router } from "expo-router";
import { Image as ImageIcon, LogOut, Server, Smartphone, Trash2 } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { BackPill, BrandHeader, Card, InfoNote, SmallButton, Toggle } from "../components/design/kit";
import { useCharacter } from "../lib/character";
import { ConsentsCard } from "../components/smart/ConsentsCard";
import { useSession } from "../lib/session";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/theme";

export default function Privacy() {
  const { colors: t } = useTheme();
  const { profile, removePhoto, reset } = useCharacter();
  const session = useSession();
  const { clearPersonalData, notify } = useStore();
  const [busy, setBusy] = useState("");
  const [optOut, setOptOut] = useState(false);
  useEffect(() => { void isAnalyticsOptedOut().then(setOptOut); }, []);
  const run = async (key: string, fn: () => Promise<void>, done: string) => { setBusy(key); try { await fn(); notify(done); } catch (e) { notify(e instanceof Error ? e.message : "تعذّر التنفيذ"); } finally { setBusy(""); } };
  return (
    <Shell header={<BrandHeader left={<BackPill />} />} title="الخصوصية والأجهزة" subtitle="تحكم في بياناتك على هذا الجهاز وفي حسابك">
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row-reverse", gap: 8, alignItems: "center" }}><ImageIcon size={22} color={t.purple} /><Txt weight="bold" style={{ color: t.title, fontSize: 17 }}>صورة الشخصية</Txt></View>
        <Txt style={{ color: t.muted }}>{profile.faceDataUrl ? `محفوظة على هذا الجهاز فقط${profile.consentAt ? ` منذ ${new Date(profile.consentAt).toLocaleDateString("ar")}` : ""}.` : "لا توجد صورة محفوظة."}</Txt>
        <View style={{ flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" }}>
          <SmallButton title="حذف الصورة" icon={Trash2} tone="soft" disabled={!profile.faceDataUrl || !!busy} onPress={() => void run("photo", removePhoto, "حُذفت الصورة")} />
          <SmallButton title="حذف الشخصية بالكامل" tone="outline" disabled={!!busy} onPress={() => void run("char", reset, "حُذفت الشخصية وإعداداتها")} />
        </View>
      </Card>
      <ConsentsCard />
      <Card style={{ gap: 10, marginTop: 12 }} testID="analytics-optout">
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}><Txt weight="bold" style={{ color: t.title, fontSize: 17 }}>مشاركة إحصاءات الاستخدام</Txt><Toggle value={!optOut} onChange={(v) => { setOptOut(!v); void setAnalyticsOptOut(!v); }} label="مشاركة إحصاءات الاستخدام" /></View>
        <Txt style={{ color: t.muted, lineHeight: 22 }}>عدّادات يومية مجهولة فقط (مثل عدد مرات فتح المنتجات) دون اسمك أو جهازك أو موقعك، لتحسين المتجر.</Txt>
      </Card>
      <Card style={{ gap: 10, marginTop: 12 }}>
        <View style={{ flexDirection: "row-reverse", gap: 8, alignItems: "center" }}><Smartphone size={22} color={t.purple} /><Txt weight="bold" style={{ color: t.title, fontSize: 17 }}>هذا الجهاز</Txt></View>
        <Txt style={{ color: t.muted }}>السلة والمفضلة والطلبات التجريبية والفرع المختار محفوظة محليًا.</Txt>
        <SmallButton title="مسح البيانات المحلية" icon={Trash2} tone="soft" disabled={!!busy} onPress={() => void run("local", clearPersonalData, "مُسحت البيانات المحلية")} style={{ alignSelf: "flex-end" }} />
      </Card>
      <Card style={{ gap: 10, marginTop: 12 }}>
        <View style={{ flexDirection: "row-reverse", gap: 8, alignItems: "center" }}><Server size={22} color={t.purple} /><Txt weight="bold" style={{ color: t.title, fontSize: 17 }}>الحساب والجلسة</Txt></View>
        <Txt style={{ color: t.muted }}>{session.user ? `مسجّل الدخول باسم ${session.user.name}. تُحفظ الجلسة في التخزين الآمن للجهاز.` : "غير مسجّل الدخول."}</Txt>
        <View style={{ flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" }}>
          {session.user ? <SmallButton title="تسجيل الخروج من هذا الجهاز" icon={LogOut} tone="outline" disabled={!!busy} onPress={() => void run("logout", session.logout, "تم تسجيل الخروج")} /> : null}
          <SmallButton title="اتصال الخادم" tone="outline" onPress={() => router.push("/connection")} />
          {session.user ? <SmallButton title="حذف الحساب" icon={Trash2} tone="soft" onPress={() => router.push("/delete-account")} /> : null}
        </View>
      </Card>
      <View style={{ marginTop: 12 }}><InfoNote text="لا يرسل التطبيق صورتك أو بيانات بطاقتك إلى أي خادم. الطلبات والعناوين تُحفظ على خادم المتجر الذي تربطه فقط." /></View>
    </Shell>
  );
}
