import React from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Store, UtensilsCrossed } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Card, EmptyState, Notice, Txt } from "../components/ui";
import { ProductGrid } from "../components/ProductGrid";
import { useApi } from "../lib/useApi";
import { useSession } from "../lib/session";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import type { Product } from "../data/products";

type Restaurant = { id: string; name: string; description: string; products: number };

export default function Restaurants() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { configured } = useSession();
  const directory = useApi<{ restaurants: Restaurant[] }>("/restaurants");
  const [selected, setSelected] = React.useState<string | null>(null);
  const menu = useApi<{ restaurant: Restaurant; products: Product[] }>(selected ? `/restaurants/${encodeURIComponent(selected)}/menu` : null);
  return (
    <Shell title="المطاعم" subtitle="اختر مطعمًا، ثم أضف أصنافه إلى سلتك" back testID="restaurants-screen">
      {!configured ? <Notice text="اربط خادم المتجر لعرض المطاعم وأصنافها الفعلية." /> : null}
      {directory.error ? <Notice text={directory.error} tone="danger" /> : null}
      {configured && directory.data?.restaurants.length === 0 ? <EmptyState title="لا توجد مطاعم متاحة" detail="تظهر المطاعم النشطة التي أضافها مدير المتجر هنا." /> : null}
      <View style={{ gap: 10 }}>
        {directory.data?.restaurants.map((restaurant) => (
          <Pressable key={restaurant.id} testID={`restaurant-${restaurant.id}`} accessibilityRole="button" accessibilityLabel={`${t("عرض قائمة")} ${restaurant.name}`} onPress={() => setSelected(restaurant.id)}>
            <Card style={{ gap: 6, borderWidth: selected === restaurant.id ? 2 : 0, borderColor: colors.primary }}>
              <UtensilsCrossed size={24} color={colors.primary} />
              <Txt weight="bold">{restaurant.name}</Txt>
              {restaurant.description ? <Txt style={{ color: colors.muted }}>{restaurant.description}</Txt> : null}
              <Txt style={{ color: colors.muted }}>{restaurant.products} {t("صنف متاح")}</Txt>
            </Card>
          </Pressable>
        ))}
      </View>
      {menu.error ? <Notice text={menu.error} tone="danger" /> : null}
      {selected && menu.data ? (
        <View testID="restaurant-menu" style={{ marginTop: 20, gap: 12 }}>
          <Txt weight="extra" style={{ fontSize: 20 }}>{t("قائمة")} {menu.data.restaurant.name}</Txt>
          {menu.data.products.length ? <ProductGrid items={menu.data.products} /> : <Txt style={{ color: colors.muted }}>{t("لا تتوفر أصناف حاليًا.")}</Txt>}
        </View>
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => router.push("/explore")} style={{ marginTop: 20, flexDirection: "row", gap: 8, alignItems: "center" }}><Store size={18} color={colors.primary} /><Txt style={{ color: colors.primary }}>{t("تصفح جميع المنتجات")}</Txt></Pressable>
    </Shell>
  );
}
