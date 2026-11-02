// Explore — reference design "اكتشف عالمك"
import React, { useMemo, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ArrowUpDown, Check, ChevronDown, ChevronLeft, MapPin, Search, ShoppingBasket, SlidersHorizontal, X } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { Txt } from "../components/ui";
import { BrandHeader, Chip, SectionHeader, SmallButton, Toggle } from "../components/design/kit";
import { MiniProductCard } from "../components/ProductCard";
import { Companion } from "../components/character/Companion";
import { categories, categoryAliases } from "../data/products";
import { designAssets } from "../lib/designAssets";
import { useStore } from "../lib/store";
import { searchCatalog, type CatalogSort } from "../lib/catalog-search";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";

const tileImages: Record<string, number> = {
  grocery: designAssets.exGrocery, electronics: designAssets.exElectronics, fashion: designAssets.exFashion,
  home: designAssets.exHome, beauty: designAssets.exBeauty, sports: designAssets.exSports,
};
const sorts: { value: CatalogSort; label: string }[] = [
  { value: "featured", label: "الأنسب" }, { value: "low", label: "السعر: من الأقل" }, { value: "high", label: "السعر: من الأعلى" }, { value: "rating", label: "الأعلى تقييمًا" },
];
const budgets = [{ v: undefined, l: "كل الأسعار" }, { v: 5, l: "حتى ٥ د.أ" }, { v: 20, l: "حتى ٢٠ د.أ" }, { v: 50, l: "حتى ٥٠ د.أ" }] as const;

export default function Explore() {
  const params = useLocalSearchParams<{ q?: string; category?: string }>();
  return <ExploreContent key={`${params.q || ""}:${params.category || ""}`} initialQuery={params.q || ""} initialCategory={params.category || "grocery"} />;
}

