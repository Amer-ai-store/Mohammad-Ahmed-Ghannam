// "كيف نساعدك؟" — support conversation (server tickets) + latest notifications.
import React, { useCallback, useState } from "react";
import { Image, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Bell, ChevronLeft, Headset, ImageIcon, MessageSquareText, Package, SendHorizontal, Settings, Truck, UserRound } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { AccountPill, BrandHeader, Card, ErrorBlock, LoadingBlock, Segmented } from "../components/design/kit";
import { Companion } from "../components/character/Companion";
import { designAssets } from "../lib/designAssets";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { useStore } from "../lib/store";
import { pickImageDataUrl, type PickedImage } from "../lib/media";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";

type Ticket = { id: string; subject: string; message: string; status: string; createdAt: string; updatedAt: string; photos?: number; replies: { id: string; userId: string; name: string; message: string; createdAt: string }[] };
type Notice = { id: string; title: string; body: string; read: boolean; orderId?: string; createdAt: string };
const DEMO_NOTICES: Notice[] = [
  { id: "d1", title: "إرجاع منتج (مثال)", body: "تم استلام المنتج المرتجع بنجاح، وسيتم معالجة المبلغ خلال 3-5 أيام عمل (مثال).", read: false, createdAt: "" },
  { id: "d2", title: "تحديث الطلب (مثال)", body: "تم شحن الطلب LQ-DEMO-001 ومن المتوقع وصوله اليوم (مثال).", read: false, createdAt: "" },
];

