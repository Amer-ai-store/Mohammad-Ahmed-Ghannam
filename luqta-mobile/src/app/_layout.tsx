import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StoreProvider } from "../lib/store";
import { ThemeProvider, useTheme } from "../lib/theme";
import { SessionProvider } from "../lib/session";
import { I18nProvider, rootDirection, useI18n } from "../lib/i18n";
import { RobotProvider } from "../lib/robot";

export default function RootLayout() {
  return <ThemeProvider><I18nProvider><AppLayout /></I18nProvider></ThemeProvider>;
}
function AppLayout() {
  const { colors: theme, isDark } = useTheme();
  const { lang, t } = useI18n();
  const [loaded, error] = useFonts({
    Tajawal_400Regular: require("@expo-google-fonts/tajawal/400Regular/Tajawal_400Regular.ttf"),
    Tajawal_500Medium: require("@expo-google-fonts/tajawal/500Medium/Tajawal_500Medium.ttf"),
    Tajawal_700Bold: require("@expo-google-fonts/tajawal/700Bold/Tajawal_700Bold.ttf"),
    Tajawal_800ExtraBold: require("@expo-google-fonts/tajawal/800ExtraBold/Tajawal_800ExtraBold.ttf"),
  });
  const title = t("لُقطة — اختيارات ذكية، لحياة أسهل");
  const metadata = (
    <Head>
      <title>{title}</title>
      <meta name="description" content={t("متجر عربي مع مساعد تسوق وروبوت متحرك وكتالوج ومفضلة وسلة مشتريات.")} />
    </Head>
  );
  if (!loaded && !error)
    return (
      <>
        {metadata}
        <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={theme.orange} />
        </View>
      </>
    );
  return (
    <SafeAreaProvider>
      {metadata}
      <View style={{ flex: 1, direction: rootDirection(lang), backgroundColor: theme.background }}>
        <SessionProvider><RobotProvider><StoreProvider>
          <StatusBar style={isDark ? "light" : "dark"} />
          <Stack screenOptions={{ title, headerShown: false, contentStyle: { backgroundColor: theme.background }, animation: "fade" }} />
        </StoreProvider></RobotProvider></SessionProvider>
      </View>
    </SafeAreaProvider>
  );
}
