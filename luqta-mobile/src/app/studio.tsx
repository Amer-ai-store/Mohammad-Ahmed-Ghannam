// "الاستوديو الإبداعي" (AI Creative / Lifestyle Virtual Studio) — place a product in a
// lifestyle scene (from the Aura app), drag / pinch / rotate, caption, then save the image.
import React, { useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import * as LegacyFS from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import { Download, ImagePlus, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { Card, CTA, InfoNote, SectionHeader, SmallButton } from "../components/design/kit";
import { AvatarSurface, type SurfaceHandle } from "../components/character/AvatarSurface";
import { STUDIO_SCENES } from "../components/smart/studioScenes.generated";
import { studioHtml } from "../components/smart/studioHtml";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/theme";

export default function Studio() {
  const { colors: t } = useTheme();
  const { products, notify } = useStore();
  const surface = useRef<SurfaceHandle>(null);
  const withImages = products.filter((p) => typeof p.image === "string" && /^https:\/\//.test(p.image));
  const [scene, setScene] = useState(STUDIO_SCENES[0].id);
  const [productId, setProductId] = useState<string | undefined>(withImages[0]?.id);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const html = useMemo(() => studioHtml({ scene: STUDIO_SCENES[0].dataUrl, product: (withImages[0]?.image as string) || null }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const send = (m: object) => surface.current?.send(m);
  async function pickOwn(kind: "scene" | "product") {
    const r = await DocumentPicker.getDocumentAsync({ type: ["image/jpeg", "image/png", "image/webp"], copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    if ((a.size || 0) > 6_000_000) { notify("الصورة أكبر من 6 ميغابايت"); return; }
    const b64 = Platform.OS === "web" ? null : await LegacyFS.readAsStringAsync(a.uri, { encoding: LegacyFS.EncodingType.Base64 });
    const src = b64 ? `data:${a.mimeType || "image/jpeg"};base64,${b64}` : a.uri;
    send({ type: kind, src });
  }
  async function save(dataUrl: string) {
    const b64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    if (Platform.OS === "web") { const link = document.createElement("a"); link.href = dataUrl; link.download = "luqta-studio.png"; link.click(); notify("تم تنزيل الصورة"); return; }
    if (Platform.OS === "android") {
      const perm = await LegacyFS.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!perm.granted) { notify("لم يتم اختيار مجلد للحفظ"); return; }
      const uri = await LegacyFS.StorageAccessFramework.createFileAsync(perm.directoryUri, `luqta-studio-${Date.now()}`, "image/png");
      await LegacyFS.writeAsStringAsync(uri, b64, { encoding: LegacyFS.EncodingType.Base64 }); notify("حُفظت الصورة في المجلد المختار"); return;
    }
    const path = `${LegacyFS.documentDirectory}luqta-studio-${Date.now()}.png`; await LegacyFS.writeAsStringAsync(path, b64, { encoding: LegacyFS.EncodingType.Base64 }); notify("حُفظت الصورة في ملفات التطبيق");
  }
  function onMessage(data: string) {
    try { const m = JSON.parse(data); if (m.type === "image") { setBusy(false); void save(m.dataUrl).catch(() => notify("تعذّر حفظ الصورة")); } else if (m.type === "error") { setBusy(false); notify(m.code === "TAINTED" ? "لا يمكن تصدير صورة هذا المنتج (مصدرها لا يسمح)؛ استخدم «صورتي»." : "تعذّر تحميل الصورة"); } } catch { /* ignore */ }
  }
  return (
    <Shell title="الاستوديو الإبداعي" subtitle="ضع المنتج في مشهد حياتي، عدّل، واحفظ الصورة">
      <View style={{ aspectRatio: 1, borderRadius: 24, overflow: "hidden", backgroundColor: t.backgroundDeep }} testID="studio-canvas">
        <AvatarSurface ref={surface} html={html} onMessage={onMessage} interactive accessibilityLabel="لوحة الاستوديو: اسحب المنتج، وكبّر بإصبعين" />
      </View>
      <View style={{ flexDirection: "row-reverse", justifyContent: "center", gap: 8, marginTop: 10 }}>
        <SmallButton title="تكبير" icon={ZoomIn} tone="outline" onPress={() => send({ type: "scale", k: 1.12 })} testID="studio-zoom-in" />
        <SmallButton title="تصغير" icon={ZoomOut} tone="outline" onPress={() => send({ type: "scale", k: 0.89 })} />
        <SmallButton title="تدوير" icon={RotateCw} tone="outline" onPress={() => send({ type: "rotate", d: 0.15 })} />
        <SmallButton title="إعادة" icon={RotateCcw} tone="outline" onPress={() => send({ type: "reset" })} />
      </View>
      <Card style={{ marginTop: 12 }}>
        <SectionHeader title="المشهد" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: "row-reverse" }}>
          {STUDIO_SCENES.map((s) => <Pressable key={s.id} accessibilityRole="button" accessibilityState={{ selected: scene === s.id }} onPress={() => { setScene(s.id); send({ type: "scene", src: s.dataUrl }); }} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: scene === s.id ? t.orange : t.field }}><Txt weight="bold" style={{ color: scene === s.id ? t.onAccent : t.ink }}>{s.label}</Txt></Pressable>)}
          <Pressable accessibilityRole="button" onPress={() => void pickOwn("scene")} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: t.purpleSoft }}><Txt weight="bold" style={{ color: t.purple }}>صورتي</Txt></Pressable>
        </ScrollView>
        <SectionHeader title="المنتج" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: "row-reverse" }}>
          {withImages.slice(0, 20).map((p) => <Pressable key={p.id} accessibilityRole="button" accessibilityState={{ selected: productId === p.id }} onPress={() => { setProductId(p.id); send({ type: "product", src: p.image }); }} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: productId === p.id ? t.orange : t.field }}><Txt weight="bold" numberOfLines={1} style={{ color: productId === p.id ? t.onAccent : t.ink, maxWidth: 140 }}>{p.name}</Txt></Pressable>)}
          <Pressable accessibilityRole="button" onPress={() => void pickOwn("product")} style={{ flexDirection: "row-reverse", gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: t.purpleSoft }}><ImagePlus size={18} color={t.purple} /><Txt weight="bold" style={{ color: t.purple }}>صورة منتج</Txt></Pressable>
        </ScrollView>
        {!withImages.length ? <InfoNote text="منتجات الكتالوج التجريبي صورها محلية؛ اختر «صورة منتج» من جهازك، أو اربط الخادم لاستخدام صور المنتجات." /> : null}
        <SectionHeader title="عبارة على الصورة" />
        <TextInput accessibilityLabel="عبارة على الصورة" value={caption} maxLength={40} onChangeText={(v) => { setCaption(v); send({ type: "caption", text: v }); }} placeholder="مثلًا: صباحي مع لُقطة" placeholderTextColor={t.mutedSoft} style={{ minHeight: 48, borderRadius: 14, backgroundColor: t.field, paddingHorizontal: 14, textAlign: "right", color: t.ink, fontFamily: "Tajawal_500Medium" }} />
      </Card>
      <CTA title="حفظ الصورة" icon={Download} busy={busy} onPress={() => { setBusy(true); send({ type: "export" }); }} style={{ marginTop: 12 }} testID="studio-save" />
    </Shell>
  );
}
