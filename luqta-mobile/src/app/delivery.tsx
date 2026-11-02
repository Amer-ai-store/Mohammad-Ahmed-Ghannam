// "وين نوصلك؟" — address details + delivery time slot.
import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import * as Location from "expo-location";
import { CircleCheck, ChevronDown, Clock, Crosshair, MapPin, Moon, Plus, Sun, Sunset } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { BrandHeader, Card, CTA, Field, FieldRow, HeaderPill, SmallButton } from "../components/design/kit";
import { MapArt } from "../components/design/MapArt";
import { Companion } from "../components/character/Companion";
import { useStore } from "../lib/store";
import { useSession } from "../lib/session";
import { api } from "../lib/api";
import { deliverySlots, type Address, type DeliverySlot } from "../lib/commerce-types";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";

const JO_CITIES: Record<string, string[]> = {
  "عمان": ["الهاشمي", "صويلح", "خلدا", "الجبيهة", "عبدون", "الشميساني", "ماركا", "طبربور", "تلاع العلي", "جبل الحسين"],
  "الزرقاء": ["الزرقاء الجديدة", "الرصيفة", "حي معصوم"],
  "إربد": ["الحصن", "حي التركمان", "شارع الجامعة"],
  "العقبة": ["المنطقة الخامسة", "الشلالة"],
  "السلط": ["البقعة", "عين الباشا"],
  "مادبا": ["وسط البلد", "حي النزهة"],
};
const slotIcons: Record<DeliverySlot, typeof Sun> = { morning: Sun, afternoon: Sunset, evening: Moon };
type FormState = { name: string; phone: string; city: string; district: string; street: string; building: string; details: string; latitude?: number; longitude?: number; id?: string };

function parseStreet(a?: Address): Pick<FormState, "district" | "street" | "building" | "details"> {
  const raw = a?.street || "";
  const parts = raw.split("، ").map((x) => x.trim());
  return { district: parts[0] && Object.values(JO_CITIES).flat().includes(parts[0]) ? parts[0] : "الهاشمي", street: parts[1] || raw, building: (parts[2] || "").replace(/^رقم\s*/, ""), details: parts.slice(3).join("، ") };
}

