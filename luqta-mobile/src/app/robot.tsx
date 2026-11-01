import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Footprints, Hand, Minus, Plus, Square, MoveUp, Sparkles, UserRound, Volume2 } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Robot } from "../components/Robot";
import { Button, Card, Chip, Field, Notice, Row, Tabs, Toggle, Txt } from "../components/ui";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { ROBOT_COLORS, useRobot, type RobotAccessory, type RobotMotion, type RobotOutfit, type RobotPrefs } from "../lib/robot";

const MOTIONS: [RobotPrefs["motion"], string, typeof Hand][] = [["walk", "امشِ", Footprints], ["jump", "اقفز", MoveUp], ["come", "تعال هنا", UserRound], ["stop", "توقف", Square], ["wave", "لوّح", Hand], ["dance", "ارقص", Sparkles]];
const OUTFITS: [RobotOutfit, string][] = [["none", "بدون"], ["scarf", "وشاح"], ["cape", "عباءة بطل"], ["bowtie", "ربطة عنق"], ["hoodie", "هودي"]];
const ACCESSORIES: [RobotAccessory, string][] = [["none", "بدون"], ["cap", "قبعة"], ["crown", "تاج"], ["glasses", "نظارات"], ["headphones", "سماعات"], ["flower", "وردة"]];

export function SizeSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { colors: t } = useTheme();
  const { t: tr } = useI18n();
  const [width, setWidth] = useState(1);
  const clamp = (v: number) => Math.round(Math.min(1.4, Math.max(0.6, v)) * 10) / 10;
  const pct = (value - 0.6) / 0.8;
  return (
    <View style={{ gap: 6 }}>
      <Row style={{ justifyContent: "space-between" }}><Txt weight="bold">{tr("حجم الشخصية")}</Txt><Txt testID="size-value" style={{ color: t.muted }}>{Math.round(value * 100)}%</Txt></Row>
      <Row>
        <Pressable testID="size-down" accessibilityRole="button" accessibilityLabel={tr("تصغير الشخصية")} onPress={() => onChange(clamp(value - 0.1))} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.secondary, alignItems: "center", justifyContent: "center" }}><Minus size={16} color={t.ink} /></Pressable>
        <Pressable accessibilityRole="adjustable" accessibilityLabel={tr("حجم الشخصية")} accessibilityValue={{ min: 60, max: 140, now: Math.round(value * 100) }} accessibilityActions={[{ name: "increment" }, { name: "decrement" }]} onAccessibilityAction={(e) => onChange(clamp(value + (e.nativeEvent.actionName === "increment" ? 0.1 : -0.1)))} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} onPress={(e) => onChange(clamp(0.6 + (1 - e.nativeEvent.locationX / width) * 0.8))} style={{ flex: 1, height: 36, justifyContent: "center" }}>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: t.line }}><View style={{ width: `${pct * 100}%`, height: 8, borderRadius: 4, backgroundColor: t.primary, alignSelf: "flex-end" }} /></View>
          <View style={{ position: "absolute", right: `${pct * 100}%`, marginRight: -11, width: 22, height: 22, borderRadius: 11, backgroundColor: t.paper, borderWidth: 3, borderColor: t.primary }} />
        </Pressable>
        <Pressable testID="size-up" accessibilityRole="button" accessibilityLabel={tr("تكبير الشخصية")} onPress={() => onChange(clamp(value + 0.1))} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.secondary, alignItems: "center", justifyContent: "center" }}><Plus size={16} color={t.ink} /></Pressable>
      </Row>
    </View>
  );
}

