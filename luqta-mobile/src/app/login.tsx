import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Shell } from "../components/Shell";
import { Button, Txt } from "../components/ui";
import { AccountCard, errorMessage, FormField, FormMessage } from "../components/AccountKit";
import { useSession } from "../lib/session";
import { useTheme } from "../lib/theme";

export default function LoginScreen() {
  const session = useSession();
  const { colors: t } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (session.user) router.replace("/profile"); }, [session.user]);
  const submit = async () => {
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || !password) { setError("أدخل بريدًا إلكترونيًا صالحًا وكلمة المرور."); return; }
    setBusy(true);
    try { await session.login(email, password); setPassword(""); router.replace("/profile"); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };
  return <Shell title="تسجيل الدخول" subtitle="حسابك وطلباتك محفوظة في قاعدة بيانات المتجر."><View style={{ width: "100%", maxWidth: 540, alignSelf: "center", gap: 18 }}><AccountCard>{!session.configured ? <><FormMessage text="لم يُربط خادم المتجر بعد. لا يمكن تسجيل الدخول دون اتصال فعلي." /><Button title="إعداد اتصال الخادم" onPress={() => router.push("/connection")} /></> : null}<FormField label="البريد الإلكتروني" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="next" /><FormField label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" returnKeyType="done" onSubmitEditing={() => { if (!busy && session.configured) void submit(); }} /><FormMessage text={error} /><Button title="تسجيل الدخول" onPress={() => void submit()} busy={busy} disabled={!session.hydrated || !session.configured} /><Button title="نسيت كلمة المرور؟ استخدم رمز الاسترداد" secondary onPress={() => router.push("/recover-account")} /><Button title="إنشاء حساب جديد" secondary onPress={() => router.push("/register")} /><Txt style={{ color: t.muted, lineHeight: 24, fontSize: 13 }}>لا تتم مشاركة كلمة المرور مع وكلاء الإدارة. يستخدم الوكلاء مفاتيح منفصلة وصلاحيات محددة من لوحة الإدارة.</Txt></AccountCard><Button title="إعداد الخادم أو تغييره" secondary onPress={() => router.push("/connection")} /></View></Shell>;
}
