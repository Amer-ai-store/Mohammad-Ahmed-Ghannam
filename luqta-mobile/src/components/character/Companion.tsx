// The 3D companion placed in its own layout slot on each screen (never on top of
// buttons). It walks into the slot when a screen opens, then plays the screen pose.
// It is display-only: it has no access to the cart, checkout or any store action.
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Animated, Image, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import { avatarHtml, type AvatarAction } from "./characterHtml";
import { AvatarSurface, type SurfaceHandle } from "./AvatarSurface";
import { posePosters } from "../../lib/designAssets";
import { toAvatarProfile, useCharacter } from "../../lib/character";

export type CompanionHandle = {
  play: (action: AvatarAction) => void;
  processFace: (dataUrl: string) => Promise<{ dataUrl: string; skin: string; hair: string }>;
  probe: () => Promise<Record<string, unknown>>;
};
type Props = {
  action: AvatarAction;
  /** slot height in dp at the default 25 % size */
  base?: number;
  aspect?: number;
  enterFrom?: "left" | "right" | "none";
  /** fixed size (ignores the size preference) — used by the customise/preview screens */
  fixedHeight?: number;
  testID?: string;
};

const posterFor = (a: AvatarAction) => (posePosters as Record<string, number>)[a] ?? (a === "wake" || a === "stop" || a === "come" || a === "wave" ? posePosters.idle : posePosters.walk);

export const Companion = forwardRef<CompanionHandle, Props>(function Companion({ action, base = 132, aspect = 0.62, enterFrom = "left", fixedHeight, testID = "companion" }, ref) {
  const { profile, systemReduceMotion } = useCharacter();
  const { height: screenH } = useWindowDimensions();
  const reduce = profile.reduceMotion || systemReduceMotion;
  const surface = useRef<SurfaceHandle>(null);
  const [focused, setFocused] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef(new Map<string, (v: Record<string, unknown>) => void>());
  const slide = useRef(new Animated.Value(enterFrom === "none" || reduce ? 0 : 1)).current;
  useFocusEffect(useCallback(() => { setFocused(true); return () => { setFocused(false); setReady(false); readyRef.current = false; }; }, []));

  // size: 25 % → base height (≈ a quarter of the reference slot), 100 % → 2.2× base, capped to 45 % of the screen
  const h = fixedHeight ?? Math.min(screenH * 0.45, base * (1 + (profile.scale - 0.25) * 1.6));
  const w = h * aspect;
  const initialAction = enterFrom !== "none" && !reduce ? (action === "cart" ? "cart" : "walk") : action;
  // HTML is built once per mount; later changes are sent as messages (no reload).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => avatarHtml({ action: initialAction, profile: toAvatarProfile(profile), reduceMotion: reduce, sound: profile.sound }), [focused]);

  const readyRef = useRef(false);
  const queue = useRef<object[]>([]);
  const send = (m: object) => { if (readyRef.current) surface.current?.send(m); else queue.current.push(m); };
  useEffect(() => { readyRef.current = ready; if (ready && queue.current.length) { const q = queue.current; queue.current = []; q.forEach((m) => surface.current?.send(m)); } }, [ready]);
  useEffect(() => { if (ready) send({ type: "profile", profile: toAvatarProfile(profile) }); }, [ready, profile]);
  useEffect(() => { if (ready) send({ type: "reduceMotion", value: reduce }); }, [ready, reduce]);
  useEffect(() => { if (ready) send({ type: "sound", value: profile.sound }); }, [ready, profile.sound]);
  useEffect(() => {
    if (!ready) return;
    if (enterFrom === "none" || reduce) { send({ type: "action", action }); return; }
    // walk into the slot, facing the travel direction, then turn and play the pose
    send({ type: "facing", yaw: enterFrom === "left" ? 1.3 : -1.3 });
    send({ type: "action", action: action === "cart" ? "cart" : "walk" });
    slide.setValue(1);
    Animated.timing(slide, { toValue: 0, duration: 1100, useNativeDriver: true }).start(() => {
      send({ type: "facing", yaw: 0.25 });
      send({ type: "action", action });
    });
  }, [ready, action, enterFrom, reduce, slide]);

  useImperativeHandle(ref, () => ({
    play: (a) => send({ type: "action", action: a }),
    processFace: (dataUrl) => new Promise((resolve, reject) => {
      const id = `f${Date.now()}`;
      const timer = setTimeout(() => { pending.current.delete(id); reject(new Error("انتهت مهلة معالجة الصورة")); }, 30000);
      pending.current.set(id, (v) => { clearTimeout(timer); if (v.type === "faceProcessed") resolve(v as { dataUrl: string; skin: string; hair: string }); else reject(new Error("تعذّرت معالجة الصورة")); });
      send({ type: "processFace", dataUrl, id });
    }),
    probe: () => new Promise((resolve) => { const id = `p${Date.now()}`; pending.current.set(id, resolve); send({ type: "probe", id }); }),
  }), []);

  const onMessage = (data: string) => {
    let m: Record<string, unknown>;
    try { m = JSON.parse(data); } catch { return; }
    if (m.type === "ready") setReady(true);
    if (m.type === "error" && (m.code === "NO_WEBGL" || m.code === "NO_THREE" || m.code === "WEBVIEW_GONE" || m.code === "WEBVIEW_LOAD")) setFailed(true);
    const id = typeof m.id === "string" ? m.id : "";
    if (id && pending.current.has(id)) { pending.current.get(id)!(m); pending.current.delete(id); }
  };

  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [0, enterFrom === "right" ? 70 : -70] });
  const use3d = profile.enabled3d && !failed;
  return (
    <View pointerEvents="none" style={{ width: w, height: h }} testID={testID} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {use3d && focused ? (
        <Animated.View style={{ flex: 1, transform: [{ translateX }] }}>
          <AvatarSurface ref={surface} html={html} onMessage={onMessage} />
        </Animated.View>
      ) : (
        <Image source={posterFor(action)} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
      )}
    </View>
  );
});
