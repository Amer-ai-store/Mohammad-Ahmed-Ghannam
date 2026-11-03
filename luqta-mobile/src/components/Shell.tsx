// App frame matching the Amer AI Store | لُقطة designs: lavender gradient page,
// brand header, centered title, scrolling content and the 4-tab floating nav.
import React from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Compass, House, ShoppingBasket, UserRound, WifiOff } from "lucide-react-native";
import { router, usePathname } from "expo-router";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";
import { useStore } from "../lib/store";
import { Txt } from "./ui";
import { BrandHeader, PageTitle, SmallButton } from "./design/kit";

export function Logo() {
  return <BrandHeader left={null} />;
}

export type TabKey = "home" | "explore" | "cart" | "account";
const tabs: { key: TabKey; href: "/" | "/explore" | "/cart" | "/profile"; label: string; icon: typeof House }[] = [
  { key: "home", href: "/", label: "الرئيسية", icon: House },
  { key: "explore", href: "/explore", label: "اكتشف", icon: Compass },
  { key: "cart", href: "/cart", label: "السلة", icon: ShoppingBasket },
  { key: "account", href: "/profile", label: "حسابي", icon: UserRound },
];
export function tabForPath(path: string): TabKey {
  if (path === "/explore" || path.startsWith("/product") || ["/offers", "/compare", "/favorites", "/smart-tools", "/market-pulse", "/price-radar", "/trending", "/lens", "/nutrition", "/voice", "/studio", "/reels", "/vendors"].includes(path) || path.startsWith("/vendor/") || path.startsWith("/collection/")) return "explore";
  if (path === "/basket-optimizer") return "cart";
  if (path === "/cart") return "cart";
  if (["/profile", "/orders", "/notifications", "/support", "/wallet", "/addresses", "/appearance", "/privacy", "/returns", "/login", "/register", "/auth", "/delete-account", "/recover-account", "/connection", "/admin", "/driver", "/command-center", "/social", "/rewards", "/lists", "/watchlist", "/insights", "/merchant", "/permissions", "/receipts", "/green", "/game", "/coupons"].some((p) => path === p || path.startsWith(`${p}/`)) || path.startsWith("/order/")) return "account";
  return "home";
}

export function BottomNav() {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const path = usePathname();
  const { cartCount } = useStore();
  const active = tabForPath(path);
  return (
    <SafeAreaView edges={["bottom"]} style={s.navWrap}>
      <View style={s.nav} accessibilityRole="tablist">
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <Pressable key={tab.key} testID={`tab-${tab.key}`} accessibilityRole="tab" accessibilityState={{ selected }}
              accessibilityLabel={tab.key === "cart" && cartCount ? `${tab.label}، ${cartCount} منتج` : tab.label}
              onPress={() => router.navigate(tab.href)} style={[s.tab, selected && s.tabActive]}>
              <View>
                <tab.icon size={27} color={selected ? t.orange : t.purple} strokeWidth={selected ? 2.4 : 2} fill={selected && tab.key === "home" ? t.orange : "none"} />
                {tab.key === "cart" && cartCount > 0 ? <View style={s.badge}><Txt weight="bold" style={{ color: t.onAccent, fontSize: 11, textAlign: "center" }}>{cartCount > 99 ? "99+" : cartCount}</Txt></View> : null}
              </View>
              <Txt weight={selected ? "bold" : "medium"} style={{ fontSize: 15, marginTop: 3, color: selected ? t.orange : t.muted, textAlign: "center" }}>{tab.label}</Txt>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export function Shell({
  children,
  title,
  subtitle,
  header,
  side,
  footer,
  hideNav = false,
  scroll = true,
  titleAlign = "center",
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  /** legacy prop kept for older screens; the search lives on the home/explore screens now */
  search?: boolean;
  header?: React.ReactNode;
  side?: React.ReactNode;
  footer?: React.ReactNode;
  hideNav?: boolean;
  scroll?: boolean;
  titleAlign?: "center" | "right";
}) {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const store = useStore();
  const path = usePathname();
  const showOffline = store.catalogStatus === "offline" && ["/", "/explore", "/cart", "/checkout"].includes(path);
  const body = (
    <View style={s.content}>
      {header === undefined ? <BrandHeader /> : header}
      {title ? <PageTitle title={title} subtitle={subtitle} side={side} align={titleAlign} /> : side ? <View style={{ alignItems: "flex-start" }}>{side}</View> : null}
      {showOffline ? (
        <View style={s.offline} accessibilityRole="alert">
          <WifiOff size={18} color={t.danger} />
          <Txt style={{ flex: 1, color: t.ink, fontSize: 13, lineHeight: 20 }}>الخادم غير متاح حاليًا. نعرض آخر نسخة، ويُعاد التحقق من السعر والمخزون قبل التأكيد.</Txt>
          <SmallButton title="إعادة المحاولة" tone="soft" onPress={() => void store.refreshCatalog()} />
        </View>
      ) : null}
      {children}
    </View>
  );
  return (
    <LinearGradient colors={[t.background, t.backgroundDeep]} style={{ flex: 1 }}>
      <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          {scroll ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {body}
            </ScrollView>
          ) : <View style={{ flex: 1 }}>{body}</View>}
          {footer ? <View style={s.footer}>{footer}</View> : null}
          {!hideNav ? <BottomNav /> : null}
        </KeyboardAvoidingView>
        {store.toast ? (
          <View accessibilityLiveRegion="polite" pointerEvents="none" style={s.toast}>
            <Txt weight="bold" style={{ color: t.onToast, textAlign: "center", fontSize: 14 }}>{store.toast}</Txt>
          </View>
        ) : null}
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  safe: { flex: 1, direction: "ltr" },
  content: { width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 18 },
  offline: { flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 12, borderRadius: 16, backgroundColor: t.orangeSoft, borderWidth: 1, borderColor: t.chip, marginBottom: 12, flexWrap: "wrap" },
  footer: { width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 18, paddingTop: 6 },
  navWrap: { backgroundColor: "transparent" },
  nav: { flexDirection: "row-reverse", marginHorizontal: 12, marginBottom: 8, marginTop: 4, padding: 8, borderRadius: 30, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, shadowColor: t.shadow, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -2 }, elevation: 6, maxWidth: 560, alignSelf: "center", width: "94%" },
  tab: { flex: 1, minHeight: 60, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: t.orangeSoft },
  badge: { position: "absolute", top: -8, right: -12, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 4, backgroundColor: t.orange, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: t.card },
  toast: { position: "absolute", bottom: 110, alignSelf: "center", backgroundColor: t.toast, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 16, maxWidth: "90%", zIndex: 99 },
});
