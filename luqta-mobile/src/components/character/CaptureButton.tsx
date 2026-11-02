// "التقط صورة" — opens the front camera through the WebView file chooser
// (<input capture="user">), downsizes the photo on the device and returns a data URL.
// No extra native camera module is required; the photo never leaves the phone here.
import React from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { captureHtml } from "./captureHtml";

export function CaptureButton({ label, color, onPhoto, onError }: { label: string; color: string; onPhoto: (dataUrl: string) => void; onError: (message: string) => void }) {
  return (
    <View style={{ flex: 1, height: 56, borderRadius: 999, overflow: "hidden" }} accessibilityRole="button" accessibilityLabel={label} testID="capture-photo">
      <WebView
        source={{ html: captureHtml(label, color) }}
        originWhitelist={["about:blank", "about:srcdoc"]}
        javaScriptEnabled
        scrollEnabled={false}
        allowFileAccess={false}
        style={{ backgroundColor: "transparent" }}
        containerStyle={{ backgroundColor: "transparent" }}
        onMessage={(e) => {
          try {
            const m = JSON.parse(e.nativeEvent.data);
            if (m.type === "photo" && typeof m.dataUrl === "string" && m.dataUrl.startsWith("data:image/jpeg;base64,")) onPhoto(m.dataUrl);
            else onError("تعذّر قراءة الصورة من الكاميرا");
          } catch { onError("تعذّر قراءة الصورة من الكاميرا"); }
        }}
      />
    </View>
  );
}
