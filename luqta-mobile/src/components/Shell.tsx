import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Bell,
  ChevronDown,
  Compass,
  Heart,
  House,
  MapPin,
  Search,
  ShoppingBag,
  Sparkles,
  UserRound,
  ArrowUpLeft,
  Moon,
  Sun,
} from "lucide-react-native";
import { router, usePathname } from "expo-router";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";
import { useStore } from "../lib/store";
import { useSession } from "../lib/session";
import { Txt } from "./ui";

const navigation = [
  { href: "/", label: "الرئيسية", icon: House },
  { href: "/explore", label: "اكتشف المنتجات", short: "تصفح", icon: Compass },
  {
    href: "/assistant",
    label: "مساعد التسوق",
    short: "المساعد",
    icon: Sparkles,
  },
  { href: "/favorites", label: "المفضلة", icon: Heart },
  { href: "/cart", label: "سلة المشتريات", short: "السلة", icon: ShoppingBag },
] as const;

const utilityNavigation = [
  { href: "/orders", label: "طلباتي" },
  { href: "/offers", label: "العروض والخصومات" },
  { href: "/compare", label: "مقارنة المنتجات" },
  { href: "/appearance", label: "مظهر التطبيق" },
] as const;

export function Logo({ small = false }: { small?: boolean }) {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="لُقطة — الرئيسية"
      onPress={() => router.navigate("/")}
      style={s.logo}
    >
      <View
        style={[
          s.logoMark,
          small ? { width: 30, height: 30, borderRadius: 10 } : null,
        ]}
      >
        <ShoppingBag color={t.onAccent} size={small ? 17 : 23} strokeWidth={2.2} />
      </View>
      <Txt weight="extra" style={{ fontSize: small ? 26 : 32, lineHeight: 44 }}>
        لُقطة
        <Txt weight="extra" style={{ color: t.orange, fontSize: 32 }}>
          .
        </Txt>
      </Txt>
    </Pressable>
  );
}

