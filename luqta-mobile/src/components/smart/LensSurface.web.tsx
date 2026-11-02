// Web build: same page in an iframe allowed to use the camera/microphone.
import React, { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { lensHtml, type LensMode } from "./lensHtml";
import type { LensMessage } from "./LensSurface";
export type { LensMessage } from "./LensSurface";
const LABELS = { capture: "التقاط", stop: "إيقاف", record: "اضغط وتحدث", fallback: "اختيار صورة" };

export function LensSurface({ mode, onMessage, height = 340 }: { mode: LensMode; onMessage: (m: LensMessage) => void; height?: number }) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const handler = useRef(onMessage);
  useEffect(() => { handler.current = onMessage; }, [onMessage]);
  useEffect(() => {
    const listener = (e: MessageEvent) => { if (e.source === frame.current?.contentWindow && typeof e.data === "string") { try { handler.current(JSON.parse(e.data)); } catch { /* ignore */ } } };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);
  const html = useMemo(() => lensHtml(mode, LABELS), [mode]);
  return (
    <View style={{ height, borderRadius: 24, overflow: "hidden", backgroundColor: "#130050" }} testID={`lens-${mode}`}>
      {React.createElement("iframe", { ref: frame, srcDoc: html, title: "الكاميرا", sandbox: "allow-scripts", allow: "camera; microphone", style: { border: 0, width: "100%", height: "100%" } })}
    </View>
  );
}
