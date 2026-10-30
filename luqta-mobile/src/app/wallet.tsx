import React, { useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Shell } from "../components/Shell";
import { Button, Txt } from "../components/ui";
import { AccountCard, AccountGate, accountMoney, errorMessage, FormField, FormMessage } from "../components/AccountKit";
import { useAccountResource } from "../lib/accountResource";
import { api } from "../lib/api";
import { useTheme } from "../lib/theme";

type Wallet = {
  balance: number;
  currency: string;
  transactions: { id: string; amount: number; type: string; note: string; orderId?: string; date: string }[];
};
type Rewards = {
  points: number;
  redeemablePoints: number;
  currency: string;
  transactions: { id: string; points: number; note: string; orderId?: string; date: string }[];
};

function RewardsContent({ onWalletChanged }: { onWalletChanged: () => void }) {
  const { colors: t } = useTheme();
  const resource = useAccountResource<Rewards>("/rewards");
  const [input, setInput] = useState("100");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const pending = useRef<{ points: number; key: string } | null>(null);
  const redeem = async () => {
    setMessage(""); setSuccess(false);
    const points = Number(input.trim().replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660)));
    if (!Number.isSafeInteger(points) || points < 100 || points % 100 !== 0) return setMessage("أدخل 100 نقطة أو مضاعفاتها.");
    if (!resource.data || points > resource.data.redeemablePoints) return setMessage("رصيد النقاط القابل للاستبدال غير كافٍ.");
    if (pending.current?.points !== points) pending.current = { points, key: `reward-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    setBusy(true);
    try {
      const result = await api.post<{ currency: string }>("/rewards/redeem", { points, requestKey: pending.current.key });
      pending.current = null;
      setMessage(`أضيف ${accountMoney(points / 100, result.currency)} إلى محفظتك.`);
      setSuccess(true);
      resource.reload(); onWalletChanged();
    } catch (failure) { setMessage(errorMessage(failure)); }
    finally { setBusy(false); }
  };
  return <View style={{ gap: 17 }}>
    <Txt weight="bold" style={{ fontSize: 22 }}>برنامج المكافآت</Txt>
    {resource.loading ? <ActivityIndicator color={t.orange} /> : null}
    <FormMessage text={resource.error || message} success={success && !resource.error} />
    {resource.data ? <>
      <AccountCard>
        <Txt weight="extra" style={{ fontSize: 34, color: t.orange }}>{resource.data.points.toLocaleString("ar")} نقطة</Txt>
        <Txt style={{ color: t.muted, lineHeight: 25 }}>تكسب نقطة لكل وحدة كاملة من قيمة المنتجات بعد الخصم عند تسليم الطلب. كل 100 نقطة تُحوَّل إلى {accountMoney(1, resource.data.currency)} في المحفظة. تُعكس النقاط عند قبول المرتجع وتُسوّى النقاط المستبدلة من مبلغ الاسترداد.</Txt>
        {resource.data.points < 0 ? <Txt style={{ color: t.orange }}>رصيد النقاط سالب بعد إرجاع طلب؛ ستغطيه النقاط المكتسبة لاحقًا.</Txt> : null}
        <Txt style={{ color: t.muted }}>القابل للاستبدال الآن: {resource.data.redeemablePoints.toLocaleString("ar")} نقطة</Txt>
        <FormField label="عدد النقاط للاستبدال" value={input} onChangeText={setInput} keyboardType="number-pad" maxLength={7} placeholder="100" />
        <Button title="استبدال النقاط برصيد المحفظة" onPress={() => void redeem()} busy={busy} disabled={resource.data.redeemablePoints < 100} />
      </AccountCard>
      <Txt weight="bold" style={{ fontSize: 22 }}>سجل النقاط</Txt>
      {resource.data.transactions.length ? resource.data.transactions.map((item) => <AccountCard key={item.id}>
        <View style={{ flexDirection: "row-reverse", gap: 14, alignItems: "center" }}><Txt weight="bold" style={{ flex: 1 }}>{item.note}</Txt><Txt weight="bold" style={{ color: item.points >= 0 ? t.green : t.orange }}>{item.points > 0 ? "+" : ""}{item.points.toLocaleString("ar")}</Txt></View>
        <Txt style={{ color: t.muted, fontSize: 12 }}>{new Date(item.date).toLocaleString("ar")}{item.orderId ? ` · ${item.orderId}` : ""}</Txt>
      </AccountCard>) : <AccountCard><Txt style={{ color: t.muted }}>ستظهر نقاطك بعد تسليم أول طلب.</Txt></AccountCard>}
    </> : null}
  </View>;
}

function WalletContent() {
  const { colors: t } = useTheme();
  const resource = useAccountResource<Wallet>("/wallet");
  return <View style={{ gap: 17 }}>
    <Button title="تحديث الرصيد والسجل" secondary onPress={resource.reload} disabled={resource.loading} />
    {resource.loading ? <ActivityIndicator color={t.orange} /> : null}
    <FormMessage text={resource.error} />
    {resource.data ? <>
      <AccountCard><Txt style={{ color: t.muted }}>الرصيد المتاح على الخادم</Txt><Txt weight="extra" style={{ fontSize: 36, color: t.green }}>{accountMoney(resource.data.balance, resource.data.currency)}</Txt><Txt style={{ color: t.muted, lineHeight: 25 }}>تُستخدم المحفظة الداخلية لدفع الطلبات واستلام الاستردادات. لا يوجد شحن ببطاقة أو تحويل مصرفي مفعّل.</Txt></AccountCard>
      <Txt weight="bold" style={{ fontSize: 22 }}>سجل المحفظة</Txt>
      {resource.data.transactions.length ? resource.data.transactions.map((item) => <AccountCard key={item.id}>
        <View style={{ flexDirection: "row-reverse", gap: 14, alignItems: "center" }}><Txt weight="bold" style={{ flex: 1 }}>{item.note || (item.amount >= 0 ? "إضافة رصيد" : "خصم رصيد")}</Txt><Txt weight="bold" style={{ color: item.amount >= 0 ? t.green : t.orange }}>{item.amount > 0 ? "+" : ""}{accountMoney(item.amount, resource.data!.currency)}</Txt></View>
        <Txt style={{ color: t.muted, fontSize: 12 }}>{new Date(item.date).toLocaleString("ar")}{item.orderId ? ` · ${item.orderId}` : ""}</Txt>
      </AccountCard>) : <AccountCard><Txt style={{ color: t.muted }}>لا توجد معاملات على هذا الحساب بعد.</Txt></AccountCard>}
    </> : null}
    <RewardsContent onWalletChanged={resource.reload} />
  </View>;
}

export default function WalletScreen() {
  return <Shell title="المحفظة والمكافآت" subtitle="رصيدك ونقاطك وسجل العمليات المرتبطة بحسابك."><AccountGate><WalletContent /></AccountGate></Shell>;
}
