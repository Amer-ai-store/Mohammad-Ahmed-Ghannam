import React, { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import * as Location from "expo-location";
import { Shell } from "../components/Shell";
import { Button, Txt } from "../components/ui";
import { AccountCard, AccountGate, errorMessage, FormField, FormMessage } from "../components/AccountKit";
import { api } from "../lib/api";
import { useAccountResource } from "../lib/accountResource";
import { useTheme } from "../lib/theme";

type Address = { id: string; label?: string; name: string; phone: string; city: string; street: string; latitude?: number; longitude?: number; isDefault?: boolean };
const blank = { id: "", label: "", name: "", phone: "", city: "", street: "", latitude: "", longitude: "", isDefault: false };
function coordinate(value: string) { return Number(value.trim().replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776)).replace("٫", ".")); }
function AddressContent() {
  const { colors: t } = useTheme();
  const resource = useAccountResource<{ addresses: Address[] }>("/addresses");
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const field = (key: keyof typeof blank, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setMessage(""); setSuccess(false);
    if (form.name.trim().length < 2 || form.city.trim().length < 2 || form.street.trim().length < 4 || form.phone.replace(/\D/g, "").length < 8) { setMessage("أكمل اسم المستلم ورقم هاتف صالح والمدينة والعنوان التفصيلي."); return; }
    let point: { latitude?: number; longitude?: number } = {};
    if (form.latitude.trim() || form.longitude.trim()) {
      const latitude = coordinate(form.latitude), longitude = coordinate(form.longitude);
      if (!form.latitude.trim() || !form.longitude.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) { setMessage("أدخل خط عرض بين ‎-90 و90 وخط طول بين ‎-180 و180، أو اترك الحقلين فارغين."); return; }
      point = { latitude, longitude };
    }
    setBusy("save");
    try {
      const body = { label: form.label.trim(), name: form.name.trim(), phone: form.phone.trim(), city: form.city.trim(), street: form.street.trim(), isDefault: form.isDefault, ...point };
      if (form.id) await api.patch(`/addresses/${encodeURIComponent(form.id)}`, { ...body, ...(Object.keys(point).length ? {} : { latitude: null, longitude: null }) });
      else await api.post("/addresses", body);
      setForm(blank); resource.reload(); setSuccess(true); setMessage("حُفظ العنوان في قاعدة بيانات حسابك.");
    } catch (failure) { setMessage(errorMessage(failure)); }
    finally { setBusy(""); }
  };
  const remove = async (id: string) => {
    setBusy(id); setMessage(""); setSuccess(false);
    try { await api.delete(`/addresses/${encodeURIComponent(id)}`); setDeleteId(""); if (form.id === id) setForm(blank); resource.reload(); setSuccess(true); setMessage("حُذف العنوان من الحساب."); }
    catch (failure) { setMessage(errorMessage(failure)); }
    finally { setBusy(""); }
  };
  const makeDefault = async (id: string) => {
    setBusy(id); setMessage(""); setSuccess(false);
    try { await api.patch(`/addresses/${encodeURIComponent(id)}`, { isDefault: true }); resource.reload(); setSuccess(true); setMessage("تم تحديث عنوانك الافتراضي."); }
    catch (failure) { setMessage(errorMessage(failure)); }
    finally { setBusy(""); }
  };
  const locate = async () => {
    setBusy("gps"); setMessage(""); setSuccess(false);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("لم تمنح إذن الموقع. يمكنك كتابة الإحداثيات يدويًا أو حفظ العنوان دون نقطة موقع.");
      const position = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("تعذر تحديد الموقع خلال المهلة. جرّب في مكان مكشوف أو أدخل الإحداثيات يدويًا.")), 30_000); })]);
      setForm((current) => ({ ...current, latitude: position.coords.latitude.toFixed(6), longitude: position.coords.longitude.toFixed(6) }));
      setSuccess(true); setMessage("تم أخذ إحداثيات الجهاز. اضغط حفظ العنوان لربطها بحسابك.");
    } catch (failure) { setMessage(errorMessage(failure)); }
    finally { if (timer) clearTimeout(timer); setBusy(""); }
  };
  return <View style={{ gap: 17 }}><Button title="تحديث العناوين" secondary onPress={resource.reload} disabled={resource.loading || Boolean(busy)} />{resource.loading ? <ActivityIndicator color={t.orange} /> : null}<FormMessage text={resource.error} />{resource.data?.addresses.length === 0 ? <AccountCard><Txt style={{ color: t.muted }}>لم تحفظ عنوان توصيل بعد.</Txt></AccountCard> : null}{resource.data?.addresses.map((address) => <AccountCard key={address.id}><Txt weight="bold" style={{ fontSize: 19 }}>{address.label || address.name}{address.isDefault ? " · الافتراضي" : ""}</Txt><Txt style={{ lineHeight: 25 }}>{address.name} · {address.phone}</Txt><Txt style={{ color: t.muted, lineHeight: 25 }}>{address.city}، {address.street}</Txt>{Number.isFinite(address.latitude) && Number.isFinite(address.longitude) ? <Txt style={{ color: t.muted, fontSize: 12 }}>نقطة محفوظة: {address.latitude}, {address.longitude}</Txt> : null}<Button title="تعديل العنوان" secondary disabled={Boolean(busy)} onPress={() => { setForm({ id: address.id, label: address.label || "", name: address.name, phone: address.phone, city: address.city, street: address.street, latitude: address.latitude?.toString() || "", longitude: address.longitude?.toString() || "", isDefault: Boolean(address.isDefault) }); setMessage(""); setDeleteId(""); }} />{!address.isDefault ? <Button title="اجعله العنوان الافتراضي" secondary disabled={Boolean(busy)} onPress={() => void makeDefault(address.id)} /> : null}{deleteId === address.id ? <><Txt style={{ color: t.muted }}>تأكيد حذف هذا العنوان؟ لن تُحذف بيانات الطلبات السابقة.</Txt><Button title="تأكيد حذف العنوان" busy={busy === address.id} disabled={Boolean(busy)} onPress={() => void remove(address.id)} /><Button title="تراجع عن الحذف" secondary onPress={() => setDeleteId("")} /></> : <Button title="حذف العنوان" secondary disabled={Boolean(busy)} onPress={() => setDeleteId(address.id)} />}</AccountCard>)}<AccountCard><Txt weight="bold" style={{ fontSize: 22 }}>{form.id ? "تعديل عنوان" : "إضافة عنوان توصيل"}</Txt><FormField label="اسم العنوان (اختياري)" value={form.label} onChangeText={(v) => field("label", v)} placeholder="المنزل أو العمل" maxLength={60} /><FormField label="اسم المستلم" value={form.name} onChangeText={(v) => field("name", v)} maxLength={100} /><FormField label="رقم الهاتف" value={form.phone} onChangeText={(v) => field("phone", v)} keyboardType="phone-pad" maxLength={24} /><FormField label="المدينة" value={form.city} onChangeText={(v) => field("city", v)} maxLength={100} /><FormField label="العنوان التفصيلي" value={form.street} onChangeText={(v) => field("street", v)} multiline maxLength={500} /><Txt style={{ color: t.muted, lineHeight: 25 }}>نقطة الموقع اختيارية. تُستخدم كوجهة للتوصيل ولا يُنشأ موقع افتراضي عند تركها فارغة.</Txt><FormField label="خط العرض (اختياري)" value={form.latitude} onChangeText={(v) => field("latitude", v)} keyboardType="numbers-and-punctuation" style={{ textAlign: "left", writingDirection: "ltr" }} /><FormField label="خط الطول (اختياري)" value={form.longitude} onChangeText={(v) => field("longitude", v)} keyboardType="numbers-and-punctuation" style={{ textAlign: "left", writingDirection: "ltr" }} /><Button title="استخدام موقعي الحالي بإذني" secondary busy={busy === "gps"} disabled={Boolean(busy)} onPress={() => void locate()} /><Button title={form.isDefault ? "العنوان الافتراضي: نعم" : "تعيين عنوان افتراضي: لا"} secondary onPress={() => field("isDefault", !form.isDefault)} disabled={Boolean(busy)} /><FormMessage text={message} success={success} /><Button title={form.id ? "حفظ تعديلات العنوان" : "حفظ العنوان"} busy={busy === "save"} disabled={Boolean(busy)} onPress={() => void save()} />{form.id ? <Button title="إلغاء التعديل" secondary onPress={() => setForm(blank)} /> : null}</AccountCard></View>;
}
export default function AddressesScreen() { return <Shell title="دفتر العناوين" subtitle="عناوين محفوظة على الخادم مع نقطة توصيل اختيارية."><AccountGate><AddressContent /></AccountGate></Shell>; }
