// "اصنع شخصيتك" — photo → preview → customise. Processing happens on the device.
import React, { useRef, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Lock, RotateCcw, Upload } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { Card, Checkbox, Chip, CTA, ErrorBlock } from "../components/design/kit";
import { CaptureButton } from "../components/character/CaptureButton";
import { Companion, type CompanionHandle } from "../components/character/Companion";
import { designAssets } from "../lib/designAssets";
import { useCharacter } from "../lib/character";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";

export default function CharacterCreate() {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { profile, save } = useCharacter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [consent, setConsent] = useState(false);
  const [raw, setRaw] = useState<string | null>(null);
  const [processed, setProcessed] = useState<{ dataUrl: string; skin: string; hair: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const preview = useRef<CompanionHandle>(null);

  async function upload() {
    setError("");
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ["image/jpeg", "image/png", "image/webp"], copyToCacheDirectory: true });
      if (r.canceled || !r.assets?.[0]) return;
      const a = r.assets[0];
      if (a.size && a.size > 8_000_000) { setError("الصورة كبيرة جدًا؛ اختر صورة أقل من 8 ميغابايت."); return; }
      const b64 = await FileSystem.readAsStringAsync(a.uri, { encoding: FileSystem.EncodingType.Base64 });
      setRaw(`data:${a.mimeType && /image\/(png|webp)/.test(a.mimeType) ? a.mimeType : "image/jpeg"};base64,${b64}`);
    } catch { setError("تعذّر فتح الصورة"); }
  }
  async function toPreview() {
    if (!raw) { setError("التقط صورة أو ارفع صورة أولًا"); return; }
    if (!consent) { setError("وافق على استخدام صورتك لإنشاء الشخصية"); return; }
    setError(""); setStep(2); setBusy(true);
    // the preview companion queues the request until its WebGL page is ready
    setTimeout(async () => {
      try {
        const out = await preview.current!.processFace(raw);
        setProcessed(out);
        await save({ ...profile, faceDataUrl: out.dataUrl, skin: out.skin, hair: out.hair, consentAt: new Date().toISOString(), createdAt: profile.createdAt || new Date().toISOString() });
      } catch (e) { setError(e instanceof Error ? e.message : "تعذّرت معالجة الصورة"); }
      finally { setBusy(false); }
    }, 60);
  }
  const steps = [{ n: 1, l: "صورة" }, { n: 2, l: "معاينة" }, { n: 3, l: "تخصيص" }];
  return (
    <Shell title="اصنع شخصيتك" subtitle="حوّل صورتك إلى شخصية ثلاثية الأبعاد خاصة بك">
      <View style={s.stepper} accessibilityLabel={`الخطوة ${step} من 3`}>
        {steps.map((st, i) => (
          <React.Fragment key={st.n}>
            {i > 0 ? <View style={[s.bar, { backgroundColor: step > i ? t.orange : t.line }]} /> : null}
            <View style={{ alignItems: "center", gap: 6 }}>
              <View style={[s.num, step >= st.n ? { backgroundColor: t.orange } : { backgroundColor: t.purpleSoft }]}><Txt weight="bold" style={{ color: step >= st.n ? t.onAccent : t.muted, fontSize: 18 }}>{st.n}</Txt></View>
              <Txt style={{ color: step >= st.n ? t.title : t.muted, fontSize: 15 }}>{st.l}</Txt>
            </View>
          </React.Fragment>
        ))}
      </View>

      {step === 1 ? (
        <Card style={{ marginTop: 12 }}>
          <View style={s.drop}>
            {raw ? <Image source={{ uri: raw }} style={s.photo} resizeMode="cover" /> : <Image source={designAssets.camera3d} style={{ width: 170, height: 125 }} resizeMode="contain" />}
            <Txt weight="bold" style={{ fontSize: 19, color: t.title, marginTop: 10 }}>{raw ? "تم اختيار الصورة" : "التقط صورة واضحة لوجهك"}</Txt>
            <Txt style={{ color: t.muted, fontSize: 14, textAlign: "center" }}>يفضل أن تكون الصورة من الأمام وبإضاءة جيدة</Txt>
          </View>
          <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 12 }}>
            <CaptureButton label="التقط صورة" color={t.orange} onPhoto={(d) => { setRaw(d); setError(""); }} onError={setError} />
            <Pressable accessibilityRole="button" accessibilityLabel="ارفع صورة" testID="upload-photo" onPress={() => void upload()} style={s.uploadBtn}>
              <Txt weight="bold" style={{ color: t.title, fontSize: 18 }}>ارفع صورة</Txt><Upload size={24} color={t.title} />
            </Pressable>
          </View>
          <View style={s.example}>
            <View style={{ flex: 1, alignItems: "center", gap: 6 }}>
              <Chip label="مثال" tone="demo" />
              <Txt style={{ color: t.title, fontSize: 16, textAlign: "center", lineHeight: 26 }}>هكذا ستبدو{"\n"}شخصيتك الثلاثية الأبعاد</Txt>
            </View>
            <Companion action="crossed" base={130} enterFrom="none" />
          </View>
          <View style={{ marginTop: 10, borderWidth: 1, borderColor: t.line, borderRadius: 16, paddingHorizontal: 10 }}>
            <Checkbox checked={consent} onChange={setConsent} testID="photo-consent" label="أوافق على استخدام صورتي لإنشاء شخصيتي" />
          </View>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 }}>
            <Lock size={16} color={t.muted} /><Txt style={{ color: t.muted, fontSize: 14 }}>يمكنك حذف الصورة والشخصية في أي وقت</Txt>
          </View>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card style={{ marginTop: 12, alignItems: "center" }}>
          <Companion ref={preview} action="wave" fixedHeight={300} enterFrom="none" />
          {busy ? <Txt style={{ color: t.muted, marginTop: 8 }}>نجهّز شخصيتك على جهازك…</Txt> : processed ? (
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12, marginTop: 8 }}>
              <Image source={{ uri: processed.dataUrl }} style={{ width: 64, height: 64, borderRadius: 32 }} />
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row-reverse", gap: 8, alignItems: "center" }}><View style={[s.sw, { backgroundColor: processed.skin }]} /><Txt style={{ color: t.muted }}>لون البشرة</Txt></View>
                <View style={{ flexDirection: "row-reverse", gap: 8, alignItems: "center" }}><View style={[s.sw, { backgroundColor: processed.hair }]} /><Txt style={{ color: t.muted }}>لون الشعر</Txt></View>
              </View>
            </View>
          ) : null}
          <Txt style={{ color: t.muted, fontSize: 12, textAlign: "center", marginTop: 8 }}>تُستخدم صورة وجهك المقصوصة (256 بكسل) لكسوة رأس الشخصية، وتؤخذ ألوان البشرة والشعر منها. تبقى على هذا الجهاز فقط.</Txt>
          <Pressable accessibilityRole="button" accessibilityLabel="إعادة الالتقاط" onPress={() => { setStep(1); setProcessed(null); }} style={{ flexDirection: "row-reverse", gap: 6, alignItems: "center", padding: 10 }}><RotateCcw size={18} color={t.orange} /><Txt style={{ color: t.orange }}>إعادة الالتقاط</Txt></Pressable>
        </Card>
      ) : null}

      {error ? <View style={{ marginTop: 10 }}><ErrorBlock message={error} /></View> : null}
      {step === 1 ? <CTA title="متابعة" testID="create-continue" disabled={!raw || !consent} onPress={() => void toPreview()} style={{ marginTop: 14 }} /> : null}
      {step === 2 ? <CTA title="متابعة إلى التخصيص" busy={busy} disabled={!processed} onPress={() => { setStep(3); router.replace("/character"); }} style={{ marginTop: 14 }} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="تخطي الآن" testID="create-skip" onPress={() => router.replace("/character")} style={s.skip}>
        <Txt weight="bold" style={{ color: t.title, fontSize: 18 }}>تخطي الآن</Txt>
      </Pressable>
    </Shell>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  stepper: { flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "center", marginTop: 4 },
  bar: { width: 70, height: 3, borderRadius: 2, marginTop: 23, marginHorizontal: 6 },
  num: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  drop: { borderWidth: 1.5, borderStyle: "dashed", borderColor: t.mutedSoft, borderRadius: 22, padding: 16, alignItems: "center" },
  photo: { width: 150, height: 150, borderRadius: 75 },
  uploadBtn: { flex: 1, height: 56, borderRadius: 999, backgroundColor: t.purpleSoft, borderWidth: 1, borderColor: t.line, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 10 },
  example: { flexDirection: "row-reverse", alignItems: "center", backgroundColor: t.orangeSoft, borderRadius: 20, padding: 10, marginTop: 12 },
  sw: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: t.line },
  skip: { minHeight: 52, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, alignItems: "center", justifyContent: "center", marginTop: 10 },
});