export default function Support() {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ order?: string; tab?: string }>();
  const { user, configured } = useSession();
  const { notify } = useStore();
  const live = Boolean(user && configured);
  const [tab, setTab] = useState<"support" | "notifications">(params.tab === "notifications" ? "notifications" : "support");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!live) return; setLoading(true); setError("");
    try {
      const [tk, nt] = await Promise.all([api.get<{ tickets: Ticket[] }>("/tickets"), api.get<{ notifications: Notice[] }>("/notifications")]);
      setTickets(tk.tickets); setNotices(nt.notifications);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذّر تحميل الدعم"); }
    finally { setLoading(false); }
  }, [live]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const orderRef = params.order;
  const current = tickets.find((x) => x.status !== "resolved" && (!orderRef || x.subject.includes(orderRef))) || tickets.find((x) => x.status !== "resolved");
  async function send(message: string) {
    const body = message.trim();
    if (!live) { notify("سجّل الدخول واربط الخادم لمراسلة الدعم"); return; }
    if (body.length < 2 && !photo) return;
    setBusy(true); setError("");
    try {
      if (current) await api.post(`/tickets/${current.id}/replies`, { message: body || "صورة مرفقة", ...(photo ? { photo: photo.dataUrl } : {}) });
      else await api.post("/tickets", { subject: orderRef ? `الطلب رقم ${orderRef}` : "استفسار عام", message: body.length >= 5 ? body : `${body} — استفسار`, ...(photo ? { photo: photo.dataUrl } : {}) });
      setText(""); setPhoto(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذّر إرسال الرسالة"); }
    finally { setBusy(false); }
  }
  async function attach() { try { const p = await pickImageDataUrl(); if (p) setPhoto(p); } catch (e) { setError(e instanceof Error ? e.message : "تعذّر إرفاق الصورة"); } }
  async function markAll() { if (!live) return; try { await api.post("/notifications/read-all"); await load(); } catch { /* ignore */ } }
  const shown = live ? notices : DEMO_NOTICES;
  const demoThread = !live;
  return (
    <Shell header={<BrandHeader left={<AccountPill />} />} title="كيف نساعدك؟" subtitle="فريقنا جاهز للرد على استفساراتك" side={<Companion action="sit" base={112} enterFrom="right" />}>
      <Segmented value={tab} onChange={setTab} testID="support-tabs" options={[{ value: "support", label: "الدعم", icon: Headset }, { value: "notifications", label: "الإشعارات", icon: Bell }]} />
      {loading ? <LoadingBlock /> : null}
      {error ? <View style={{ marginTop: 10 }}><ErrorBlock message={error} onRetry={() => void load()} /></View> : null}
      {tab === "support" ? (
        <Card style={{ marginTop: 14 }} testID="support-thread">
          <View style={s.cardHead}><MessageSquareText size={26} color={t.title} /><Txt weight="bold" style={{ fontSize: 19, color: t.title }}>المحادثة الحالية</Txt></View>
          {demoThread ? (
            <>
              <View style={s.ref}><Package size={22} color={t.muted} /><Txt weight="bold" style={{ color: t.title, fontSize: 16 }}>الطلب رقم LQ-DEMO-001</Txt></View>
              <Txt style={{ color: t.muted, fontSize: 14, marginBottom: 8 }}>استفسار عن حالة التوصيل (مثال)</Txt>
              <Bubble mine text={"مرحباً،\nما هي حالة التوصيل للطلب رقم LQ-DEMO-001؟"} />
              <Bubble text={"أهلاً بك،\nالطلب LQ-DEMO-001 قيد التوصيل الآن ومن المتوقع وصوله اليوم."} />
              <Txt style={{ color: t.muted, fontSize: 12, textAlign: "center", marginTop: 6 }}>محادثة مثال. سجّل الدخول لمراسلة فريق الدعم فعليًا.</Txt>
            </>
          ) : current ? (
            <>
              <View style={s.ref}><Package size={22} color={t.muted} /><Txt weight="bold" style={{ color: t.title, fontSize: 16 }}>{current.subject}</Txt></View>
              <Bubble mine text={current.message} />
              {current.replies.map((r) => <Bubble key={r.id} mine={r.userId === user?.id} text={r.message} />)}
              {current.photos ? <Txt style={{ color: t.muted, fontSize: 12 }}>صور مرفقة: {current.photos}</Txt> : null}
            </>
          ) : <Txt style={{ color: t.muted, marginVertical: 10 }}>لا توجد محادثة مفتوحة. اكتب رسالتك وسنرد عليك.{orderRef ? ` (بخصوص الطلب ${orderRef})` : ""}</Txt>}
          {photo ? <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 8 }}><Image source={{ uri: photo.uri }} style={{ width: 44, height: 44, borderRadius: 8 }} /><Txt style={{ color: t.muted, fontSize: 12, flex: 1 }}>{photo.name}</Txt><Txt style={{ color: t.orange }} onPress={() => setPhoto(null)}>إزالة</Txt></View> : null}
          <View style={s.inputRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="إرسال" testID="support-send" disabled={busy} onPress={() => void send(text)} style={[s.send, busy && { opacity: 0.6 }]}>
              <Txt weight="bold" style={{ color: t.onAccent, fontSize: 17 }}>إرسال</Txt><SendHorizontal size={22} color={t.onAccent} style={{ transform: [{ scaleX: -1 }] }} />
            </Pressable>
            <TextInput testID="support-input" accessibilityLabel="اكتب رسالتك" value={text} onChangeText={setText} placeholder="اكتب رسالتك هنا..." placeholderTextColor={t.muted} style={s.input} />
            <Pressable accessibilityRole="button" accessibilityLabel="إرفاق صورة" onPress={() => void attach()} style={s.attach}><ImageIcon size={24} color={t.title} /><Txt style={{ fontSize: 10, color: t.title }}>إرفاق صورة</Txt></Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="طلب موظف" testID="ask-agent" onPress={() => void send("أرغب بالتحدث مع موظف خدمة العملاء")} style={s.agent}>
            <Txt weight="bold" style={{ color: t.orange, fontSize: 17 }}>طلب موظف</Txt><UserRound size={22} color={t.orange} fill={t.orange} />
          </Pressable>
        </Card>
      ) : null}
      <Card style={{ marginTop: 14 }} testID="notices">
        <View style={s.cardHead}><Bell size={24} color={t.title} fill={t.title} /><Txt weight="bold" style={{ fontSize: 19, color: t.title, flex: 1 }}>أحدث الإشعارات</Txt>{live && notices.some((n) => !n.read) ? <Txt style={{ color: t.orange, fontSize: 13 }} onPress={() => void markAll()}>تعيين الكل كمقروء</Txt> : null}</View>
        {!shown.length ? <Txt style={{ color: t.muted }}>لا توجد إشعارات بعد.</Txt> : null}
        {(tab === "support" ? shown.slice(0, 2) : shown).map((n) => {
          const isReturn = /إرجاع/.test(n.title);
          return (
            <Pressable key={n.id} accessibilityRole="button" accessibilityLabel={n.title} onPress={() => { if (live && !n.read) void api.patch(`/notifications/${n.id}`, { read: true }).then(load).catch(() => {}); if (n.orderId) router.push(`/tracking/${encodeURIComponent(n.orderId)}`); }} style={s.notice}>
              {!n.read ? <View style={s.dot} /> : <View style={{ width: 9 }} />}
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Txt weight="bold" style={{ color: t.title, fontSize: 16 }}>{n.title}</Txt>
                <Txt style={{ color: t.muted, fontSize: 13, lineHeight: 21 }}>{n.body}</Txt>
              </View>
              <View style={[s.noticeIcon, { backgroundColor: isReturn ? t.successSoft : t.infoSoft }]}>{isReturn ? <Package size={26} color={t.green} /> : <Truck size={26} color={t.info} />}</View>
              <ChevronLeft size={22} color={t.muted} />
            </Pressable>
          );
        })}
        <Pressable accessibilityRole="button" accessibilityLabel="إعدادات الإشعارات" onPress={() => router.push("/notification-settings")} style={s.settings}>
          <Settings size={22} color={t.title} /><Txt style={{ color: t.muted, fontSize: 15, flex: 1 }}>إعدادات الإشعارات</Txt><ChevronLeft size={22} color={t.muted} />
        </Pressable>
      </Card>
    </Shell>
  );
}

