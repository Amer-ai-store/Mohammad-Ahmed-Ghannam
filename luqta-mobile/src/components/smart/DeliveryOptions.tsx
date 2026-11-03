// G16 — delivery mode (standard / express quick-commerce / click-and-collect), courier
// instructions, contactless drop-off and tip. Fees and ETAs come from the server.
import React, { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { HandCoins, Store, Truck, Zap } from "lucide-react-native";
import { Txt } from "../ui";
import { Card, Checkbox, Chip, Segmented } from "../design/kit";
import { useMoney } from "./Bits";
import { api } from "../../lib/api";
import { useFlags } from "../../lib/flags";
import { useSession } from "../../lib/session";
import { useStore } from "../../lib/store";
import { useTheme } from "../../lib/theme";

type Options = { standard: { fee: number; eta: string; available?: boolean; reason?: string; zone?: { inService?: boolean; zone?: string; distanceKm?: number; needsLocation?: boolean } }; express: { available: boolean; reason?: string; fee?: number; etaMinutes?: number; branch?: { id: string; name: string }; distanceKm?: number }; pickup: { branchId: string; name: string; city: string; available: boolean; readyInMinutes: number; distanceKm?: number }[]; tips: number[] };

export function DeliveryOptions({ latitude, longitude }: { latitude?: number; longitude?: number }) {
  const { colors: t } = useTheme();
  const money = useMoney();
  const flags = useFlags();
  const { configured } = useSession();
  const { cart, draft, updateDraft, branches, settings, subtotal } = useStore();
  const [opts, setOpts] = useState<Options | null>(null);
  const items = Object.entries(cart).filter(([, q]) => q > 0).map(([productId, quantity]) => ({ productId, quantity }));
  const key = `${latitude ?? ""}:${longitude ?? ""}:${items.map((i) => `${i.productId}x${i.quantity}`).join(",")}`;
  useEffect(() => {
    let active = true;
    if (!configured || !items.length) return;
    api.post<Options>("/delivery/options", { items, latitude, longitude }).then((r) => { if (active) setOpts(r); }).catch(() => { if (active) setOpts(null); });
    return () => { active = false; };
  }, [key, configured]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown: Options = configured && opts ? opts : { standard: { fee: subtotal >= settings.freeShippingThreshold ? 0 : settings.shippingFee, eta: "خلال الفترة المختارة" }, express: { available: false, reason: "التوصيل السريع يُحسب من خادم المتجر حسب أقرب فرع" }, pickup: branches.map((b) => ({ branchId: b.id, name: b.name, city: b.city || "", available: true, readyInMinutes: 30 })), tips: [0, 0.5, 1, 2] };
  const mode = draft.deliveryMode || "standard";
  const modes = [{ value: "standard" as const, label: "عادي", icon: Truck }, ...(flags.express ? [{ value: "express" as const, label: "سريع", icon: Zap }] : []), ...(flags.pickup ? [{ value: "pickup" as const, label: "استلام", icon: Store }] : [])];
  const pick = (m: "standard" | "express" | "pickup") => updateDraft({ deliveryMode: m, ...(m === "express" ? { expressFee: shown.express.fee, expressEta: shown.express.etaMinutes } : {}), ...(m === "pickup" ? { tip: 0, contactless: false, eco: false } : {}) });
  return (
    <Card style={{ marginTop: 12, gap: 10 }} testID="delivery-options">
      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}><Truck size={24} color={t.orange} /><Txt weight="bold" style={{ fontSize: 18, color: t.title }}>طريقة الاستلام</Txt></View>
      <Segmented value={mode} onChange={pick} options={modes} testID="delivery-mode" />
      {mode === "standard" ? (shown.standard.available === false
        ? <Txt style={{ color: t.danger }} testID="outside-zone">{shown.standard.reason}</Txt>
        : <Txt style={{ color: t.muted }}>رسوم التوصيل {money(shown.standard.fee)}{shown.standard.zone?.zone ? ` (منطقة ${shown.standard.zone.zone}، ${shown.standard.zone.distanceKm} كم)` : shown.standard.zone?.needsLocation ? " — حدّد موقعك لحساب رسوم منطقتك" : ""} · {shown.standard.eta}</Txt>) : null}
      {mode === "express" ? (shown.express.available ? (
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Chip label={`خلال ~${shown.express.etaMinutes} دقيقة`} tone="success" icon={Zap} />
          <Chip label={`+${money(shown.express.fee)}`} tone="warn" />
          <Txt style={{ color: t.muted, fontSize: 13 }}>من {shown.express.branch?.name} ({shown.express.distanceKm} كم)</Txt>
        </View>
      ) : <Txt style={{ color: t.warn }}>{shown.express.reason || "التوصيل السريع غير متاح لهذا العنوان"}</Txt>) : null}
      {mode === "pickup" ? (
        <View style={{ gap: 6 }}>
          {shown.pickup.map((b) => {
            const selected = draft.pickupBranchId === b.branchId;
            return (
              <Pressable key={b.branchId} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: !b.available }} disabled={!b.available} onPress={() => updateDraft({ pickupBranchId: b.branchId })}
                style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: selected ? t.orange : t.line, backgroundColor: selected ? t.orangeSoft : t.card, opacity: b.available ? 1 : 0.5 }}>
                <Store size={20} color={selected ? t.orange : t.title} />
                <View style={{ flex: 1, alignItems: "flex-end" }}><Txt weight="bold" style={{ color: t.title }}>{b.name}</Txt><Txt style={{ color: t.muted, fontSize: 12 }}>{b.available ? `جاهز خلال ${b.readyInMinutes} دقيقة` : "بعض الأصناف غير متوفرة"}{b.distanceKm != null ? ` · ${b.distanceKm} كم` : ""}</Txt></View>
                <Chip label="مجاني" tone="success" />
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {mode !== "pickup" ? (
        <>
          <TextInput testID="delivery-instructions" accessibilityLabel="تعليمات للسائق" value={draft.instructions || ""} onChangeText={(v) => updateDraft({ instructions: v.slice(0, 300) })} placeholder="تعليمات للسائق (مثلًا: الطابق الثالث، اتصل عند الوصول)" placeholderTextColor={t.mutedSoft} multiline
            style={{ minHeight: 64, borderRadius: 14, borderWidth: 1, borderColor: t.line, backgroundColor: t.field, padding: 12, textAlign: "right", textAlignVertical: "top", color: t.ink, fontFamily: "IBMPlexSansArabic_500Medium" }} />
          <Checkbox checked={!!draft.contactless} onChange={(v) => updateDraft({ contactless: v })} label={<Txt style={{ color: t.ink }}>توصيل بدون تلامس — اترك الطلب عند الباب</Txt>} testID="contactless" />
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <HandCoins size={20} color={t.purple} /><Txt style={{ color: t.ink }}>إكرامية السائق:</Txt>
            {shown.tips.map((v) => { const sel = (draft.tip || 0) === v; return <Pressable key={v} accessibilityRole="radio" accessibilityState={{ checked: sel }} accessibilityLabel={v ? `إكرامية ${money(v)}` : "بدون إكرامية"} onPress={() => updateDraft({ tip: v })} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: sel ? t.orange : t.field }}><Txt weight="bold" style={{ color: sel ? t.onAccent : t.ink }}>{v ? money(v) : "بدون"}</Txt></Pressable>; })}
          </View>
        </>
      ) : null}
    </Card>
  );
}
