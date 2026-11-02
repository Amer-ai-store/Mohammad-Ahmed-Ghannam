// تسجيل الدخول — الهاتف (رمز SMS) أو Google أو البريد الإلكتروني، بنمط التصميم المرجعي.
import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Mail, Smartphone } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { Card, CTA, Field, InfoNote, Segmented } from "../components/design/kit";
import { Companion } from "../components/character/Companion";
import { GoogleButton, PhoneSignIn, RecoveryNotice, useAuthProviders } from "../components/AuthExtras";
import { errorMessage } from "../components/AccountKit";
import { useSession } from "../lib/session";
import { useTheme } from "../lib/theme";

export default function LoginScreen() {
  const session = useSession();
  const { colors: t } = useTheme();
  const providers = useAuthProviders();
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [recovery, setRecovery] = useState("");
  useEffect(() => { if (session.user && !recovery) router.replace("/profile"); }, [session.user, recovery]);
  const submit = async () => {
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || !password) { setError("أدخل بريدًا إلكترونيًا صالحًا وكلمة المرور."); return; }
    setBusy(true);
    try { await session.login(email, password); setPassword(""); router.replace("/profile"); }
    catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  };
  if (recovery) return <Shell title="مرحبًا بك في لُقطة" subtitle="أُنشئ حسابك بنجاح"><RecoveryNotice code={recovery} onDone={() => { setRecovery(""); router.replace("/profile"); }} /></Shell>;
  return (
    <Shell title="تسجيل الدخول" subtitle="ادخل برقم هاتفك أو حساب Google أو بريدك">
      <View style={{ width: "100%", maxWidth: 540, alignSelf: "center", gap: 14 }}>
        <View style={{ alignItems: "center", marginBottom: -8 }}><Companion action="wave" base={110} enterFrom="none" /></View>
        {!session.configured ? (
          <Card style={{ gap: 10 }}>
            <Txt weight="bold" style={{ color: t.title, fontSize: 18 }}>اربط خادم المتجر أولًا</Txt>
            <Txt style={{ color: t.muted, lineHeight: 24 }}>الحسابات محفوظة في قاعدة بيانات المتجر؛ لا يمكن الدخول دون اتصال فعلي.</Txt>
            <CTA title="إعداد اتصال الخادم" onPress={() => router.push("/connection")} />
          </Card>
        ) : null}
        <Card style={{ gap: 12 }}>
          <GoogleButton disabled={!session.configured || providers?.google.enabled === false} onError={setError} />
          {providers && !providers.google.enabled ? <Txt style={{ color: t.muted, fontSize: 12, textAlign: "center" }}>الدخول بـ Google غير مفعّل على الخادم بعد.</Txt> : null}
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}><View style={{ flex: 1, height: 1, backgroundColor: t.line }} /><Txt style={{ color: t.muted }}>أو</Txt><View style={{ flex: 1, height: 1, backgroundColor: t.line }} /></View>
          <Segmented testID="login-method" value={method} onChange={(v) => { setMethod(v); setError(""); }} options={[{ value: "phone", label: "رقم الهاتف", icon: Smartphone }, { value: "email", label: "البريد الإلكتروني", icon: Mail }]} />
          {method === "phone" ? (
            providers?.phone.enabled === false ? <InfoNote text="الدخول بالهاتف يحتاج ربط مزود رسائل SMS على الخادم. استخدم البريد أو Google حاليًا." tone="warn" /> :
            <PhoneSignIn demo={!!providers?.phone.demo} askName onDone={(r) => { if (r.isNew && r.recoveryCode) setRecovery(r.recoveryCode); else router.replace("/profile"); }} />
          ) : (
            <View style={{ gap: 10 }}>
              <Field label="البريد الإلكتروني" placeholder="البريد الإلكتروني" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" testID="login-email" />
              <Field label="كلمة المرور" placeholder="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={() => { if (!busy && session.configured) void submit(); }} testID="login-password" />
              <CTA title="تسجيل الدخول" busy={busy} disabled={!session.hydrated || !session.configured} onPress={() => void submit()} testID="login-submit" />
              <Pressable accessibilityRole="button" onPress={() => router.push("/recover-account")}><Txt style={{ color: t.purple, textAlign: "center" }}>نسيت كلمة المرور؟ استخدم رمز الاسترداد</Txt></Pressable>
            </View>
          )}
          {error ? <Txt accessibilityRole="alert" style={{ color: t.danger }}>{error}</Txt> : null}
        </Card>
        <CTA title="إنشاء حساب جديد بالبريد" tone="soft" onPress={() => router.push("/register")} />
        <Pressable accessibilityRole="button" onPress={() => router.push("/connection")}><Txt style={{ color: t.muted, textAlign: "center" }}>إعداد الخادم أو تغييره</Txt></Pressable>
        <Txt style={{ color: t.muted, lineHeight: 22, fontSize: 12, textAlign: "center" }}>بالمتابعة توافق على الشروط وسياسة الخصوصية. لا نشارك رقمك أو بريدك مع أي طرف.</Txt>
      </View>
    </Shell>
  );
}
