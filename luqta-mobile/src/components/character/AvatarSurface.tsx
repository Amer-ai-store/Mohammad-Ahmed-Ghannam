// Native surface: transparent WebView hosting the WebGL avatar / product viewer.
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

export type SurfaceHandle = { send: (message: object) => void };
type Props = { html: string; onMessage: (data: string) => void; interactive?: boolean; testID?: string; accessibilityLabel?: string };

export const AvatarSurface = forwardRef<SurfaceHandle, Props>(function AvatarSurface({ html, onMessage, interactive = false, testID, accessibilityLabel }, ref) {
  const web = useRef<WebView>(null);
  useImperativeHandle(ref, () => ({
    send: (message: object) => {
      const payload = JSON.stringify(JSON.stringify(message));
      web.current?.injectJavaScript(`(function(){var m=${payload};if(window.LuqtaAvatar)window.LuqtaAvatar.command(m);if(window.LuqtaViewer)window.LuqtaViewer.command(m);})();true;`);
    },
  }), []);
  return (
    <View style={{ flex: 1 }} pointerEvents={interactive ? "auto" : "none"} testID={testID} accessibilityLabel={accessibilityLabel}>
      <WebView
        ref={web}
        source={{ html }}
        originWhitelist={["about:blank", "about:srcdoc"]}
        onShouldStartLoadWithRequest={(req) => req.url === "about:blank" || req.url.startsWith("data:") || req.url === ""}
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        domStorageEnabled={false}
        allowFileAccess={false}
        setSupportMultipleWindows={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        androidLayerType="hardware"
        style={{ flex: 1, backgroundColor: "transparent" }}
        containerStyle={{ backgroundColor: "transparent" }}
        onMessage={(e) => onMessage(e.nativeEvent.data)}
        onError={() => onMessage(JSON.stringify({ type: "error", code: "WEBVIEW_LOAD" }))}
        onRenderProcessGone={() => onMessage(JSON.stringify({ type: "error", code: "WEBVIEW_GONE" }))}
      />
    </View>
  );
});
