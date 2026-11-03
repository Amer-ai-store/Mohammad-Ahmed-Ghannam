// Web build: open HyperPay's page in a new tab; the order page verifies the payment.
import React, { useEffect } from "react";
import { View } from "react-native";
import { Txt } from "../ui";

export function PaymentSurface({ url }: { url: string; onResult: (status: string) => void }) {
  useEffect(() => { window.open(url, "_blank", "noopener"); }, [url]);
  return <View style={{ padding: 16 }} testID="payment-surface"><Txt>فُتحت صفحة الدفع الآمنة في نافذة جديدة. بعد الدفع اضغط «تحقق من الدفع».</Txt></View>;
}
