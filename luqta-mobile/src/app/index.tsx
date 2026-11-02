// Home — reference design "شو بدك اليوم؟"
import React, { useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Camera, Mic } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { CTA, SectionHeader } from "../components/design/kit";
import { ProductCard } from "../components/ProductCard";
import { Companion } from "../components/character/Companion";
import { designAssets } from "../lib/designAssets";
import { useStore } from "../lib/store";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";

const homeCategories = [
  { id: "grocery", label: "غذاء", image: designAssets.catFood },
  { id: "electronics", label: "إلكترونيات", image: designAssets.catElectronics },
  { id: "fashion", label: "أزياء", image: designAssets.catFashion },
  { id: "home", label: "منزل", image: designAssets.catHome },
];

export default function Home() {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { products, catalogStatus, catalogError, refreshCatalog } = useStore();
  const [query, setQuery] = useState("");
  const [voiceHint, setVoiceHint] = useState(false);
  const input = useRef<TextInput>(null);
  const featured = useMemo(() => {
    const visible = products.filter((p) => p.active !== false && !p.variantOf);
    const pick = (id: string) => visible.find((p) => p.id === id);
    const chosen = [pick("headphones"), pick("rice")].filter(Boolean) as typeof visible;
    const rest = [...visible].filter((p) => !chosen.includes(p)).sort((a, b) => Number(!!b.badge) - Number(!!a.badge) || b.rating - a.rating);
    return [...chosen, ...rest].slice(0, 2);
  }, [products]);
  const ask = () => router.push({ pathname: "/assistant", params: query.trim() ? { q: query.trim() } : {} });
  return (
    <Shell title="شو بدك اليوم؟" subtitle="تسوق بالمحادثة، أنا أجهّز لك الأفضل">
      <View style={s.searchCard}>
        <View style={s.searchInner}>
          <Pressable accessibilityRole="button" accessibilityLabel="ابحث بصورة المنتج" testID="home-camera" onPress={() => router.push({ pathname: "/assistant", params: { mode: "photo" } })} style={s.camera}>
            <Camera size={30} color={t.ink} strokeWidth={2} />
          </Pressable>
          <View style={s.divider} />
          <TextInput ref={input} testID="home-search" accessibilityLabel="ابحث عن منتج أو اسألني" value={query} onChangeText={setQuery} onSubmitEditing={ask} returnKeyType="search"
            placeholder="ابحث عن منتج أو اسألني..." placeholderTextColor={t.muted} style={s.input} />
          <Pressable accessibilityRole="button" accessibilityLabel="البحث بالصوت" testID="home-mic" onPress={() => { setVoiceHint(true); input.current?.focus(); }} style={s.mic}>
            <Mic size={26} color={t.onAccent} strokeWidth={2.2} />
          </Pressable>
        </View>
        {voiceHint ? <Txt style={{ color: t.muted, fontSize: 12, marginTop: 8, textAlign: "center" }}>اضغط ميكروفون لوحة المفاتيح وتحدّث، ثم اضغط بحث.</Txt> : null}
      </View>

      <View style={s.cats}>
        {homeCategories.map((c) => (
          <Pressable key={c.id} testID={`home-cat-${c.id}`} accessibilityRole="button" accessibilityLabel={`قسم ${c.label}`} onPress={() => router.push({ pathname: "/explore", params: { category: c.id } })} style={({ pressed }) => [s.cat, pressed && { opacity: 0.8 }]}>
            <Image source={c.image} style={s.catIcon} resizeMode="contain" />
            <Txt weight="bold" style={{ fontSize: 16, color: t.title, textAlign: "center" }}>{c.label}</Txt>
          </Pressable>
        ))}
      </View>

      <SectionHeader title="منتجات مميزة لك" action="عرض الكل" onPress={() => router.push("/explore")} />
      {catalogStatus === "loading" && !featured.length ? <Txt style={{ color: t.muted, textAlign: "center", padding: 20 }}>جارٍ تحميل المنتجات…</Txt> : null}
      {catalogStatus === "offline" && catalogError ? <Txt style={{ color: t.danger, fontSize: 12, marginBottom: 6 }} onPress={() => void refreshCatalog()}>{catalogError} — اضغط لإعادة المحاولة</Txt> : null}
      <View style={s.grid}>
        {featured.map((p) => <ProductCard key={p.id} product={p} width="48.3%" />)}
      </View>

      <View style={s.companionRow}>
        <View style={s.bubble}>
          <Txt weight="medium" style={{ fontSize: 17, color: t.title, textAlign: "center", lineHeight: 27 }}>مستعد أساعدك{"\n"}تلاقي الأفضل!</Txt>
        </View>
        <Companion action="walk" base={128} enterFrom="left" />
      </View>
      <CTA title="ابدأ التسوق" testID="home-start" onPress={() => router.push("/assistant")} />
    </Shell>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  searchCard: { backgroundColor: t.card, borderRadius: 26, padding: 10, borderWidth: 1, borderColor: t.line, shadowColor: t.shadow, shadowOpacity: 0.06, shadowRadius: 12, elevation: 1 },
  searchInner: { flexDirection: "row-reverse", alignItems: "center", backgroundColor: t.field, borderRadius: 999, minHeight: 54, paddingHorizontal: 6 },
  camera: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  divider: { width: 1.5, height: 30, backgroundColor: t.line, marginHorizontal: 6 },
  input: { flex: 1, fontFamily: "Tajawal_500Medium", fontSize: 16, color: t.ink, textAlign: "right", writingDirection: "rtl", paddingHorizontal: 8, minHeight: 48 },
  mic: { width: 50, height: 50, borderRadius: 25, backgroundColor: t.purple, alignItems: "center", justifyContent: "center" },
  cats: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 12 },
  cat: { width: "22.5%", aspectRatio: 1, backgroundColor: t.card, borderRadius: 20, borderWidth: 1, borderColor: t.line, alignItems: "center", justifyContent: "center", gap: 6, shadowColor: t.shadow, shadowOpacity: 0.05, shadowRadius: 10, elevation: 1 },
  catIcon: { width: "62%", height: "48%" },
  grid: { flexDirection: "row-reverse", justifyContent: "space-between", flexWrap: "wrap", rowGap: 14 },
  companionRow: { flexDirection: "row-reverse", alignItems: "flex-end", justifyContent: "center", marginTop: 2, marginBottom: -4, gap: 2 },
  bubble: { backgroundColor: t.purpleSoft, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, marginBottom: 40, borderWidth: 1, borderColor: t.line },
});
