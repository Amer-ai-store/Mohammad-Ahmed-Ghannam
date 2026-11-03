import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import { api } from "./api";
import { useSession } from "./session";

export type RobotMotion = "idle" | "wave" | "walk" | "jump" | "come" | "stop" | "dance" | "sleep" | "sad" | "talk";
export type RobotOutfit = "none" | "scarf" | "cape" | "bowtie" | "hoodie";
export type RobotAccessory = "none" | "cap" | "crown" | "glasses" | "headphones" | "flower";
export type RobotPrefs = {
  name: string; color: string; outfit: RobotOutfit; accessory: RobotAccessory; size: number;
  reduceMotion: boolean; voice: boolean; motion: Exclude<RobotMotion, "idle" | "sleep" | "sad" | "talk">; faceConsent: boolean;
};
export type RobotEvent = "cart" | "favorite" | "order" | "error" | "checkin" | "hello" | "search" | "reward";
export const ROBOT_DEFAULTS: RobotPrefs = { name: "لُقطي", color: "#7C5CFF", outfit: "none", accessory: "none", size: 1, reduceMotion: false, voice: true, motion: "wave", faceConsent: false };
export const ROBOT_COLORS = ["#7C5CFF", "#FF6B4A", "#22B07D", "#2F80ED", "#F2A900", "#E0559B", "#3B3F5C"];
const REACTIONS: Record<RobotEvent, { motion: RobotMotion; message: string }> = {
  cart: { motion: "jump", message: "أضفتها للسلة! 🎉" },
  favorite: { motion: "wave", message: "حفظتها في مفضلتك 💜" },
  order: { motion: "dance", message: "طلبك في الطريق! 🛵" },
  error: { motion: "sad", message: "أوه! حاول مرة ثانية" },
  checkin: { motion: "jump", message: "حضورك اليوم سجلناه ⭐" },
  hello: { motion: "wave", message: "أهلًا! شو بدك اليوم؟" },
  search: { motion: "come", message: "خليني أدور معك 🔎" },
  reward: { motion: "dance", message: "نقاطك زادت! 🏆" },
};
const PREFS_KEY = "luqta-robot-v1";
const FACE_KEY = "luqta-robot-face-v1";

type RobotState = {
  prefs: RobotPrefs; face: string | null; reaction: { motion: RobotMotion; message: string; at: number } | null;
  systemReduceMotion: boolean; reduceMotion: boolean;
  update: (changes: Partial<RobotPrefs>) => Promise<void>;
  setFace: (dataUri: string | null) => Promise<void>;
  react: (event: RobotEvent, message?: string) => void;
  play: (motion: RobotMotion, message?: string) => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  speaking: boolean;
};
const Context = createContext<RobotState | null>(null);
const valid = (p: Partial<RobotPrefs>): RobotPrefs => ({ ...ROBOT_DEFAULTS, ...Object.fromEntries(Object.entries(p).filter(([k]) => k in ROBOT_DEFAULTS)) } as RobotPrefs);

export function RobotProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const [prefs, setPrefs] = useState<RobotPrefs>(ROBOT_DEFAULTS);
  const [face, setFaceState] = useState<string | null>(null);
  const [reaction, setReaction] = useState<RobotState["reaction"]>(null);
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    AsyncStorage.multiGet([PREFS_KEY, FACE_KEY]).then(([[, saved], [, savedFace]]) => {
      if (saved) { try { setPrefs(valid(JSON.parse(saved))); } catch { /* ignore a corrupted cache */ } }
      if (savedFace && savedFace.startsWith("data:image/")) setFaceState(savedFace);
    }).catch(() => {});
    AccessibilityInfo.isReduceMotionEnabled().then(setSystemReduceMotion).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setSystemReduceMotion);
    return () => subscription.remove();
  }, []);
  // Signed-in shoppers keep their character on every device.
  useEffect(() => {
    if (!user) return;
    let active = true;
    api.get<{ preferences: { robot: RobotPrefs } }>("/me/preferences").then((r) => { if (active && r.preferences?.robot) { const next = valid(r.preferences.robot); setPrefs(next); AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {}); } }).catch(() => {});
    return () => { active = false; };
  }, [user]);
  const update = useCallback(async (changes: Partial<RobotPrefs>) => {
    const next = valid({ ...prefs, ...changes });
    setPrefs(next);
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {});
    if (user) await api.patch("/me/preferences", { robot: next });
  }, [prefs, user]);
  const setFace = useCallback(async (dataUri: string | null) => {
    setFaceState(dataUri);
    if (dataUri) await AsyncStorage.setItem(FACE_KEY, dataUri); else await AsyncStorage.removeItem(FACE_KEY);
  }, []);
  const play = useCallback((motion: RobotMotion, message = "") => {
    if (timer.current) clearTimeout(timer.current);
    setReaction({ motion, message, at: Date.now() });
    timer.current = setTimeout(() => setReaction(null), motion === "stop" ? 6000 : 3200);
  }, []);
  const speak = useCallback((text: string) => {
    if (!prefs.voice || !text) return;
    try {
      Speech.stop();
      setSpeaking(true);
      Speech.speak(text.replace(/[\p{Extended_Pictographic}]/gu, ""), { language: /[؀-ۿ]/.test(text) ? "ar" : "en-US", pitch: 1.35, rate: Platform.OS === "web" ? 1 : 0.95, onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => setSpeaking(false) });
    } catch { setSpeaking(false); }
  }, [prefs.voice]);
  const stopSpeaking = useCallback(() => { try { Speech.stop(); } catch { /* nothing is playing */ } setSpeaking(false); }, []);
  const react = useCallback((event: RobotEvent, message?: string) => { const r = REACTIONS[event]; play(r.motion, message ?? r.message); }, [play]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const value = useMemo<RobotState>(() => ({ prefs, face, reaction, systemReduceMotion, reduceMotion: prefs.reduceMotion || systemReduceMotion, update, setFace, react, play, speak, stopSpeaking, speaking }), [prefs, face, reaction, systemReduceMotion, update, setFace, react, play, speak, stopSpeaking, speaking]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useRobot() {
  const value = useContext(Context);
  if (!value) throw new Error("RobotProvider is required");
  return value;
}
