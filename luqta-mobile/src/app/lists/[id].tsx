// List detail — check items, add products or free text, budget meter, share invite code,
// and add every catalogue item to the cart in one tap.
import React, { useMemo, useState } from "react";
import { Pressable, Share, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Plus, Share2, ShoppingCart, Trash2 } from "lucide-react-native";
import { Shell } from "../../components/Shell";
import { Txt } from "../../components/ui";
import { AccountGate } from "../../components/AccountKit";
import { Card, Checkbox, Chip, CTA, ErrorBlock, Field, LoadingBlock, SectionHeader, SmallButton } from "../../components/design/kit";
import { ProductRow, useMoney } from "../../components/smart/Bits";
import { ProgressBar } from "../../components/smart/Charts";
import { api } from "../../lib/api";
import { normalizeSearch } from "../../lib/recommendations";
import { useSession } from "../../lib/session";
import { useStore } from "../../lib/store";
import { useRemote } from "../../lib/useRemote";
import type { ShoppingList } from "../../lib/smart";
import { useTheme } from "../../lib/theme";

export default function ListDetail() {
  return <Shell title="القائمة" subtitle="أضف، شارك، واشترِ دفعة واحدة"><AccountGate><Body /></AccountGate></Shell>;
}
function Body() {
  const { colors: t } = useTheme();
  const money = useMoney();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const { products, setQuantity, cart, notify } = useStore();
  const { data, setData, loading, error, reload } = useRemote<{ list: ShoppingList }>(id ? `/lists/${id}` : null, { auth: true });
  const [q, setQ] = useState("");
  const results = useMemo(() => { const n = normalizeSearch(q); return n.length < 2 ? [] : products.filter((p) => normalizeSearch(p.name).includes(n)).slice(0, 5); }, [q, products]);
  const list = data?.list;
  const apply = (l: ShoppingList) => setData({ list: l });
  async function call(fn: () => Promise<{ list: ShoppingList }>) { try { apply((await fn()).list); } catch (e) { notify(e instanceof Error ? e.message : "تعذّر التحديث"); } }
  if (loading && !list) return <LoadingBlock />;
  if (!list) return <ErrorBlock message={error || "القائمة غير موجودة"} onRetry={reload} />;
  const total = list.items.reduce((a, i) => a + (i.lineTotal || 0), 0);
  const isOwner = list.ownerId === user?.id;
  function addAllToCart() {
    let n = 0; for (const i of list!.items) if (i.productId && !i.done && products.some((p) => p.id === i.productId)) { setQuantity(i.productId, (cart[i.productId] || 0) + i.quantity); n++; }
    notify(n ? `أُضيف ${n} صنف إلى السلة` : "لا توجد أصناف من المتجر غير مكتملة"); if (n) router.navigate("/cart");
  }
  return (
    <View style={{ gap: 14 }} testID="list-detail">
      <Card>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
          <Txt weight="extra" style={{ flex: 1, fontSize: 22, color: t.title }}>{list.name}</Txt>
          {list.family ? <Chip label="عائلية" tone="info" /> : null}
        </View>
        <Txt style={{ color: t.muted, marginTop: 4 }}>الإجمالي التقديري {money(total)}{list.budget ? ` من ميزانية ${money(list.budget)}` : ""}</Txt>
        {list.budget ? <View style={{ marginTop: 8 }}><ProgressBar value={total / list.budget} color={total > list.budget ? t.danger : t.green} /></View> : null}
        {list.family && list.shareCode ? (
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 10 }}>
            <Chip label={`رمز الدعوة ${list.shareCode}`} tone="neutral" />
            <SmallButton title="مشاركة" icon={Share2} tone="purple" onPress={() => void Share.share({ message: `انضم إلى قائمة «${list.name}» على لُقطة برمز الدعوة: ${list.shareCode}` })} />
          </View>
        ) : null}
        {list.members.length > 1 ? <Txt style={{ color: t.muted, fontSize: 13, marginTop: 6 }}>الأفراد: {list.members.map((m) => m.name).join("، ")}</Txt> : null}
      </Card>
      <Card padded={false} style={{ paddingHorizontal: 14 }}>
        {list.items.length ? list.items.map((i) => (
          <View key={i.id} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderColor: t.line }}>
            <View style={{ flex: 1 }}><Checkbox checked={i.done} onChange={(v) => void call(() => api.patch(`/lists/${list.id}/items/${i.id}`, { done: v }))} label={<Txt style={{ color: i.done ? t.mutedSoft : t.ink, textDecorationLine: i.done ? "line-through" : "none" }}>{i.title} × {i.quantity}{i.lineTotal != null ? ` · ${money(i.lineTotal)}` : ""}</Txt>} /></View>
            <Txt style={{ color: t.muted, fontSize: 11 }}>{i.addedBy}</Txt>
            <Pressable accessibilityRole="button" accessibilityLabel={`حذف ${i.title}`} onPress={() => void call(() => api.delete(`/lists/${list.id}/items/${i.id}`))} hitSlop={8}><Trash2 size={20} color={t.orange} /></Pressable>
          </View>
        )) : <Txt style={{ color: t.muted, padding: 14 }}>القائمة فارغة.</Txt>}
      </Card>
      <Card>
        <SectionHeader title="أضف صنفًا" icon={Plus} />
        <Field label="ابحث في المتجر أو اكتب صنفًا" placeholder="ابحث في المتجر أو اكتب صنفًا" value={q} onChangeText={setQ} testID="list-add" />
        {results.map((p) => <ProductRow key={p.id} product={p} onPress={() => { setQ(""); void call(() => api.post(`/lists/${list.id}/items`, { productId: p.id, quantity: 1 })); }} />)}
        {q.trim().length >= 2 ? <SmallButton title={`إضافة «${q.trim()}» كنص`} tone="outline" onPress={() => { const title = q.trim(); setQ(""); void call(() => api.post(`/lists/${list.id}/items`, { title })); }} style={{ marginTop: 8 }} /> : null}
      </Card>
      <CTA title="أضف الأصناف المتبقية إلى السلة" icon={ShoppingCart} onPress={addAllToCart} testID="list-to-cart" />
      <CTA title={isOwner ? "حذف القائمة" : "مغادرة القائمة"} tone="soft" onPress={() => void api.delete(`/lists/${list.id}`).then(() => { notify(isOwner ? "حُذفت القائمة" : "غادرت القائمة"); router.replace("/lists"); }).catch((e: unknown) => notify(e instanceof Error ? e.message : "تعذّر"))} />
    </View>
  );
}