export function Shell({
  children,
  title,
  subtitle,
  search = false,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  search?: boolean;
}) {
  const { colors: t, isDark } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const desktop = width >= 950;
  const path = usePathname();
  const store = useStore();
  const { user } = useSession();
  const [query, setQuery] = React.useState("");
  const submitSearch = () =>
    router.navigate({ pathname: "/explore", params: { q: query } });
  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.frame}>
        {desktop ? (
          <View style={s.sidebar}>
            <Logo />
            <Txt style={s.sideTag}>كل يوم، لُقطة جديدة</Txt>
            <View style={s.nav}>
              {navigation.map((item) => {
                const active = path === item.href;
                return (
                  <Pressable
                    key={item.href}
                    accessibilityRole="button"
                    accessibilityLabel={item.href === "/cart" && store.cartCount ? `${item.label}، ${store.cartCount} منتج` : item.label}
                    accessibilityState={{ selected: active }}
                    onPress={() => router.navigate(item.href)}
                    style={[s.navItem, active ? s.navActive : null]}
                  >
                    <item.icon
                      size={20}
                      color={active ? t.orange : t.muted}
                    />
                    <Txt
                      weight={active ? "bold" : "medium"}
                      style={{ flex: 1, color: active ? t.orange : t.muted }}
                    >
                      {item.label}
                    </Txt>
                    {item.href === "/cart" && store.cartCount > 0 ? (
                      <View style={s.cartBadge}>
                        <Txt
                          weight="bold"
                          style={{ color: t.orange, fontSize: 11 }}
                        >
                          {store.cartCount}
                        </Txt>
                      </View>
                    ) : null}
                    {item.href === "/assistant" ? (
                      <View style={s.aiBadge}>
                        <Txt
                          weight="bold"
                          style={{ fontSize: 9, color: t.orange }}
                        >
                          AI
                        </Txt>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            <View style={{ marginTop: 18, gap: 4 }}>
              {utilityNavigation.map((item) => <Pressable key={item.href} accessibilityRole="button" onPress={() => router.navigate(item.href)} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 14 }}>
                <Txt style={{ color: t.muted, fontSize: 13 }}>{item.label}</Txt>
              </Pressable>)}
            </View>
            <View style={{ flex: 1 }} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="ابدأ محادثة مساعد التسوق"
              onPress={() => router.navigate("/assistant")}
              style={s.sidebarPromo}
            >
              <View style={s.promoIcon}>
                <Sparkles size={19} color={t.orange} />
              </View>
              <Txt weight="bold" style={{ fontSize: 16 }}>
                حائر في الاختيار؟
              </Txt>
              <Txt style={{ color: t.muted, fontSize: 12, lineHeight: 21 }}>
                دع مساعدك يجد لك ما يناسبك.
              </Txt>
              <View style={s.promoLink}>
                <Txt weight="bold" style={{ color: t.orange, fontSize: 12 }}>
                  ابدأ المحادثة
                </Txt>
                <ArrowUpLeft size={14} color={t.orange} />
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={user ? `الملف الشخصي، ${user.name}` : "الملف الشخصي للزائر"}
              onPress={() => router.navigate("/profile")}
              style={s.sideProfile}
            >
              <View style={s.avatar}>
                <UserRound color={t.muted} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt weight="bold" style={{ fontSize: 13 }}>
                  {user ? `أهلًا، ${user.name}` : "أهلًا بك في لُقطة"}
                </Txt>
                <Txt style={{ color: t.muted, fontSize: 11, marginTop: 3 }}>
                  {user ? "حسابك في لُقطة" : "حساب الزائر"}
                </Txt>
              </View>
              <ChevronDown size={14} color={t.muted} />
            </Pressable>
          </View>
        ) : null}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.main}
        >
          <View style={[s.header, !desktop ? s.mobileHeader : null]}>
            {desktop ? (
              <View style={s.location}>
                <MapPin size={17} color={t.orange} />
                <View>
                  <Txt style={{ fontSize: 10, color: t.muted }}>
                    عملة المتجر
                  </Txt>
                  <Txt weight="bold" style={{ fontSize: 12 }}>
                    {store.settings.country} · {store.settings.currency}
                  </Txt>
                </View>
              </View>
            ) : (
              <Logo small />
            )}
            {desktop ? (
              <View style={s.headerSearch}>
                <Search size={17} color={t.muted} />
                <TextInput
                  accessibilityLabel="البحث في المتجر"
                  placeholder="ابحث عن لُقطتك القادمة..."
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={submitSearch}
                  returnKeyType="search"
                  placeholderTextColor={t.muted}
                  style={s.headerInput}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="تنفيذ البحث"
                  onPress={submitSearch}
                  style={{ minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center", paddingHorizontal: 5 }}
                >
                  <Txt style={{ color: t.muted, fontSize: 11 }}>بحث</Txt>
                </Pressable>
              </View>
            ) : null}
            <View style={s.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="مظهر التطبيق"
                onPress={() => router.navigate("/appearance")}
                style={s.iconButton}
              >
                {isDark ? <Sun size={20} color={t.ink} /> : <Moon size={20} color={t.ink} />}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="الإشعارات"
                onPress={() => router.navigate("/notifications")}
                style={s.iconButton}
              >
                <Bell size={19} color={t.ink} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="حسابي وطلباتي"
                onPress={() => router.navigate("/profile")}
                style={[s.iconButton, { backgroundColor: t.secondary }]}
              >
                <UserRound size={19} color={t.ink} />
              </Pressable>
            </View>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[s.content, { paddingHorizontal: desktop ? 38 : 20 }]}>
              {title ? (
                <View style={s.pageHeading}>
                  <Txt accessibilityRole="header" weight="extra" style={{ fontSize: desktop ? 28 : 25 }}>
                    {title}
                  </Txt>
                  {subtitle ? (
                    <Txt
                      style={{ color: t.muted, lineHeight: 24, marginTop: 6 }}
                    >
                      {subtitle}
                    </Txt>
                  ) : null}
                </View>
              ) : null}
              {search && !desktop ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="البحث عن المنتجات"
                  onPress={() => router.navigate("/explore")}
                  style={s.mobileSearch}
                >
                  <Search size={19} color={t.muted} />
                  <Txt style={{ color: t.muted, flex: 1 }}>
                    ابحث عن لُقطتك القادمة...
                  </Txt>
                  <View style={s.searchHint}>
                    <Txt weight="bold" style={{ fontSize: 11 }}>
                      بحث
                    </Txt>
                  </View>
                </Pressable>
              ) : null}
              {(path === "/" || path === "/explore" || path === "/cart" || path.startsWith("/product/")) && store.catalogStatus !== "connected" ? (
                <View style={s.connectionBanner}>
                  <View style={{ flex: 1, gap: 5 }}>
                    <Txt weight="bold" style={{ fontSize: 13 }}>
                      {store.catalogStatus === "loading" ? "جارٍ مزامنة الكتالوج…" : store.catalogStatus === "offline" ? "الخادم غير متاح حاليًا" : "كتالوج نموذجي"}
                    </Txt>
                    <Txt style={{ color: t.muted, fontSize: 12, lineHeight: 21 }}>
                      {store.catalogStatus === "offline" ? "نعرض آخر نسخة متاحة. أعد الاتصال قبل إتمام الطلب." : store.catalogStatus === "loading" ? "نسترجع المنتجات والكميات من قاعدة بيانات المتجر." : "اربط خادم المتجر للوصول إلى المنتجات والمخزون والطلبات المشتركة."}
                    </Txt>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel="إعداد اتصال الخادم" style={s.bannerAction} onPress={() => router.navigate("/connection")}>
                    <Txt weight="bold" style={{ color: t.orange, fontSize: 12 }}>إعداد الاتصال</Txt>
                  </Pressable>
                  {store.catalogStatus === "offline" ? <Pressable accessibilityRole="button" accessibilityLabel="إعادة الاتصال بالخادم" style={s.bannerAction} onPress={() => { void store.refreshCatalog(); }}>
                    <Txt weight="bold" style={{ color: t.orange, fontSize: 12 }}>إعادة المحاولة</Txt>
                  </Pressable> : null}
                </View>
              ) : null}
              {children}
              <View style={s.footer}>
                <Txt
                  style={{
                    color: t.muted,
                    fontSize: 11,
                    textAlign: "center",
                  }}
                >
                  {store.catalogStatus === "connected" ? "لُقطة · كتالوج متصل بالخادم" : store.catalogStatus === "offline" ? "لُقطة · الاتصال بالخادم غير متاح" : "لُقطة · كتالوج نموذجي دون ربط بالخادم"}
                </Txt>
                <Txt
                  style={{
                    color: t.muted,
                    fontSize: 11,
                    textAlign: "center",
                    marginTop: 5,
                  }}
                >
                  صُنعت لتجعل اختيارك أسهل.
                </Txt>
              </View>
            </View>
          </ScrollView>
          {!desktop ? (
            <SafeAreaView edges={["bottom"]} style={s.bottomWrap}>
              <View style={s.bottomNav}>
                {navigation.map((item) => {
                  const active = item.href === path;
                  return (
                    <Pressable
                      key={item.href}
                      accessibilityRole="button"
                      accessibilityLabel={item.href === "/cart" && store.cartCount ? `${item.label}، ${store.cartCount} منتج` : item.label}
                      accessibilityState={{ selected: active }}
                      onPress={() => router.navigate(item.href)}
                      style={s.bottomItem}
                    >
                      <View>
                        <item.icon
                          size={22}
                          color={active ? t.orange : t.muted}
                        />
                        {item.href === "/cart" && store.cartCount ? (
                          <View style={s.mobileBadge}>
                            <Txt style={{ color: t.onAccent, fontSize: 10 }}>
                              {store.cartCount}
                            </Txt>
                          </View>
                        ) : null}
                      </View>
                      <Txt
                        weight={active ? "bold" : "medium"}
                        style={{
                          fontSize: 10,
                          color: active ? t.orange : t.muted,
                          marginTop: 5,
                        }}
                      >
                        {"short" in item ? item.short : item.label}
                      </Txt>
                    </Pressable>
                  );
                })}
              </View>
            </SafeAreaView>
          ) : null}
        </KeyboardAvoidingView>
      </View>
      {store.toast ? (
        <View accessibilityLiveRegion="polite" style={s.toast}>
          <Txt
            weight="bold"
            style={{ color: t.onToast, textAlign: "center", fontSize: 14 }}
          >
            {store.toast}
          </Txt>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
const makeStyles = (t: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background, direction: "ltr" },
  frame: { flex: 1, flexDirection: "row-reverse" },
  sidebar: {
    width: 228,
    backgroundColor: t.paper,
    borderLeftWidth: 1,
    borderColor: t.line,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 24,
  },
  logo: {
    minHeight: 44,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    alignSelf: "flex-end",
  },
  logoMark: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: t.orange,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-5deg" }],
  },
  sideTag: { color: t.muted, fontSize: 11, marginTop: 7, marginRight: 50 },
  nav: { marginTop: 43, gap: 11 },
  navItem: {
    flexDirection: "row-reverse",
    gap: 13,
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 15,
    borderRadius: 12,
  },
  navActive: { backgroundColor: t.orangeSoft },
  cartBadge: {
    minWidth: 21,
    height: 21,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.orangeSoft,
  },
  aiBadge: {
    paddingHorizontal: 5,
    paddingTop: 3,
    paddingBottom: 1,
    backgroundColor: t.orangeSoft,
    borderRadius: 5,
  },
  sidebarPromo: {
    backgroundColor: t.paper,
    padding: 17,
    borderRadius: 16,
    marginBottom: 22,
    gap: 8,
  },
  promoIcon: {
    alignSelf: "flex-end",
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: t.orangeSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  promoLink: {
    flexDirection: "row-reverse",
    gap: 6,
    alignItems: "center",
    marginTop: 6,
  },
  sideProfile: {
    flexDirection: "row-reverse",
    gap: 10,
    paddingTop: 19,
    borderTopWidth: 1,
    borderColor: t.line,
    alignItems: "center",
  },
  avatar: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: t.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  main: { flex: 1, minWidth: 0 },
  header: {
    backgroundColor: t.background,
    minHeight: 95,
    paddingHorizontal: 38,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: t.line,
    gap: 20,
  },
  mobileHeader: { minHeight: 75, paddingHorizontal: 20 },
  location: { flexDirection: "row-reverse", alignItems: "center", gap: 9 },
  headerSearch: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: t.line,
    backgroundColor: t.secondary,
    borderRadius: 12,
    paddingHorizontal: 15,
    minHeight: 44,
    width: "43%",
    maxWidth: 420,
  },
  headerInput: {
    fontFamily: "Tajawal_400Regular",
    fontSize: 13,
    color: t.ink,
    textAlign: "right",
    flex: 1,
    padding: 0,
  },
  headerActions: { flexDirection: "row-reverse", gap: 12 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    paddingTop: 28,
    paddingBottom: 28,
  },
  pageHeading: { marginBottom: 24 },
  connectionBanner: { flexDirection: "row-reverse", flexWrap: "wrap", alignItems: "center", gap: 10, backgroundColor: t.orangeSoft, borderWidth: 1, borderColor: t.line, padding: 15, borderRadius: 14, marginBottom: 20 },
  bannerAction: { minHeight: 44, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  mobileSearch: {
    backgroundColor: t.paper,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 13,
    minHeight: 50,
    paddingHorizontal: 15,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 9,
    marginBottom: 22,
  },
  searchHint: { backgroundColor: t.secondary, padding: 7, borderRadius: 8 },
  footer: {
    marginTop: 40,
    paddingTop: 23,
    borderTopWidth: 1,
    borderColor: t.line,
  },
  bottomWrap: {
    backgroundColor: t.paper,
    borderTopWidth: 1,
    borderColor: t.line,
  },
  bottomNav: {
    flexDirection: "row-reverse",
    minHeight: 66,
    justifyContent: "space-around",
    alignItems: "center",
  },
  bottomItem: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 52,
    minHeight: 55,
    paddingVertical: 5,
  },
  mobileBadge: {
    position: "absolute",
    top: -5,
    right: -8,
    backgroundColor: t.orange,
    minWidth: 18,
    minHeight: 18,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  toast: {
    position: "absolute",
    bottom: 85,
    alignSelf: "center",
    backgroundColor: t.toast,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    maxWidth: "90%",
    zIndex: 99,
  },
});