export default function RobotScreen() {
  const { colors: t } = useTheme();
  const { t: tr } = useI18n();
  const robot = useRobot();
  const [tab, setTab] = useState<"motion" | "clothes" | "look" | "voice">("motion");
  const [draft, setDraft] = useState<RobotPrefs>(robot.prefs);
  const [preview, setPreview] = useState<RobotMotion>(robot.prefs.motion);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof RobotPrefs>(key: K, value: RobotPrefs[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(robot.prefs);
  async function save() {
    setBusy(true); setMessage("");
    try { await robot.update(draft); setMessage("حفظت شخصيتك ✨"); robot.react("hello", tr("شكلي حلو؟ 😄")); }
    catch (e) { setMessage(e instanceof Error ? e.message : "حُفظت على هذا الجهاز؛ تعذرت المزامنة"); } finally { setBusy(false); }
  }
  return (
    <Shell title="تخصيص شخصيتي" subtitle="اختر حركته وملابسه ولونه وصوته" back testID="robot-screen">
      <Card tone="soft" style={{ alignItems: "center", paddingVertical: 20 }} testID="robot-preview">
        <Robot size={170 * draft.size} motion={preview} color={draft.color} outfit={draft.outfit} accessory={draft.accessory} reduceMotion={draft.reduceMotion} bubble="top" message={draft.name} />
      </Card>
      <View style={{ marginTop: 12 }}><Tabs testID="robot-tabs" value={tab} onChange={setTab} tabs={[{ id: "motion", label: "حركة" }, { id: "clothes", label: "ملابس" }, { id: "look", label: "مظهر" }, { id: "voice", label: "صوت" }]} /></View>
      {tab === "motion" ? (
        <Card style={{ marginTop: 12, gap: 12 }}>
          <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 }}>
            {MOTIONS.map(([motion, label, Icon]) => (
              <Pressable key={motion} testID={`motion-${motion}`} accessibilityRole="button" accessibilityLabel={tr(label)} accessibilityState={{ selected: draft.motion === motion }} onPress={() => { setPreview(motion); set("motion", motion); robot.play(motion, tr(label)); }}
                style={{ width: "31%", aspectRatio: 1.2, borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: draft.motion === motion ? t.primary : t.secondary }}>
                <Icon size={24} color={draft.motion === motion ? t.onPrimary : t.primary} />
                <Txt weight="bold" style={{ color: draft.motion === motion ? t.onPrimary : t.ink, fontSize: 13, textAlign: "center" }}>{tr(label)}</Txt>
              </Pressable>
            ))}
          </View>
          <SizeSlider value={draft.size} onChange={(v) => set("size", v)} />
          <Toggle testID="reduce-motion" label="تقليل الحركة" detail={robot.systemReduceMotion ? "مفعّل أيضًا من إعدادات جهازك" : "يثبت الشخصية دون رسوم متحركة"} value={draft.reduceMotion} onChange={(v) => set("reduceMotion", v)} />
        </Card>
      ) : null}
      {tab === "clothes" ? (
        <Card style={{ marginTop: 12, gap: 10 }}>
          <Txt weight="bold">{tr("الملابس")}</Txt>
          <Row wrap>{OUTFITS.map(([id, label]) => <Chip key={id} testID={`outfit-${id}`} label={label} active={draft.outfit === id} onPress={() => set("outfit", id)} />)}</Row>
          <Txt weight="bold">{tr("الإكسسوارات")}</Txt>
          <Row wrap>{ACCESSORIES.map(([id, label]) => <Chip key={id} testID={`accessory-${id}`} label={label} active={draft.accessory === id} onPress={() => set("accessory", id)} />)}</Row>
        </Card>
      ) : null}
      {tab === "look" ? (
        <Card style={{ marginTop: 12, gap: 10 }}>
          <Txt weight="bold">{tr("اللون")}</Txt>
          <Row wrap>{ROBOT_COLORS.map((c) => <Pressable key={c} testID={`color-${c.slice(1)}`} accessibilityRole="button" accessibilityLabel={c} accessibilityState={{ selected: draft.color === c }} onPress={() => set("color", c)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c, borderWidth: 4, borderColor: draft.color === c ? t.ink : t.paper }} />)}</Row>
          <Field label="اسم الشخصية" testID="robot-name" value={draft.name} onChangeText={(v) => set("name", v.slice(0, 20))} />
          <Button title={tr("صورتك على شاشة الروبوت")} secondary onPress={() => router.push("/robot-create")} />
        </Card>
      ) : null}
      {tab === "voice" ? (
        <Card style={{ marginTop: 12, gap: 10 }}>
          <Toggle testID="robot-voice" label="صوت لُقطي" detail="يقرأ الردود بصوت مرح" value={draft.voice} onChange={(v) => set("voice", v)} />
          <Button title={tr("اسمعني")} testID="voice-test" secondary icon={<Volume2 size={16} color={t.ink} />} onPress={() => { robot.play("talk", tr("أهلًا! أنا {n}", { n: draft.name })); robot.speak(tr("أهلًا! أنا {n}، جاهز أساعدك بالتسوق", { n: draft.name })); }} />
        </Card>
      ) : null}
      {message ? <View style={{ marginTop: 10 }}><Notice text={message} tone="success" /></View> : null}
      <Button title={tr("حفظ")} testID="save-robot" busy={busy} disabled={!dirty} onPress={() => void save()} style={{ marginTop: 14 }} />
    </Shell>
  );
}
