// Native camera/microphone surface (WebView). Permission prompts are granted to the page
// only after Android grants CAMERA / RECORD_AUDIO to the app.
import React from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { lensHtml, type LensMode } from "./lensHtml";

export type LensMessage = { type: "barcode"; value: string; format?: string } | { type: "photo"; dataUrl: string; noBarcode?: boolean } | { type: "audio"; dataUrl: string } | { type: "ready"; live?: boolean } | { type: "recording" } | { type: "error"; code: string };
const LABELS = { capture: "التقاط", stop: "إيقاف", record: "اضغط وتحدث", fallback: "فتح الكاميرا" };

export function LensSurface({ mode, onMessage, height = 340 }: { mode: LensMode; onMessage: (m: LensMessage) => void; height?: number }) {
  return (
    <View style={{ height, borderRadius: 24, overflow: "hidden", backgroundColor: "#130050" }} testID={`lens-${mode}`}>
      <WebView
        source={{ html: lensHtml(mode, LABELS), baseUrl: "https://lens.luqta.local/" }}
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={(r) => r.url.startsWith("https://lens.luqta.local") || r.url === "about:blank" || r.url.startsWith("data:")}
        javaScriptEnabled
        mediaCapturePermissionGrantType="grant"
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        allowFileAccess={false}
        domStorageEnabled={false}
        setSupportMultipleWindows={false}
        onMessage={(e) => { try { onMessage(JSON.parse(e.nativeEvent.data)); } catch { /* ignore */ } }}
        onError={() => onMessage({ type: "error", code: "WEBVIEW_LOAD" })}
      />
    </View>
  );
}
