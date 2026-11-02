// "المستويات والشارات" — level & progress, daily check-in streak, badges, game and coupons.
import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Award, CalendarCheck, Gamepad2, Medal, Ticket, Trophy } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { AccountGate } from "../components/AccountKit";
import { Card, Chip, CTA, ErrorBlock, LoadingBlock, SectionHeader, SmallButton } from "../components/design/kit";
import { ProgressBar } from "../components/smart/Charts";
import { Companion } from "../components/character/Companion";
import { api } from "../lib/api";
import { useStore } from "../lib/store";
import { useRemote } from "../lib/useRemote";
import type { RewardsProfile } from "../lib/smart";
import { useTheme } from "../lib/theme";

export default function RewardsScreen() {
  return <Shell title="المستويات والشارات" subtitle="سجّل يوميًا، العب، واجمع الشارات"><AccountGate><Body /></AccountGate></Shell>;
}
function Body() {
  const { colors: t } = useTheme();
  const { notify } = useStore();
  const { data, setData, loading, error, reload } = useRemote<RewardsProfile>("/rewards/profile", { auth: true });
  const [busy, setBusy] = useState(false);
  async function checkin() {
    setBusy(true);
    try { const r = await api.post<{ points: number; streak: number; profile: RewardsProfile }>("/rewards/checkin"); setData(r.profile); notify(`+${r.points} نقطة — اليوم ${r.streak} على التوالي`); }
    catch (e) { notify(e instanceof Error ? e.message : "تعذّر التسجيل"); reload(); } finally { setBusy(false); }
  }
  if (loading && !data) return <LoadingBlock />;
  if (!data) return <ErrorBlock message={error || "تعذّر التحميل"} onRetry={reload} />;
  const lvl = data.level;
  return (
    <View style={{ gap: 14 }} testID="rewards">
      <Card style={{ backgroundColor: t.orangeSoft }}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
          <Trophy size={40} color={t.orange} />
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Txt weight="extra" style={{ fontSize: 24, color: t.title }}>المستوى {lvl.name}</Txt>
            <Txt style={{ color: t.muted }}>رصيدك {data.points} نقطة · مكتسب إجمالًا {data.lifetime}</Txt>
          </View>
          <Companion action={data.checkedInToday ? "thumbs" : "wave"} base={80} enterFrom="none" />
        </View>
        <View style={{ marginTop: 10 }}><ProgressBar value={lvl.progress} /></View>
        <Txt style={{ color: t.muted, marginTop: 6, fontSize: 13 }}>{lvl.next ? `${lvl.next.min - data.lifetime} نقطة للوصول إلى ${lvl.next.name}` : "وصلت لأعلى مستوى 🎉"}</Txt>
      </Card>
      <Card>
        <SectionHeader title="التسجيل اليومي" icon={CalendarCheck} />
        <View style={{ flexDirection: "row-reverse", gap: 6, marginBottom: 10 }}>
          {Array.from({ length: 7 }, (_, i) => <View key={i} style={{ flex: 1, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: i < Math.min(7, data.streak) ? t.orange : t.field }}><Txt weight="bold" style={{ color: i < Math.min(7, data.streak) ? t.onAccent : t.muted }}>{i + 1}</Txt></View>)}
        </View>
        <CTA title={data.checkedInToday ? `سجّلت اليوم — عد غدًا (+${data.nextCheckinPoints})` : `سجّل حضورك اليوم (+${data.nextCheckinPoints} نقطة)`} disabled={data.checkedInToday} busy={busy} onPress={() => void checkin()} testID="checkin" />
        <Txt style={{ color: t.muted, fontSize: 12, marginTop: 6 }}>5 نقاط يوميًا +2 لكل يوم متتالٍ (حتى 20).</Txt>
      </Card>
      <Card>
        <SectionHeader title="الشارات" icon={Award} />
        <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
          {data.badges.map((b) => (
            <View key={b.id} accessibilityLabel={`${b.title}: ${b.earned ? "مكتسبة" : "غير مكتسبة"} — ${b.detail}`} style={{ width: "31%", padding: 10, borderRadius: 16, alignItems: "center", backgroundColor: b.earned ? t.successSoft : t.field, opacity: b.earned ? 1 : 0.6 }}>
              <Medal size={28} color={b.earned ? t.green : t.mutedSoft} />
              <Txt weight="bold" numberOfLines={1} style={{ fontSize: 13, color: t.title, marginTop: 4 }}>{b.title}</Txt>
              <Txt numberOfLines={2} style={{ fontSize: 11, color: t.muted, textAlign: "center" }}>{b.detail}</Txt>
            </View>
          ))}
        </View>
      </Card>
      <Card style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
        <Gamepad2 size={32} color={t.purple} />
        <View style={{ flex: 1, alignItems: "flex-end" }}><Txt weight="bold" style={{ color: t.title }}>العب واربح</Txt><Txt style={{ color: t.muted, fontSize: 13 }}>{data.gamePlayedToday ? "حصلت على جائزة اليوم" : "10 نقاط عند الفوز (مرة يوميًا)"}</Txt></View>
        {data.gamePlayedToday ? <Chip label="تم" tone="success" /> : null}
        <SmallButton title="العب" onPress={() => router.push("/game")} />
      </Card>
      <Card style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
        <Ticket size={32} color={t.orange} />
        <View style={{ flex: 1, alignItems: "flex-end" }}><Txt weight="bold" style={{ color: t.title }}>محفظة الكوبونات والنقاط</Txt><Txt style={{ color: t.muted, fontSize: 13 }}>استبدل النقاط برصيد واستخدم الكوبونات</Txt></View>
        <SmallButton title="الكوبونات" tone="soft" onPress={() => router.push("/coupons")} />
        <SmallButton title="النقاط" tone="outline" onPress={() => router.push("/wallet")} />
      </Card>
    </View>
  );
}
