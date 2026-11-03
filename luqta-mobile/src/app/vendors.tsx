// "المتاجر" — vendor discovery: the official store and approved marketplace merchants.
import React from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { BadgeCheck, Star, Store } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { Card, Chip, ErrorBlock, InfoNote, LoadingBlock } from "../components/design/kit";
import { DemoChip } from "../components/smart/Bits";
import { categoryLabel } from "../data/products";
import { useStore } from "../lib/store";
import { useRemote } from "../lib/useRemote";
import { useTheme } from "../lib/theme";

type Vendor = { id: string; name: string; official: boolean; products: number; categories: string[]; rating: number; offers: number };
export default function Vendors() {
  const { colors: t } = useTheme();
  const { products, settings } = useStore();
  const { data, loading, error, demo, reload } = useRemote<{ vendors: Vendor[] }>("/vendors", { demo: () => ({ vendors: [{ id: "luqta", name: settings.storeName || "لُقطة", official: true, products: products.length, categories: [...new Set(products.map((p) => p.category))].slice(0, 6), rating: 0, offers: products.filter((p) => p.oldPrice && p.oldPrice > p.price).length }] }) });
  return (
    <Shell title="المتاجر" subtitle="تسوّق من لُقطة ومن التجار المعتمدين" side={<DemoChip show={demo} />}>
      {loading && !data ? <LoadingBlock /> : !data ? <ErrorBlock message={error || "تعذّر التحميل"} onRetry={reload} /> : (
        <View style={{ gap: 10 }} testID="vendors">
          {data.vendors.map((v) => (
            <Pressable key={v.id} accessibilityRole="button" accessibilityLabel={`متجر ${v.name}`} onPress={() => router.push(`/vendor/${v.id}`)}>
              <Card style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: v.official ? t.orangeSoft : t.purpleSoft, alignItems: "center", justifyContent: "center" }}><Store size={28} color={v.official ? t.orange : t.purple} /></View>
                <View style={{ flex: 1, alignItems: "flex-end", gap: 4 }}>
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}><Txt weight="bold" style={{ fontSize: 17, color: t.title }}>{v.name}</Txt>{v.official ? <BadgeCheck size={18} color={t.orange} /> : null}</View>
                  <Txt numberOfLines={1} style={{ color: t.muted, fontSize: 13 }}>{v.categories.map(categoryLabel).join("، ")}</Txt>
                  <View style={{ flexDirection: "row-reverse", gap: 6 }}>
                    <Chip label={`${v.products} منتج`} tone="neutral" />
                    {v.rating ? <Chip label={`${v.rating}`} tone="info" icon={Star} /> : null}
                    {v.offers ? <Chip label={`${v.offers} عرض`} tone="success" /> : null}
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
          <InfoNote text="التجار يُعتمدون من الإدارة، وكل منتج يُراجع قبل نشره." />
        </View>
      )}
    </Shell>
  );
}
