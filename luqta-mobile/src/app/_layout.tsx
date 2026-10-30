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

export default function RootLayout() {
  return <ThemeProvider><AppLayout /></ThemeProvider>;
}
function AppLayout() {
  const { colors: theme, isDark } = useTheme();
  const [loaded, error] = useFonts({
    Tajawal_400Regular: require("@expo-google-fonts/tajawal/400Regular/Tajawal_400Regular.ttf"),
    Tajawal_500Medium: require("@expo-google-fonts/tajawal/500Medium/Tajawal_500Medium.ttf"),
    Tajawal_700Bold: require("@expo-google-fonts/tajawal/700Bold/Tajawal_700Bold.ttf"),
    Tajawal_800ExtraBold: require("@expo-google-fonts/tajawal/800ExtraBold/Tajawal_800ExtraBold.ttf"),
  });
  const metadata = (
    <Head>
      <title>لُقطة — اختيارات ذكية، لحياة أسهل</title>
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
      <SessionProvider><StoreProvider>
        <StatusBar style={isDark ? "light" : "dark"} />
        <Stack
          screenOptions={{
            title: "لُقطة — اختيارات ذكية، لحياة أسهل",
            headerShown: false,
            contentStyle: { backgroundColor: theme.background },
            animation: "fade",
          }}
        />
      </StoreProvider></SessionProvider>
    </SafeAreaProvider>
  );
}
