import React, { useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { Button, Txt } from "../ui";
import { useTheme } from "../../lib/theme";

export function AdminCard({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors: c } = useTheme();
  return <View style={{ backgroundColor: c.paper, borderColor: c.line, borderWidth: 1, borderRadius: 18, padding: 18, gap: 13 }}>
    <Txt weight="bold" style={{ fontSize: 19 }}>{title}</Txt>{children}
  </View>;
}

export function AdminField({ label, value, onChangeText, multiline = false, secret = false, numeric = false, placeholder }: {
  label: string; value: string; onChangeText: (text: string) => void; multiline?: boolean; secret?: boolean; numeric?: boolean; placeholder?: string;
}) {
  const { colors: c } = useTheme();
  return <View style={{ gap: 6, flexGrow: 1 }}>
    <Txt weight="medium" style={{ fontSize: 13, color: c.muted }}>{label}</Txt>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.muted}
      multiline={multiline} secureTextEntry={secret} autoCapitalize="none" autoCorrect={false} keyboardType={numeric ? "decimal-pad" : "default"}
      style={{ backgroundColor: c.background, color: c.ink, borderColor: c.line, borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, fontFamily: "Tajawal_400Regular", textAlign: "right", writingDirection: "rtl", minHeight: multiline ? 125 : 48, textAlignVertical: multiline ? "top" : "center" }} />
  </View>;
}

export function AdminChoices<T extends string>({ label, value, choices, onChange }: {
  label: string; value: T; choices: readonly { value: T; label: string }[]; onChange: (value: T) => void;
}) {
  const { colors: c } = useTheme();
  return <View style={{ gap: 8 }}><Txt style={{ color: c.muted, fontSize: 13 }}>{label}</Txt>
    <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 }}>{choices.map(item =>
      <Pressable key={item.value} accessibilityRole="button" accessibilityState={{ selected: value === item.value }} accessibilityLabel={`${label}: ${item.label}`}
        onPress={() => onChange(item.value)} style={{ backgroundColor: value === item.value ? c.orange : c.background, borderColor: c.line, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, minHeight: 44, justifyContent: "center", borderRadius: 10 }}>
        <Txt weight="medium" style={{ color: value === item.value ? "white" : c.ink, fontSize: 13 }}>{item.label}</Txt>
      </Pressable>)}</View>
  </View>;
}

export function AdminNotice({ error, message }: { error?: string; message?: string }) {
  const { colors: c } = useTheme();
  if (!error && !message) return null;
  return <View accessibilityLiveRegion="polite" style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: error ? "#CB5555" : c.green, backgroundColor: c.background }}>
    <Txt style={{ color: error ? "#CB5555" : c.green, lineHeight: 23 }}>{error || message}</Txt>
  </View>;
}

export function AdminLoading() {
  const { colors: c } = useTheme();
  return <View style={{ padding: 24 }}><ActivityIndicator color={c.orange} accessibilityLabel="تحميل بيانات الإدارة" /></View>;
}

export function AdminRefresh({ busy, onPress }: { busy: boolean; onPress: () => void }) {
  return <Button title="تحديث البيانات" busy={busy} secondary onPress={onPress} />;
}

export function useAdminAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const run = async (action: () => Promise<unknown>, success: string, after?: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await action(); if (after) await after(); setMessage(success); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذّر إتمام العملية. حاول مجددًا."); }
    finally { setBusy(false); }
  };
  return { busy, error, message, run, clear: () => { setError(""); setMessage(""); } };
}

export function numberInput(value: string, label: string) {
  const normalized = value.trim().replace(/[٠-٩]/g, n => String("٠١٢٣٤٥٦٧٨٩".indexOf(n))).replace(/[۰-۹]/g, n => String("۰۱۲۳۴۵۶۷۸۹".indexOf(n))).replace("٫", ".");
  const result = Number(normalized);
  if (!normalized || !Number.isFinite(result)) throw new Error(`أدخل قيمة رقمية صحيحة لحقل ${label}.`);
  return result;
}
