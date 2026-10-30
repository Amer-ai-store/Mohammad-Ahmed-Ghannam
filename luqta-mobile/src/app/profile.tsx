import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Shell } from "../components/Shell";
import { Button, Txt } from "../components/ui";
import { AccountCard, AccountLink, errorMessage, FormField, FormMessage } from "../components/AccountKit";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/theme";

const roleNames = { customer: "عميل", admin: "مدير المتجر", driver: "سائق توصيل" };

function RecoveryCodeCard() {
  const { colors: t } = useTheme();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const issue = async () => {
    setBusy(true); setError("");
    try {
      const result = await api.post<{ recoveryCode: string }>("/auth/recovery-code", { password });
      if (!result.recoveryCode) throw new Error("لم يصدر الخادم رمزًا جديدًا.");
      setPassword(""); setCode(result.recoveryCode);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };
  return <AccountCard>
    <Txt weight="bold" style={{ fontSize: 20 }}>رمز استرداد الحساب</Txt>
    <Txt style={{ color: t.muted, lineHeight: 25 }}>إذا نسيت كلمة المرور، يمكنك استخدامها مع رمز استرداد محفوظ. إصدار رمز جديد يُبطل الرمز السابق، ولا يُرسل الرمز بالبريد أو الرسائل النصية.</Txt>
    {code ? <>
      <Txt selectable accessibilityLabel="رمز استرداد الحساب، اضغط مطولًا لنسخه" style={{ color: t.orange, fontSize: 20, lineHeight: 30 }}>{code}</Txt>
      <Txt style={{ color: t.muted, lineHeight: 24 }}>يظهر الآن فقط. انسخه واحفظه في مكان خاص، ثم أخفه من الشاشة.</Txt>
      <Button title="حفظت الرمز، إخفاؤه" secondary onPress={() => setCode("")} />
    </> : <>
      <FormField label="كلمة المرور الحالية لإصدار رمز جديد" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" returnKeyType="done" onSubmitEditing={() => { if (!busy && password) void issue(); }} />
      <Button title="إصدار رمز استرداد جديد" secondary busy={busy} disabled={!password} onPress={() => void issue()} />
    </>}
    <FormMessage text={error} />
  </AccountCard>;
}

export default function ProfileScreen() {
  const session = useSession();
  const { colors: t } = useTheme();
  const { favorites, cartCount } = useStore();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const saveName = async () => {
    setBusy(true); setMessage(""); setSuccess(false);
    try {
      if (name.trim().length < 2) throw new Error("أدخل اسمًا من حرفين على الأقل.");
      await api.patch("/auth/me", { name: name.trim() });
      await session.refreshUser();
      setEditing(false); setSuccess(true); setMessage("تم تحديث الاسم في قاعدة بيانات الحساب.");
    } catch (failure) { setMessage(errorMessage(failure)); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    setBusy(true); setMessage(""); setSuccess(false);
    try { await session.logout(); }
    catch (failure) { setMessage(errorMessage(failure)); }
    finally { setBusy(false); }
  };
  return <Shell title="حسابي" subtitle="طلباتك وعناوينك وإعدادات المتجر في مكان واحد.">
    <View style={{ maxWidth: 850, width: "100%", alignSelf: "center", gap: 16 }}>
      <AccountCard>
        <Txt weight="extra" style={{ fontSize: 25 }}>{session.user ? `أهلًا، ${session.user.name}` : "أهلًا بك في لُقطة"}</Txt>
        <Txt style={{ color: t.muted, lineHeight: 24 }}>{session.user ? `${session.user.email} · ${roleNames[session.user.role]}` : "تصفّح المنتجات كزائر، وسجّل الدخول لحفظ طلباتك وعناوينك في قاعدة البيانات."}</Txt>
        <Txt style={{ color: session.connected ? t.green : t.muted }}>{session.connected ? "اتصال فعلي بالخادم" : session.configured ? "عنوان خادم محفوظ · الاتصال غير مؤكد" : "وضع الاستعراض المحلي · دون خادم"}</Txt>
        {session.user ? <>
          {editing ? <>
            <FormField label="الاسم الكامل" value={name} onChangeText={setName} maxLength={100} />
            <Button title="حفظ الاسم" busy={busy} onPress={() => void saveName()} />
            <Button title="إلغاء التعديل" secondary onPress={() => setEditing(false)} />
          </> : <Button title="تعديل الاسم" secondary onPress={() => { setName(session.user?.name || ""); setEditing(true); }} />}
          <Button title="تسجيل الخروج" secondary onPress={() => void logout()} busy={busy} />
        </> : <>
          <Button title="تسجيل الدخول" onPress={() => router.push("/login")} />
          <Button title="إنشاء حساب" secondary onPress={() => router.push("/register")} />
        </>}
        <FormMessage text={message || session.error} success={success} />
      </AccountCard>
      {session.user ? <RecoveryCodeCard /> : null}
      <AccountLink href="/orders" title="طلباتي والتتبع" detail="حالة الطلب، الإلغاء، المرتجعات وتتبع سائق التوصيل" />
      <AccountLink href="/wallet" title="المحفظة والمكافآت" detail="الرصيد والنقاط وسجل القيود والاستردادات" />
      <AccountLink href="/addresses" title="دفتر العناوين" detail="عناوين التوصيل المحفوظة ونقطة الموقع الاختيارية" />
      <AccountLink href="/notifications" title="الإشعارات" detail="تحديثات حالة طلباتك من قاعدة بيانات المتجر" />
      <AccountLink href="/favorites" title="المفضلة" detail={`${favorites.length} منتجًا محفوظًا`} />
      <AccountLink href="/cart" title="سلة المشتريات" detail={`${cartCount} قطعة في السلة`} />
      <AccountLink href="/appearance" title="المظهر والوضع الليلي" detail="فاتح أو داكن أو حسب إعداد الجهاز" />
      <AccountLink href="/social" title="ربط حساب Facebook" detail="موافقة رسمية عبر Meta وصلاحيات محددة" />
      <AccountLink href="/connection" title="اتصال الخادم" detail="اختبار الاتصال وحفظ عنوان الخادم" />
      {session.user?.role === "admin" ? <>
        <AccountLink href="/command-center" title="ربط مركز القيادة المركزي" detail="استيراد وصول المالك واختبار ومزامنة الأصناف والطلبات" />
        <AccountLink href="/admin" title="لوحة الإدارة والقيادة" detail="المخزون والأصناف والطلبات والوكلاء وسجل التعديلات" />
      </> : null}
      {session.user?.role === "driver" ? <AccountLink href="/driver" title="لوحة السائق" detail="الطلبات المسندة ومشاركة الموقع وحالة التسليم" /> : null}
      {session.user ? <AccountLink href="/delete-account" title="حذف الحساب والبيانات الشخصية" detail="طلب حذف نهائي مع التحقق من كلمة المرور والالتزامات النشطة" /> : null}
    </View>
  </Shell>;
}