function BranchPill() {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { branches, branchId, setBranch } = useStore();
  const [open, setOpen] = useState(false);
  const current = branches.find((b) => b.id === branchId) || branches[0];
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`الفرع: ${current?.name || "اختر الفرع"}`} testID="branch-pill" onPress={() => setOpen(true)} style={s.branchPill}>
        <ChevronDown size={20} color={t.ink} />
        <Txt weight="medium" style={{ fontSize: 16, color: t.ink }}>{current?.name || "اختر الفرع"}</Txt>
        <MapPin size={22} color={t.ink} fill={t.ink} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)} accessibilityLabel="إغلاق">
          <Pressable style={s.sheet} onPress={() => {}}>
            <Txt weight="extra" style={{ fontSize: 20, color: t.title, marginBottom: 10 }}>اختر الفرع</Txt>
            {branches.map((b) => (
              <Pressable key={b.id} accessibilityRole="radio" accessibilityState={{ checked: b.id === current?.id }} onPress={() => { setBranch(b.id); setOpen(false); }} style={s.sheetRow}>
                {b.id === current?.id ? <Check size={20} color={t.orange} /> : <View style={{ width: 20 }} />}
                <View style={{ flex: 1 }}><Txt weight="bold" style={{ color: t.ink }}>{b.name}</Txt>{b.city ? <Txt style={{ color: t.muted, fontSize: 13 }}>{b.city}</Txt> : null}</View>
              </Pressable>
            ))}
            <Txt style={{ color: t.muted, fontSize: 12, marginTop: 8 }}>تُعرض الكميات حسب الفرع ويُعاد التحقق منها عند تأكيد الطلب.</Txt>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function ExploreContent({ initialQuery, initialCategory }: { initialQuery: string; initialCategory: string }) {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { products, branchId, catalogStatus } = useStore();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(categoryAliases[initialCategory] || initialCategory);
  const [sort, setSort] = useState<CatalogSort>("featured");
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [stockOnly, setStockOnly] = useState(false);
  const [panel, setPanel] = useState<"none" | "filter" | "sort">("none");
  const [showAll, setShowAll] = useState(false);
  const branchAware = useMemo(() => products.map((p) => (p.branchStock && branchId ? { ...p, stock: Math.min(p.stock ?? 0, p.branchStock[branchId] ?? 0) } : p)), [products, branchId]);
  const normalized = useMemo(() => branchAware.map((p) => ({ ...p, category: categoryAliases[p.category] || p.category })), [branchAware]);
  const searching = query.trim().length > 0;
  const results = useMemo(() => searchCatalog(normalized, { query, category: searching ? "all" : category, sort, maxPrice, inStockOnly: stockOnly }), [normalized, query, category, sort, maxPrice, stockOnly, searching]);
  const shown = searching || showAll ? results : results.slice(0, 4);
  const catLabel = categories.find((c) => c.id === category)?.label || "كل المنتجات";
  const filtersOn = maxPrice !== undefined || stockOnly;
  return (
    <Shell header={<BrandHeader left={<BranchPill />} />} title="اكتشف عالمك" subtitle="كل ما تحتاجه في مكان واحد" titleAlign="right"
      side={<Companion action="cart" base={150} aspect={0.75} enterFrom="right" />}>
      <View style={s.search}>
        <Pressable accessibilityRole="button" accessibilityLabel="تنفيذ البحث" style={s.searchBtn} onPress={() => setShowAll(true)}><Search size={24} color={t.ink} /></Pressable>
        <TextInput testID="explore-search" accessibilityLabel="ابحث عن منتجات أو علامات تجارية" value={query} onChangeText={setQuery} placeholder="ابحث عن منتجات أو علامات تجارية..." placeholderTextColor={t.muted} returnKeyType="search" style={s.input} />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel="مسح البحث" onPress={() => setQuery("")} style={{ padding: 10 }}><X size={18} color={t.muted} /></Pressable> : null}
      </View>
      <View style={s.tools}>
        <Pressable accessibilityRole="button" accessibilityLabel="ترتيب" testID="explore-sort" accessibilityState={{ expanded: panel === "sort" }} onPress={() => setPanel(panel === "sort" ? "none" : "sort")} style={[s.tool, sort !== "featured" && { borderColor: t.orange }]}>
          <ChevronDown size={18} color={t.ink} /><Txt weight="medium" style={{ fontSize: 16, color: t.ink }}>ترتيب</Txt><ArrowUpDown size={24} color={t.ink} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="فلترة" testID="explore-filter" accessibilityState={{ expanded: panel === "filter" }} onPress={() => setPanel(panel === "filter" ? "none" : "filter")} style={[s.tool, filtersOn && { borderColor: t.orange }]}>
          <ChevronDown size={18} color={t.ink} /><Txt weight="medium" style={{ fontSize: 16, color: t.ink }}>فلترة</Txt><SlidersHorizontal size={24} color={t.ink} />
        </Pressable>
      </View>
      {panel === "filter" ? (
        <View style={s.panel}>
          <Txt weight="bold" style={{ color: t.title }}>السعر</Txt>
          <View style={s.wrap}>{budgets.map((b) => <SmallButton key={b.l} title={b.l} tone={maxPrice === b.v ? "primary" : "outline"} onPress={() => setMaxPrice(b.v)} />)}</View>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
            <Txt style={{ color: t.ink }}>المتوفر فقط في الفرع المختار</Txt><Toggle value={stockOnly} onChange={setStockOnly} label="المتوفر فقط" />
          </View>
          {filtersOn ? <SmallButton title="مسح الفلاتر" tone="soft" onPress={() => { setMaxPrice(undefined); setStockOnly(false); }} style={{ alignSelf: "flex-end" }} /> : null}
        </View>
      ) : null}
      {panel === "sort" ? (
        <View style={s.panel}>
          {sorts.map((o) => (
            <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: sort === o.value }} onPress={() => { setSort(o.value); setPanel("none"); }} style={s.sheetRow}>
              {sort === o.value ? <Check size={20} color={t.orange} /> : <View style={{ width: 20 }} />}<Txt style={{ color: t.ink, flex: 1 }}>{o.label}</Txt>
            </Pressable>
          ))}
        </View>
      ) : null}

      {!searching ? (
        <View style={s.tiles}>
          {categories.map((c) => {
            const active = c.id === category;
            return (
              <Pressable key={c.id} testID={`explore-cat-${c.id}`} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={c.label} onPress={() => { setCategory(c.id); setShowAll(false); }} style={[s.tile, active && s.tileActive]}>
                <Image source={tileImages[c.id]} style={s.tileImage} resizeMode="contain" />
                <Txt weight="bold" style={{ fontSize: 16, color: t.title, textAlign: "center" }}>{c.label}</Txt>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={s.section}>
        <SectionHeader title={searching ? `نتائج «${query.trim()}»` : catLabel} icon={searching ? Search : ShoppingBasket}
          action={!searching && results.length > 4 ? (showAll ? "عرض أقل" : "عرض الكل") : undefined} onPress={() => setShowAll(!showAll)} />
        {catalogStatus === "loading" ? <Txt style={{ color: t.muted, textAlign: "center", padding: 16 }}>جارٍ مزامنة المنتجات من المتجر…</Txt> : null}
        {!shown.length ? (
          <View style={{ alignItems: "center", padding: 20, gap: 8 }}>
            <Txt weight="bold" style={{ color: t.title }}>لا توجد منتجات مطابقة</Txt>
            <Txt style={{ color: t.muted, textAlign: "center" }}>جرّب كلمة أخرى أو امسح الفلاتر أو اختر فرعًا آخر.</Txt>
          </View>
        ) : (
          <View style={s.grid}>{shown.map((p) => <MiniProductCard key={p.id} product={p} width="48.5%" />)}</View>
        )}
        {!searching && !showAll && results.length > 4 ? (
          <Pressable accessibilityRole="button" onPress={() => setShowAll(true)} style={{ flexDirection: "row-reverse", alignSelf: "center", alignItems: "center", padding: 10 }}>
            <Txt style={{ color: t.orange }}>عرض {results.length - 4} منتجات أخرى</Txt><ChevronLeft size={16} color={t.orange} />
          </Pressable>
        ) : null}
        {catalogStatus === "sample" ? <Chip label="بيانات تجريبية" tone="demo" /> : null}
      </View>
    </Shell>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  branchPill: { flexDirection: "row-reverse", alignItems: "center", gap: 10, minHeight: 50, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.card },
  backdrop: { flex: 1, backgroundColor: "rgba(19,0,80,0.35)", justifyContent: "flex-end" },
  sheet: { backgroundColor: t.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34 },
  sheetRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12, minHeight: 50, borderBottomWidth: 1, borderColor: t.line },
  search: { flexDirection: "row", alignItems: "center", backgroundColor: t.card, borderRadius: 999, borderWidth: 1, borderColor: t.line, padding: 5, minHeight: 60, marginTop: 4 },
  searchBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: t.purpleSoft, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, fontFamily: "Tajawal_500Medium", fontSize: 16, color: t.ink, textAlign: "right", writingDirection: "rtl", paddingHorizontal: 12, minHeight: 48 },
  tools: { flexDirection: "row", gap: 12, marginTop: 12, width: "76%" },
  tool: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.card },
  panel: { backgroundColor: t.card, borderRadius: 20, borderWidth: 1, borderColor: t.line, padding: 14, marginTop: 10, gap: 10 },
  wrap: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  tiles: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12, marginTop: 16 },
  tile: { width: "31.6%", aspectRatio: 0.92, backgroundColor: t.card, borderRadius: 20, borderWidth: 1.5, borderColor: t.line, alignItems: "center", justifyContent: "center", padding: 8, gap: 4 },
  tileActive: { borderColor: t.orange, backgroundColor: t.orangeSoft },
  tileImage: { width: "92%", height: "66%" },
  section: { backgroundColor: t.card, borderRadius: 26, borderWidth: 1, borderColor: t.line, padding: 12, marginTop: 16 },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
});
