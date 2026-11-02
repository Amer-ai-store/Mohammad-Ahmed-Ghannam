// "جرّب قبل ما تختار" — interactive 3D product viewer with a true-scale room mode.
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Box, Info, RotateCcw, Rotate3d, ZoomIn, ZoomOut } from "lucide-react-native";
import { Shell } from "../../components/Shell";
import { Txt } from "../../components/ui";
import { Card, CTA, ErrorBlock, InfoNote } from "../../components/design/kit";
import { AvatarSurface, type SurfaceHandle } from "../../components/character/AvatarSurface";
import { viewerHtml, type ViewerModel } from "../../components/character/characterHtml";
import { Companion } from "../../components/character/Companion";
import { useStore } from "../../lib/store";
import { Palette, useTheme, useThemedStyles } from "../../lib/theme";

export default function View3D() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { products, addToCart } = useStore();
  const product = products.find((p) => p.id === id) || products.find((p) => p.model3d === "chair");
  const surface = useRef<SurfaceHandle>(null);
  const [mode, setMode] = useState<"3d" | "room">("3d");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const model: ViewerModel = product?.model3d || "box";
  const html = useMemo(() => viewerHtml({ model, color: product?.swatches?.[0]?.hex, dimensions: product?.dimensions }), [model, product?.swatches, product?.dimensions]);
  const send = useCallback((m: object) => surface.current?.send(m), []);
  const onMessage = (data: string) => {
    try { const m = JSON.parse(data); if (m.type === "ready") setState("ready"); if (m.type === "error") setState("error"); } catch { /* ignore */ }
  };
  const tools = [
    { label: "تدوير", icon: Rotate3d, cmd: "rotate" },
    { label: "تقريب", icon: ZoomIn, cmd: "zoomIn" },
    { label: "تبعيد", icon: ZoomOut, cmd: "zoomOut" },
    { label: "إعادة", icon: RotateCcw, cmd: "reset" },
  ];
  const dims = product?.dimensions;
  return (
    <Shell title="جرّب قبل ما تختار" subtitle="شاهد المنتج بتقنية ثلاثية الأبعاد">
      <View style={s.stage} testID="viewer-stage">
        {state === "error" ? <ErrorBlock message="تعذّر تشغيل العرض ثلاثي الأبعاد على هذا الجهاز." onRetry={() => setState("loading")} /> : (
          <AvatarSurface key={state === "loading" ? "l" : "r"} ref={surface} html={html} onMessage={onMessage} interactive accessibilityLabel={`عرض ثلاثي الأبعاد: ${product?.name || ""}`} />
        )}
        {state === "loading" ? <View style={s.loading} pointerEvents="none"><Txt style={{ color: t.muted }}>جارٍ تجهيز النموذج…</Txt></View> : null}
        <View style={s.companion} pointerEvents="none"><Companion action="crossed" base={150} enterFrom="none" /></View>
      </View>
      <Card style={s.tools}>
        {tools.map((tool) => (
          <Pressable key={tool.label} accessibilityRole="button" accessibilityLabel={tool.label} onPress={() => send({ type: tool.cmd })} style={s.tool} disabled={state !== "ready"}>
            <View style={s.toolCircle}><tool.icon size={30} color={t.title} /></View>
            <Txt style={{ color: t.muted, fontSize: 15 }}>{tool.label}</Txt>
          </Pressable>
        ))}
      </Card>
      <View style={s.toggle} accessibilityRole="tablist">
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === "3d" }} onPress={() => { setMode("3d"); send({ type: "mode", value: "3d" }); }} style={[s.toggleItem, mode === "3d" && { backgroundColor: t.orange }]}>
          <Txt weight="bold" style={{ fontSize: 20, color: mode === "3d" ? t.onAccent : t.ink }}>3D</Txt><Box size={32} color={mode === "3d" ? t.onAccent : t.ink} />
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === "room" }} onPress={() => { setMode("room"); send({ type: "mode", value: "room" }); }} style={[s.toggleItem, mode === "room" && { backgroundColor: t.orange }]}>
          <Box size={30} color={mode === "room" ? t.onAccent : t.muted} />
          <Txt weight="bold" style={{ fontSize: 18, color: mode === "room" ? t.onAccent : t.ink }}>في غرفتي</Txt>
        </Pressable>
      </View>
      <View style={s.note}>
        <Info size={22} color={t.muted} />
        <Txt style={{ color: t.muted, fontSize: 15, flex: 1 }}>{dims ? `المقاسات للعرض التجريبي: ${Math.round(dims.w * 100)}×${Math.round(dims.d * 100)}×${Math.round(dims.h * 100)} سم` : "المقاسات للعرض التجريبي"}</Txt>
      </View>
      {mode === "room" ? <InfoNote text="«في غرفتي» يعرض المنتج بمقاسه الحقيقي داخل غرفة افتراضية بجانب شخص بطول 175 سم؛ لا يستخدم الكاميرا (AR) في هذه النسخة." /> : null}
      <CTA title="اختيار هذا المنتج" testID="viewer-choose" style={{ marginTop: 12 }} onPress={() => { if (product) { addToCart(product.id); router.push(`/product/${product.id}`); } else router.back(); }} />
    </Shell>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  stage: { height: 360, borderRadius: 30, overflow: "hidden", backgroundColor: t.purpleSoft, marginTop: 2 },
  loading: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  companion: { position: "absolute", right: 6, bottom: 30 },
  tools: { flexDirection: "row-reverse", justifyContent: "space-around", marginTop: 12, paddingVertical: 14 },
  tool: { alignItems: "center", gap: 6, minWidth: 64 },
  toolCircle: { width: 62, height: 62, borderRadius: 31, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, alignItems: "center", justifyContent: "center" },
  toggle: { flexDirection: "row-reverse", backgroundColor: t.field, borderRadius: 26, padding: 8, marginTop: 12, borderWidth: 1, borderColor: t.line },
  toggleItem: { flex: 1, minHeight: 56, borderRadius: 20, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 14 },
  note: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, minHeight: 50, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: t.line, backgroundColor: t.field },
});
