import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Share, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { Bookmark, Share2, ShoppingCart, Tag, Trash, Users } from "lucide-react-native";
import { Shell } from "../components/Shell";
import { ProductImage } from "../components/ProductCard";
import { Mascot } from "../components/Robot";
import { Button, Card, EmptyState, Field, KeyValue, Notice, Row, SectionTitle, Stepper, Txt } from "../components/ui";
import { useStore } from "../lib/store";
import { useSession } from "../lib/session";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { useMoney } from "../lib/money";
import { api } from "../lib/api";
import { cartLimit } from "../lib/reorder";
import { parseSharedCart, sharedCartLink } from "../lib/sharedCart";

type Quote = { subtotal: number; discount: number; shipping: number; total: number; freeShippingRemaining: number; couponError: string | null; zone: { name: string } | null };

export default function Cart() {
  const { colors: t } = useTheme();
  const { t: tr } = useI18n();
  const money = useMoney();
  const { user, configured } = useSession();
  const store = useStore();
  const { products, cart, saved, setQuantity, subtotal, shipping, settings } = store;
  const [coupon, setCoupon] = useState("");
  // A code picked in the coupon wallet arrives as ?coupon= and is applied straight away. A cart someone shared
  // arrives as ?add=rice*2,milk*1 and is only offered: nothing is added until the shopper taps "add all".
  const { coupon: offered, add: sharedParam } = useLocalSearchParams<{ coupon?: string; add?: string }>();
  const [sharedHandled, setSharedHandled] = useState<string | null>(null);
  const shared = useMemo(() => {
    const items = parseSharedCart(sharedParam);
    const known = Object.entries(items).map(([id, quantity]) => ({ product: store.products.find((p) => p.id === id), quantity })).filter((l) => l.product);
    return { known, items: Object.fromEntries(known.map((l) => [l.product!.id, l.quantity])) };
  }, [sharedParam, store.products]);
  const showShared = typeof sharedParam === "string" && sharedParam !== "" && sharedHandled !== sharedParam;
  const closeShared = () => { setSharedHandled(typeof sharedParam === "string" ? sharedParam : null); router.setParams({ add: "" }); };
  const [applied, setApplied] = useState("");
  const [lastOffered, setLastOffered] = useState<string | undefined>(undefined);
  if (typeof offered === "string" && offered && offered !== lastOffered) { setLastOffered(offered); setCoupon(offered); setApplied(offered.trim().toUpperCase()); }
  const [serverQuote, setQuote] = useState<Quote | null>(null);
  const [message, setMessage] = useState("");
  const lines = useMemo(() => Object.entries(cart).map(([id, quantity]) => ({ product: products.find((p) => p.id === id), quantity })).filter((l) => l.product), [cart, products]);
  const savedLines = useMemo(() => Object.entries(saved).map(([id, quantity]) => ({ product: products.find((p) => p.id === id), quantity })).filter((l) => l.product), [saved, products]);
  // Prices, discount and delivery come from the server when connected; the local estimate is only a fallback.
  useEffect(() => {
    let active = true;
    if (!configured || !lines.length) return;
    const timer = setTimeout(() => {
      api.post<Quote>("/checkout/quote", { items: Object.entries(cart).map(([productId, quantity]) => ({ productId, quantity })), couponCode: applied || undefined, address: { city: "عمان" } })
        .then((q) => { if (active) { setQuote(q); if (applied && q.couponError) { setMessage(q.couponError); setApplied(""); } } }).catch(() => { if (active) setQuote(null); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [cart, applied, configured, lines.length]);
  const quote = configured && lines.length ? serverQuote : null;
  const apply = () => { setMessage(""); setApplied(coupon.trim().toUpperCase()); };
  const shareCart = async () => {
    const link = sharedCartLink(cart);
    if (!link) return;
    const list = lines.map(({ product, quantity }) => `• ${product!.name} × ${quantity}`).join("\n");
    const message = `${tr("سلتي في لُقطة ({n:product}):", { n: store.cartCount })}\n${list}\n${tr("افتحها في التطبيق لإضافتها إلى سلتك:")} ${link}`;
    await Clipboard.setStringAsync(link).catch(() => {});
    // Where the system share sheet is missing (some browsers), the link is already on the clipboard.
    try { await Share.share({ message }); } catch { store.notify("نُسخ رابط السلة"); }
  };
  const sharedCard = showShared ? (
    <Card style={{ marginBottom: 14, gap: 10 }} tone="soft" testID="shared-cart">
      <Row><Users size={20} color={t.primary} /><Txt weight="bold" style={{ flex: 1 }}>{tr("سلة مشتركة معك")}</Txt></Row>
      {shared.known.length ? (
        <>
          {shared.known.slice(0, 8).map(({ product, quantity }) => (
            <Txt key={product!.id} testID={`shared-line-${product!.id}`} style={{ fontSize: 13 }}>{`• ${product!.name} × ${quantity}`}</Txt>
          ))}
          {shared.known.length > 8 ? <Txt style={{ color: t.muted, fontSize: 12 }}>{tr("و{n:product} غيرها", { n: shared.known.length - 8 })}</Txt> : null}
          <Row>
            <Button title={tr("أضف الكل إلى سلتي")} testID="shared-cart-add" icon={<ShoppingCart size={16} color={t.onAccent} />} onPress={() => { store.addManyToCart(shared.items); closeShared(); }} style={{ flex: 1 }} />
            <Button title={tr("تجاهل")} testID="shared-cart-dismiss" secondary onPress={closeShared} />
          </Row>
        </>
      ) : (
        <>
          <Txt style={{ color: t.muted, fontSize: 13 }}>{tr("لم نجد منتجات هذه السلة في المتجر.")}</Txt>
          <Button title={tr("تجاهل")} testID="shared-cart-dismiss" secondary onPress={closeShared} />
        </>
      )}
    </Card>
  ) : null;
  if (!lines.length && !savedLines.length) return (
    <Shell title="السلة" testID="cart">
      {sharedCard}
      <EmptyState title="سلتك فاضية" detail="أضف منتجات من المتجر أو اطلب من لُقطي أن يجهز لك سلة بميزانيتك." art={<Mascot size={120} motion="sad" interactive={false} />} />
      <Button title={tr("جهز لي سلة بميزانية")} secondary onPress={() => router.navigate({ pathname: "/assistant", params: { q: "جهز لي سلة بـ ٢٠ دينار" } })} />
    </Shell>
  );
  const total = quote ? quote.total : subtotal + shipping;

  const freeLeft = quote ? quote.freeShippingRemaining : Math.max(0, settings.freeShippingThreshold - subtotal);
  return (
    <Shell title="السلة" subtitle={tr("{n:product} في سلتك", { n: store.cartCount })} robot={freeLeft > 0 ? tr("باقي {m} على التوصيل المجاني!", { m: money.format(freeLeft) }) : "التوصيل مجاني 🎉"} testID="cart">
      {sharedCard}
      {lines.length ? (
        <View style={{ gap: 10 }}>
          {lines.map(({ product, quantity }) => (
            <Card key={product!.id} style={{ padding: 12 }} testID={`cart-line-${product!.id}`}>
              <Row style={{ alignItems: "flex-start" }}>
                <Pressable accessibilityRole="button" onPress={() => router.push(`/product/${product!.id}`)} style={{ width: 76, height: 76, borderRadius: 18, overflow: "hidden" }}><ProductImage product={product!} /></Pressable>
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt weight="bold" numberOfLines={2}>{product!.name}</Txt>
                  <Txt style={{ color: t.muted, fontSize: 12 }}>{product!.unit || product!.subtitle}</Txt>
                  <Txt weight="extra" style={{ color: t.orange }}>{money.format(product!.price * quantity)}</Txt>
                  <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
                    <Stepper value={quantity} onChange={(q) => setQuantity(product!.id, q)} min={1} max={Math.max(1, cartLimit(products, product!.id))} label={product!.name} testID={`stepper-${product!.id}`} />
                    <Row gap={4}>
                      <Pressable testID={`save-later-${product!.id}`} accessibilityRole="button" accessibilityLabel={`${tr("احفظ لوقت لاحق")} ${product!.name}`} onPress={() => store.saveForLater(product!.id)} style={{ padding: 8 }}><Bookmark size={18} color={t.primary} /></Pressable>
                      <Pressable testID={`remove-${product!.id}`} accessibilityRole="button" accessibilityLabel={`${tr("حذف")} ${product!.name}`} onPress={() => setQuantity(product!.id, 0)} style={{ padding: 8 }}><Trash size={18} color={t.danger} /></Pressable>
                    </Row>
                  </Row>
                </View>
              </Row>
            </Card>
          ))}
        </View>
      ) : <Notice text="سلتك فارغة، لكن عندك منتجات محفوظة لوقت لاحق." />}

      {lines.length ? (
        <>
          <Card style={{ marginTop: 14, gap: 8 }}>
            <Row><Tag size={18} color={t.primary} /><Txt weight="bold" style={{ flex: 1 }}>{tr("كود الخصم")}</Txt></Row>
            <Row>
              <View style={{ flex: 1 }}><Field label="أدخل الكود" testID="coupon-input" value={coupon} onChangeText={setCoupon} autoCapitalize="characters" placeholder="WELCOME5" /></View>
              <Button title={tr("تطبيق")} testID="apply-coupon" onPress={apply} disabled={!coupon.trim() || !configured} style={{ marginTop: 22, minHeight: 50 }} />
            </Row>
            {!configured ? <Txt style={{ color: t.muted, fontSize: 12 }}>{tr("أكواد الخصم تتحقق على خادم المتجر.")}</Txt> : null}
            {applied && quote?.discount ? <Notice text={tr("تم تطبيق {c}: وفّرت {m}", { c: applied, m: money.format(quote.discount) })} tone="success" /> : null}
            {message ? <Notice text={message} tone="danger" /> : null}
          </Card>
          <Card style={{ marginTop: 14 }} testID="cart-summary">
            <KeyValue label="المجموع الفرعي" value={money.format(quote?.subtotal ?? subtotal)} />
            {quote?.discount ? <KeyValue label="الخصم" value={`- ${money.format(quote.discount)}`} /> : null}
            <KeyValue label={quote?.zone ? tr("التوصيل ({z})", { z: quote.zone.name }) : "التوصيل (تقديري)"} value={money.format(quote?.shipping ?? shipping)} />
            <View style={{ height: 6, borderRadius: 3, backgroundColor: t.line, marginVertical: 8, overflow: "hidden" }}><View style={{ width: `${Math.min(100, Math.round(((quote?.subtotal ?? subtotal) / Math.max(1, settings.freeShippingThreshold)) * 100))}%`, height: 6, backgroundColor: t.success }} /></View>
            <KeyValue label="الإجمالي" value={money.format(total)} strong testID="cart-total" />
            {money.approx(total) ? <Txt style={{ color: t.muted, fontSize: 12 }}>{money.approx(total)}</Txt> : null}
          </Card>
          <Button title={tr(user ? "متابعة الطلب" : "سجّل الدخول للمتابعة")} testID="checkout" icon={<ShoppingCart size={18} color={t.onAccent} />} onPress={() => router.push(user ? { pathname: "/checkout", params: applied ? { coupon: applied } : {} } : "/login")} style={{ marginTop: 14 }} />
          <Button title={tr("شارك السلة")} testID="share-cart" secondary icon={<Share2 size={17} color={t.ink} />} onPress={() => void shareCart()} style={{ marginTop: 10 }} />
        </>
      ) : null}

      {savedLines.length ? (
        <View testID="saved-for-later">
          <SectionTitle title="محفوظة لوقت لاحق" />
          {savedLines.map(({ product, quantity }) => (
            <Card key={product!.id} style={{ padding: 12, marginBottom: 8 }}>
              <Row>
                <View style={{ width: 56, height: 56, borderRadius: 14, overflow: "hidden" }}><ProductImage product={product!} /></View>
                <View style={{ flex: 1 }}><Txt weight="bold" numberOfLines={1}>{product!.name}</Txt><Txt style={{ color: t.muted, fontSize: 12 }}>{tr("الكمية {n}", { n: quantity })} · {money.format(product!.price)}</Txt></View>
                <Button title={tr("انقل للسلة")} testID={`move-to-cart-${product!.id}`} onPress={() => store.moveToCart(product!.id)} style={{ minHeight: 40, paddingVertical: 6, paddingHorizontal: 12 }} />
                <Pressable accessibilityRole="button" accessibilityLabel={tr("حذف")} onPress={() => store.removeSaved(product!.id)} style={{ padding: 8 }}><Trash size={16} color={t.muted} /></Pressable>
              </Row>
            </Card>
          ))}
        </View>
      ) : null}
    </Shell>
  );
}
