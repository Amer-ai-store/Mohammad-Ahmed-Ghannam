import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Heart } from "lucide-react-native";
import { useFocusEffect } from "expo-router";
import { Shell } from "../components/Shell";
import { ProductGrid } from "../components/ProductGrid";
import { Button, EmptyState, Txt } from "../components/ui";
import { useStore } from "../lib/store";
import { useSession } from "../lib/session";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";

export default function FavoritesScreen() {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { favorites, hydrated, products, wishlistSynced, refreshWishlist } = useStore();
  const { user, configured } = useSession();
  const userId = user?.id;
  const [syncError, setSyncError] = useState("");
  useFocusEffect(useCallback(() => {
    if (!userId || !configured) return;
    let active = true;
    void refreshWishlist().catch((error) => {
      if (active) setSyncError(error instanceof Error ? error.message : "تعذّر تحديث المفضلة.");
    });
    return () => { active = false; };
  }, [userId, configured, refreshWishlist]));
  const saved = products.filter((product) => favorites.includes(product.id));
  return (
    <Shell
      title="لُقطات أحببتها"
      subtitle="كل اختياراتك المفضلة، في مكان واحد."
    >
      {user && configured ? <View style={{ gap: 9, marginBottom: 14 }}>
        <Button title="تحديث المفضلة من الحساب" secondary onPress={() => void refreshWishlist().then(() => setSyncError("")).catch((error) => setSyncError(error instanceof Error ? error.message : "تعذّر تحديث المفضلة."))} />
        {syncError ? <Txt accessibilityRole="alert" style={{ color: t.danger }}>{syncError}</Txt> : null}
      </View> : null}
      {!hydrated ? (
        <Txt style={s.loading}>جارٍ استعادة المفضلة…</Txt>
      ) : saved.length ? (
        <>
          <View style={s.count}>
            <Heart size={17} color={t.orange} />
            <Txt weight="bold" style={{ color: t.orange }}>
              {saved.length} منتجات في مفضلتك
            </Txt>
            <Txt style={{ flex: 1, color: t.muted, fontSize: 12 }}>
              {wishlistSynced ? "متزامنة مع حسابك على الخادم" : "محفوظة على هذا الجهاز؛ غير متزامنة حاليًا"}
            </Txt>
          </View>
          <ProductGrid items={saved} />
        </>
      ) : (
        <EmptyState
          title="هنا تبدأ لُقطاتك المفضلة"
          detail="اضغط على القلب بجوار أي منتج أعجبك، وستجده هنا عندما تعود."
        />
      )}
    </Shell>
  );
}
const makeStyles = (t: Palette) => StyleSheet.create({
  grid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 18,
  },
  count: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 9,
    marginBottom: 24,
    padding: 18,
    borderRadius: 14,
    backgroundColor: t.orangeSoft,
    flexWrap: "wrap",
  },
  loading: { color: t.muted, padding: 30 },
});
