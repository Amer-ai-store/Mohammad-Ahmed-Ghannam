// "تسوق بالمحادثة" — chat shopping with basket suggestions (reference design).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { Calculator, Camera, Mic, Plus, SendHorizontal, ShoppingCart, UserRound, Volume2, VolumeX } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { Card, Chip, CTA } from "../components/design/kit";
import { ProductImage } from "../components/ProductCard";
import { Companion } from "../components/character/Companion";
import { formatPrice } from "../data/products";
import { designAssets } from "../lib/designAssets";
import { useStore } from "../lib/store";
import { useCharacter } from "../lib/character";
import { recommendProducts } from "../lib/recommendations";
import { askAssistant, checkAssistant } from "../lib/assistant";
import { buildBasket, parseBasketRequest, type BasketLine } from "../lib/basket";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";

type Message = { role: "user" | "assistant"; content: string; lines?: BasketLine[] };

export default function Assistant() {
  const { q, mode } = useLocalSearchParams<{ q?: string; mode?: string }>();
  return <AssistantContent key={`${q || ""}:${mode || ""}`} initialPrompt={q || ""} photoMode={mode === "photo"} />;
}

function AssistantContent({ initialPrompt, photoMode }: { initialPrompt: string; photoMode: boolean }) {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { products, settings, cart, setQuantity, notify, catalogStatus } = useStore();
  const { profile, update } = useCharacter();
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "أهلًا! أخبرني بما تحتاجه أو بميزانيتك، مثل: «جهّز لي سلة بـ 20 دينار»، وسأقترح عليك من منتجات المتجر." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [serverAssistant, setServerAssistant] = useState(false);
  const [hint, setHint] = useState("");
  const inputRef = useRef<TextInput>(null);
  const sentInitial = useRef(false);
  useEffect(() => { let a = true; checkAssistant().then((v) => { if (a) setServerAssistant(v); }); return () => { a = false; }; }, []);
  const available = useMemo(() => products.filter((p) => !p.variantOf && (p.stock === undefined || p.stock > 0)), [products]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput(""); setHint("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    setBusy(true);
    try {
      const basket = parseBasketRequest(message);
      if (basket) {
        const r = buildBasket(basket.budget, available);
        setMessages((m) => [...m, { role: "assistant", content: r.message, lines: r.lines }]);
      } else {
        const r = serverAssistant ? await askAssistant(message, messages.map(({ role, content }) => ({ role, content }))) : recommendProducts(message, available, settings.currency);
        const lines = r.productIds.filter((id: string) => available.some((p) => p.id === id)).slice(0, 4).map((id: string) => ({ productId: id, quantity: 1, price: available.find((p) => p.id === id)!.price }));
        setMessages((m) => [...m, { role: "assistant", content: r.message, lines }]);
      }
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : "تعذّر الرد الآن، حاول مجددًا." }]);
    } finally { setBusy(false); }
  }
  useEffect(() => {
    if (sentInitial.current) return; sentInitial.current = true;
    if (initialPrompt) void send(initialPrompt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function pickPhoto() {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: "image/*", copyToCacheDirectory: true, multiple: false });
      if (picked.canceled || !picked.assets?.[0]) return;
      setMessages((m) => [...m, { role: "user", content: `📷 صورة منتج: ${picked.assets[0].name}` }, {
        role: "assistant",
        content: "استلمت الصورة على جهازك. التعرف على المنتج من الصورة يحتاج تفعيل خدمة الرؤية على خادم المتجر، وهي غير مفعّلة في هذه النسخة؛ اكتب اسم المنتج أو وصفه وسأجده لك.",
      }]);
      inputRef.current?.focus();
    } catch { notify("تعذّر فتح الصور"); }
  }
  useEffect(() => { if (photoMode) void pickPhoto(); /* open picker on arrival from the camera button */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoMode]);

  const lastLines = [...messages].reverse().find((m) => m.lines?.length)?.lines || [];
  const estimate = lastLines.reduce((a, l) => a + l.price * l.quantity, 0);
  const addLine = (l: BasketLine) => { setQuantity(l.productId, (cart[l.productId] || 0) + l.quantity); notify("أُضيف إلى السلة — لن يُطلب شيء قبل تأكيدك"); };
  const reviewAll = () => { lastLines.forEach((l) => setQuantity(l.productId, Math.max(cart[l.productId] || 0, l.quantity))); router.push("/cart"); };

  const footer = (
    <View style={s.inputBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="تحدث" onPress={() => { setHint("استخدم ميكروفون لوحة المفاتيح للإملاء الصوتي ثم اضغط إرسال."); inputRef.current?.focus(); }} style={s.micBtn}><Mic size={26} color={t.onAccent} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="أرسل صورة منتج" onPress={() => void pickPhoto()} style={s.cameraBtn}><Camera size={26} color={t.ink} /></Pressable>
      <TextInput ref={inputRef} testID="chat-input" accessibilityLabel="اكتب أو احكي" value={input} onChangeText={setInput} onSubmitEditing={() => void send(input)} returnKeyType="send" placeholder="اكتب أو احكي..." placeholderTextColor={t.muted} style={s.input} />
      <Pressable accessibilityRole="button" accessibilityLabel="إرسال" testID="chat-send" disabled={busy || !input.trim()} onPress={() => void send(input)} style={[s.send, (!input.trim() || busy) && { opacity: 0.55 }]}>
        <SendHorizontal size={26} color={t.onAccent} style={{ transform: [{ scaleX: -1 }] }} />
      </Pressable>
    </View>
  );
  return (
    <Shell title="تسوق بالمحادثة" subtitle="أخبرني بما تحتاجه، وسأجهز لك أفضل الخيارات من متجري." side={<Companion action="listen" base={128} enterFrom="right" />} footer={footer}>
      <View style={{ gap: 12 }} accessibilityLiveRegion="polite">
        {messages.map((m, i) => m.role === "user" ? (
          <View key={i} style={s.userRow}>
            <View style={s.userBubble}><Txt weight="medium" style={{ fontSize: 17, color: t.title }}>{m.content}</Txt></View>
            <View style={s.avatar}><UserRound size={26} color={t.purple} fill={t.purple} /></View>
          </View>
        ) : (
          <View key={i} style={s.botRow}>
            <View style={s.botAvatar}><Image source={designAssets.logoMark} style={{ width: 34, height: 34 }} resizeMode="contain" /></View>
            <View style={s.botBubble}><Txt style={{ fontSize: 16, lineHeight: 27, color: t.title }}>{m.content}</Txt></View>
          </View>
        ))}
        {busy ? <Txt style={{ color: t.muted, textAlign: "center" }}>يكتب المساعد…</Txt> : null}
        {messages.length === 1 && !busy ? (
          <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
            {["جهّز لي سلة بـ 20 دينار", "سماعات لاسلكية", "أساسيات الفطور تحت 10 دينار", "هدية بحدود 30 دينار"].map((p) => (
              <Pressable key={p} accessibilityRole="button" accessibilityLabel={p} testID={`prompt-${p.slice(0, 8)}`} onPress={() => void send(p)} style={s.prompt}><Txt style={{ color: t.purple, fontSize: 14 }}>{p}</Txt></Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {lastLines.length ? (
        <Card style={{ marginTop: 14 }} testID="basket-suggestions">
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
            <ShoppingCart size={26} color={t.orange} /><Txt weight="extra" style={{ fontSize: 20, color: t.title, flex: 1 }}>مقترحات السلة</Txt>
            {catalogStatus !== "connected" ? <Chip label="مقترحات تجريبية" tone="demo" /> : null}
          </View>
          <Txt style={{ color: t.muted, fontSize: 13, marginTop: 4 }}>مختارة من كتالوج المتجر بناء على طلبك.</Txt>
          {lastLines.map((l) => {
            const p = products.find((x) => x.id === l.productId); if (!p) return null;
            return (
              <View key={l.productId} style={s.line}>
                <View style={{ width: 70, height: 80 }}><ProductImage product={p} /></View>
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Txt weight="bold" style={{ fontSize: 17, color: t.title }}>{p.name}{l.quantity > 1 ? ` × ${l.quantity}` : ""}</Txt>
                  <Txt style={{ fontSize: 14, color: t.mutedSoft }}>{p.unit || p.subtitle}</Txt>
                  <Txt weight="bold" style={{ fontSize: 17, color: t.orange }}>{formatPrice(p.price, settings.currency)}</Txt>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`أضف ${p.name}`} testID={`suggest-add-${p.id}`} onPress={() => addLine(l)} style={s.addBtn}>
                  <Txt weight="bold" style={{ color: t.onAccent, fontSize: 17 }}>{cart[p.id] ? "أُضيف" : "أضف"}</Txt><Plus size={20} color={t.onAccent} />
                </Pressable>
              </View>
            );
          })}
          <View style={s.estimate}>
            <Calculator size={26} color={t.purple} /><Txt weight="medium" style={{ fontSize: 16, color: t.title, flex: 1 }}>المجموع التقديري</Txt>
            <Txt weight="extra" style={{ fontSize: 24, color: t.orange }}>{formatPrice(estimate, settings.currency)}</Txt>
          </View>
          <Txt style={{ color: t.muted, fontSize: 13, marginTop: 8 }}>يمكنك إضافة أو إزالة منتجات قبل المتابعة.</Txt>
        </Card>
      ) : null}
      {lastLines.length ? <CTA title="راجع السلة المقترحة" testID="review-basket" onPress={reviewAll} style={{ marginTop: 12 }} /> : null}
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: !profile.sound }} accessibilityLabel={profile.sound ? "إيقاف الصوت" : "تشغيل الصوت"} onPress={() => update({ sound: !profile.sound })} style={s.voice}>
        <Txt weight="medium" style={{ color: t.ink, fontSize: 15 }}>{profile.sound ? "إيقاف الصوت" : "تشغيل الصوت"}</Txt>
        {profile.sound ? <VolumeX size={22} color={t.purple} /> : <Volume2 size={22} color={t.purple} />}
      </Pressable>
      {hint ? <Txt style={{ color: t.muted, fontSize: 12, textAlign: "center", marginTop: 6 }}>{hint}</Txt> : null}
      <Txt style={{ color: t.mutedSoft, fontSize: 11, textAlign: "center", marginTop: 6 }}>{serverAssistant ? "مساعد الخادم متصل" : "توصيات محلية من كتالوج المتجر"} · المساعد يقترح فقط ولا يشتري عنك.</Txt>
    </Shell>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  userRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  userBubble: { backgroundColor: t.purpleSoft, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 14, maxWidth: "75%" },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: t.purpleSoft, alignItems: "center", justifyContent: "center", marginRight: "auto" },
  botRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  botAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: t.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: t.line },
  botBubble: { flex: 1, backgroundColor: t.card, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 14, borderWidth: 1, borderColor: t.line },
  line: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: 1, borderColor: t.line, marginTop: 8 },
  addBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 22, borderRadius: 999, backgroundColor: t.orange },
  estimate: { flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: t.field, borderRadius: 16, padding: 14, marginTop: 6 },
  prompt: { paddingHorizontal: 14, minHeight: 40, justifyContent: "center", borderRadius: 999, backgroundColor: t.purpleSoft, borderWidth: 1, borderColor: t.line },
  voice: { flexDirection: "row-reverse", alignItems: "center", gap: 8, alignSelf: "center", minHeight: 46, paddingHorizontal: 20, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, marginTop: 12 },
  inputBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.card, borderRadius: 999, borderWidth: 1, borderColor: t.line, padding: 6 },
  send: { width: 52, height: 52, borderRadius: 26, backgroundColor: t.orange, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, minHeight: 48, borderRadius: 999, backgroundColor: t.field, paddingHorizontal: 16, fontFamily: "IBMPlexSansArabic_500Medium", fontSize: 16, color: t.ink, textAlign: "right", writingDirection: "rtl" },
  cameraBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: t.field, alignItems: "center", justifyContent: "center" },
  micBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: t.purple, alignItems: "center", justifyContent: "center" },
});
