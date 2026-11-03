import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Check, Monitor, Moon, Sun } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Toggle } from "../components/design/kit";
import { Txt } from "../components/ui";
import { useLang } from "../lib/i18n";
import { LANGS } from "../lib/i18nCore";
import { Palette, SKINS, ThemeMode, useTheme, useThemedStyles, type SkinId } from "../lib/theme";

const choices = [
  { mode: "light", title: "الوضع النهاري", detail: "ألوان فاتحة طوال الوقت", icon: Sun },
  { mode: "dark", title: "الوضع الليلي", detail: "ألوان داكنة طوال الوقت", icon: Moon },
  { mode: "system", title: "حسب إعداد الجهاز", detail: "يتغير تلقائيًا مع مظهر جهازك", icon: Monitor },
] as const;

export default function AppearanceScreen() {
  const { colors: t, mode, setMode, isDark, storageError, hydrated, skin, setSkin, simple, setSimple } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { lang, setLang } = useLang();
  return (
    <Shell title="مظهر التطبيق" subtitle="اختر المظهر الأنسب لك. يُحفظ اختيارك على هذا الجهاز.">
      <View style={s.options} accessibilityRole="radiogroup" accessibilityLabel="مظهر التطبيق">
        {choices.map((choice) => {
          const selected = mode === choice.mode;
          return (
            <Pressable
              key={choice.mode}
              accessibilityRole="radio"
              accessibilityLabel={choice.title}
              accessibilityState={{ checked: selected, disabled: !hydrated }}
              disabled={!hydrated}
              onPress={() => setMode(choice.mode as ThemeMode)}
              style={({ pressed }) => [s.option, selected && s.selected, { opacity: pressed ? 0.8 : 1 }]}
            >
              <choice.icon color={selected ? t.orange : t.muted} size={24} />
              <View style={{ flex: 1, gap: 5 }}>
                <Txt weight="bold" style={{ fontSize: 18 }}>{choice.title}</Txt>
                <Txt style={{ color: t.muted, lineHeight: 24 }}>{choice.detail}</Txt>
              </View>
              {selected ? <Check color={t.orange} size={23} /> : <View style={s.radio} />}
            </Pressable>
          );
        })}
      </View>
      <View style={[s.preview, { marginTop: 18 }]} testID="simple-mode">
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
          <Txt weight="bold" style={{ fontSize: 18 }}>الواجهة البسيطة</Txt>
          <Toggle value={simple} onChange={setSimple} label="الواجهة البسيطة" />
        </View>
        <Txt style={{ color: t.muted, lineHeight: 22 }}>خط أكبر، وشخصية ثنائية الأبعاد خفيفة بدل المجسم ثلاثي الأبعاد. مناسبة للأجهزة الأبطأ ولمن يفضّل واجهة هادئة.</Txt>
      </View>
      <View style={[s.preview, { marginTop: 18 }]} accessibilityRole="radiogroup" accessibilityLabel="اللغة" testID="lang-picker">
        <Txt weight="bold" style={{ fontSize: 18 }}>اللغة</Txt>
        <View style={{ flexDirection: "row-reverse", gap: 10 }}>
          {LANGS.map((l) => (
            <Pressable key={l.id} accessibilityRole="radio" accessibilityState={{ checked: lang === l.id }} accessibilityLabel={l.label} testID={`lang-${l.id}`} onPress={() => setLang(l.id)}
              style={{ flex: 1, padding: 12, borderRadius: 16, borderWidth: 2, borderColor: lang === l.id ? t.orange : t.line, alignItems: "center" }}>
              <Txt weight={lang === l.id ? "bold" : "regular"} style={{ textAlign: "center" }}>{l.label}</Txt>
            </Pressable>
          ))}
        </View>
        <Txt style={{ color: t.muted, fontSize: 13 }}>{lang === "en" ? "English covers navigation and the main screens; other texts stay in Arabic for now." : "الإنجليزية تغطي التنقل والشاشات الرئيسية حاليًا، وبقية النصوص تبقى بالعربية."}</Txt>
      </View>
      <View style={[s.preview, { marginTop: 18 }]} accessibilityRole="radiogroup" accessibilityLabel="ألوان التطبيق" testID="skin-picker">
        <Txt weight="bold" style={{ fontSize: 18 }}>ألوان التطبيق</Txt>
        <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 }}>
          {(Object.keys(SKINS) as SkinId[]).map((id) => {
            const sk = SKINS[id], selected = skin === id;
            return (
              <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={sk.label} testID={`skin-${id}`} onPress={() => setSkin(id)}
                style={{ width: "30%", padding: 10, borderRadius: 16, borderWidth: 2, borderColor: selected ? t.orange : t.line, alignItems: "center", gap: 6 }}>
                <View style={{ flexDirection: "row", gap: 4 }}><View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: sk.orange || "#FE585C" }} /><View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: sk.purple || "#6E4AA6" }} /></View>
                <Txt weight={selected ? "bold" : "regular"} style={{ fontSize: 13, textAlign: "center" }}>{sk.label}</Txt>
              </Pressable>
            );
          })}
        </View>
        <Txt style={{ color: t.muted, fontSize: 13 }}>«تصميم لُقطة» هو التصميم الأصلي المعتمد؛ بقية الألوان اختيارية.</Txt>
      </View>
      <View accessibilityLiveRegion="polite" style={s.preview}>
        <Txt weight="bold" style={{ fontSize: 18 }}>
          المظهر الحالي: {isDark ? "ليلي" : "نهاري"}
        </Txt>
        <Txt style={{ color: t.muted, lineHeight: 25 }}>
          تظهر التغييرات فورًا في القوائم والبطاقات والنصوص دون الحاجة إلى إعادة تشغيل التطبيق.
        </Txt>
        {storageError ? (
          <Txt style={{ color: t.danger, lineHeight: 24 }}>
            طُبّق المظهر الآن، لكن تعذّر حفظ التفضيل على هذا الجهاز.
          </Txt>
        ) : null}
      </View>
    </Shell>
  );
}
const makeStyles = (t: Palette) => StyleSheet.create({
  options: { gap: 14, width: "100%", maxWidth: 720, alignSelf: "center" },
  option: { flexDirection: "row-reverse", alignItems: "center", gap: 16, padding: 22, minHeight: 90, backgroundColor: t.paper, borderColor: t.line, borderWidth: 1, borderRadius: 18 },
  selected: { borderColor: t.orange, backgroundColor: t.orangeSoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderColor: t.muted, borderWidth: 1 },
  preview: { backgroundColor: t.paper, padding: 24, borderRadius: 18, borderWidth: 1, borderColor: t.line, gap: 12, marginTop: 24, width: "100%", maxWidth: 720, alignSelf: "center" },
});