function Bubble({ text, mine = false }: { text: string; mine?: boolean }) {
  const { colors: t } = useTheme();
  return (
    <View style={{ flexDirection: mine ? "row-reverse" : "row", alignItems: "center", gap: 8, marginVertical: 6 }}>
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: mine ? t.purpleSoft : t.card, borderWidth: mine ? 0 : 1, borderColor: t.line, alignItems: "center", justifyContent: "center" }}>
        {mine ? <UserRound size={24} color={t.purple} fill={t.purple} /> : <Image source={designAssets.logoMark} style={{ width: 30, height: 30 }} resizeMode="contain" />}
      </View>
      <View style={{ flex: 1, backgroundColor: mine ? t.purpleSoft : t.card, borderRadius: 18, padding: 12, borderWidth: mine ? 0 : 1, borderColor: t.line }}>
        <Txt style={{ color: t.title, fontSize: 15, lineHeight: 24 }}>{text}</Txt>
      </View>
    </View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  cardHead: { flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingBottom: 10, borderBottomWidth: 1, borderColor: t.line, marginBottom: 8 },
  ref: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  send: { flexDirection: "row-reverse", alignItems: "center", gap: 8, minHeight: 52, paddingHorizontal: 18, borderRadius: 999, backgroundColor: t.orange },
  input: { flex: 1, minHeight: 52, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, paddingHorizontal: 14, fontFamily: "Tajawal_500Medium", fontSize: 15, color: t.ink, textAlign: "right" },
  attach: { alignItems: "center", justifyContent: "center", minWidth: 60 },
  agent: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 50, borderRadius: 999, borderWidth: 1.5, borderColor: t.chip, backgroundColor: t.orangeSoft, marginTop: 10 },
  notice: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderColor: t.line },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: t.orange },
  noticeIcon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  settings: { flexDirection: "row-reverse", alignItems: "center", gap: 10, minHeight: 52, backgroundColor: t.field, borderRadius: 14, paddingHorizontal: 12, marginTop: 10 },
});
