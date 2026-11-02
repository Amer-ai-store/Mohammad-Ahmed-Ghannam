// Web variant: same capture page inside a sandboxed iframe.
import React, { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { captureHtml } from "./captureHtml";

export function CaptureButton({ label, color, onPhoto, onError }: { label: string; color: string; onPhoto: (dataUrl: string) => void; onError: (message: string) => void }) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const html = useMemo(() => captureHtml(label, color), [label, color]);
  const cb = useRef({ onPhoto, onError });
  useEffect(() => { cb.current = { onPhoto, onError }; }, [onPhoto, onError]);
  useEffect(() => {
    const l = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data !== "string") return;
      try { const m = JSON.parse(e.data); if (m.type === "photo") cb.current.onPhoto(m.dataUrl); else cb.current.onError("تعذّر قراءة الصورة"); } catch { /* ignore */ }
    };
    window.addEventListener("message", l);
    return () => window.removeEventListener("message", l);
  }, []);
  return (
    <View style={{ flex: 1, height: 56, borderRadius: 999, overflow: "hidden" }} testID="capture-photo">
      {React.createElement("iframe", { ref: frame, srcDoc: html, title: label, sandbox: "allow-scripts", style: { border: 0, width: "100%", height: "100%" } })}
    </View>
  );
}
