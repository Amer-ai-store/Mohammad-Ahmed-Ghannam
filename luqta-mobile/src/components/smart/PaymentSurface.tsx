// HyperPay hosted card form inside a WebView. The page is served by the store server and
// loads HyperPay's widget; card data goes only to HyperPay. The server redirects to
// luqta://order/<id>?payment=paid|pending|failed, which we intercept here.
import React from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

export function PaymentSurface({ url, onResult }: { url: string; onResult: (status: string) => void }) {
  return (
    <View style={{ flex: 1, minHeight: 560, borderRadius: 20, overflow: "hidden", backgroundColor: "#fff" }} testID="payment-surface">
      <WebView source={{ uri: url }} originWhitelist={["https://*", "luqta://*"]} javaScriptEnabled domStorageEnabled setSupportMultipleWindows={false} incognito
        onShouldStartLoadWithRequest={(r) => {
          if (r.url.startsWith("luqta://")) { const m = /[?&]payment=(\w+)/.exec(r.url); onResult(m ? m[1] : "pending"); return false; }
          return r.url.startsWith("https://");
        }} />
    </View>
  );
}
