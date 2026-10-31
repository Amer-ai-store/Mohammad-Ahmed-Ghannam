import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Search, SlidersHorizontal, X } from "lucide-react-native";
import { useLocalSearchParams } from "expo-router";
import { Shell } from "../components/Shell";
import { EmptyState, Txt } from "../components/ui";
import { ProductGrid } from "../components/ProductGrid";
import { categories as knownCategories } from "../data/products";
import { useStore } from "../lib/store";
import { parsePriceLimit, searchCatalog, type CatalogSort } from "../lib/catalog-search";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";

export default function Explore() {
  const params = useLocalSearchParams<{ q?: string; category?: string }>();
  return (
    <ExploreContent
      key={`${params.q || ""}:${params.category || "all"}`}
      initialQuery={params.q || ""}
      initialCategory={params.category || "all"}
    />
  );
}
function ExploreContent({
  initialQuery,
  initialCategory,
}: {
  initialQuery: string;
  initialCategory: string;
}) {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { products, settings } = useStore();
  const categories = useMemo(() => [...new Set(products.filter((product) => !product.variantOf).map((product) => product.category))].map((id) => ({ id, label: knownCategories.find((c) => c.id === id)?.label || id })), [products]);
  const [stockOnly, setStockOnly] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState<CatalogSort>("featured");
  const [budget, setBudget] = useState("all");
  const [customBudget, setCustomBudget] = useState("");
  const parsedBudget = parsePriceLimit(customBudget);
  const filtered = useMemo(() => searchCatalog(products, {
    query, category, sort,
    maxPrice: customBudget.trim() ? parsedBudget : budget === "all" ? undefined : Number(budget),
    inStockOnly: stockOnly,
  }), [products, query, category, sort, budget, customBudget, parsedBudget, stockOnly]);
  const resetFilters = () => {
    setQuery(""); setCategory("all"); setBudget("all"); setCustomBudget(""); setSort("featured"); setStockOnly(false);
  };
  return (
    <Shell
      title="اكتشف لُقطتك القادمة"
      subtitle="أشياء تختارها بعناية، لتفاصيل تعيشها كل يوم."
    >
      <View style={s.search}>
        <Search size={20} color={t.muted} />
        <TextInput
          accessibilityLabel="ابحث عن منتج"
          placeholder="سماعات، هدية، إضاءة..."
          placeholderTextColor={t.muted}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          style={s.input}
        />
        {query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="مسح البحث"
            onPress={() => setQuery("")}
            style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }}
          >
            <X size={18} color={t.muted} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chips}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: category === "all" }}
          onPress={() => setCategory("all")}
          style={[s.chip, category === "all" ? s.selected : null]}
        >
          <Txt
            weight="bold"
            style={{ color: category === "all" ? t.onAccent : t.muted }}
          >
            كل المنتجات
          </Txt>
        </Pressable>
        {categories.map((c) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: category === c.id }}
            key={c.id}
            onPress={() => setCategory(c.id)}
            style={[s.chip, category === c.id ? s.selected : null]}
          >
            <Txt
              weight="bold"
              style={{ color: category === c.id ? t.onAccent : t.muted }}
            >
              {c.label}
            </Txt>
          </Pressable>
        ))}
      </ScrollView>
      <View style={s.filterBox}>
        <View style={s.filterRow}>
          <SlidersHorizontal size={16} color={t.muted} />
          <Txt weight="bold" style={{ fontSize: 13 }}>
            الميزانية ({settings.currency})
          </Txt>
          {[
            { id: "all", label: "الكل" },
            { id: "150", label: "حتى 150" },
            { id: "300", label: "حتى 300" },
            { id: "500", label: "حتى 500" },
          ].map((b) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: b.id === budget }}
              key={b.id}
              onPress={() => { setBudget(b.id); setCustomBudget(""); }}
              style={[
                s.smallChip,
                budget === b.id ? { backgroundColor: t.orangeSoft } : null,
              ]}
            >
              <Txt
                style={{
                  fontSize: 12,
                  color: budget === b.id ? t.orange : t.muted,
                }}
              >
                {b.label}
              </Txt>
            </Pressable>
          ))}
        </View>
        <TextInput
          accessibilityLabel={`حد أقصى مخصص للسعر بعملة ${settings.currency}`}
          keyboardType="decimal-pad"
          placeholder={`حد أقصى مخصص (${settings.currency})`}
          placeholderTextColor={t.muted}
          value={customBudget}
          onChangeText={(value) => { setCustomBudget(value); setBudget("all"); }}
          style={[s.budgetInput, { color: t.ink, borderColor: t.line }]}
        />
        {customBudget.trim() && parsedBudget === undefined ? <Txt style={{ color: t.orange, fontSize: 12 }}>أدخل مبلغًا موجبًا، حتى ثلاث خانات عشرية.</Txt> : null}
        <View style={s.filterRow}>
          <Txt style={{ color: t.muted, fontSize: 12 }}>الترتيب</Txt>
          {[
            { id: "featured", label: "اختياراتنا" },
            { id: "low", label: "الأقل سعرًا" },
            { id: "high", label: "الأعلى سعرًا" },
            { id: "rating", label: "الأعلى تقييمًا" },
          ].map((o) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: o.id === sort }}
              key={o.id}
              onPress={() => setSort(o.id as CatalogSort)}
              style={s.smallChip}
            >
              <Txt
                weight={sort === o.id ? "bold" : "regular"}
                style={{ fontSize: 12, color: sort === o.id ? t.ink : t.muted }}
              >
                {o.label}
              </Txt>
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="checkbox" accessibilityLabel="المتوفر في المخزون فقط" accessibilityState={{ checked: stockOnly }} onPress={() => setStockOnly(!stockOnly)} style={[s.smallChip, { backgroundColor: stockOnly ? t.orangeSoft : t.secondary, alignSelf: "flex-end" }]}>
          <Txt style={{ color: stockOnly ? t.orange : t.muted, fontSize: 13 }}>{stockOnly ? "✓ " : ""}المتوفر في المخزون فقط</Txt>
        </Pressable>
      </View>
      <View style={s.results}>
        <Txt weight="bold" style={{ fontSize: 14 }}>
          {filtered.length} لُقطة بانتظارك
        </Txt>
        {query || category !== "all" || budget !== "all" || customBudget || stockOnly || sort !== "featured" ? (
          <Pressable
            accessibilityRole="button"
            onPress={resetFilters}
          >
            <Txt style={{ color: t.orange, fontSize: 12 }}>
              إعادة ضبط الفلاتر
            </Txt>
          </Pressable>
        ) : null}
      </View>
      {filtered.length ? (
        <ProductGrid items={filtered} />
      ) : (
        <View>
          <EmptyState
            title="لم نجد لُقطة مطابقة"
            detail="جرّب كلمة أخرى أو ميزانية أوسع، ثم أعد ضبط الفلاتر."
          />
          <Pressable
            accessibilityRole="button"
            onPress={resetFilters}
          >
            <Txt style={{ textAlign: "center", color: t.orange }}>
              مسح البحث والفلاتر
            </Txt>
          </Pressable>
        </View>
      )}
    </Shell>
  );
}
const makeStyles = (t: Palette) => StyleSheet.create({
  search: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 13,
    backgroundColor: t.paper,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.line,
    paddingHorizontal: 18,
    minHeight: 56,
  },
  input: {
    flex: 1,
    fontFamily: "Tajawal_400Regular",
    fontSize: 15,
    color: t.ink,
    textAlign: "right",
    paddingVertical: 12,
  },
  chips: { flexDirection: "row-reverse", gap: 10, paddingVertical: 23 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: t.secondary,
  },
  selected: { backgroundColor: t.orange },
  filterBox: {
    backgroundColor: t.paper,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: t.line,
    gap: 7,
  },
  filterRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  smallChip: { paddingVertical: 10, paddingHorizontal: 10, borderRadius: 9, minHeight: 44, justifyContent: "center" },
  budgetInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 46, fontFamily: "Tajawal_400Regular", textAlign: "right" },
  results: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 18,
  },
});
