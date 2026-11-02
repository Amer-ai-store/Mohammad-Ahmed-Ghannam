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
import { CharacterProvider } from "../lib/character";

export default function RootLayout() {
  return <ThemeProvider><AppLayout /></ThemeProvider>;
}
function AppLayout() {
  const { colors: theme, isDark } = useTheme();
  const [loaded, error] = useFonts({
    // IBM Plex Sans Arabic — the typeface of the reference designs (OFL, bundled in assets/fonts)
    IBMPlexSansArabic_400Regular: require("../../assets/fonts/IBMPlexSansArabic-Regular.ttf"),
    IBMPlexSansArabic_500Medium: require("../../assets/fonts/IBMPlexSansArabic-Medium.ttf"),
    IBMPlexSansArabic_600SemiBold: require("../../assets/fonts/IBMPlexSansArabic-SemiBold.ttf"),
    IBMPlexSansArabic_700Bold: require("../../assets/fonts/IBMPlexSansArabic-Bold.ttf"),
  });

  const metadata = (
    <Head>
      <title>Amer AI Store | لُقطة</title>
      <meta
        name="description"
        content="متجر عربي مع مساعد تسوق وكتالوج منتجات ومفضلة وسلة مشتريات."
      />
    </Head>
  );
  if (!loaded && !error)
    return (
      <>
        {metadata}
        {
          <View
            style={{
              flex: 1,
              backgroundColor: theme.background,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <ActivityIndicator color={theme.orange} />
          </View>
        }
      </>
    );
  return (
    <SafeAreaProvider>
      {metadata}
      <SessionProvider><StoreProvider><CharacterProvider>
        <StatusBar style={isDark ? "light" : "dark"} />
        <Stack
          screenOptions={{
            title: "Amer AI Store | لُقطة",
            headerShown: false,
            contentStyle: { backgroundColor: theme.background },
            animation: "fade",
          }}
        />
      </CharacterProvider></StoreProvider></SessionProvider>
    </SafeAreaProvider>
  );
}
