import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextProps,
  View,
  ViewStyle,
} from "react-native";
import { ArrowLeft, Sparkles } from "lucide-react-native";
import { router } from "expo-router";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";

export function Txt({
  weight = "regular",
  style,
  ...props
}: TextProps & { weight?: "regular" | "medium" | "bold" | "extra" }) {
  const { colors: t } = useTheme();
  const font = {
    regular: "Tajawal_400Regular",
    medium: "Tajawal_500Medium",
    bold: "Tajawal_700Bold",
    extra: "Tajawal_800ExtraBold",
  }[weight];
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: font,
          color: t.ink,
          textAlign: "right",
          writingDirection: "rtl",
          fontSize: 15,
        },
        style,
      ]}
    />
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  busy = false,
  style,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
}) {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary ? s.secondary : null,
        { opacity: disabled || busy ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? t.ink : t.onAccent} />
      ) : (
        <Txt
          weight="bold"
          style={{
            color: secondary ? t.ink : t.onAccent,
            textAlign: "center",
            fontSize: 16,
          }}
        >
          {title}
        </Txt>
      )}
    </Pressable>
  );
}
export function EmptyState({
  title,
  detail,
  action = "اكتشف المنتجات",
}: {
  title: string;
  detail: string;
  action?: string;
}) {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Sparkles color={t.orange} size={30} />
      </View>
      <Txt accessibilityRole="header" weight="bold" style={{ fontSize: 24, textAlign: "center" }}>
        {title}
      </Txt>
      <Txt
        style={{
          color: t.muted,
          textAlign: "center",
          lineHeight: 26,
          maxWidth: 340,
        }}
      >
        {detail}
      </Txt>
      <Button
        title={action}
        onPress={() => router.navigate("/explore")}
        style={{ minWidth: 180 }}
      />
    </View>
  );
}
export function SectionTitle({
  title,
  subtitle,
  action,
  onPress,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onPress?: () => void;
}) {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.section}>
      <View style={{ flex: 1, gap: 6 }}>
        <Txt accessibilityRole="header" weight="extra" style={{ fontSize: 25 }}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt style={{ color: t.muted, fontSize: 14 }}>{subtitle}</Txt>
        ) : null}
      </View>
      {action && onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onPress} style={s.link}>
          <Txt weight="bold" style={{ color: t.orange, fontSize: 14 }}>
            {action}
          </Txt>
          <ArrowLeft color={t.orange} size={15} />
        </Pressable>
      ) : null}
    </View>
  );
}
const makeStyles = (t: Palette) => StyleSheet.create({
  button: {
    backgroundColor: t.orange,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 51,
  },
  secondary: { backgroundColor: t.secondary },
  empty: { alignItems: "center", padding: 44, gap: 20 },
  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 24,
    backgroundColor: t.orangeSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 16,
    marginTop: 28,
    marginBottom: 20,
  },
  link: { flexDirection: "row-reverse", alignItems: "center", gap: 7, minHeight: 44, paddingHorizontal: 4 },
});
