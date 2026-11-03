// "الدفع الآمن" — creates a HyperPay checkout for a server-priced card order and shows
// the hosted form; the result is verified by the server before the order counts as paid.
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Lock } from "lucide-react-native";
import { Shell } from "../../components/Shell";
import { Txt } from "../../components/ui";
import { Chip, CTA, ErrorBlock, LoadingBlock } from "../../components/design/kit";
import { PaymentSurface } from "../../components/smart/PaymentSurface";
import { api } from "../../lib/api";
import { useSession } from "../../lib/session";
import { useStore } from "../../lib/store";
import { useTheme } from "../../lib/theme";

export default function PayScreen() {
  const { colors: t } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { baseUrl } = useSession();
  const { notify, refreshOrders } = useStore();
  const [page, setPage] = useState<{ url: string; amount: string; currency: string; sandbox: boolean } | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !id) return; started.current = true;
    api.post<{ pageUrl: string; amount: string; currency: string; sandbox: boolean }>("/payments/checkout", { orderId: id })
      .then((r) => setPage({ url: `${baseUrl.replace(/\/api$/, "")}${r.pageUrl}`, amount: r.amount, currency: r.currency, sandbox: r.sandbox }))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "تعذّر بدء الدفع"));
  }, [id, baseUrl]);
  async function finish(status: string) {
    const final = status === "paid" ? "paid" : await api.post<{ status: string }>("/payments/verify", { orderId: id }).then((r) => r.status).catch(() => status);
    notify(final === "paid" ? "تم الدفع بنجاح" : final === "pending" ? "الدفع قيد المراجعة لدى البنك" : "لم يكتمل الدفع؛ يمكنك المحاولة مجددًا");
    void refreshOrders();
    if (final === "paid" || final === "pending") router.replace(`/tracking/${id}`);
  }
  return (
    <Shell title="الدفع الآمن" subtitle={`الطلب ${id}`} scroll={!page}>
      <View style={{ flex: 1, gap: 10, paddingBottom: 10 }}>
        {page ? <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}><Lock size={18} color={t.green} /><Txt weight="bold" style={{ color: t.title }}>المبلغ {page.amount} {page.currency}</Txt>{page.sandbox ? <Chip label="بيئة اختبار" tone="demo" /> : null}</View> : null}
        {error ? <ErrorBlock message={error} /> : !page ? <LoadingBlock label="نجهّز صفحة الدفع الآمنة…" /> : <PaymentSurface url={page.url} onResult={(s) => void finish(s)} />}
        {page ? <CTA title="تحقق من الدفع" tone="soft" busy={busy} onPress={() => { setBusy(true); void finish("check").finally(() => setBusy(false)); }} testID="pay-verify" /> : null}
        {error ? <CTA title="عرض الطلب" onPress={() => router.replace(`/tracking/${id}`)} /> : null}
      </View>
    </Shell>
  );
}
