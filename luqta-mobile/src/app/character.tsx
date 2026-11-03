// "تخصيص شخصيتي" — motion, clothes, appearance, sound; size 25–100 %; reduce motion.
import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Camera, Eye, Footprints, Hand, PersonStanding, Shirt, Smile, Square, Trash2, Volume2 } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { BrandHeader, Card, CharacterPill, CTA, SmallButton, Slider, Toggle } from "../components/design/kit";
import { Companion, type CompanionHandle } from "../components/character/Companion";
import type { AvatarAction } from "../components/character/characterHtml";
import { CharacterContextOverride as CharacterOverride, outfitSwatches, useCharacter, type CharacterProfile } from "../lib/character";
import { useStore } from "../lib/store";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";

type Tab = "motion" | "clothes" | "look" | "sound";
const moves: { a: AvatarAction; label: string; icon: typeof Footprints }[] = [
  { a: "walk", label: "امشي", icon: PersonStanding },
  { a: "jump", label: "اقفز", icon: Footprints },
  { a: "come", label: "تعال هنا", icon: Hand },
  { a: "idle", label: "توقف", icon: Square },
];
const extraMoves: { a: AvatarAction; label: string }[] = [
  { a: "run", label: "اجرِ" }, { a: "cart", label: "تسوّق بالعربة" }, { a: "sleep", label: "نَم" }, { a: "wake", label: "استيقظ" },
  { a: "thumbs", label: "أعجبني" }, { a: "wave", label: "لوّح" }, { a: "think", label: "فكّر" }, { a: "sit", label: "اجلس" },
];
const skinTones = ["#F1C7A5", "#E0A27C", "#C68863", "#8D5A3B"];
const hairColors = ["#1C140F", "#3F281B", "#7A4E2D", "#B9925B"];
const pantsColors = ["#C4161B", "#1F2A44", "#2F2F2F", "#5B6B3A"];

