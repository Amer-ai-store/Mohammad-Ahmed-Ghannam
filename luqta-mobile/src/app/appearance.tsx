import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Check, Monitor, Moon, Sun } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { Palette, ThemeMode, useTheme, useThemedStyles } from "../lib/theme";

const choices = [
  { mode: "light", title: "الوضع النهاري", detail: "ألوان فاتحة طوال الوقت", icon: Sun },
  { mode: "dark", title: "الوضع الليلي", detail: "ألوان داكنة طوال الوقت", icon: Moon },
  { mode: "system", title: "حسب إعداد الجهاز", detail: "يتغير تلقائيًا مع مظهر جهازك", icon: Monitor },
] as const;

export default function AppearanceScreen() {
  const { colors: t, mode, setMode, isDark, storageError, hydrated } = useTheme();
  const s = useThemedStyles(makeStyles);
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
