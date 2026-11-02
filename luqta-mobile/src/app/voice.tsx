// "البحث الصوتي" — record a short query (WebView MediaRecorder) → server transcription → search.
import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { Card, Field, InfoNote, LoadingBlock, SmallButton } from "../components/design/kit";
import { LensSurface, type LensMessage } from "../components/smart/LensSurface";
import { Companion } from "../components/character/Companion";
import { api } from "../lib/api";
import { cleanVoiceQuery } from "../lib/smart";
import { useSession } from "../lib/session";
import { useTheme } from "../lib/theme";

export default function VoiceSearch() {
  const { colors: t } = useTheme();
  const { configured, user } = useSession();
  const [heard, setHeard] = useState(""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false); const [listening, setListening] = useState(false);
  const go = (q: string) => { const query = cleanVoiceQuery(q); if (query) router.push({ pathname: "/explore", params: { q: query } }); };
  async function onLens(m: LensMessage) {
    if (m.type === "recording") { setListening(true); setMsg(""); return; }
    if (m.type === "error") { setListening(false); setMsg(m.code === "MIC_DENIED" ? "لم يُسمح بالميكروفون — فعّله من الأذونات." : "التسجيل الصوتي غير مدعوم هنا — استخدم ميكروفون لوحة المفاتيح في مربع البحث."); return; }
    if (m.type !== "audio") return;
    setListening(false);
    if (!configured || !user) { setMsg("تحويل الصوت لنص يتم على خادم المتجر؛ سجّل الدخول أولًا أو استخدم ميكروفون لوحة المفاتيح."); return; }
    setBusy(true);
    try { const r = await api.post<{ text: string }>("/ai/transcribe", { audio: m.dataUrl }); setHeard(r.text); if (r.text) go(r.text); else setMsg("لم نفهم التسجيل، حاول مجددًا."); }
    catch (e) { setMsg(e instanceof Error ? e.message : "تعذّر تحويل الصوت"); } finally { setBusy(false); }
  }
  return (
    <Shell title="البحث الصوتي" subtitle="اضغط وتحدث: «ابحث عن سماعات لاسلكية»">
      <View style={{ alignItems: "center" }}><Companion action={listening ? "listen" : busy ? "think" : "wave"} base={120} enterFrom="none" /></View>
      <LensSurface mode="voice" onMessage={(m) => void onLens(m)} height={150} />
      {busy ? <LoadingBlock label="نحوّل صوتك إلى نص…" /> : null}
      {heard ? <Card style={{ marginTop: 12 }}><Txt style={{ color: t.muted }}>سمعنا:</Txt><Txt weight="bold" style={{ fontSize: 18, color: t.title }}>{heard}</Txt></Card> : null}
      {msg ? <View style={{ marginTop: 10 }}><InfoNote text={msg} tone="warn" /></View> : null}
      <Card style={{ marginTop: 12 }}>
        <Field label="أو اكتب/أملِ بالكيبورد" placeholder="أو اكتب/أملِ بميكروفون لوحة المفاتيح" value={heard} onChangeText={setHeard} onSubmitEditing={() => go(heard)} testID="voice-text" />
        <SmallButton title="بحث" onPress={() => go(heard)} style={{ marginTop: 8 }} />
      </Card>
    </Shell>
  );
}