export default function CharacterScreen() {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { profile, save, removePhoto } = useCharacter();
  const { notify } = useStore();
  const [draft, setDraft] = useState<CharacterProfile>(profile);
  const [tab, setTab] = useState<Tab>("motion");
  const [action, setAction] = useState<AvatarAction>("walk");
  const [busy, setBusy] = useState(false);
  const preview = useRef<CompanionHandle>(null);
  const set = (patch: Partial<CharacterProfile>) => setDraft((d) => ({ ...d, ...patch }));
  const play = (a: AvatarAction) => { setAction(a); preview.current?.play(a); };
  async function persist() {
    setBusy(true);
    try { await save(draft); notify("حُفظت شخصيتك"); router.back(); } catch { notify("تعذّر حفظ الشخصية"); } finally { setBusy(false); }
  }
  const tabs: { k: Tab; l: string; icon: typeof Shirt }[] = [
    { k: "motion", l: "حركة", icon: PersonStanding }, { k: "clothes", l: "ملابس", icon: Shirt }, { k: "look", l: "مظهر", icon: Smile }, { k: "sound", l: "صوت", icon: Volume2 },
  ];
  return (
    <Shell header={<BrandHeader left={<CharacterPill />} />} title="تخصيص شخصيتي" subtitle="صمّم مظهرك وتحكّم في حركاتك وصوتك">
      <View style={s.stage}>
        {/* preview reflects unsaved draft through a keyed remount when appearance changes */}
        <CompanionPreview ref={preview} draft={draft} action={action} />
        <Pressable accessibilityRole="button" accessibilityLabel="معاينة تصميم" onPress={() => play("wave")} style={s.previewPill}>
          <Txt weight="medium" style={{ color: t.ink, fontSize: 15 }}>معاينة تصميم</Txt><Eye size={22} color={t.ink} />
        </Pressable>
        <View style={s.platform} />
      </View>
      <Card style={s.tabs} padded={false}>
        {tabs.map((x) => (
          <Pressable key={x.k} accessibilityRole="tab" accessibilityState={{ selected: tab === x.k }} accessibilityLabel={x.l} onPress={() => setTab(x.k)} style={[s.tab, tab === x.k && { backgroundColor: t.orangeSoft }]}>
            <x.icon size={26} color={tab === x.k ? t.orange : t.purple} />
            <Txt weight="medium" style={{ fontSize: 16, color: tab === x.k ? t.orange : t.title }}>{x.l}</Txt>
          </Pressable>
        ))}
      </Card>
      <Card style={{ marginTop: 12 }}>
        {tab === "motion" ? (
          <>
            <Txt weight="extra" style={s.h}>تحكم في الحركة</Txt>
            <Txt style={s.sub}>جرّب الحركات المختلفة لشخصيتك</Txt>
            <View style={s.moves}>
              {moves.map((m) => (
                <Pressable key={m.a} accessibilityRole="button" accessibilityLabel={m.label} testID={`move-${m.a}`} accessibilityState={{ selected: action === m.a }} onPress={() => play(m.a)} style={[s.move, action === m.a && { backgroundColor: t.orange }]}>
                  <m.icon size={28} color={action === m.a ? t.onAccent : t.title} />
                  <Txt weight="bold" style={{ fontSize: 16, color: action === m.a ? t.onAccent : t.title }}>{m.label}</Txt>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {extraMoves.map((m) => <SmallButton key={m.a} title={m.label} tone={action === m.a ? "primary" : "outline"} onPress={() => play(m.a)} />)}
            </View>
            <View style={s.divider} />
            <Txt weight="extra" style={s.h}>حجم الشخصية</Txt>
            <Txt style={s.sub}>اضبط حجم الشخصية في المشهد</Txt>
            <Slider value={draft.scale} min={0.25} max={1} label="حجم الشخصية" format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ scale: v })} />
            <View style={s.divider} />
            <View style={s.rowBetween}>
              <View style={{ flex: 1 }}><Txt weight="extra" style={s.h}>تقليل الحركة</Txt><Txt style={s.sub}>يقلل من شدة الحركات المتكررة</Txt></View>
              <Toggle value={draft.reduceMotion} onChange={(v) => set({ reduceMotion: v })} label="تقليل الحركة" />
            </View>
            <View style={s.divider} />
            <View style={s.rowBetween} testID="hologram-row">
              <View style={{ flex: 1 }}><Txt weight="extra" style={s.h}>مظهر الهولوجرام</Txt><Txt style={s.sub}>شخصية شفافة بتوهج فضائي (يتوقف الوميض مع تقليل الحركة)</Txt></View>
              <Toggle value={draft.hologram} onChange={(v) => set({ hologram: v })} label="مظهر الهولوجرام" />
            </View>
            <View style={s.divider} />
            <View style={s.rowBetween}>
              <View style={{ flex: 1 }}><Txt weight="extra" style={s.h}>لون الزي الأساسي</Txt><Txt style={s.sub}>اختر لون البنطال أو الزي الرئيسي</Txt></View>
            </View>
            <Swatches values={outfitSwatches} value={draft.pants} onPick={(v) => set({ pants: v })} label="لون الزي" />
          </>
        ) : tab === "clothes" ? (
          <>
            <Txt weight="extra" style={s.h}>الملابس</Txt>
            <Txt style={s.sub}>لون السترة</Txt>
            <Swatches values={["#141414", "#5B2BE0", "#7A4E2D", "#1F2A44"]} value={draft.outfit} onPick={(v) => set({ outfit: v })} label="لون السترة" />
            <Txt style={[s.sub, { marginTop: 14 }]}>لون البنطال</Txt>
            <Swatches values={pantsColors} value={draft.pants} onPick={(v) => set({ pants: v })} label="لون البنطال" />
          </>
        ) : tab === "look" ? (
          <>
            <Txt weight="extra" style={s.h}>المظهر</Txt>
            <Txt style={s.sub}>لون البشرة</Txt>
            <Swatches values={skinTones} value={draft.skin} onPick={(v) => set({ skin: v })} label="لون البشرة" />
            <Txt style={[s.sub, { marginTop: 14 }]}>لون الشعر واللحية</Txt>
            <Swatches values={hairColors} value={draft.hair} onPick={(v) => set({ hair: v })} label="لون الشعر" />
            <View style={[s.rowBetween, { marginTop: 14 }]}><Txt style={{ color: t.title, fontSize: 16 }}>إظهار اللحية</Txt><Toggle value={draft.beard} onChange={(v) => set({ beard: v })} label="إظهار اللحية" /></View>
            <View style={s.divider} />
            <View style={{ flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" }}>
              <SmallButton title={draft.faceDataUrl ? "تغيير صورة الوجه" : "اصنع شخصيتك من صورتك"} icon={Camera} onPress={() => router.push("/character-create")} />
              {draft.faceDataUrl ? <SmallButton title="حذف الصورة" icon={Trash2} tone="soft" onPress={() => { void removePhoto(); set({ faceDataUrl: undefined }); notify("حُذفت صورتك من الجهاز"); }} /> : null}
            </View>
            <View style={[s.rowBetween, { marginTop: 14 }]}><Txt style={{ color: t.title, fontSize: 16, flex: 1 }}>عرض ثلاثي الأبعاد (إيقافه يعرض صورة ثابتة ويوفر البطارية)</Txt><Toggle value={draft.enabled3d} onChange={(v) => set({ enabled3d: v })} label="عرض ثلاثي الأبعاد" /></View>
          </>
        ) : (
          <>
            <Txt weight="extra" style={s.h}>الصوت</Txt>
            <View style={s.rowBetween}><Txt style={{ color: t.title, fontSize: 16, flex: 1 }}>مؤثرات صوتية خفيفة للشخصية</Txt><Toggle value={draft.sound} onChange={(v) => set({ sound: v })} label="مؤثرات الصوت" /></View>
            <Txt style={[s.sub, { marginTop: 8 }]}>القراءة الصوتية للردود غير متاحة في هذه النسخة.</Txt>
          </>
        )}
        <CTA title="حفظ الشخصية" testID="character-save" busy={busy} onPress={() => void persist()} style={{ marginTop: 18 }} />
      </Card>
    </Shell>
  );
}

function Swatches({ values, value, onPick, label }: { values: readonly string[]; value: string; onPick: (v: string) => void; label: string }) {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={{ flexDirection: "row", gap: 14 }}>
      {values.map((c) => (
        <Pressable key={c} accessibilityRole="radio" accessibilityLabel={`${label} ${c}`} accessibilityState={{ checked: c.toLowerCase() === value.toLowerCase() }} onPress={() => onPick(c)} style={[s.ring, c.toLowerCase() === value.toLowerCase() && { borderColor: t.orange }]}>
          <View style={[s.dot, { backgroundColor: c }]} />
        </Pressable>
      ))}
    </View>
  );
}

const CompanionPreview = React.forwardRef<CompanionHandle, { draft: CharacterProfile; action: AvatarAction }>(function CompanionPreview({ draft, action }, ref) {
  // The live companion reads the saved profile; the preview passes the draft through a temporary provider.
  return <PreviewProvider draft={draft}><Companion ref={ref} action={action} fixedHeight={250} enterFrom="none" testID="character-preview" /></PreviewProvider>;
});

function PreviewProvider({ draft, children }: { draft: CharacterProfile; children: React.ReactNode }) {
  const ctx = useCharacter();
  return <CharacterOverride value={{ ...ctx, profile: { ...draft, scale: ctx.profile.scale } }}>{children}</CharacterOverride>;
}

const makeStyles = (t: Palette) => StyleSheet.create({
  stage: { height: 280, alignItems: "center", justifyContent: "flex-end" },
  previewPill: { position: "absolute", left: 0, top: 110, flexDirection: "row-reverse", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.card },
  platform: { position: "absolute", bottom: 6, width: 200, height: 26, borderRadius: 100, backgroundColor: t.purpleSoft, zIndex: -1 },
  tabs: { flexDirection: "row-reverse", padding: 6, gap: 6 },
  tab: { flex: 1, minHeight: 74, borderRadius: 18, alignItems: "center", justifyContent: "center", gap: 4 },
  h: { fontSize: 19, color: t.title },
  sub: { fontSize: 14, color: t.muted, marginTop: 2, marginBottom: 10 },
  moves: { flexDirection: "row-reverse", gap: 8 },
  move: { flex: 1, minHeight: 84, borderRadius: 18, backgroundColor: t.purpleSoft, alignItems: "center", justifyContent: "center", gap: 6 },
  divider: { height: 1, backgroundColor: t.line, marginVertical: 14 },
  rowBetween: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 },
  ring: { width: 50, height: 50, borderRadius: 25, borderWidth: 3, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  dot: { width: 38, height: 38, borderRadius: 19 },
});