export default function Delivery() {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { draft, updateDraft, notify } = useStore();
  const { user } = useSession();
  const [saved, setSaved] = useState<Address[]>([]);
  const initial = draft.address;
  const [form, setForm] = useState<FormState>({ name: initial?.name || user?.name || "", phone: initial?.phone || "", city: initial?.city || "عمان", ...parseStreet(initial), latitude: initial?.latitude, longitude: initial?.longitude, id: initial?.id });
  const [slot, setSlot] = useState<DeliverySlot>(draft.slot);
  const [picker, setPicker] = useState<"none" | "city" | "district">("none");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user) return; let active = true;
    api.get<{ addresses: Address[] }>("/addresses").then((r) => { if (!active) return; setSaved(r.addresses); const d = r.addresses.find((a) => a.isDefault) || r.addresses[0]; if (d && !draft.address) setForm((f) => ({ ...f, name: d.name, phone: d.phone, city: d.city, ...parseStreet(d), latitude: d.latitude, longitude: d.longitude, id: d.id })); }).catch(() => {});
    return () => { active = false; };
  }, [user, draft.address]);
  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  async function locate() {
    setLocating(true); setError("");
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      if (p.status !== "granted") throw new Error("لم تمنح إذن الموقع. يمكنك كتابة العنوان يدويًا.");
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setForm((f) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
      notify("حُدد موقعك على الخريطة");
    } catch (e) { setError(e instanceof Error ? e.message : "تعذّر تحديد الموقع"); }
    finally { setLocating(false); }
  }
  async function save() {
    setError("");
    if (form.name.trim().length < 2) return setError("أدخل اسم المستلم");
    if (form.phone.replace(/\D/g, "").length < 9) return setError("أدخل رقم هاتف صحيح");
    if (form.street.trim().length < 3) return setError("أدخل اسم الشارع");
    const address: Address = {
      id: form.id, name: form.name.trim(), phone: form.phone.trim(), city: form.city,
      street: [form.district, form.street.trim(), form.building.trim() ? `رقم ${form.building.trim()}` : "", form.details.trim()].filter(Boolean).join("، "),
      latitude: form.latitude, longitude: form.longitude, label: form.district,
    };
    setBusy(true);
    try {
      if (user) {
        const r = form.id ? await api.patch<{ address: Address }>(`/addresses/${form.id}`, address) : await api.post<{ address: Address }>("/addresses", { ...address, isDefault: !saved.length });
        address.id = r.address.id;
      }
      updateDraft({ address, slot });
      router.push("/payment");
    } catch (e) { setError(e instanceof Error ? e.message : "تعذّر حفظ العنوان"); }
    finally { setBusy(false); }
  }
  const options = picker === "city" ? Object.keys(JO_CITIES) : JO_CITIES[form.city] || [];
  return (
    <Shell header={<BrandHeader left={<HeaderPill label={locating ? "جارٍ التحديد…" : "استخدم موقعي"} icon={MapPin} onPress={() => void locate()} testID="use-location" />} />}
      title="وين نوصلك؟" subtitle="اختر عنوانك وحدد وقت التوصيل المناسب لك." side={<Companion action="point" base={120} enterFrom="right" />}>
      <View style={s.mapWrap}>
        <MapArt height={170} pin />
        <Pressable accessibilityRole="button" accessibilityLabel="حدد على الخريطة" testID="pick-on-map" onPress={() => void locate()} style={s.mapBtn}>
          <Txt weight="medium" style={{ fontSize: 15, color: t.ink }}>حدد على الخريطة</Txt><Crosshair size={22} color={t.ink} />
        </Pressable>
        {form.latitude !== undefined ? <View style={s.coords}><Txt style={{ fontSize: 11, color: t.ink }}>{form.latitude.toFixed(5)}، {form.longitude?.toFixed(5)}</Txt></View> : null}
      </View>
      {saved.length > 1 ? (
        <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          {saved.map((a) => <SmallButton key={a.id} title={a.label || a.city} tone={a.id === form.id ? "primary" : "outline"} onPress={() => setForm({ name: a.name, phone: a.phone, city: a.city, ...parseStreet(a), latitude: a.latitude, longitude: a.longitude, id: a.id })} />)}
        </View>
      ) : null}
      <Card style={{ marginTop: 12 }}>
        <View style={s.cardTitle}><MapPin size={24} color={t.orange} fill={t.orange} /><Txt weight="bold" style={s.cardTitleText}>تفاصيل العنوان</Txt></View>
        <FieldRow label="المدينة"><Pressable accessibilityRole="button" accessibilityLabel={`المدينة: ${form.city}`} onPress={() => setPicker("city")} style={s.select}><Txt style={{ flex: 1, color: t.ink, fontSize: 16 }}>{form.city}</Txt><ChevronDown size={20} color={t.ink} /></Pressable></FieldRow>
        <FieldRow label="الحي"><Pressable accessibilityRole="button" accessibilityLabel={`الحي: ${form.district}`} onPress={() => setPicker("district")} style={s.select}><Txt style={{ flex: 1, color: t.ink, fontSize: 16 }}>{form.district}</Txt><ChevronDown size={20} color={t.ink} /></Pressable></FieldRow>
        <FieldRow label="الشارع"><Field label="الشارع" value={form.street} onChangeText={set("street")} placeholder="شارع الأمير راشد بن الحسن" testID="addr-street" /></FieldRow>
        <FieldRow label="رقم المبنى"><Field label="رقم المبنى" value={form.building} onChangeText={set("building")} placeholder="12" keyboardType="number-pad" /></FieldRow>
        <FieldRow label="المستلم"><Field label="اسم المستلم" value={form.name} onChangeText={set("name")} placeholder="الاسم" testID="addr-name" /></FieldRow>
        <FieldRow label="الهاتف"><Field label="رقم الهاتف" value={form.phone} onChangeText={set("phone")} placeholder="07XXXXXXXX" keyboardType="phone-pad" testID="addr-phone" /></FieldRow>
        <Txt style={{ color: t.muted, fontSize: 15, marginTop: 4, marginBottom: 8 }}>تفاصيل إضافية (اختياري)</Txt>
        <Field label="تفاصيل إضافية" value={form.details} onChangeText={set("details")} placeholder="مثل: الطابق، اسم العمارة، ملاحظات التوصيل" />
      </Card>
      <Card style={{ marginTop: 12 }}>
        <View style={s.cardTitle}><Clock size={24} color={t.orange} /><Txt weight="bold" style={s.cardTitleText}>وقت التوصيل</Txt></View>
        <View style={{ flexDirection: "row-reverse", gap: 10 }}>
          {deliverySlots.map((d) => {
            const Icon = slotIcons[d.id]; const active = d.id === slot;
            return (
              <Pressable key={d.id} accessibilityRole="radio" accessibilityState={{ checked: active }} accessibilityLabel={`${d.label} ${d.time}`} testID={`slot-${d.id}`} onPress={() => setSlot(d.id)} style={[s.slot, active && s.slotActive]}>
                {active ? <View style={s.slotCheck}><CircleCheck size={22} color={t.onAccent} fill={t.orange} /></View> : null}
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}><Icon size={20} color={active ? t.orange : t.title} /><Txt weight="bold" style={{ fontSize: 16, color: active ? t.orange : t.title }}>{d.label}</Txt></View>
                <Txt style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>{d.time}</Txt>
              </Pressable>
            );
          })}
        </View>
      </Card>
      {error ? <Txt accessibilityRole="alert" style={{ color: t.danger, marginTop: 10 }}>{error}</Txt> : null}
      <CTA title="حفظ العنوان والموعد" testID="delivery-save" busy={busy} onPress={() => void save()} style={{ marginTop: 14 }} />
      <Pressable accessibilityRole="button" accessibilityLabel="إضافة عنوان آخر" onPress={() => setForm({ name: user?.name || "", phone: "", city: "عمان", district: "الهاشمي", street: "", building: "", details: "" })} style={s.addAnother}>
        <Txt weight="medium" style={{ fontSize: 16, color: t.ink }}>إضافة عنوان آخر</Txt><Plus size={22} color={t.ink} />
      </Pressable>
      <Modal visible={picker !== "none"} transparent animationType="fade" onRequestClose={() => setPicker("none")}>
        <Pressable style={s.backdrop} onPress={() => setPicker("none")}>
          <View style={s.sheet}>
            <Txt weight="extra" style={{ fontSize: 20, color: t.title, marginBottom: 8 }}>{picker === "city" ? "اختر المدينة" : "اختر الحي"}</Txt>
            {options.map((o) => (
              <Pressable key={o} accessibilityRole="button" onPress={() => { if (picker === "city") setForm((f) => ({ ...f, city: o, district: JO_CITIES[o][0] })); else setForm((f) => ({ ...f, district: o })); setPicker("none"); }} style={s.sheetRow}>
                <Txt style={{ color: t.ink, fontSize: 16 }}>{o}</Txt>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </Shell>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  mapWrap: { borderRadius: 26, borderWidth: 2, borderColor: t.card, overflow: "hidden" },
  mapBtn: { position: "absolute", top: 12, left: 12, flexDirection: "row-reverse", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 16, borderRadius: 999, backgroundColor: t.card },
  coords: { position: "absolute", bottom: 8, right: 10, backgroundColor: t.card, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  cardTitle: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 12 },
  cardTitleText: { fontSize: 19, color: t.title },
  select: { flexDirection: "row-reverse", alignItems: "center", minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: t.line, backgroundColor: t.field, paddingHorizontal: 14 },
  slot: { flex: 1, borderRadius: 18, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, paddingVertical: 14, paddingHorizontal: 6, alignItems: "center" },
  slotActive: { borderColor: t.orange, backgroundColor: t.orangeSoft },
  slotCheck: { position: "absolute", top: 6, left: 6 },
  addAnother: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 52, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, marginTop: 10 },
  backdrop: { flex: 1, backgroundColor: "rgba(19,0,80,0.35)", justifyContent: "flex-end" },
  sheet: { backgroundColor: t.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34, maxHeight: "70%" },
  sheetRow: { minHeight: 50, justifyContent: "center", borderBottomWidth: 1, borderColor: t.line },
});
