// Web surface: sandboxed iframe (srcdoc) hosting the WebGL avatar / product viewer.
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { View } from "react-native";

export type SurfaceHandle = { send: (message: object) => void };
type Props = { html: string; onMessage: (data: string) => void; interactive?: boolean; testID?: string; accessibilityLabel?: string };

export const AvatarSurface = forwardRef<SurfaceHandle, Props>(function AvatarSurface({ html, onMessage, interactive = false, testID, accessibilityLabel }, ref) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const handler = useRef(onMessage);
  handler.current = onMessage;
  useImperativeHandle(ref, () => ({ send: (message: object) => frame.current?.contentWindow?.postMessage(JSON.stringify(message), "*") }), []);
  useEffect(() => {
    const listener = (e: MessageEvent) => { if (e.source === frame.current?.contentWindow && typeof e.data === "string") handler.current(e.data); };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);
  return (
    <View style={{ flex: 1 }} pointerEvents={interactive ? "auto" : "none"} testID={testID} accessibilityLabel={accessibilityLabel}>
      {React.createElement("iframe", {
        ref: frame, srcDoc: html, title: accessibilityLabel || "عرض ثلاثي الأبعاد", sandbox: "allow-scripts",
        style: { border: 0, width: "100%", height: "100%", background: "transparent", pointerEvents: interactive ? "auto" : "none" },
      })}
    </View>
  );
});
